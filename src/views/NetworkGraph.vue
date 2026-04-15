<template>
  <div class="network-graph">
    <!-- Toolbar -->
    <div class="graph-toolbar">
      <div class="toolbar-left">
        <h3 class="toolbar-title">&gt; REDE EM TEMPO REAL</h3>
        <div class="connection-status" :class="{ connected: networkStore.isConnected }">
          <span class="status-dot"></span>
          <span>{{ networkStore.isConnected ? 'CONECTADO' : 'DESCONECTADO' }}</span>
        </div>
      </div>

      <div class="toolbar-center">
        <div class="filter-buttons">
          <button
            v-for="filter in filters"
            :key="filter.value"
            :class="{ active: networkStore.nodeFilter === filter.value }"
            @click="networkStore.setFilter(filter.value)"
            class="filter-btn"
          >
            {{ filter.label }} <span class="filter-count">{{ filter.count }}</span>
          </button>
        </div>
      </div>

      <div class="toolbar-right">
        <button @click="refreshGraph" :disabled="networkStore.loading" class="btn btn-icon" title="Atualizar">&#x27F3;</button>
        <button @click="resetView" class="btn btn-icon" title="Resetar">&#x2302;</button>
      </div>
    </div>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="stat-item purple">
        <span class="stat-icon">&#x1F3EA;</span>
        <span class="stat-value text-purple">{{ networkStore.nodeCounts.store || 0 }}</span>
        <span class="stat-label">LOJAS</span>
      </div>
      <div class="stat-item green">
        <span class="stat-icon">&#x1F4B3;</span>
        <span class="stat-value text-green">{{ networkStore.nodeCounts.gateway || 0 }}</span>
        <span class="stat-label">GATEWAYS</span>
      </div>
      <div class="stat-item red">
        <span class="stat-icon">&#x1F6D2;</span>
        <span class="stat-value text-red">{{ networkStore.nodeCounts.order || 0 }}</span>
        <span class="stat-label">PEDIDOS</span>
      </div>
      <div class="stat-item cyan">
        <span class="stat-icon">&#x1F4E6;</span>
        <span class="stat-value text-cyan">{{ networkStore.nodeCounts.product || 0 }}</span>
        <span class="stat-label">PRODUTOS</span>
      </div>
      <div class="stat-item purple">
        <span class="stat-icon">&#x1F517;</span>
        <span class="stat-value text-purple">{{ networkStore.connectionCount }}</span>
        <span class="stat-label">CONEX&Otilde;ES</span>
      </div>
      <div v-if="networkStore.lastActivity" class="stat-item green">
        <span class="stat-icon">&#x23F1;</span>
        <span class="stat-value text-green">{{ formatTimeAgo(networkStore.lastActivity) }}</span>
        <span class="stat-label">&Uacute;LTIMA ATIV.</span>
      </div>
    </div>

    <!-- Graph Canvas -->
    <div class="graph-wrapper">
      <div ref="graphContainer" class="graph-canvas"></div>

      <!-- Loading -->
      <div v-if="networkStore.loading" class="loading-overlay">
        <div class="loading-square"></div>
        <span>CONSTRUINDO GRAFO...</span>
      </div>
    </div>

    <!-- Node Detail Panel -->
    <div v-if="networkStore.selectedNode" class="node-panel">
      <div class="panel-header">
        <h4>[ DETALHES DO N&Oacute; ]</h4>
        <button @click="networkStore.clearSelection()" class="close-btn">&times;</button>
      </div>
      <div class="panel-body">
        <div class="detail-row">
          <span class="detail-label">ID</span>
          <span class="detail-value">{{ networkStore.selectedNode.id }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">TIPO</span>
          <span class="detail-value">{{ networkStore.selectedNode.type }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">NOME</span>
          <span class="detail-value">{{ networkStore.selectedNode.label }}</span>
        </div>

        <template v-if="networkStore.selectedNode.type === 'store'">
          <div class="detail-row"><span class="detail-label">FONTE</span><span class="detail-value">{{ networkStore.selectedNode.source }}</span></div>
          <div class="detail-row"><span class="detail-label">PEDIDOS</span><span class="detail-value">{{ networkStore.selectedNode.order_count }}</span></div>
          <div class="detail-row"><span class="detail-label">RECEITA</span><span class="detail-value text-green">R$ {{ networkStore.selectedNode.revenue?.toFixed(2) || '0.00' }}</span></div>
          <div class="detail-row"><span class="detail-label">&Uacute;LTIMO SYNC</span><span class="detail-value">{{ formatTimeAgo(networkStore.selectedNode.last_sync) }}</span></div>
        </template>

        <template v-if="networkStore.selectedNode.type === 'gateway'">
          <div class="detail-row"><span class="detail-label">PROVIDER</span><span class="detail-value">{{ networkStore.selectedNode.provider }}</span></div>
          <div class="detail-row"><span class="detail-label">TRANS.</span><span class="detail-value">{{ networkStore.selectedNode.transaction_count }}</span></div>
          <div class="detail-row"><span class="detail-label">RECEITA</span><span class="detail-value text-green">R$ {{ networkStore.selectedNode.total_revenue?.toFixed(2) || '0.00' }}</span></div>
          <div class="detail-row"><span class="detail-label">STATUS</span><span class="detail-value" :class="networkStore.selectedNode.status === 'active' ? 'text-green' : 'text-red'">{{ networkStore.selectedNode.status }}</span></div>
        </template>

        <template v-if="networkStore.selectedNode.type === 'order'">
          <div class="detail-row"><span class="detail-label">CLIENTE</span><span class="detail-value">{{ networkStore.selectedNode.customer_name }}</span></div>
          <div class="detail-row"><span class="detail-label">EMAIL</span><span class="detail-value">{{ networkStore.selectedNode.customer_email }}</span></div>
          <div class="detail-row"><span class="detail-label">TOTAL</span><span class="detail-value text-green">R$ {{ networkStore.selectedNode.total?.toFixed(2) || '0.00' }}</span></div>
          <div class="detail-row"><span class="detail-label">STATUS</span><span class="detail-value">{{ networkStore.selectedNode.status }}</span></div>
          <div class="detail-row"><span class="detail-label">PAGAMENTO</span><span class="detail-value">{{ networkStore.selectedNode.payment_method }}</span></div>
          <div class="detail-row"><span class="detail-label">CRIADO</span><span class="detail-value">{{ formatTimeAgo(networkStore.selectedNode.created_at) }}</span></div>
        </template>

        <template v-if="networkStore.selectedNode.type === 'product'">
          <div class="detail-row"><span class="detail-label">VENDAS</span><span class="detail-value">{{ networkStore.selectedNode.sales_count }}</span></div>
          <div class="detail-row"><span class="detail-label">RECEITA</span><span class="detail-value text-green">R$ {{ networkStore.selectedNode.total_revenue?.toFixed(2) || '0.00' }}</span></div>
          <div class="detail-row"><span class="detail-label">PRE&Ccedil;O</span><span class="detail-value">R$ {{ networkStore.selectedNode.price?.toFixed(2) || '0.00' }}</span></div>
        </template>

        <template v-if="networkStore.selectedNode.type === 'config'">
          <div class="detail-row"><span class="detail-label">TIPO</span><span class="detail-value">{{ networkStore.selectedNode.config_type }}</span></div>
          <div class="detail-row"><span class="detail-label">STATUS</span><span class="detail-value" :class="networkStore.selectedNode.enabled ? 'text-green' : 'text-red'">{{ networkStore.selectedNode.enabled ? 'ATIVO' : 'INATIVO' }}</span></div>
          <div v-if="networkStore.selectedNode.location" class="detail-row"><span class="detail-label">LOCAL</span><span class="detail-value">{{ networkStore.selectedNode.location }}</span></div>
          <div v-if="networkStore.selectedNode.provider" class="detail-row"><span class="detail-label">PROVEDOR</span><span class="detail-value">{{ networkStore.selectedNode.provider }}</span></div>
        </template>
      </div>
    </div>

    <!-- Live Events Feed -->
    <div class="events-feed">
      <div class="feed-header">
        <h4>[ EVENTOS AO VIVO ]</h4>
      </div>
      <div class="feed-body">
        <div v-for="event in networkStore.recentEvents.slice(0, 10)" :key="event.id" class="event-item" :class="`event-${event.eventType.toLowerCase()}`">
          <span class="event-icon">{{ getEventIcon(event.eventType) }}</span>
          <span class="event-text">{{ getEventText(event) }}</span>
          <span class="event-time">{{ formatTimeAgo(event.timestamp) }}</span>
        </div>
        <div v-if="networkStore.recentEvents.length === 0" class="empty-events">
          AGUARDANDO EVENTOS<span class="animate-pulse">...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Network, DataSet } from 'vis-network/standalone'
import { useNetworkStore } from '../stores/network'
import { useShopConfigStore } from '../stores/shopConfig'

const networkStore = useNetworkStore()
const shopConfig = useShopConfigStore()
const graphContainer = ref(null)
let networkInstance = null
let nodesDataSet = null
let edgesDataSet = null

const filters = [
  { value: 'all', label: 'TODOS' },
  { value: 'store', label: 'LOJAS' },
  { value: 'gateway', label: 'GATEWAYS' },
  { value: 'order', label: 'PEDIDOS' },
  { value: 'product', label: 'PRODUTOS' },
  { value: 'config', label: 'CONFIG' },
].map(f => ({ ...f, get count() {
  if (f.value === 'all') return networkStore.nodes.length
  return (networkStore.nodes || []).filter(n => n.type === f.value).length
}}))

const nodeConfig = {
  store: { color: '#8B5CF6', size: 40, shape: 'square', font: { color: '#8B5CF6', size: 14, face: 'JetBrains Mono' } },
  gateway: { color: '#00FF41', size: 35, shape: 'diamond', font: { color: '#00FF41', size: 12, face: 'JetBrains Mono' } },
  order: { color: '#FF3347', size: 20, shape: 'dot', font: { color: '#FF3347', size: 10, face: 'JetBrains Mono' } },
  product: { color: '#00E5FF', size: 15, shape: 'dot', font: { color: '#00E5FF', size: 10, face: 'JetBrains Mono' } },
  config: { color: '#FFB800', size: 25, shape: 'triangle', font: { color: '#FFB800', size: 11, face: 'JetBrains Mono' } },
}

function formatVisNodes(nodes) {
  return nodes.map(node => {
    const config = nodeConfig[node.type] || nodeConfig.product
    return { id: node.id, label: node.label, type: node.type, ...config, borderWidth: 2, shadow: false }
  })
}

function formatVisEdges(edges) {
  return edges.map(edge => ({
    ...edge,
    color: { color: edge.color?.color || '#2A2A35' },
    width: edge.value ? Math.max(1, Math.min(4, edge.value / 10)) : 1,
    font: { align: 'top', size: 9, color: '#606070', face: 'JetBrains Mono' },
    smooth: { type: 'continuous', roundness: 0.2 }
  }))
}

function initNetwork() {
  if (!graphContainer.value) return

  nodesDataSet = new DataSet(formatVisNodes(networkStore.filteredNodes))
  edgesDataSet = new DataSet(formatVisEdges(networkStore.edges))

  const options = {
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: { gravitationalConstant: -80, centralGravity: 0.01, springLength: 150, springConstant: 0.05, damping: 0.4 },
      stabilization: { enabled: true, iterations: 100, fit: true }
    },
    interaction: { hover: true, tooltipDelay: 100, dragNodes: true, dragView: true, zoomView: true },
    nodes: { borderWidth: 2, shadow: false },
    edges: { hoverWidth: 0.5, selectionWidth: 2, smooth: { enabled: true, type: 'continuous', roundness: 0.2 } },
    autoResize: true
  }

  networkInstance = new Network(graphContainer.value, { nodes: nodesDataSet, edges: edgesDataSet }, options)

  networkInstance.on('click', (params) => {
    if (params.nodes.length > 0) networkStore.selectNode(params.nodes[0])
    else networkStore.clearSelection()
  })

  networkInstance.on('stabilizationIterationsDone', () => {
    networkInstance.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } })
  })
}

function updateGraph() {
  if (!nodesDataSet || !edgesDataSet) return
  nodesDataSet.clear()
  edgesDataSet.clear()
  nodesDataSet.add(formatVisNodes(networkStore.filteredNodes))
  edgesDataSet.add(formatVisEdges(networkStore.edges))
}

async function refreshGraph() {
  await networkStore.buildGraph()
  // Also fetch shop config to add config nodes
  try {
    await shopConfig.fetchConfig()
  } catch (e) {
    // Config might not exist
  }
  updateGraph()
}

function resetView() {
  if (networkInstance) networkInstance.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } })
}

function getEventIcon(eventType) {
  const icons = { INSERT: '+', UPDATE: '~', DELETE: 'x' }
  return icons[eventType] || '?'
}

function getEventText(event) {
  const names = { orders: 'PEDIDO', webhook_events: 'WEBHOOK', third_party_sync_log: 'SYNC' }
  const name = names[event.table] || event.table
  return `${event.eventType} // ${name}`
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'N/A'
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (diff < 60) return `${diff}S`
  if (diff < 3600) return `${Math.floor(diff / 60)}M`
  if (diff < 86400) return `${Math.floor(diff / 3600)}H`
  return `${Math.floor(diff / 86400)}D`
}

watch(() => networkStore.nodeFilter, updateGraph)
watch(() => networkStore.nodes, updateGraph, { deep: true })
watch(() => networkStore.edges, updateGraph, { deep: true })

onMounted(async () => {
  await networkStore.buildGraph()
  setTimeout(() => initNetwork(), 100)
  networkStore.subscribeToRealtime()
})

onUnmounted(async () => {
  if (networkInstance) { networkInstance.destroy(); networkInstance = null }
  await networkStore.unsubscribe()
})
</script>

<style scoped>
.network-graph {
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  border: var(--border);
}

/* Toolbar */
.graph-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-5);
  background: var(--bg-surface);
  border-bottom: var(--border);
  gap: var(--space-4);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.toolbar-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--purple);
  letter-spacing: 1px;
  margin: 0;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--red-bg);
  border: 1px solid var(--red);
}

.connection-status.connected {
  background: var(--green-bg);
  border-color: var(--green);
}

.status-dot {
  width: 8px;
  height: 8px;
  background: var(--red);
  animation: pulse 2s infinite;
}

.connection-status.connected .status-dot {
  background: var(--green);
}

.connection-status span:last-child {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--red);
}

.connection-status.connected span:last-child {
  color: var(--green);
}

.toolbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.filter-buttons {
  display: flex;
  gap: var(--space-2);
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-base);
  border: var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  transition: all var(--transition);
}

.filter-btn:hover {
  background: var(--bg-elevated);
  border-color: var(--purple);
  color: var(--purple);
}

.filter-btn.active {
  background: var(--purple);
  border-color: var(--purple);
  color: var(--bg-base);
}

.filter-count {
  padding: 1px 4px;
  background: var(--bg-elevated);
  font-size: 9px;
}

.filter-btn.active .filter-count {
  background: var(--purple-dark);
  color: white;
}

.toolbar-right {
  display: flex;
  gap: var(--space-2);
}

/* Stats Bar */
.stats-bar {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  background: var(--bg-elevated);
  border-bottom: var(--border);
  overflow-x: auto;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-5);
  background: var(--bg-surface);
  border: var(--border);
  min-width: 100px;
  position: relative;
}

.stat-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
}

.stat-item.purple::before { background: var(--purple); }
.stat-item.green::before { background: var(--green); }
.stat-item.red::before { background: var(--red); }
.stat-item.cyan::before { background: var(--cyan); }

.stat-icon { font-size: 16px; }

.stat-value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-muted);
}

/* Graph Canvas */
.graph-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.graph-canvas {
  width: 100%;
  height: 100%;
  background: var(--bg-base);
}

:deep(canvas) {
  background: var(--bg-base) !important;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-base);
  gap: var(--space-4);
}

.loading-square {
  width: 40px;
  height: 40px;
  border: var(--border);
  border-top-color: var(--purple);
  animation: spin 1s linear infinite;
}

.loading-overlay span {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--purple);
}

/* Node Detail Panel */
.node-panel {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  width: 280px;
  max-height: calc(100% - 100px);
  background: var(--bg-surface);
  border: var(--border);
  overflow: hidden;
  z-index: 10;
}

.node-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--purple);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-bottom: var(--border);
}

.panel-header h4 {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--purple);
  margin: 0;
}

.close-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  transition: all var(--transition);
}

.close-btn:hover {
  background: var(--red);
  border-color: var(--red);
  color: white;
}

.panel-body {
  padding: var(--space-4);
  overflow-y: auto;
  max-height: 400px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: var(--border-light);
  gap: var(--space-3);
}

.detail-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.detail-value {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
  word-break: break-word;
}

/* Events Feed */
.events-feed {
  position: absolute;
  bottom: var(--space-4);
  left: var(--space-4);
  width: 300px;
  max-height: 250px;
  background: var(--bg-surface);
  border: var(--border);
  overflow: hidden;
  z-index: 10;
}

.feed-header {
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-bottom: var(--border);
}

.feed-header h4 {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--green);
  margin: 0;
}

.feed-body {
  max-height: 200px;
  overflow-y: auto;
}

.event-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-left: 3px solid;
  transition: background var(--transition);
}

.event-insert { border-color: var(--green); }
.event-update { border-color: var(--cyan); }
.event-delete { border-color: var(--red); }

.event-icon {
  font-size: 12px;
  font-weight: 700;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.event-text {
  flex: 1;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-primary);
}

.event-time {
  font-size: 9px;
  color: var(--text-muted);
  font-weight: 700;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.empty-events {
  text-align: center;
  padding: var(--space-6);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
}

/* Responsive */
@media (max-width: 1024px) {
  .node-panel { width: 260px; right: var(--space-3); }
  .events-feed { width: 260px; left: var(--space-3); }
}

@media (max-width: 768px) {
  .graph-toolbar {
    flex-direction: column;
    gap: var(--space-3);
  }

  .toolbar-center { width: 100%; }
  .filter-buttons { justify-content: center; flex-wrap: wrap; }

  .stats-bar {
    gap: var(--space-2);
    padding: var(--space-2);
  }

  .stat-item { min-width: 80px; padding: var(--space-2) var(--space-3); }
  .stat-value { font-size: 16px; }

  .node-panel, .events-feed {
    position: static;
    width: 100%;
    max-height: 200px;
    margin: var(--space-2);
  }
}
</style>
