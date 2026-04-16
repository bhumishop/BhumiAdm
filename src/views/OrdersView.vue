<template>
  <div class="orders-page">
    <div class="page-header">
      <div>
        <span class="page-label">ORDERS</span>
        <h1 class="page-title">{{ orderStore.orders.length }} PEDIDOS</h1>
      </div>
      <div class="header-actions">
        <button class="btn-flat" @click="exportCSV">
          EXPORT CSV
        </button>
        <button class="btn-flat" @click="exportPDF">
          EXPORT PDF
        </button>
        <button class="btn-primary" @click="orderStore.fetchOrders()">
          REFRESH
        </button>
      </div>
    </div>

    <div v-if="orderStore.loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span class="loading-text">CARREGANDO PEDIDOS...</span>
    </div>

    <div v-else-if="orderStore.error" class="error-state">
      <span class="error-code">ERROR</span>
      <p>{{ orderStore.error }}</p>
    </div>

    <div v-else-if="orderStore.orders.length === 0" class="empty-state">
      <div class="empty-icon"></div>
      <p>NENHUM PEDIDO ENCONTRADO</p>
    </div>

    <div v-else class="orders-content">
      <div class="orders-table-wrapper">
        <table class="flat-table">
          <thead>
            <tr>
              <th>ORDER_ID</th>
              <th>DATE</th>
              <th>CUSTOMER</th>
              <th>TOTAL</th>
              <th>PAYMENT</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orderStore.orders" :key="order.id" class="order-row">
              <td class="order-id">{{ order.order_number }}</td>
              <td class="date-cell">{{ formatDate(order.created_at) }}</td>
              <td class="customer-cell">
                <span class="customer-name">{{ order.customer_name }}</span>
                <span class="customer-email">{{ order.customer_email }}</span>
              </td>
              <td class="total-cell">R$ {{ formatPrice(order.total) }}</td>
              <td class="payment-cell">{{ getPaymentMethodLabel(order.payment_method) }}</td>
              <td class="status-cell">
                <span :class="['badge', getStatusBadgeClass(order.status)]">
                  {{ getStatusLabel(order.status) }}
                </span>
              </td>
              <td class="actions-cell">
                <button class="btn-icon" @click="openOrderDetails(order)" title="View details">
                  VIEW
                </button>
                <select
                  :value="order.status"
                  @change="updateStatus(order.id, $event.target.value)"
                  class="flat-select"
                >
                  <option value="pending">PENDING</option>
                  <option value="processing">PROCESSING</option>
                  <option value="paid">PAID</option>
                  <option value="shipped">SHIPPED</option>
                  <option value="delivered">DELIVERED</option>
                  <option value="cancelled">CANCELLED</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="selectedOrder" class="modal-overlay" @click.self="selectedOrder = null">
      <div class="flat-modal">
        <div class="modal-header">
          <div>
            <span class="modal-label">ORDER_DETAILS</span>
            <h2>{{ selectedOrder.order_number }}</h2>
          </div>
          <button class="close-btn" @click="selectedOrder = null">&times;</button>
        </div>

        <div class="modal-body">
          <div class="detail-section">
            <h3 class="section-title">CUSTOMER_INFORMATION</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">NAME</span>
                <span class="info-value">{{ selectedOrder.customer_name }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">EMAIL</span>
                <span class="info-value">{{ selectedOrder.customer_email }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">PHONE</span>
                <span class="info-value">{{ selectedOrder.customer_phone || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">ADDRESS</span>
                <span class="info-value">{{ selectedOrder.shipping_address || '-' }}</span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h3 class="section-title">ORDER_ITEMS</h3>
            <table class="items-table">
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>PRICE</th>
                  <th>QTY</th>
                  <th>SIZE</th>
                  <th>SUBTOTAL</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in selectedOrder.order_items" :key="item.id">
                  <td>{{ item.product_name }}</td>
                  <td>R$ {{ formatPrice(item.product_price) }}</td>
                  <td>{{ item.quantity }}</td>
                  <td>{{ item.size || '-' }}</td>
                  <td>R$ {{ formatPrice(item.product_price * item.quantity) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4">TOTAL</td>
                  <td class="total-value">R$ {{ formatPrice(selectedOrder.total) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="detail-section">
            <h3 class="section-title">STATUS_HISTORY</h3>
            <div class="status-timeline">
              <div
                v-for="(item, index) in selectedOrder.order_status_history"
                :key="index"
                class="timeline-item"
              >
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span :class="['badge', 'badge-sm', getStatusBadgeClass(item.status)]">{{ getStatusLabel(item.status) }}</span>
                    <span class="timeline-date">{{ formatDate(item.created_at) }}</span>
                  </div>
                  <p class="timeline-desc">{{ item.description }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { useOrderStore } from '../stores/orders'

const orderStore = useOrderStore()
const selectedOrder = ref(null)

onMounted(() => {
  orderStore.fetchOrders()
})

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatPrice(price) {
  return Number(price).toFixed(2).replace('.', ',')
}

function getPaymentMethodLabel(method) {
  const labels = {
    pix: 'PIX',
    mercadopago: 'MERCADOPAGO',
    paypal: 'PAYPAL',
    whatsapp: 'WHATSAPP'
  }
  return labels[method] || method.toUpperCase()
}

function getStatusLabel(status) {
  const labels = {
    pending: 'PENDING',
    processing: 'PROCESSING',
    paid: 'PAID',
    shipped: 'SHIPPED',
    delivered: 'DELIVERED',
    cancelled: 'CANCELLED'
  }
  return labels[status] || status.toUpperCase()
}

function getStatusBadgeClass(status) {
  const classes = {
    pending: 'badge-warning',
    processing: 'badge-info',
    paid: 'badge-success',
    shipped: 'badge-info',
    delivered: 'badge-success',
    cancelled: 'badge-danger'
  }
  return classes[status] || 'badge-gold'
}

function openOrderDetails(order) {
  selectedOrder.value = order
}

async function updateStatus(orderId, newStatus) {
  const descriptions = {
    pending: 'Awaiting payment',
    processing: 'Payment under review',
    paid: 'Payment confirmed',
    shipped: 'Order shipped',
    delivered: 'Order delivered',
    cancelled: 'Order cancelled'
  }

  try {
    await orderStore.updateOrderStatus(orderId, newStatus, descriptions[newStatus])
  } catch (error) {
    console.error('Error updating status:', error)
  }
}

function exportCSV() {
  const orders = orderStore.orders
  const headers = ['Nº Pedido', 'Data', 'Cliente', 'Email', 'Telefone', 'Total', 'Pagamento', 'Status']
  const rows = orders.map(o => [
    o.order_number,
    formatDate(o.created_at),
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    o.total,
    getPaymentMethodLabel(o.payment_method),
    getStatusLabel(o.status)
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  const date = new Date().toISOString().split('T')[0]
  link.setAttribute('href', url)
  link.setAttribute('download', `bhumi-pedidos-${date}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function exportPDF() {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF()
  const date = new Date().toLocaleDateString('pt-BR')

  doc.setFontSize(18)
  doc.text('BhumiShop - Order Report', 14, 22)

  doc.setFontSize(10)
  doc.text(`Date: ${date}`, 14, 30)
  doc.text(`Total orders: ${orderStore.orders.length}`, 14, 36)

  const tableData = orderStore.orders.map(o => [
    o.order_number,
    formatDate(o.created_at),
    o.customer_name,
    `R$ ${formatPrice(o.total)}`,
    getPaymentMethodLabel(o.payment_method),
    getStatusLabel(o.status)
  ])

  doc.autoTable({
    head: [['Order_ID', 'Date', 'Customer', 'Total', 'Payment', 'Status']],
    body: tableData,
    startY: 42,
    styles: { fontSize: 8, font: 'Courier' },
    headStyles: { fillColor: [212, 175, 55], textColor: 0, fontStyle: 'bold' }
  })

  doc.save(`bhumi-orders-${new Date().toISOString().split('T')[0]}.pdf`)
}
</script>

<style scoped>
/* ============================================
   LUXURY AMOLED DESIGN SYSTEM - Orders View
   ============================================ */

.orders-page {
  padding: var(--space-6);
  min-height: 100vh;
  background: var(--bg-base);
  font-family: var(--font-sans);
  color: var(--text-primary);
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-8);
  flex-wrap: wrap;
  gap: var(--space-4);
}

.page-label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
  letter-spacing: 2px;
  text-transform: uppercase;
  display: block;
  margin-bottom: var(--space-1);
}

.page-title {
  font-family: var(--font-display);
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -1px;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* Buttons */
.btn-flat {
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 1px;
  cursor: pointer;
  transition: var(--transition-fast);
}

.btn-flat:hover {
  background: var(--bg-hover);
  border-color: var(--gold);
  color: var(--gold);
}

.btn-primary {
  padding: var(--space-2) var(--space-4);
  background: var(--gold-bg);
  border: 1px solid var(--gold-border);
  border-radius: var(--radius-sm);
  color: var(--gold);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 1px;
  cursor: pointer;
  transition: var(--transition-fast);
}

.btn-primary:hover {
  background: var(--gold);
  color: var(--bg-base);
}

/* State Messages */
.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: var(--space-16);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 2px solid var(--border);
  border-top-color: var(--gold);
  border-radius: 50%;
  margin: 0 auto var(--space-4);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--text-muted);
  letter-spacing: 2px;
}

.error-state {
  border: 1px solid var(--danger-border);
  background: var(--danger-bg);
  padding: var(--space-8);
  border-radius: var(--radius);
}

.error-code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--danger);
  letter-spacing: 2px;
  display: block;
  margin-bottom: var(--space-2);
}

.error-state p {
  color: var(--text-secondary);
  margin: 0;
}

.empty-state {
  border: 1px dashed var(--border-light);
  padding: var(--space-12);
  border-radius: var(--radius);
}

.empty-state p {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--text-muted);
  letter-spacing: 2px;
  margin: 0;
}

/* Table */
.orders-table-wrapper {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-surface);
  overflow: hidden;
}

.flat-table {
  width: 100%;
  border-collapse: collapse;
}

.flat-table th {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: var(--text-muted);
}

.flat-table td {
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
  vertical-align: middle;
}

.order-row {
  transition: var(--transition-fast);
}

.order-row:hover {
  background: var(--bg-hover);
}

.order-id {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--gold);
  font-size: 0.875rem;
}

.date-cell {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.customer-name {
  display: block;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.customer-email {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.total-cell {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--success);
  font-size: 1rem;
}

.payment-cell {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* Status Badges */
.badge {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  border-radius: var(--radius-sm);
  text-transform: uppercase;
}

.badge-sm {
  font-size: 0.65rem;
  padding: var(--space-0\.5) var(--space-1);
}

.badge-gold {
  background: var(--gold-bg);
  color: var(--gold);
  border: 1px solid var(--gold-border);
}

.badge-success {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.badge-danger {
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-border);
}

.badge-info {
  background: var(--info-bg);
  color: var(--info);
  border: 1px solid var(--info-border);
}

.badge-warning {
  background: var(--warning-bg);
  color: var(--warning);
  border: 1px solid var(--warning-border);
}

/* Actions */
.actions-cell {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.btn-icon {
  padding: var(--space-1) var(--space-3);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--info);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 1px;
  cursor: pointer;
  transition: var(--transition-fast);
}

.btn-icon:hover {
  background: var(--info);
  color: var(--bg-base);
  border-color: var(--info);
}

.flat-select {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  cursor: pointer;
  transition: var(--transition-fast);
}

.flat-select:focus {
  outline: none;
  border-color: var(--gold);
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
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  width: 100%;
  max-width: 900px;
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
  background: linear-gradient(90deg, var(--gold), var(--gold-light));
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--space-6);
  border-bottom: 1px solid var(--border);
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
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  transition: var(--transition-fast);
}

.close-btn:hover {
  background: var(--danger);
  color: var(--bg-base);
  border-color: var(--danger);
}

.modal-body {
  padding: var(--space-6);
}

.detail-section {
  margin-bottom: var(--space-8);
}

.detail-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-family: var(--font-display);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--text-secondary);
  margin: 0 0 var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-light);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.info-item {
  padding: var(--space-3);
  background: var(--bg-elevated);
  border-left: 2px solid var(--gold);
  border-radius: var(--radius-sm);
}

.info-item:nth-child(2) { border-left-color: var(--success); }
.info-item:nth-child(3) { border-left-color: var(--info); }
.info-item:nth-child(4) { border-left-color: var(--warning); }

.info-label {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
  letter-spacing: 1px;
  margin-bottom: var(--space-1);
}

.info-value {
  display: block;
  font-size: 0.9rem;
  color: var(--text-primary);
}

/* Items Table */
.items-table {
  width: 100%;
  border-collapse: collapse;
}

.items-table th {
  padding: var(--space-3) var(--space-2);
  text-align: left;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--text-muted);
}

.items-table td {
  padding: var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--border-light);
  font-size: 0.85rem;
  color: var(--text-primary);
}

.items-table tfoot td {
  padding-top: var(--space-4);
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--text-primary);
  border-top: 2px solid var(--border);
}

.total-value {
  color: var(--success);
  font-size: 1.1rem;
}

/* Status Timeline */
.status-timeline {
  position: relative;
}

.timeline-item {
  position: relative;
  padding-left: var(--space-6);
  padding-bottom: var(--space-4);
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-marker {
  position: absolute;
  left: 0;
  top: 6px;
  width: 10px;
  height: 10px;
  background: var(--gold);
  border-radius: 50%;
  border: 2px solid var(--gold-light);
}

.timeline-item:nth-child(2) .timeline-marker { background: var(--info); border-color: var(--info-border); }
.timeline-item:nth-child(3) .timeline-marker { background: var(--success); border-color: var(--success-border); }

.timeline-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.timeline-date {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.timeline-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0;
  margin-left: var(--space-6);
}

/* ============================================
   RESPONSIVE
   ============================================ */
@media (max-width: 1024px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .orders-page {
    padding: var(--space-4);
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .page-title {
    font-size: 1.75rem;
  }

  .header-actions {
    width: 100%;
  }

  .btn-flat,
  .btn-primary {
    flex: 1;
    text-align: center;
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
    align-items: flex-start;
  }

  .flat-modal {
    max-width: 100%;
    margin: var(--space-2);
  }

  .modal-header,
  .modal-body {
    padding: var(--space-4);
  }
}
</style>
