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
                <span :class="['flat-badge', order.status]">
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
          <button class="close-btn" @click="selectedOrder = null">X</button>
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
                    <span :class="['flat-badge', 'small', item.status]">{{ getStatusLabel(item.status) }}</span>
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
    headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: 'bold' }
  })

  doc.save(`bhumi-orders-${new Date().toISOString().split('T')[0]}.pdf`)
}
</script>

<style scoped>
.orders-page {
  padding: var(--space-6);
  min-height: 100vh;
}

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
}

.header-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.btn-flat {
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 0;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-flat:hover {
  background: var(--bg-hover);
  border-color: var(--purple);
  color: var(--purple);
}

.loading-state,
.error-state,
.empty-state {
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

.error-state {
  border: 1px solid var(--red);
  background: rgba(239, 68, 68, 0.05);
  padding: var(--space-8);
}

.error-code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--red);
  letter-spacing: 2px;
  display: block;
  margin-bottom: var(--space-2);
}

.error-state p {
  color: var(--text-secondary);
  margin: 0;
}

.empty-state {
  border: 1px dashed var(--border-color);
  padding: var(--space-12);
}

.empty-state p {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--text-muted);
  letter-spacing: 2px;
  margin: 0;
}

.orders-table-wrapper {
  border: 1px solid var(--border-color);
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
  border-bottom: 1px solid var(--border-color);
  font-family: var(--font-mono);
  font-size: 0.75rem;
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

.order-row {
  transition: background 0.15s ease;
}

.order-row:hover {
  background: var(--bg-elevated);
}

.order-id {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--purple);
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
  color: var(--green);
  font-size: 1rem;
}

.payment-cell {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.actions-cell {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.btn-icon {
  padding: var(--space-1) var(--space-3);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0;
  color: var(--cyan);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-icon:hover {
  background: var(--cyan);
  color: var(--bg-base);
  border-color: var(--cyan);
}

.flat-select {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 0;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  cursor: pointer;
}

.flat-select:focus {
  outline: none;
  border-color: var(--purple);
}

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

.detail-section {
  margin-bottom: var(--space-8);
}

.detail-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--text-muted);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-color);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.info-item {
  padding: var(--space-3);
  background: var(--bg-elevated);
  border-left: 2px solid var(--purple);
}

.info-item:nth-child(2) { border-left-color: var(--green); }
.info-item:nth-child(3) { border-left-color: var(--cyan); }
.info-item:nth-child(4) { border-left-color: var(--yellow); }

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

.items-table {
  width: 100%;
  border-collapse: collapse;
}

.items-table th {
  padding: var(--space-3) var(--space-2);
  text-align: left;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--text-muted);
}

.items-table td {
  padding: var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.85rem;
  color: var(--text-primary);
}

.items-table tfoot td {
  padding-top: var(--space-4);
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--text-primary);
  border-top: 2px solid var(--border-color);
}

.total-value {
  color: var(--green);
  font-size: 1.1rem;
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
  top: 4px;
  width: 8px;
  height: 8px;
  background: var(--purple);
}

.timeline-item:nth-child(2) .timeline-marker { background: var(--cyan); }
.timeline-item:nth-child(3) .timeline-marker { background: var(--green); }

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

/* Responsive */
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
