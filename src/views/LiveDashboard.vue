<template>
  <div class="live-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-left">
        <h2 class="page-title">&gt; DASHBOARD AO VIVO</h2>
        <div class="live-indicator" :class="{ active: networkStore.isConnected }">
          <span class="live-dot"></span>
          <span>{{ networkStore.isConnected ? 'LIVE' : 'OFFLINE' }}</span>
        </div>
      </div>
      <div class="header-right">
        <button @click="refreshAll" :disabled="loading" class="btn btn-secondary">
          <span :class="{ 'animate-spin': loading }">&#x27F3;</span>
          <span>{{ loading ? 'ATUALIZANDO...' : 'ATUALIZAR' }}</span>
        </button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card" v-for="kpi in kpiCards" :key="kpi.label">
        <div class="kpi-top" :class="kpi.colorClass">
          <div class="kpi-icon">{{ kpi.icon }}</div>
          <span class="kpi-trend-badge" :class="kpi.trendClass">{{ kpi.trend }}</span>
        </div>
        <div class="kpi-value" :class="kpi.colorClass">{{ kpi.value }}</div>
        <div class="kpi-label">{{ kpi.label }}</div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="dashboard-grid">
      <!-- Store Activity -->
      <div class="dashboard-card">
        <div class="card-header">
          <h3>[ ATIVIDADE DAS LOJAS ]</h3>
        </div>
        <div class="card-body">
          <div v-for="store in networkStore.storeNodes" :key="store.id" class="store-row">
            <div class="store-info">
              <span class="store-name">{{ store.label }}</span>
              <span class="store-meta">{{ store.order_count }} PEDIDOS // R$ {{ store.revenue?.toFixed(2) || '0.00' }}</span>
            </div>
            <span class="store-badge" :class="`badge-${store.sync_status}`">
              {{ store.sync_status === 'active' ? 'ATIVO' : 'INATIVO' }}
            </span>
          </div>
          <div v-if="networkStore.storeNodes.length === 0" class="empty">NENHUMA LOJA CONECTADA</div>
        </div>
      </div>

      <!-- Gateway Status -->
      <div class="dashboard-card">
        <div class="card-header">
          <h3>[ GATEWAYS DE PAGAMENTO ]</h3>
        </div>
        <div class="card-body">
          <div v-for="gateway in networkStore.gatewayNodes" :key="gateway.id" class="gateway-row">
            <div class="gateway-info">
              <span class="gateway-name">{{ gateway.label }}</span>
              <span class="gateway-meta">{{ gateway.transaction_count }} TRANS. // R$ {{ gateway.total_revenue?.toFixed(2) || '0.00' }}</span>
            </div>
            <span class="gateway-badge" :class="`badge-${gateway.status}`">
              {{ gateway.status === 'active' ? 'ATIVO' : 'INATIVO' }}
            </span>
          </div>
          <div v-if="networkStore.gatewayNodes.length === 0" class="empty">NENHUM GATEWAY</div>
        </div>
      </div>

      <!-- Recent Orders -->
      <div class="dashboard-card full-width">
        <div class="card-header">
          <h3>[ FLUXO DE PEDIDOS ]</h3>
          <router-link to="/pedidos" class="card-link">VER TODOS &rarr;</router-link>
        </div>
        <div class="card-body">
          <div class="orders-table">
            <div class="orders-head">
              <div>ID</div>
              <div>CLIENTE</div>
              <div>LOJA</div>
              <div>GATEWAY</div>
              <div>TOTAL</div>
              <div>STATUS</div>
              <div>TEMPO</div>
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
              <div v-if="networkStore.orderNodes.length === 0" class="empty-row">NENHUM PEDIDO RECENTE</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Live Activity Feed -->
      <div class="dashboard-card full-width">
        <div class="card-header">
          <h3>[ FEED EM TEMPO REAL ]</h3>
          <button @click="clearEvents" class="btn btn-ghost btn-sm">LIMPAR</button>
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
              <span>AGUARDANDO ATIVIDADES</span>
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

const kpiCards = computed(() => {
  const s = dashboardStore.stats
  return [
    { icon: '&#x1F6D2;', label: 'TOTAL DE PEDIDOS', value: s.totalOrders || networkStore.nodeCounts.order || 0, trend: `${s.pendingOrders || 0} PENDENTES`, trendClass: 'trend-yellow', colorClass: 'text-purple' },
    { icon: '&#x1F4B0;', label: 'RECEITA TOTAL', value: `R$ ${(s.totalRevenue || 0).toFixed(2)}`, trend: `M&Eacute;DIA: R$ ${(s.averageOrderValue || 0).toFixed(2)}`, trendClass: 'trend-green', colorClass: 'text-green' },
    { icon: '&#x1F3EA;', label: 'LOJAS CONECTADAS', value: networkStore.nodeCounts.store || 0, trend: `${networkStore.nodeCounts.product || 0} PRODUTOS`, trendClass: 'trend-green', colorClass: 'text-purple' },
    { icon: '&#x1F4B3;', label: 'GATEWAYS ATIVOS', value: networkStore.nodeCounts.gateway || 0, trend: `${networkStore.connectionCount} CONEX&Otilde;ES`, trendClass: 'trend-green', colorClass: 'text-green' },
    { icon: '&#x1F4E6;', label: 'PRODUTOS ATIVOS', value: s.activeProducts || networkStore.nodeCounts.product || 0, trend: `${s.lowStockProducts || 0} ESTOQUE BAIXO`, trendClass: s.lowStockProducts > 5 ? 'trend-red' : 'trend-yellow', colorClass: 'text-cyan' },
    { icon: '&#x1F465;', label: 'CLIENTES', value: s.totalCustomers || 0, trend: 'EM BREVE', trendClass: 'trend-purple', colorClass: 'text-purple' }
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
  const labels = { pending: 'PENDENTE', processing: 'PROCESSANDO', shipped: 'ENVIADO', delivered: 'ENTREGUE', cancelled: 'CANCELADO' }
  return labels[status] || status.toUpperCase()
}

function getStatusBadge(status) {
  const badges = { pending: 'badge-yellow', processing: 'badge-cyan', shipped: 'badge-purple', delivered: 'badge-green', cancelled: 'badge-red' }
  return badges[status] || 'badge-purple'
}

function getEventIcon(eventType) {
  const icons = { INSERT: '+', UPDATE: '~', DELETE: 'x' }
  return icons[eventType] || '?'
}

function getEventText(event) {
  const names = { orders: 'PEDIDO', webhook_events: 'WEBHOOK', third_party_sync_log: 'SYNC' }
  const name = names[event.table] || event.table
  if (event.table === 'orders') return `${event.eventType === 'INSERT' ? 'NOVO' : 'ATUALIZADO'} ${name} - R$ ${event.record?.total || 0}`
  if (event.table === 'third_party_sync_log') return `SYNC ${event.record?.source || ''} - ${event.record?.status || ''}`
  return `${name} // ${event.eventType}`
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'N/A'
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (diff < 60) return `${diff}S`
  if (diff < 3600) return `${Math.floor(diff / 60)}M`
  if (diff < 86400) return `${Math.floor(diff / 3600)}H`
  return `${Math.floor(diff / 86400)}D`
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'N/A'
  return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

onMounted(async () => {
  await refreshAll()
  networkStore.subscribeToRealtime()
})

onUnmounted(async () => {
  await networkStore.unsubscribe()
})
</script>

<style scoped>
.live-dashboard {
  max-width: 1440px;
  margin: 0 auto;
}

/* Header */
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
  font-size: 20px;
  font-weight: 700;
  color: var(--green);
  letter-spacing: 1px;
  margin: 0;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--red-bg);
  border: 1px solid var(--red);
}

.live-indicator.active {
  background: var(--green-bg);
  border-color: var(--green);
}

.live-dot {
  width: 8px;
  height: 8px;
  background: currentColor;
  animation: pulse 2s infinite;
}

.live-indicator span:last-child {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--red);
}

.live-indicator.active span:last-child {
  color: var(--green);
}

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.kpi-card {
  background: var(--bg-surface);
  border: var(--border);
  padding: var(--space-5);
  position: relative;
  transition: all var(--transition);
}

.kpi-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
}

.kpi-card:nth-child(1)::before { background: var(--purple); }
.kpi-card:nth-child(2)::before { background: var(--green); }
.kpi-card:nth-child(3)::before { background: var(--purple); }
.kpi-card:nth-child(4)::before { background: var(--green); }
.kpi-card:nth-child(5)::before { background: var(--cyan); }
.kpi-card:nth-child(6)::before { background: var(--purple); }

.kpi-card:hover {
  border-color: var(--purple);
}

.kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

.kpi-icon {
  font-size: 24px;
}

.kpi-trend-badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: var(--space-1) var(--space-2);
  border: 1px solid;
}

.trend-green { background: var(--green-bg); color: var(--green); border-color: var(--green); }
.trend-yellow { background: var(--yellow-bg); color: var(--yellow); border-color: var(--yellow); }
.trend-red { background: var(--red-bg); color: var(--red); border-color: var(--red); }
.trend-purple { background: var(--purple-bg); color: var(--purple); border-color: var(--purple); }

.kpi-value {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: var(--space-2);
  line-height: 1;
}

.kpi-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-muted);
}

/* Dashboard Grid */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: var(--space-4);
}

.dashboard-card {
  background: var(--bg-surface);
  border: var(--border);
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
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-primary);
  margin: 0;
}

.card-link {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--purple);
  text-decoration: none;
}

.card-link:hover {
  color: var(--purple-light);
}

.card-body {
  padding: var(--space-4);
  max-height: 400px;
  overflow-y: auto;
}

/* Store & Gateway Rows */
.store-row, .gateway-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  border: var(--border-light);
  margin-bottom: var(--space-2);
  transition: background var(--transition);
}

.store-row:hover, .gateway-row:hover {
  background: var(--purple-bg);
}

.store-info, .gateway-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.store-name, .gateway-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.store-meta, .gateway-meta {
  font-size: 9px;
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 0.5px;
}

.store-badge, .gateway-badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: var(--space-1) var(--space-2);
  border: 1px solid;
}

.badge-active { background: var(--green-bg); color: var(--green); border-color: var(--green); }
.badge-inactive { background: var(--yellow-bg); color: var(--yellow); border-color: var(--yellow); }
.badge-error { background: var(--red-bg); color: var(--red); border-color: var(--red); }

/* Orders Table */
.orders-table {
  border: var(--border);
}

.orders-head {
  display: grid;
  grid-template-columns: 70px 1fr 90px 90px 90px 90px 70px;
  background: var(--bg-elevated);
  border-bottom: var(--border);
}

.orders-head > div {
  padding: var(--space-2) var(--space-3);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-muted);
  border-right: var(--border-light);
}

.orders-body {
  display: flex;
  flex-direction: column;
}

.order-row {
  display: grid;
  grid-template-columns: 70px 1fr 90px 90px 90px 90px 70px;
  border-bottom: var(--border-light);
  transition: background var(--transition);
}

.order-row:last-child {
  border-bottom: none;
}

.order-row:hover {
  background: var(--purple-bg);
}

.order-row > div {
  padding: var(--space-2) var(--space-3);
  font-size: 11px;
  border-right: var(--border-light);
}

.col-id {
  font-weight: 700;
  color: var(--purple);
}

.col-customer {
  font-weight: 600;
  color: var(--text-primary);
}

.col-store, .col-gateway {
  color: var(--text-secondary);
  font-weight: 600;
}

.col-total {
  font-weight: 700;
  color: var(--green);
}

.col-time {
  color: var(--text-muted);
  font-weight: 600;
}

.order-pending { border-left: 3px solid var(--yellow); }
.order-processing { border-left: 3px solid var(--cyan); }
.order-shipped { border-left: 3px solid var(--purple); }
.order-delivered { border-left: 3px solid var(--green); }
.order-cancelled { border-left: 3px solid var(--red); opacity: 0.6; }

.empty-row, .empty {
  text-align: center;
  padding: var(--space-8);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
}

/* Activity Feed */
.activity-feed {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.activity-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-left: 3px solid;
  transition: background var(--transition);
}

.event-insert { background: var(--bg-surface); border-color: var(--green); }
.event-update { background: var(--bg-surface); border-color: var(--cyan); }
.event-delete { background: var(--bg-surface); border-color: var(--red); }

.activity-icon {
  font-size: 14px;
  font-weight: 700;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.activity-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
}

.activity-time {
  font-size: 9px;
  color: var(--text-muted);
  font-weight: 700;
  letter-spacing: 0.5px;
}

.empty-wait {
  text-align: center;
  padding: var(--space-8);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
}

.dots {
  font-weight: 700;
  letter-spacing: 2px;
}

/* Responsive */
@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .orders-head, .order-row {
    grid-template-columns: 60px 1fr 80px 80px 80px;
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
    grid-template-columns: 50px 1fr 70px 70px;
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
