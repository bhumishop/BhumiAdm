<template>
  <div class="payments-view">
    <div class="page-header">
      <div>
        <span class="page-label">PAYMENTS</span>
        <h1 class="page-title">{{ paymentStats.total }} TRANSACOES</h1>
      </div>
      <div class="header-actions">
        <button @click="refreshPayments" class="btn-flat">
          REFRESH
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">TOTAL</span>
        <span class="stat-value">{{ paymentStats.total }}</span>
        <div class="stat-bar" style="background: var(--purple);"></div>
      </div>
      <div class="stat-card">
        <span class="stat-label">PENDING</span>
        <span class="stat-value">{{ paymentStats.pending }}</span>
        <div class="stat-bar" style="background: var(--yellow);"></div>
      </div>
      <div class="stat-card">
        <span class="stat-label">PAID</span>
        <span class="stat-value">{{ paymentStats.paid }}</span>
        <div class="stat-bar" style="background: var(--green);"></div>
      </div>
      <div class="stat-card">
        <span class="stat-label">REVENUE</span>
        <span class="stat-value revenue">R$ {{ paymentStats.totalRevenue.toFixed(2).replace('.', ',') }}</span>
        <div class="stat-bar" style="background: var(--cyan);"></div>
      </div>
    </div>

    <div class="filters">
      <select v-model="filterMethod" class="flat-select">
        <option value="">ALL_METHODS</option>
        <option v-for="method in paymentMethods" :key="method" :value="method">
          {{ getPaymentMethodName(method) }}
        </option>
      </select>
      <select v-model="filterStatus" class="flat-select">
        <option value="">ALL_STATUSES</option>
        <option v-for="status in paymentStatuses" :key="status" :value="status">
          {{ getPaymentStatusName(status) }}
        </option>
      </select>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="SEARCH_CUSTOMER_ORDER..."
        class="flat-input"
      >
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span class="loading-text">LOADING_PAYMENTS...</span>
    </div>

    <div v-else-if="filteredPayments.length === 0" class="empty-state">
      <p>NO_PAYMENTS_FOUND</p>
    </div>

    <div v-else class="table-wrapper">
      <table class="flat-table">
        <thead>
          <tr>
            <th>ORDER</th>
            <th>CUSTOMER</th>
            <th>METHOD</th>
            <th>STATUS</th>
            <th>AMOUNT</th>
            <th>DATE</th>
            <th>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="payment in filteredPayments" :key="payment.id">
            <td class="order-id">{{ payment.order_number || `#${payment.id}` }}</td>
            <td class="customer-cell">
              <span class="customer-name">{{ payment.customer_name }}</span>
              <span class="customer-email">{{ payment.customer_email }}</span>
            </td>
            <td>
              <span class="method-tag">
                {{ getPaymentMethodName(payment.payment_method) }}
              </span>
            </td>
            <td>
              <span :class="['status-tag', getPaymentStatusColor(payment.payment_status)]">
                {{ getPaymentStatusName(payment.payment_status) }}
              </span>
            </td>
            <td class="amount-cell">R$ {{ payment.total?.toFixed(2).replace('.', ',') }}</td>
            <td class="date-cell">{{ formatDate(payment.created_at) }}</td>
            <td class="actions-cell">
              <button @click="viewPayment(payment)" class="btn-action">VIEW</button>
              <button
                v-if="payment.payment_status === 'pending'"
                @click="checkPixStatus(payment.payment_reference)"
                class="btn-action-check"
              >CHECK_PIX</button>
              <button
                v-if="payment.payment_status !== 'paid'"
                @click="markAsPaid(payment.id)"
                class="btn-action-paid"
              >MARK_PAID</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="selectedPayment" class="modal-overlay" @click.self="closePaymentModal">
      <div class="flat-modal">
        <div class="modal-header">
          <div>
            <span class="modal-label">PAYMENT_DETAILS</span>
            <h2>{{ selectedPayment.order_number || `#${selectedPayment.id}` }}</h2>
          </div>
          <button @click="closePaymentModal" class="close-btn">X</button>
        </div>

        <div class="modal-body">
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-label">CUSTOMER</span>
              <span class="detail-value">{{ selectedPayment.customer_name }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">EMAIL</span>
              <span class="detail-value">{{ selectedPayment.customer_email }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">METHOD</span>
              <span class="detail-value">{{ getPaymentMethodName(selectedPayment.payment_method) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">STATUS</span>
              <span :class="['status-tag', getPaymentStatusColor(selectedPayment.payment_status)]">
                {{ getPaymentStatusName(selectedPayment.payment_status) }}
              </span>
            </div>
            <div class="detail-item highlight">
              <span class="detail-label">AMOUNT</span>
              <span class="detail-value amount">R$ {{ selectedPayment.total?.toFixed(2).replace('.', ',') }}</span>
            </div>
            <div class="detail-item" v-if="selectedPayment.payment_provider">
              <span class="detail-label">PROVIDER</span>
              <span class="detail-value">{{ selectedPayment.payment_provider }}</span>
            </div>
            <div class="detail-item" v-if="selectedPayment.payment_reference">
              <span class="detail-label">REFERENCE</span>
              <span class="detail-value mono">{{ selectedPayment.payment_reference }}</span>
            </div>
            <div class="detail-item" v-if="selectedPayment.payment_paid_at">
              <span class="detail-label">PAID_AT</span>
              <span class="detail-value">{{ formatDateTime(selectedPayment.payment_paid_at) }}</span>
            </div>
            <div class="detail-item" v-if="selectedPayment.customer_tax_id">
              <span class="detail-label">CPF_CNPJ</span>
              <span class="detail-value mono">{{ selectedPayment.customer_tax_id }}</span>
            </div>
          </div>

          <div class="modal-actions">
            <button
              v-if="selectedPayment.payment_status !== 'paid'"
              @click="markAsPaid(selectedPayment.id)"
              class="btn-primary"
            >
              MARK_AS_PAID
            </button>
            <button @click="closePaymentModal" class="btn-flat">CLOSE</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePaymentStore } from '../stores/payments'

const paymentStore = usePaymentStore()

const filterMethod = ref('')
const filterStatus = ref('')
const searchQuery = ref('')

const payments = computed(() => paymentStore.payments)
const loading = computed(() => paymentStore.loading)
const selectedPayment = computed(() => paymentStore.selectedPayment)
const paymentMethods = computed(() => paymentStore.paymentMethods)
const paymentStatuses = computed(() => paymentStore.paymentStatuses)
const paymentStats = computed(() => paymentStore.paymentStats)

const filteredPayments = computed(() => {
  let result = payments.value

  if (filterMethod.value) {
    result = result.filter(p => p.payment_method === filterMethod.value)
  }

  if (filterStatus.value) {
    result = result.filter(p => p.payment_status === filterStatus.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      p.customer_name?.toLowerCase().includes(query) ||
      p.customer_email?.toLowerCase().includes(query) ||
      p.order_number?.toLowerCase().includes(query) ||
      p.id.toString().includes(query)
    )
  }

  return result
})

function formatDate(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR')
}

function formatDateTime(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('pt-BR')
}

async function refreshPayments() {
  await paymentStore.fetchPayments()
}

async function viewPayment(payment) {
  await paymentStore.fetchPaymentById(payment.id)
}

async function markAsPaid(orderId) {
  try {
    await paymentStore.updatePaymentStatus(orderId, 'paid')
    await refreshPayments()
  } catch (err) {
    console.error('Error marking as paid:', err)
  }
}

async function checkPixStatus(paymentReference) {
  if (!paymentReference) return

  try {
    const status = await paymentStore.checkPixStatus(paymentReference)
    console.log('PIX Status:', status)
  } catch (err) {
    console.error('Error checking PIX status:', err)
  }
}

function getPaymentMethodName(method) {
  return paymentStore.getPaymentMethodName(method)
}

function getPaymentStatusName(status) {
  return paymentStore.getPaymentStatusName(status)
}

function getPaymentStatusColor(status) {
  return paymentStore.getPaymentStatusColor(status)
}

function closePaymentModal() {
  paymentStore.selectedPayment = null
}

onMounted(async () => {
  await paymentStore.fetchPayments()
})
</script>

<style scoped>
.payments-view {
  padding: var(--space-6);
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
  gap: var(--space-4);
}

.page-label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
  letter-spacing: 2px;
  display: block;
  margin-bottom: var(--space-1);
}

.page-title {
  font-family: var(--font-display);
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -1px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.stat-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 0;
  padding: var(--space-4);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--purple);
}

.stat-card:nth-child(2)::before { background: var(--yellow); }
.stat-card:nth-child(3)::before { background: var(--green); }
.stat-card:nth-child(4)::before { background: var(--cyan); }

.stat-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: var(--text-muted);
  display: block;
  margin-bottom: var(--space-2);
}

.stat-value {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  display: block;
}

.stat-value.revenue {
  color: var(--cyan);
}

.filters {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
}

.flat-select {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 0;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 1px;
  cursor: pointer;
}

.flat-select:focus {
  outline: none;
  border-color: var(--purple);
}

.flat-input {
  flex: 1;
  min-width: 250px;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 0;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 1px;
}

.flat-input:focus {
  outline: none;
  border-color: var(--purple);
}

.flat-input::placeholder {
  color: var(--text-muted);
}

.loading-state {
  text-align: center;
  padding: var(--space-16);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 2px solid var(--border-color);
  border-top-color: var(--purple);
  margin: 0 auto var(--space-4);
}

.loading-text {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--text-muted);
  letter-spacing: 2px;
}

.empty-state {
  text-align: center;
  padding: var(--space-16);
  border: 1px dashed var(--border-color);
}

.empty-state p {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--text-muted);
  letter-spacing: 2px;
  margin: 0;
}

.table-wrapper {
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  overflow-x: auto;
}

.flat-table {
  width: 100%;
  border-collapse: collapse;
}

.flat-table th {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: var(--text-muted);
}

.flat-table td {
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  vertical-align: middle;
}

.flat-table tbody tr:hover {
  background: var(--bg-elevated);
}

.order-id {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--purple);
  font-size: 0.875rem;
}

.customer-name {
  display: block;
  font-weight: 600;
  margin-bottom: var(--space-1);
}

.customer-email {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.method-tag {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 0;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 1px;
  color: var(--text-secondary);
}

.status-tag {
  padding: var(--space-1) var(--space-2);
  border-radius: 0;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 1px;
  display: inline-block;
}

.status-tag.pending,
.status-tag.warning {
  background: var(--yellow);
  color: var(--bg-base);
}

.status-tag.paid,
.status-tag.success,
.status-tag.completed {
  background: var(--green);
  color: var(--bg-base);
}

.status-tag.failed,
.status-tag.error,
.status-tag.cancelled {
  background: var(--red);
  color: white;
}

.status-tag.refunded,
.status-tag.info {
  background: var(--cyan);
  color: var(--bg-base);
}

.status-tag.processing,
.status-tag.neutral {
  background: var(--purple);
  color: white;
}

.amount-cell {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 1rem;
  color: var(--green);
}

.date-cell {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.actions-cell {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.btn-action,
.btn-action-check,
.btn-action-paid {
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-action:hover {
  background: var(--purple);
  color: white;
  border-color: var(--purple);
}

.btn-action-check:hover {
  background: var(--cyan);
  color: var(--bg-base);
  border-color: var(--cyan);
}

.btn-action-paid:hover {
  background: var(--green);
  color: var(--bg-base);
  border-color: var(--green);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.flat-modal {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 0;
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.flat-modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--purple);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--space-6);
  border-bottom: 1px solid var(--border-color);
}

.modal-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
  letter-spacing: 2px;
  display: block;
  margin-bottom: var(--space-1);
}

.modal-header h2 {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: var(--red);
  color: white;
  border-color: var(--red);
}

.modal-body {
  padding: var(--space-6);
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.detail-item {
  padding: var(--space-3);
  background: var(--bg-elevated);
  border-left: 2px solid var(--border-color);
}

.detail-item.highlight {
  border-left-color: var(--green);
  background: rgba(34, 197, 94, 0.05);
}

.detail-label {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
  letter-spacing: 1px;
  margin-bottom: var(--space-1);
}

.detail-value {
  display: block;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.detail-value.amount {
  font-family: var(--font-mono);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--green);
}

.detail-value.mono {
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.modal-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

/* Responsive */
@media (max-width: 1024px) {
  .details-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .payments-view {
    padding: var(--space-4);
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .page-title {
    font-size: 1.75rem;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .filters {
    flex-direction: column;
  }

  .flat-select,
  .flat-input {
    width: 100%;
  }

  .flat-table {
    font-size: 0.8rem;
  }

  .flat-table th,
  .flat-table td {
    padding: var(--space-2);
  }

  .customer-email {
    display: none;
  }

  .actions-cell {
    flex-direction: column;
  }

  .flat-modal {
    margin: var(--space-2);
  }

  .modal-header,
  .modal-body {
    padding: var(--space-4);
  }
}
</style>
