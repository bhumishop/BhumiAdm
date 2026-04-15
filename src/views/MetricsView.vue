<template>
  <div class="metrics-view">
    <!-- Page Header -->
    <div class="page-header animate-slideDown">
      <div>
        <h2 class="page-title">&gt; DASHBOARD &amp; M&Eacute;TRICAS</h2>
        <p class="page-subtitle">ACOMPANHE O DESEMPENHO DA SUA LOJA</p>
      </div>
      <div class="page-controls">
        <select v-model="daysRange" class="input" @change="refreshData">
          <option value="7">7 DIAS</option>
          <option value="30">30 DIAS</option>
          <option value="90">90 DIAS</option>
        </select>
        <button class="btn btn-secondary" @click="refreshData" :disabled="store.loading">
          <span :class="{ 'animate-spin': store.loading }">&#x27F3;</span>
          <span>ATUALIZAR</span>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="loading-box animate-fadeIn">
      <div class="loading-block"></div>
      <p>CARREGANDO M&Eacute;TRICAS...</p>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Stats Cards -->
      <div class="stats-grid animate-slideUp">
        <div class="stat-card">
          <div class="stat-top">
            <div class="stat-box purple">&#x1F6D2;</div>
            <span class="stat-badge badge-purple">+12%</span>
          </div>
          <div class="stat-value text-purple">{{ store.stats.totalOrders }}</div>
          <div class="stat-label">TOTAL DE PEDIDOS</div>
          <div class="stat-bar"><div class="bar-fill purple" style="width: 75%"></div></div>
        </div>

        <div class="stat-card">
          <div class="stat-top">
            <div class="stat-box yellow">&#x23F3;</div>
            <span class="stat-badge badge-yellow">PENDENTES</span>
          </div>
          <div class="stat-value text-yellow">{{ store.stats.pendingOrders }}</div>
          <div class="stat-label">PEDIDOS PENDENTES</div>
          <div class="stat-bar"><div class="bar-fill yellow" style="width: 30%"></div></div>
        </div>

        <div class="stat-card">
          <div class="stat-top">
            <div class="stat-box green">&#x1F4B0;</div>
            <span class="stat-badge badge-green">RECEITA</span>
          </div>
          <div class="stat-value text-green">R$ {{ store.stats.totalRevenue.toFixed(2) }}</div>
          <div class="stat-label">RECEITA TOTAL</div>
          <div class="stat-bar"><div class="bar-fill green" style="width: 85%"></div></div>
        </div>

        <div class="stat-card">
          <div class="stat-top">
            <div class="stat-box cyan">&#x1F4E6;</div>
            <span class="stat-badge badge-cyan">{{ store.stats.activeProducts }} ATIVOS</span>
          </div>
          <div class="stat-value text-cyan">{{ store.stats.activeProducts }}</div>
          <div class="stat-label">PRODUTOS ATIVOS</div>
          <div class="stat-bar"><div class="bar-fill cyan" style="width: 65%"></div></div>
        </div>

        <div class="stat-card">
          <div class="stat-top">
            <div class="stat-box red">&#x26A0;</div>
            <span class="stat-badge badge-red">ATEN&Ccedil;&Atilde;O</span>
          </div>
          <div class="stat-value text-red">{{ store.stats.lowStockProducts }}</div>
          <div class="stat-label">ESTOQUE BAIXO</div>
          <div class="stat-bar"><div class="bar-fill red" :style="{ width: Math.min(store.stats.lowStockProducts * 10, 100) + '%' }"></div></div>
        </div>

        <div class="stat-card">
          <div class="stat-top">
            <div class="stat-box blue">&#x1F4CA;</div>
            <span class="stat-badge badge-blue">M&Eacute;DIA</span>
          </div>
          <div class="stat-value" style="color: var(--blue)">R$ {{ store.stats.averageOrderValue.toFixed(2) }}</div>
          <div class="stat-label">TICKET M&Eacute;DIO</div>
          <div class="stat-bar"><div class="bar-fill blue" style="width: 55%"></div></div>
        </div>
      </div>

      <!-- Charts -->
      <div class="charts-grid animate-slideUp">
        <!-- Revenue Chart -->
        <div class="chart-card">
          <div class="card-header">
            <h3>[ RECEITA POR DIA ]</h3>
            <span class="badge badge-green">{{ store.revenueByDay.length }} DIAS</span>
          </div>
          <div class="card-body">
            <div v-if="store.revenueByDay.length === 0" class="empty">SEM DADOS</div>
            <div v-else class="bar-chart">
              <div v-for="(day, idx) in store.revenueByDay.slice(-14)" :key="idx" class="bar-col">
                <div class="bar-wrapper">
                  <div class="bar" :style="{ height: getBarHeight(day.revenue) + '%' }">
                    <div class="bar-tooltip">
                      <span class="tooltip-val">R$ {{ day.revenue.toFixed(2) }}</span>
                      <span class="tooltip-date">{{ day.date }}</span>
                    </div>
                  </div>
                </div>
                <span class="bar-label">{{ formatBarDate(day.date) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Orders by Status -->
        <div class="chart-card">
          <div class="card-header">
            <h3>[ PEDIDOS POR STATUS ]</h3>
          </div>
          <div class="card-body">
            <div v-if="store.ordersByStatus.length === 0" class="empty">SEM DADOS</div>
            <div v-else class="status-list">
              <div v-for="item in store.ordersByStatus" :key="item.status" class="status-row">
                <span class="status-name">{{ getStatusLabel(item.status) }}</span>
                <div class="status-bar-wrap">
                  <div class="status-bar" :style="{ width: getStatusWidth(item.count) + '%' }"></div>
                </div>
                <span class="status-count">{{ item.count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom -->
      <div class="bottom-grid animate-slideUp">
        <!-- Top Products -->
        <div class="data-card">
          <div class="card-header">
            <h3>[ TOP PRODUTOS ]</h3>
          </div>
          <div class="card-body">
            <div v-if="store.topProducts.length === 0" class="empty">SEM DADOS</div>
            <div v-else class="product-list">
              <div v-for="(prod, idx) in store.topProducts.slice(0, 10)" :key="idx" class="product-row">
                <span class="product-rank" :class="getRankClass(idx)">{{ idx + 1 }}</span>
                <div class="product-info">
                  <span class="product-name">{{ prod.product_name }}</span>
                  <span class="product-meta">{{ prod.totalQuantity }} VENDAS</span>
                </div>
                <span class="product-rev">R$ {{ prod.totalRevenue.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Orders -->
        <div class="data-card">
          <div class="card-header">
            <h3>[ PEDIDOS RECENTES ]</h3>
            <router-link to="/pedidos" class="card-link">VER TODOS &rarr;</router-link>
          </div>
          <div class="card-body">
            <div v-if="store.recentOrders.length === 0" class="empty">SEM PEDIDOS RECENTES</div>
            <div v-else class="order-list">
              <div v-for="order in store.recentOrders.slice(0, 8)" :key="order.id" class="order-row">
                <div class="order-avatar">
                  {{ (order.customer_name || order.customer_email || '?').charAt(0).toUpperCase() }}
                </div>
                <div class="order-info">
                  <span class="order-name">{{ order.customer_name || order.customer_email }}</span>
                  <span class="order-meta">{{ order.order_number || '#' + order.id?.toString().slice(0, 8) }} // {{ formatTimeAgo(order.created_at) }}</span>
                </div>
                <div class="order-right">
                  <span class="order-total">R$ {{ order.total?.toFixed(2) || '0.00' }}</span>
                  <span class="badge" :class="getStatusBadge(order.status)">{{ getStatusLabel(order.status) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useDashboardStore } from '../stores/dashboard'

const store = useDashboardStore()
const daysRange = ref(30)

function getStatusLabel(status) {
  const labels = {
    pending: 'PENDENTE',
    paid: 'PAGO',
    processing: 'PROCESSANDO',
    shipped: 'ENVIADO',
    delivered: 'ENTREGUE',
    cancelled: 'CANCELADO',
    refunded: 'REEMBOLSADO'
  }
  return labels[status] || status.toUpperCase()
}

function getStatusBadge(status) {
  const badges = {
    pending: 'badge-yellow',
    paid: 'badge-green',
    processing: 'badge-blue',
    shipped: 'badge-purple',
    delivered: 'badge-green',
    cancelled: 'badge-red',
    refunded: 'badge-purple'
  }
  return badges[status] || 'badge-purple'
}

function getBarHeight(revenue) {
  const maxRevenue = Math.max(...store.revenueByDay.map(d => d.revenue), 1)
  return Math.max((revenue / maxRevenue) * 100, 5)
}

function getStatusWidth(count) {
  const total = store.ordersByStatus.reduce((sum, s) => sum + s.count, 0) || 1
  return (count / total) * 100
}

function formatBarDate(dateStr) {
  const date = new Date(dateStr)
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'N/A'
  const now = new Date()
  const time = new Date(timestamp)
  const diff = Math.floor((now - time) / 1000)
  if (diff < 60) return `${diff}S`
  if (diff < 3600) return `${Math.floor(diff / 60)}M`
  if (diff < 86400) return `${Math.floor(diff / 3600)}H`
  return `${Math.floor(diff / 86400)}D`
}

function getRankClass(idx) {
  if (idx === 0) return 'rank-1'
  if (idx === 1) return 'rank-2'
  if (idx === 2) return 'rank-3'
  return ''
}

async function refreshData() {
  await store.fetchDashboardStats(parseInt(daysRange.value))
  await store.fetchRevenueByDay(parseInt(daysRange.value))
  await store.fetchTopProducts(10)
}

onMounted(async () => {
  await refreshData()
})
</script>

<style scoped>
.metrics-view {
  max-width: 1440px;
  margin: 0 auto;
}

/* Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-8);
  gap: var(--space-6);
  flex-wrap: wrap;
  padding-bottom: var(--space-6);
  border-bottom: var(--border);
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--green);
  letter-spacing: 1px;
  margin-bottom: var(--space-1);
}

.page-subtitle {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--text-muted);
}

.page-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.page-controls .input {
  width: auto;
  min-width: 140px;
}

/* Loading */
.loading-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  gap: var(--space-4);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
}

.loading-block {
  width: 48px;
  height: 48px;
  border: var(--border);
  border-top-color: var(--purple);
  animation: spin 1s linear infinite;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.stat-card {
  background: var(--bg-surface);
  border: var(--border);
  padding: var(--space-5);
  position: relative;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
}

.stat-card:nth-child(1)::before { background: var(--purple); }
.stat-card:nth-child(2)::before { background: var(--yellow); }
.stat-card:nth-child(3)::before { background: var(--green); }
.stat-card:nth-child(4)::before { background: var(--cyan); }
.stat-card:nth-child(5)::before { background: var(--red); }
.stat-card:nth-child(6)::before { background: var(--blue); }

.stat-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

.stat-box {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  border: var(--border);
}

.stat-box.purple { background: var(--purple-bg); }
.stat-box.yellow { background: var(--yellow-bg); }
.stat-box.green { background: var(--green-bg); }
.stat-box.cyan { background: var(--cyan-bg); }
.stat-box.red { background: var(--red-bg); }
.stat-box.blue { background: var(--blue-bg); }

.stat-value {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: var(--space-1);
  line-height: 1;
}

.stat-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-muted);
  margin-bottom: var(--space-4);
}

.stat-bar {
  height: 4px;
  background: var(--bg-elevated);
}

.bar-fill {
  height: 100%;
  transition: width 0.5s ease;
}

.bar-fill.purple { background: var(--purple); }
.bar-fill.yellow { background: var(--yellow); }
.bar-fill.green { background: var(--green); }
.bar-fill.cyan { background: var(--cyan); }
.bar-fill.red { background: var(--red); }
.bar-fill.blue { background: var(--blue); }

/* Charts Grid */
.charts-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.chart-card {
  background: var(--bg-surface);
  border: var(--border);
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

.card-body {
  padding: var(--space-5);
  min-height: 200px;
}

/* Bar Chart */
.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  height: 180px;
}

.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.bar-wrapper {
  position: relative;
  width: 100%;
  height: 160px;
  display: flex;
  align-items: flex-end;
}

.bar {
  width: 100%;
  height: 100%;
  background: var(--purple);
  position: relative;
  transition: height 0.3s ease;
}

.bar:hover {
  background: var(--purple-light);
}

.bar:hover .bar-tooltip {
  opacity: 1;
  transform: translateY(0);
}

.bar-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translate(-50%, -4px);
  background: var(--bg-elevated);
  border: var(--border);
  padding: var(--space-2) var(--space-3);
  opacity: 0;
  pointer-events: none;
  transition: all var(--transition);
  z-index: 10;
  white-space: nowrap;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.tooltip-val {
  font-size: 12px;
  font-weight: 700;
  color: var(--green);
}

.tooltip-date {
  font-size: 9px;
  color: var(--text-muted);
}

.bar-label {
  font-size: 9px;
  color: var(--text-muted);
  font-weight: 600;
}

/* Status List */
.status-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.status-name {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  width: 100px;
  flex-shrink: 0;
}

.status-bar-wrap {
  flex: 1;
  height: 16px;
  background: var(--bg-elevated);
  border: var(--border-light);
}

.status-bar {
  height: 100%;
  background: var(--purple);
  transition: width 0.5s ease;
}

.status-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--green);
  width: 40px;
  text-align: right;
  flex-shrink: 0;
}

/* Bottom Grid */
.bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.data-card {
  background: var(--bg-surface);
  border: var(--border);
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
  text-decoration: underline;
}

/* Empty */
.empty {
  text-align: center;
  padding: var(--space-8);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
}

/* Product List */
.product-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.product-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  transition: background var(--transition);
}

.product-row:hover {
  background: var(--purple-bg);
}

.product-rank {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  background: var(--bg-elevated);
  border: var(--border-light);
  flex-shrink: 0;
}

.rank-1 { background: var(--purple); color: white; border-color: var(--purple); }
.rank-2 { background: var(--bg-elevated); border-color: var(--text-muted); }
.rank-3 { background: var(--bg-elevated); border-color: var(--text-muted); }

.product-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.product-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.product-meta {
  font-size: 9px;
  color: var(--text-muted);
  font-weight: 700;
  letter-spacing: 0.5px;
}

.product-rev {
  font-size: 11px;
  font-weight: 700;
  color: var(--green);
  flex-shrink: 0;
}

/* Order List */
.order-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.order-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  transition: background var(--transition);
}

.order-row:hover {
  background: var(--purple-bg);
}

.order-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--purple);
  color: white;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.order-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.order-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.order-meta {
  font-size: 9px;
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 0.5px;
}

.order-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
}

.order-total {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
}

/* Responsive */
@media (max-width: 1200px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1024px) {
  .bottom-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
  }

  .page-controls {
    width: 100%;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .page-title {
    font-size: 18px;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
