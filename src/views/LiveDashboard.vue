<template>
  <div class="live-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-left">
        <h2 class="page-title">Dashboard</h2>
        <div class="live-indicator" :class="{ active: networkStore.isConnected }">
          <span class="live-dot"></span>
          <span>{{ networkStore.isConnected ? 'Online' : 'Offline' }}</span>
        </div>
      </div>
      <div class="header-right">
        <button @click="refreshAll" :disabled="loading" class="btn btn-secondary">
          <svg :class="{ 'animate-spin': loading }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          <span>{{ loading ? 'Atualizando...' : 'Atualizar' }}</span>
        </button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card" v-for="kpi in kpiCards" :key="kpi.label">
        <div class="kpi-top">
          <div class="kpi-icon">
            <component :is="kpi.icon" />
          </div>
          <span class="kpi-trend-badge" :class="kpi.trendClass">{{ kpi.trend }}</span>
        </div>
        <div class="kpi-value">{{ kpi.value }}</div>
        <div class="kpi-label">{{ kpi.label }}</div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="dashboard-grid">
      <!-- Store Activity -->
      <div class="dashboard-card">
        <div class="card-header">
          <h3>Atividade das Lojas</h3>
        </div>
        <div class="card-body">
          <div v-for="store in networkStore.storeNodes" :key="store.id" class="store-row">
            <div class="store-info">
              <span class="store-name">{{ store.label }}</span>
              <span class="store-meta">{{ store.order_count }} pedidos &middot; R$ {{ store.revenue?.toFixed(2) || '0.00' }}</span>
            </div>
            <span class="store-badge" :class="store.sync_status === 'active' ? 'badge-success' : 'badge-warning'">
              {{ store.sync_status === 'active' ? 'Ativo' : 'Inativo' }}
            </span>
          </div>
          <div v-if="networkStore.storeNodes.length === 0" class="empty">Nenhuma loja conectada</div>
        </div>
      </div>

      <!-- Gateway Status -->
      <div class="dashboard-card">
        <div class="card-header">
          <h3>Gateways de Pagamento</h3>
        </div>
        <div class="card-body">
          <div v-for="gateway in networkStore.gatewayNodes" :key="gateway.id" class="gateway-row">
            <div class="gateway-info">
              <span class="gateway-name">{{ gateway.label }}</span>
              <span class="gateway-meta">{{ gateway.transaction_count }} trans. &middot; R$ {{ gateway.total_revenue?.toFixed(2) || '0.00' }}</span>
            </div>
            <span class="gateway-badge" :class="gateway.status === 'active' ? 'badge-success' : 'badge-warning'">
              {{ gateway.status === 'active' ? 'Ativo' : 'Inativo' }}
            </span>
          </div>
          <div v-if="networkStore.gatewayNodes.length === 0" class="empty">Nenhum gateway</div>
        </div>
      </div>

      <!-- Recent Orders -->
      <div class="dashboard-card full-width">
        <div class="card-header">
          <h3>Fluxo de Pedidos</h3>
          <router-link to="/admin/pedidos" class="card-link">Ver todos &rarr;</router-link>
        </div>
        <div class="card-body">
          <div class="orders-table">
            <div class="orders-head">
              <div>ID</div>
              <div>Cliente</div>
              <div>Loja</div>
              <div>Gateway</div>
              <div>Total</div>
              <div>Status</div>
              <div>Tempo</div>
            </div>
            <div class="orders-body">
              <div v-for="order in networkStore.orderNodes.slice(0, 15)" :key="order.id" class="order-row" :class="`order-${order.status}`">
                <div class="col-id">#{{ order.id.replace('order_', '') }}</div>
                <div class="col-customer">{{ order.customer_name }}</div>
                <div class="col-store">{{ order.source }}</div>
                <div class="col-gateway">{{ order.payment_method }}</div>
                <div class="col-total">R$ {{ order.total?.toFixed(2) || '0.00' }}</div>
                <div class="col-status">
                  <span class="badge" :class="getStatusBadge(order.status)">{{ getStatusLabel(order.status) }}</span>
                </div>
                <div class="col-time">{{ formatTimeAgo(order.created_at) }}</div>
              </div>
              <div v-if="networkStore.orderNodes.length === 0" class="empty-row">Nenhum pedido recente</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Live Activity Feed -->
      <div class="dashboard-card full-width">
        <div class="card-header">
          <h3>Feed em Tempo Real</h3>
          <button @click="clearEvents" class="btn btn-ghost btn-sm">Limpar</button>
        </div>
        <div class="card-body">
          <div class="activity-feed">
            <div v-for="event in networkStore.recentEvents.slice(0, 30)" :key="event.id" class="activity-row" :class="`event-${event.eventType.toLowerCase()}`">
              <span class="activity-icon">{{ getEventIcon(event.eventType) }}</span>
              <div class="activity-content">
                <span class="activity-text">{{ getEventText(event) }}</span>
                <span class="activity-time">{{ formatTimestamp(event.timestamp) }}</span>
              </div>
            </div>
            <div v-if="networkStore.recentEvents.length === 0" class="empty-wait">
              <span>Aguardando atividades</span>
              <span class="dots animate-pulse">...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useNetworkStore } from '../stores/network'
import { useDashboardStore } from '../stores/dashboard'

const networkStore = useNetworkStore()
const dashboardStore = useDashboardStore()
const loading = ref(false)

// SVG icon components for KPI cards
const CartIcon = { template: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' }
const DollarIcon = { template: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' }
const StoreIcon = { template: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' }
const CreditIcon = { template: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>' }
const PackageIcon = { template: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>' }
const UsersIcon = { template: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' }

const kpiCards = computed(() => {
  const s = dashboardStore.stats
  return [
    { icon: CartIcon, label: 'Total de Pedidos', value: s.totalOrders || networkStore.nodeCounts.order || 0, trend: `${s.pendingOrders || 0} pendentes`, trendClass: 'trend-warning', colorClass: 'text-gold' },
    { icon: DollarIcon, label: 'Receita Total', value: `R$ ${(s.totalRevenue || 0).toFixed(2)}`, trend: `Média: R$ ${(s.averageOrderValue || 0).toFixed(2)}`, trendClass: 'trend-success', colorClass: 'text-success' },
    { icon: StoreIcon, label: 'Lojas Conectadas', value: networkStore.nodeCounts.store || 0, trend: `${networkStore.nodeCounts.product || 0} produtos`, trendClass: 'trend-success', colorClass: 'text-gold' },
    { icon: CreditIcon, label: 'Gateways Ativos', value: networkStore.nodeCounts.gateway || 0, trend: `${networkStore.connectionCount} conexões`, trendClass: 'trend-success', colorClass: 'text-success' },
    { icon: PackageIcon, label: 'Produtos Ativos', value: s.activeProducts || networkStore.nodeCounts.product || 0, trend: `${s.lowStockProducts || 0} estoque baixo`, trendClass: s.lowStockProducts > 5 ? 'trend-danger' : 'trend-warning', colorClass: 'text-info' },
    { icon: UsersIcon, label: 'Clientes', value: s.totalCustomers || 0, trend: 'Em breve', trendClass: 'trend-muted', colorClass: 'text-gold' }
  ]
})

async function refreshAll() {
  loading.value = true
  try {
    await Promise.all([
      networkStore.buildGraph(),
      dashboardStore.fetchDashboardStats(),
      dashboardStore.fetchRevenueByDay(),
      dashboardStore.fetchTopProducts()
    ])
  } catch (err) {
    console.error('refreshAll error:', err)
  } finally {
    loading.value = false
  }
}

function clearEvents() {
  networkStore.liveEvents = []
}

function getStatusLabel(status) {
  const labels = { pending: 'Pendente', processing: 'Processando', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' }
  return labels[status] || status.toUpperCase()
}

function getStatusBadge(status) {
  const badges = { pending: 'badge-warning', processing: 'badge-info', shipped: 'badge-gold', delivered: 'badge-success', cancelled: 'badge-danger' }
  return badges[status] || 'badge-gold'
}

function getEventIcon(eventType) {
  const icons = { INSERT: '+', UPDATE: '~', DELETE: '&times;' }
  return icons[eventType] || '?'
}

function getEventText(event) {
  const names = { orders: 'Pedido', webhook_events: 'Webhook', third_party_sync_log: 'Sync' }
  const name = names[event.table] || event.table
  if (event.table === 'orders') return `${event.eventType === 'INSERT' ? 'Novo' : 'Atualizado'} ${name} &middot; R$ ${event.record?.total || 0}`
  if (event.table === 'third_party_sync_log') return `Sync ${event.record?.source || ''} &middot; ${event.record?.status || ''}`
  return `${name} &middot; ${event.eventType}`
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'N/A'
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'N/A'
  return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

onMounted(async () => {
  await refreshAll()
  await networkStore.buildGraph()
})

onUnmounted(async () => {
  await networkStore.unsubscribe()
})
</script>

<style scoped>
.live-dashboard {
  max-width: 1400px;
  margin: 0 auto;
}

/* ===== HEADER ===== */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-8);
  padding-bottom: var(--space-6);
  border-bottom: var(--border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.page-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 500;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  margin: 0;
  font-variation-settings: "SOFT" 50, "WONK" 0;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: var(--radius);
}

.live-indicator.active {
  background: var(--success-bg);
  border-color: var(--success-border);
}

.live-dot {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
  animation: pulse-soft 2s ease-in-out infinite;
}

.live-indicator { color: var(--danger); }
.live-indicator.active { color: var(--success); }

.live-indicator span:last-child {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
}

/* ===== KPI GRID ===== */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.kpi-card {
  background: var(--bg-surface);
  border: var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  position: relative;
  transition: all var(--transition-base);
  overflow: hidden;
}

.kpi-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
}

.kpi-card:hover {
  border-color: var(--gold-border);
  background: var(--bg-elevated);
}

.kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

.kpi-icon {
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.kpi-trend-badge {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.02em;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid;
}

.trend-success { background: var(--success-bg); color: var(--success); border-color: var(--success-border); }
.trend-warning { background: var(--warning-bg); color: var(--warning); border-color: var(--warning-border); }
.trend-danger { background: var(--danger-bg); color: var(--danger); border-color: var(--danger-border); }
.trend-muted { background: var(--bg-elevated); color: var(--text-muted); border-color: var(--border); }

.kpi-value {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 600;
  margin-bottom: var(--space-2);
  line-height: 1;
  letter-spacing: -0.02em;
  font-variation-settings: "SOFT" 50, "WONK" 0;
  color: var(--text-primary);
}

.kpi-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* ===== DASHBOARD GRID ===== */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-4);
}

.dashboard-card {
  background: var(--bg-surface);
  border: var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.dashboard-card.full-width {
  grid-column: 1 / -1;
}

.card-header {
  padding: var(--space-4) var(--space-5);
  border-bottom: var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-header h3 {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin: 0;
}

.card-link {
  font-size: 12px;
  font-weight: 500;
  color: var(--gold);
  text-decoration: none;
  transition: color var(--transition-base);
}

.card-link:hover {
  color: var(--gold-light);
}

.card-body {
  padding: var(--space-4);
  max-height: 400px;
  overflow-y: auto;
}

/* ===== STORE & GATEWAY ROWS ===== */
.store-row, .gateway-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  margin-bottom: var(--space-2);
  transition: all var(--transition-base);
}

.store-row:hover, .gateway-row:hover {
  background: var(--gold-bg);
  border-color: var(--gold-border);
}

.store-info, .gateway-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.store-name, .gateway-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.store-meta, .gateway-meta {
  font-size: 11px;
  color: var(--text-muted);
}

.store-badge, .gateway-badge {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
}

/* ===== ORDERS TABLE ===== */
.orders-table {
  border: var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.orders-head {
  display: grid;
  grid-template-columns: 60px 1fr 80px 80px 80px 90px 60px;
  background: var(--bg-elevated);
  border-bottom: var(--border);
}

.orders-head > div {
  padding: var(--space-3);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.orders-body {
  display: flex;
  flex-direction: column;
}

.order-row {
  display: grid;
  grid-template-columns: 60px 1fr 80px 80px 80px 90px 60px;
  border-bottom: var(--border-light);
  transition: background var(--transition-fast);
}

.order-row:last-child {
  border-bottom: none;
}

.order-row:hover {
  background: var(--bg-hover);
}

.order-row > div {
  padding: var(--space-3);
  font-size: 13px;
}

.col-id {
  font-weight: 600;
  color: var(--gold);
  font-family: var(--font-mono);
  font-size: 12px;
}

.col-customer {
  font-weight: 500;
  color: var(--text-primary);
}

.col-store, .col-gateway {
  color: var(--text-tertiary);
}

.col-total {
  font-weight: 600;
  color: var(--success);
  font-family: var(--font-mono);
  font-size: 12px;
}

.col-time {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
}

.order-pending { border-left: 2px solid var(--warning); }
.order-processing { border-left: 2px solid var(--info); }
.order-shipped { border-left: 2px solid var(--gold); }
.order-delivered { border-left: 2px solid var(--success); }
.order-cancelled { border-left: 2px solid var(--danger); opacity: 0.5; }

.empty-row, .empty {
  text-align: center;
  padding: var(--space-8);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 400;
}

/* ===== ACTIVITY FEED ===== */
.activity-feed {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.activity-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius);
  border-left: 2px solid;
  transition: background var(--transition-fast);
}

.event-insert { background: var(--success-bg); border-color: var(--success); }
.event-update { background: var(--info-bg); border-color: var(--info); }
.event-delete { background: var(--danger-bg); border-color: var(--danger); }

.activity-icon {
  font-size: 12px;
  font-weight: 700;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
  font-family: var(--font-mono);
  color: var(--text-muted);
}

.activity-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.activity-text {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
}

.activity-time {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 500;
  font-family: var(--font-mono);
  letter-spacing: 0.02em;
}

.empty-wait {
  text-align: center;
  padding: var(--space-8);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 400;
}

.dots {
  font-weight: 700;
  letter-spacing: 3px;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .orders-head, .order-row {
    grid-template-columns: 50px 1fr 70px 70px 70px;
  }

  .col-store, .col-time {
    display: none;
  }

  .orders-head > div:nth-child(3),
  .orders-head > div:nth-child(7),
  .order-row > div:nth-child(3),
  .order-row > div:nth-child(7) {
    display: none;
  }
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
  }

  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .orders-head, .order-row {
    grid-template-columns: 40px 1fr 60px 60px;
  }

  .col-gateway {
    display: none;
  }
}

@media (max-width: 480px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>
