<template>
  <div class="shop-configurator">
    <!-- Header -->
    <div class="config-header">
      <div>
        <span class="page-label">SHOP CONFIGURATION</span>
        <h1 class="page-title">VISUAL_CONFIGURADOR</h1>
      </div>
      <div class="header-actions">
        <button @click="applyLocationRules" class="btn-flat">
          APPLY_LOCATION_RULES
        </button>
        <button @click="saveAllConfig" class="btn-primary" :disabled="saving">
          {{ saving ? 'SAVING...' : 'SAVE_ALL' }}
        </button>
      </div>
    </div>

    <div class="config-layout">
      <!-- Left Panel: Product Types -->
      <div class="config-panel">
        <h2 class="panel-title">[ PRODUCT_TYPES ]</h2>
        <div class="product-list">
          <div
            v-for="pt in shopConfig.productTypes"
            :key="pt"
            class="product-item"
            :class="{ active: selectedProductType === pt }"
            @click="selectedProductType = pt"
          >
            <div class="product-header">
              <span class="product-icon">{{ getProductIcon(pt) }}</span>
              <span class="product-name">{{ pt }}</span>
            </div>
            <div v-if="selectedProductType === pt" class="product-config">
              <div class="config-row">
                <label>Provider</label>
                <select
                  v-model="currentRule.provider"
                  class="flat-select-sm"
                >
                  <option v-for="provider in shopConfig.providers" :key="provider" :value="provider">
                    {{ provider }}
                  </option>
                </select>
              </div>

              <div class="config-row">
                <label>Gateways</label>
                <div class="gateway-checkboxes">
                  <label
                    v-for="gw in allGateways"
                    :key="gw"
                    class="checkbox-item"
                  >
                    <input
                      type="checkbox"
                      :checked="currentRule.gateways.includes(gw)"
                      @change="toggleGateway(gw)"
                    >
                    {{ gw }}
                  </label>
                </div>
              </div>

              <div class="config-row">
                <label>Brazil Only</label>
                <div class="gateway-checkboxes">
                  <label
                    v-for="gw in allGateways"
                    :key="gw"
                    class="checkbox-item"
                  >
                    <input
                      type="checkbox"
                      :checked="currentRule.location_overrides?.brazil?.includes(gw)"
                      @change="toggleLocationGateway('brazil', gw)"
                    >
                    {{ gw }}
                  </label>
                </div>
              </div>

              <div class="config-row">
                <label>International Only</label>
                <div class="gateway-checkboxes">
                  <label
                    v-for="gw in allGateways"
                    :key="gw"
                    class="checkbox-item"
                  >
                    <input
                      type="checkbox"
                      :checked="currentRule.location_overrides?.international?.includes(gw)"
                      @change="toggleLocationGateway('international', gw)"
                    >
                    {{ gw }}
                  </label>
                </div>
              </div>

              <div class="config-row">
                <label>Active</label>
                <input
                  type="checkbox"
                  v-model="currentRule.is_active"
                  class="flat-checkbox"
                >
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Center Panel: Visual Graph -->
      <div class="graph-panel">
        <h2 class="panel-title">[ VISUAL_GRAPH ]</h2>
        <div class="graph-container">
          <div ref="graphContainer" class="graph-canvas"></div>
        </div>

        <!-- Legend -->
        <div class="graph-legend">
          <div class="legend-item">
            <span class="legend-dot" style="background: #8B5CF6;"></span>
            Product Type
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background: #00E5FF;"></span>
            Provider
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background: #00FF41;"></span>
            Payment Gateway
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background: #FFB800;"></span>
            Location Rule
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background: #FF3347;"></span>
            Payment Method
          </div>
        </div>
      </div>

      <!-- Right Panel: Gateways & Locations -->
      <div class="config-panel">
        <h2 class="panel-title">[ GATEWAYS ]</h2>
        <div class="gateway-list">
          <div
            v-for="gw in shopConfig.gateways"
            :key="gw.id"
            class="gateway-item"
            :class="{ enabled: gw.enabled }"
          >
            <div class="gateway-header">
              <span class="gateway-name">{{ gw.gateway }}</span>
              <button
                @click="shopConfig.toggleGateway(gw.gateway)"
                class="toggle-btn"
                :class="{ active: gw.enabled }"
              >
                {{ gw.enabled ? 'ON' : 'OFF' }}
              </button>
            </div>
            <div class="gateway-details">
              <span class="gateway-provider">Provider: {{ gw.provider }}</span>
              <span class="gateway-location">Location: {{ gw.location_restriction }}</span>
              <div class="gateway-methods">
                <span
                  v-for="method in gw.supported_methods"
                  :key="method"
                  class="method-tag"
                >
                  {{ method }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <h2 class="panel-title" style="margin-top: var(--space-4);">[ LOCATION_RULES ]</h2>
        <div class="location-rules">
          <div class="location-rule brazil">
            <h3>BRASIL</h3>
            <ul>
              <li>MercadoPago (pix, card, boleto)</li>
              <li>AbacatePay (pix, card, boleto)</li>
              <li>PixBricks (pix)</li>
              <li>UmaPenca (if provider = umapenca)</li>
            </ul>
          </div>
          <div class="location-rule international">
            <h3>INTERNATIONAL</h3>
            <ul>
              <li>MercadoPago (pix, card, boleto)</li>
              <li>AbacatePay (pix, card, boleto)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Network, DataSet } from 'vis-network/standalone'
import { useShopConfigStore } from '../stores/shopConfig'

const shopConfig = useShopConfigStore()

const selectedProductType = ref('tshirt')
const graphContainer = ref(null)
let networkInstance = null
let nodesDataSet = null
let edgesDataSet = null
const saving = ref(false)

const allGateways = ['mercadopago', 'abacatepay', 'pix_bricks', 'umapenca_native', 'paypal']

const currentRule = computed(() => {
  let rule = shopConfig.productRules.find(r => r.product_type === selectedProductType.value)
  if (!rule) {
    rule = {
      id: `rule_${selectedProductType.value}`,
      product_type: selectedProductType.value,
      provider: 'custom',
      gateways: [],
      location_overrides: {
        brazil: [],
        international: [],
      },
      priority: shopConfig.productRules.length + 1,
      is_active: true,
    }
    shopConfig.productRules.push(rule)
  }
  return rule
})

function getProductIcon(productType) {
  const icons = {
    tshirt: 'T',
    mug: 'M',
    smug: 'S',
    book: 'B',
    accessory: 'A',
    art: 'R',
    digital: 'D',
  }
  return icons[productType] || '?'
}

function toggleGateway(gw) {
  const rule = currentRule.value
  const idx = rule.gateways.indexOf(gw)
  if (idx >= 0) {
    rule.gateways.splice(idx, 1)
  } else {
    rule.gateways.push(gw)
  }
}

function toggleLocationGateway(location, gw) {
  const rule = currentRule.value
  if (!rule.location_overrides) {
    rule.location_overrides = { brazil: [], international: [] }
  }
  if (!rule.location_overrides[location]) {
    rule.location_overrides[location] = []
  }
  const idx = rule.location_overrides[location].indexOf(gw)
  if (idx >= 0) {
    rule.location_overrides[location].splice(idx, 1)
  } else {
    rule.location_overrides[location].push(gw)
  }
}

function applyLocationRules() {
  shopConfig.applyLocationRules()
}

async function saveAllConfig() {
  saving.value = true
  try {
    await shopConfig.saveConfig({
      payment_gateways: shopConfig.gateways,
      product_payment_rules: shopConfig.productRules,
    })
  } catch (err) {
    console.error('Error saving config:', err)
  } finally {
    saving.value = false
  }
}

// Graph visualization
const NODE_COLORS = {
  product_type: { color: '#8B5CF6', shape: 'box', size: 30 },
  provider: { color: '#00E5FF', shape: 'diamond', size: 25 },
  payment_gateway: { color: '#00FF41', shape: 'ellipse', size: 20 },
  location_rule: { color: '#FFB800', shape: 'triangle', size: 25 },
  payment_method: { color: '#FF3347', shape: 'dot', size: 12 },
}

function initGraph() {
  if (!graphContainer.value) return

  const graph = shopConfig.visualGraph
  nodesDataSet = new DataSet(formatNodes(graph.nodes))
  edgesDataSet = new DataSet(formatEdges(graph.edges))

  const options = {
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -50,
        centralGravity: 0.01,
        springLength: 120,
        springConstant: 0.05,
        damping: 0.4,
      },
      stabilization: { enabled: true, iterations: 100, fit: true },
    },
    interaction: { hover: true, tooltipDelay: 100, dragNodes: true, dragView: true, zoomView: true },
    nodes: {
      borderWidth: 2,
      font: { size: 10, face: 'JetBrains Mono, monospace', color: '#e0e0e0' },
      shadow: false,
    },
    edges: {
      hoverWidth: 0.5,
      selectionWidth: 2,
      smooth: { enabled: true, type: 'continuous', roundness: 0.2 },
      font: { align: 'top', size: 8, color: '#606070', face: 'JetBrains Mono, monospace' },
    },
    autoResize: true,
  }

  networkInstance = new Network(graphContainer.value, { nodes: nodesDataSet, edges: edgesDataSet }, options)

  networkInstance.on('click', (params) => {
    if (params.nodes.length > 0) {
      shopConfig.selectNode(params.nodes[0])
    } else {
      shopConfig.clearNodeSelection()
    }
  })
}

function formatNodes(nodes) {
  return nodes.map(node => {
    const config = NODE_COLORS[node.type] || NODE_COLORS.product_type
    return {
      id: node.id,
      label: node.label,
      ...config,
      borderWidth: 2,
      opacity: node.enabled ? 1 : 0.3,
    }
  })
}

function formatEdges(edges) {
  return edges.map(edge => ({
    from: edge.from,
    to: edge.to,
    label: edge.label,
    arrows: 'to',
    width: edge.enabled ? 1.5 : 0.5,
    color: {
      color: edge.enabled ? '#404050' : '#202030',
    },
    dashes: !edge.enabled,
    font: { align: 'top', size: 8, color: '#606070' },
    smooth: { type: 'continuous', roundness: 0.2 },
  }))
}

function updateGraph() {
  if (!nodesDataSet || !edgesDataSet) return
  const graph = shopConfig.visualGraph
  nodesDataSet.clear()
  edgesDataSet.clear()
  nodesDataSet.add(formatNodes(graph.nodes))
  edgesDataSet.add(formatEdges(graph.edges))
}

watch(() => shopConfig.gateways, updateGraph, { deep: true })
watch(() => shopConfig.productRules, updateGraph, { deep: true })

onMounted(async () => {
  await shopConfig.fetchConfig()
  setTimeout(() => initGraph(), 100)
})

onUnmounted(() => {
  if (networkInstance) {
    networkInstance.destroy()
    networkInstance = null
  }
})
</script>

<style scoped>
.shop-configurator {
  padding: var(--space-6);
  min-height: 100vh;
  background: var(--bg-base);
}

.config-header {
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

.btn-primary {
  padding: var(--space-2) var(--space-4);
  background: var(--purple);
  border: none;
  border-radius: 0;
  color: white;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
  background: var(--purple-light);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Layout */
.config-layout {
  display: grid;
  grid-template-columns: 280px 1fr 300px;
  gap: var(--space-4);
  min-height: calc(100vh - 200px);
}

.config-panel {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  padding: var(--space-4);
  overflow-y: auto;
  max-height: calc(100vh - 200px);
}

.panel-title {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--purple);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-color);
}

/* Product List */
.product-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.product-item {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.15s ease;
}

.product-item:hover {
  border-color: var(--purple);
}

.product-item.active {
  border-color: var(--purple);
  background: rgba(139, 92, 246, 0.1);
}

.product-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.product-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--purple);
  color: white;
  font-family: var(--font-mono);
}

.product-name {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
}

.product-config {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.config-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.config-row label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
  letter-spacing: 1px;
}

.flat-select-sm {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-base);
  border: 1px solid var(--border-color);
  border-radius: 0;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.gateway-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.75rem;
  font-family: var(--font-mono);
  cursor: pointer;
}

/* Graph Panel */
.graph-panel {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
}

.graph-container {
  flex: 1;
  min-height: 500px;
  position: relative;
}

.graph-canvas {
  width: 100%;
  height: 100%;
  background: var(--bg-base);
  border: 1px solid var(--border-color);
}

.graph-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-color);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.7rem;
  font-family: var(--font-mono);
  color: var(--text-muted);
}

.legend-dot {
  width: 10px;
  height: 10px;
}

/* Gateway List */
.gateway-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.gateway-item {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  opacity: 0.5;
  transition: all 0.15s ease;
}

.gateway-item.enabled {
  opacity: 1;
  border-color: var(--green);
}

.gateway-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}

.gateway-name {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
}

.toggle-btn {
  padding: var(--space-1) var(--space-2);
  font-size: 0.65rem;
  font-family: var(--font-mono);
  font-weight: 700;
  background: var(--bg-base);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.toggle-btn.active {
  background: var(--green);
  border-color: var(--green);
  color: var(--bg-base);
}

.gateway-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.gateway-provider,
.gateway-location {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.gateway-methods {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.method-tag {
  padding: var(--space-1) var(--space-1);
  font-size: 0.6rem;
  font-family: var(--font-mono);
  background: var(--bg-base);
  border: 1px solid var(--border-color);
  color: var(--cyan);
}

/* Location Rules */
.location-rules {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.location-rule {
  padding: var(--space-3);
  border: 1px solid var(--border-color);
}

.location-rule.brazil {
  border-color: var(--green);
  background: rgba(34, 197, 94, 0.05);
}

.location-rule.international {
  border-color: #3B82F6;
  background: rgba(59, 130, 246, 0.05);
}

.location-rule h3 {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  margin: 0 0 var(--space-2) 0;
}

.location-rule.brazil h3 {
  color: var(--green);
}

.location-rule.international h3 {
  color: #3B82F6;
}

.location-rule ul {
  margin: 0;
  padding-left: var(--space-4);
  list-style: none;
}

.location-rule li {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
  font-family: var(--font-mono);
}

/* Responsive */
@media (max-width: 1200px) {
  .config-layout {
    grid-template-columns: 1fr;
  }

  .config-panel {
    max-height: none;
  }

  .graph-container {
    min-height: 400px;
  }
}

@media (max-width: 768px) {
  .shop-configurator {
    padding: var(--space-4);
  }

  .config-header {
    flex-direction: column;
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
  }
}
</style>
