<template>
  <div class="sales-dashboard">
    <!-- Header -->
    <div class="page-header">
      <div>
        <span class="page-label">SALES DASHBOARD</span>
        <h1 class="page-title">{{ salesStore.stats.total_sales }} VENDAS</h1>
      </div>
      <div class="header-actions">
        <button @click="salesStore.fetchSales()" class="btn-flat" :disabled="salesStore.loading">
          {{ salesStore.loading ? 'LOADING...' : 'REFRESH' }}
        </button>
      </div>
    </div>

    <!-- Stats Overview -->
    <div class="stats-overview">
      <!-- Revenue Card -->
      <div class="stat-card revenue">
        <span class="stat-icon">$</span>
        <span class="stat-label">RECEITA TOTAL</span>
        <span class="stat-value">{{ salesStore.formatCurrency(salesStore.stats.total_revenue) }}</span>
      </div>

      <!-- By Location -->
      <div class="stat-card">
        <span class="stat-label">BRASIL</span>
        <span class="stat-value">{{ salesStore.stats.by_location.brazil.count }}</span>
        <span class="stat-sub">{{ salesStore.formatCurrency(salesStore.stats.by_location.brazil.revenue) }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">INTERNATIONAL</span>
        <span class="stat-value">{{ salesStore.stats.by_location.international.count }}</span>
        <span class="stat-sub">{{ salesStore.formatCurrency(salesStore.stats.by_location.international.revenue) }}</span>
      </div>
    </div>

    <!-- Status Breakdown -->
    <div class="status-section">
      <h2 class="section-title">[ STATUS DE VENDAS ]</h2>
      <div class="status-grid">
        <div
          v-for="status in allStatuses"
          :key="status"
          class="status-card"
          :class="{ active: salesStore.statusFilter === status }"
          @click="salesStore.setStatusFilter(salesStore.statusFilter === status ? 'all' : status)"
        >
          <div class="status-header">
            <span
              class="status-icon"
              :style="{ background: salesStore.getStatusConfig(status).color }"
            >
              {{ salesStore.getStatusConfig(status).icon }}
            </span>
            <span class="status-count">{{ statsByStatus[status]?.count || 0 }}</span>
          </div>
          <span class="status-label">{{ salesStore.getStatusConfig(status).label }}</span>
          <span class="status-revenue">{{ salesStore.formatCurrency(statsByStatus[status]?.revenue || 0) }}</span>
        </div>
      </div>
    </div>

    <!-- Gateway Breakdown -->
    <div class="gateway-section">
      <h2 class="section-title">[ GATEWAYS DE PAGAMENTO ]</h2>
      <div class="gateway-grid">
        <div
          v-for="(stat, gateway) in gatewayStats"
          :key="gateway"
          class="gateway-card"
          :class="{ active: salesStore.gatewayFilter === gateway }"
          @click="salesStore.setGatewayFilter(salesStore.gatewayFilter === gateway ? 'all' : gateway)"
        >
          <span class="gateway-name">{{ gateway }}</span>
          <span class="gateway-count">{{ stat.count }} vendas</span>
          <span class="gateway-revenue">{{ salesStore.formatCurrency(stat.revenue) }}</span>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <select v-model="salesStore.statusFilter" class="flat-select">
        <option value="all">ALL_STATUS</option>
        <option v-for="status in allStatuses" :key="status" :value="status">
          {{ salesStore.getStatusConfig(status).label }}
        </option>
      </select>

      <select v-model="salesStore.locationFilter" class="flat-select">
        <option value="all">ALL_LOCATIONS</option>
        <option value="brazil">BRASIL</option>
        <option value="international">INTERNATIONAL</option>
      </select>

      <input
        v-model="salesStore.searchQuery"
        type="text"
        placeholder="SEARCH_CUSTOMER..."
        class="flat-input"
      >
    </div>

    <!-- Sales Table -->
    <div v-if="salesStore.loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span class="loading-text">LOADING_SALES...</span>
    </div>

    <div v-else-if="salesStore.filteredSales.length === 0" class="empty-state">
      <p>NO_SALES_FOUND</p>
    </div>

    <div v-else class="table-wrapper">
      <table class="flat-table">
        <thead>
          <tr>
            <th>ORDER</th>
            <th>CUSTOMER</th>
            <th>LOCATION</th>
            <th>STATUS</th>
            <th>GATEWAY</th>
            <th>AMOUNT</th>
            <th>DATE</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="sale in salesStore.filteredSales" :key="sale.id">
            <td class="order-id">{{ sale.order_number }}</td>
            <td class="customer-cell">
              <span class="customer-name">{{ sale.customer_name }}</span>
              <span class="customer-email">{{ sale.customer_email }}</span>
            </td>
            <td>
              <span class="location-badge" :class="sale.customer_location">
                {{ sale.customer_location === 'brazil' ? 'BR' : 'INTL' }}
              </span>
              <span v-if="sale.customer_state" class="state-code">{{ sale.customer_state }}</span>
            </td>
            <td>
              <span
                class="status-badge"
                :style="{ background: salesStore.getStatusConfig(sale.status).color }"
              >
                {{ salesStore.getStatusConfig(sale.status).icon }}
                {{ salesStore.getStatusConfig(sale.status).label }}
              </span>
            </td>
            <td class="gateway-cell">
              {{ sale.payment_gateway || '-' }}
            </td>
            <td class="amount-cell">{{ salesStore.formatCurrency(sale.total) }}</td>
            <td class="date-cell">{{ formatDate(sale.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue'
import { useSalesStore } from '../stores/sales'

const salesStore = useSalesStore()

const allStatuses = [
  'payment_cancelled',
  'payment_pending',
  'payment_processing',
  'direct_umapenca',
  'sold_abacatepay',
  'sold_mercadopago',
  'sold_pix_bricks',
  'completed',
  'refunded',
]

const statsByStatus = computed(() => salesStore.stats.by_status)
const gatewayStats = computed(() => salesStore.stats.by_gateway)

onMounted(() => {
  salesStore.fetchSales()
})

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
</script>

<style scoped>
.sales-dashboard {
  padding: var(--space-6);
  min-height: 100vh;
  background: var(--bg-base);
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
  margin: 0;
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

.btn-flat {
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 0;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-flat:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--gold);
  color: var(--gold);
}

.btn-flat:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Stats Overview */
.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.stat-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
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
  background: var(--gold);
}

.stat-card.revenue::before {
  background: var(--success);
}

.stat-card.revenue .stat-value {
  color: var(--success);
}

.stat-icon {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gold);
}

.stat-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: var(--text-muted);
}

.stat-value {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-sub {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text-secondary);
}

/* Status Section */
.status-section,
.gateway-section {
  margin-bottom: var(--space-6);
}

.section-title {
  font-family: var(--font-display);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--gold);
  margin-bottom: var(--space-4);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
}

.status-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  padding: var(--space-3);
  cursor: pointer;
  transition: all 0.15s ease;
}

.status-card:hover {
  border-color: var(--gold);
  background: var(--bg-elevated);
}

.status-card.active {
  border-color: var(--gold);
  background: var(--gold-bg);
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.status-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--bg-base);
  font-family: var(--font-mono);
}

.status-count {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.status-label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
}

.status-revenue {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--success);
  font-weight: 600;
}

/* Gateway Section */
.gateway-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--space-3);
}

.gateway-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  cursor: pointer;
  transition: all 0.15s ease;
}

.gateway-card:hover {
  border-color: var(--info);
  background: var(--bg-elevated);
}

.gateway-card.active {
  border-color: var(--info);
  background: var(--info-bg);
}

.gateway-name {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--info);
  text-transform: uppercase;
}

.gateway-count {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.gateway-revenue {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  color: var(--success);
  font-weight: 600;
}

/* Filters */
.filters-bar {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.flat-select {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 0;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 1px;
  cursor: pointer;
}

.flat-select:focus {
  outline: none;
  border-color: var(--gold);
}

.flat-input {
  flex: 1;
  min-width: 200px;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 0;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 1px;
}

.flat-input:focus {
  outline: none;
  border-color: var(--gold);
}

.flat-input::placeholder {
  color: var(--text-muted);
}

/* Loading & Empty */
.loading-state,
.empty-state {
  text-align: center;
  padding: var(--space-16);
  border: 1px dashed var(--border);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 2px solid var(--border);
  border-top-color: var(--gold);
  margin: 0 auto var(--space-4);
  animation: spin 1s linear infinite;
}

.loading-text {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--text-muted);
  letter-spacing: 2px;
}

.empty-state p {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--text-muted);
  letter-spacing: 2px;
  margin: 0;
}

/* Table */
.table-wrapper {
  border: 1px solid var(--border);
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
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: var(--text-muted);
}

.flat-table td {
  padding: var(--space-4);
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
  vertical-align: middle;
}

.flat-table tbody tr:hover {
  background: var(--bg-elevated);
}

.order-id {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--gold);
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

.location-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 1px;
  border: 1px solid;
}

.location-badge.brazil {
  background: var(--success-bg);
  border-color: var(--success);
  color: var(--success);
}

.location-badge.international {
  background: var(--info-bg);
  border-color: var(--info);
  color: var(--info);
}

.state-code {
  margin-left: var(--space-1);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--bg-base);
}

.gateway-cell {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.amount-cell {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--success);
}

.date-cell {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 1024px) {
  .stats-overview {
    grid-template-columns: repeat(2, 1fr);
  }

  .status-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .sales-dashboard {
    padding: var(--space-4);
  }

  .page-header {
    flex-direction: column;
  }

  .page-title {
    font-size: 1.75rem;
  }

  .stats-overview {
    grid-template-columns: 1fr;
  }

  .status-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .gateway-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .filters-bar {
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
}
</style>
