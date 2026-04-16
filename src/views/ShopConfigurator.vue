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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10H3"/>
            <path d="M21 6H3"/>
            <path d="M21 14H3"/>
            <path d="M21 18H3"/>
          </svg>
          APPLY_LOCATION_RULES
        </button>
        <button @click="saveAllConfig" class="btn-primary" :disabled="saving">
          <svg v-if="!saving" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          <svg v-else class="spinner-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"/>
          </svg>
          {{ saving ? 'SAVING...' : 'SAVE_ALL' }}
        </button>
      </div>
    </div>

    <div class="config-layout">
      <!-- Left Panel: Product Types -->
      <div class="config-panel">
        <h2 class="panel-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          PRODUCT_TYPES
        </h2>
        <div class="product-list">
          <div
            v-for="pt in shopConfig.productTypes"
            :key="pt"
            class="product-item"
            :class="{ active: selectedProductType === pt }"
            @click="selectedProductType = pt"
          >
            <div class="product-header">
              <span class="product-icon">
                <svg v-if="pt === 'tshirt'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20.38 3.46L16 2 12 5 8 2 3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10h12V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>
                </svg>
                <svg v-else-if="pt === 'mug'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
                  <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
                  <line x1="6" y1="2" x2="6" y2="4"/>
                  <line x1="10" y1="2" x2="10" y2="4"/>
                  <line x1="14" y1="2" x2="14" y2="4"/>
                </svg>
                <svg v-else-if="pt === 'smug'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
                  <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
                  <line x1="6" y1="2" x2="6" y2="4"/>
                  <line x1="10" y1="2" x2="10" y2="4"/>
                  <line x1="14" y1="2" x2="14" y2="4"/>
                </svg>
                <svg v-else-if="pt === 'book'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                </svg>
                <svg v-else-if="pt === 'accessory'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else-if="pt === 'art'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 8.25 4.078 7.5 7.5 0 0 0 12 3z"/>
                  <path d="M19 9c0 .5.5 1 1 1.5s1 1 1 1.5-.5 1-1 1.5-1 1-1 1.5"/>
                  <path d="M12 18c-1.5 0-2.5.5-3 1.5"/>
                </svg>
                <svg v-else-if="pt === 'digital'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </span>
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
                    <span class="checkmark"></span>
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
                    <span class="checkmark"></span>
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
                    <span class="checkmark"></span>
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
        <h2 class="panel-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          VISUAL_GRAPH
        </h2>
        <div class="graph-container">
          <div ref="graphContainer" class="graph-canvas"></div>
        </div>

        <!-- Legend -->
        <div class="graph-legend">
          <div class="legend-item">
            <span class="legend-dot legend-dot-product"></span>
            Product Type
          </div>
          <div class="legend-item">
            <span class="legend-dot legend-dot-provider"></span>
            Provider
          </div>
          <div class="legend-item">
            <span class="legend-dot legend-dot-gateway"></span>
            Payment Gateway
          </div>
          <div class="legend-item">
            <span class="legend-dot legend-dot-location"></span>
            Location Rule
          </div>
          <div class="legend-item">
            <span class="legend-dot legend-dot-method"></span>
            Payment Method
          </div>
        </div>
      </div>

      <!-- Right Panel: Gateways & Locations -->
      <div class="config-panel">
        <h2 class="panel-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
            <line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
          GATEWAYS
        </h2>
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

        <h2 class="panel-title" style="margin-top: var(--space-4);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="10" r="3"/>
            <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z"/>
          </svg>
          LOCATION_RULES
        </h2>
        <div class="location-rules">
          <div class="location-rule brazil">
            <h3>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="10" r="3"/>
                <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z"/>
              </svg>
              BRASIL
            </h3>
            <ul>
              <li>MercadoPago (pix, card, boleto)</li>
              <li>AbacatePay (pix, card, boleto)</li>
              <li>PixBricks (pix)</li>
              <li>UmaPenca (if provider = umapenca)</li>
            </ul>
          </div>
          <div class="location-rule international">
            <h3>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              INTERNATIONAL
            </h3>
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
  product_type: { color: '#C9A96E', shape: 'box', size: 30 },
  provider: { color: '#6B9DB8', shape: 'diamond', size: 25 },
  payment_gateway: { color: '#7DB87D', shape: 'ellipse', size: 20 },
  location_rule: { color: '#C4A86E', shape: 'triangle', size: 25 },
  payment_method: { color: '#B86B6B', shape: 'dot', size: 12 },
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
      font: { size: 10, face: 'Satoshi, -apple-system, sans-serif', color: '#F0EDE8' },
      shadow: false,
    },
    edges: {
      hoverWidth: 0.5,
      selectionWidth: 2,
      smooth: { enabled: true, type: 'continuous', roundness: 0.2 },
      font: { align: 'top', size: 8, color: '#9A9590', face: 'Satoshi, -apple-system, sans-serif' },
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
      color: edge.enabled ? '#4A4640' : '#2A2A2A',
    },
    dashes: !edge.enabled,
    font: { align: 'top', size: 8, color: '#9A9590' },
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
  font-variation-settings: "SOFT" 50, "WONK" 0;
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

.btn-flat {
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border: var(--border);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all var(--transition-base);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.btn-flat:hover {
  background: var(--bg-hover);
  border-color: var(--gold-border);
  color: var(--gold);
}

.btn-primary {
  padding: var(--space-2) var(--space-4);
  background: var(--gold);
  border: none;
  border-radius: var(--radius);
  color: var(--bg-base);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all var(--transition-base);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.btn-primary:hover:not(:disabled) {
  background: var(--gold-light);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
  border: var(--border);
  padding: var(--space-4);
  overflow-y: auto;
  max-height: calc(100vh - 200px);
  border-radius: var(--radius-md);
}

.panel-title {
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: var(--border);
  display: flex;
  align-items: center;
  gap: var(--space-2);
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
  border: var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition-base);
}

.product-item:hover {
  border-color: var(--gold-border);
}

.product-item.active {
  border-color: var(--gold-border-strong);
  background: var(--gold-bg);
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
  background: var(--gold);
  color: var(--bg-base);
  border-radius: var(--radius-sm);
}

.product-name {
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.product-config {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: var(--border);
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
  font-family: var(--font-sans);
  font-size: 0.7rem;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.flat-select-sm {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-base);
  border: var(--border);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  transition: all var(--transition-base);
}

.flat-select-sm:hover {
  border-color: rgba(255, 255, 255, 0.08);
}

.flat-select-sm:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px var(--gold-bg);
}

.gateway-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.75rem;
  font-family: var(--font-sans);
  cursor: pointer;
  position: relative;
}

.checkbox-item input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  display: inline-block;
  width: 14px;
  height: 14px;
  background: var(--bg-base);
  border: var(--border);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  position: relative;
}

.checkbox-item input[type="checkbox"]:checked ~ .checkmark {
  background: var(--gold);
  border-color: var(--gold);
}

.checkbox-item input[type="checkbox"]:checked ~ .checkmark::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 4px;
  height: 8px;
  border: solid var(--bg-base);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-item:hover .checkmark {
  border-color: var(--gold-border);
}

/* Graph Panel */
.graph-panel {
  background: var(--bg-surface);
  border: var(--border);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-md);
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
  border: var(--border);
  border-radius: var(--radius);
}

.graph-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: var(--border);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.7rem;
  font-family: var(--font-sans);
  color: var(--text-secondary);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot-product {
  background: var(--gold);
}

.legend-dot-provider {
  background: var(--info);
}

.legend-dot-gateway {
  background: var(--success);
}

.legend-dot-location {
  background: var(--warning);
}

.legend-dot-method {
  background: var(--danger);
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
  border: var(--border);
  border-radius: var(--radius);
  opacity: 0.5;
  transition: all var(--transition-base);
}

.gateway-item.enabled {
  opacity: 1;
  border-color: var(--success-border);
  background: var(--success-bg);
}

.gateway-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}

.gateway-name {
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.toggle-btn {
  padding: var(--space-1) var(--space-2);
  font-size: 0.65rem;
  font-family: var(--font-sans);
  font-weight: 700;
  background: var(--bg-base);
  border: var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-base);
}

.toggle-btn.active {
  background: var(--success);
  border-color: var(--success);
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
  padding: var(--space-1) var(--space-2);
  font-size: 0.6rem;
  font-family: var(--font-sans);
  background: var(--bg-base);
  border: var(--border);
  border-radius: var(--radius-sm);
  color: var(--info);
  transition: all var(--transition-fast);
}

.method-tag:hover {
  border-color: var(--info-border);
  background: var(--info-bg);
}

/* Location Rules */
.location-rules {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.location-rule {
  padding: var(--space-3);
  border: var(--border);
  border-radius: var(--radius);
  transition: all var(--transition-base);
}

.location-rule.brazil {
  border-color: var(--success-border);
  background: var(--success-bg);
}

.location-rule.international {
  border-color: var(--info-border);
  background: var(--info-bg);
}

.location-rule h3 {
  font-family: var(--font-sans);
  font-size: 0.85rem;
  margin: 0 0 var(--space-2) 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.location-rule.brazil h3 {
  color: var(--success);
}

.location-rule.international h3 {
  color: var(--info);
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
  font-family: var(--font-sans);
  position: relative;
  padding-left: var(--space-3);
}

.location-rule li::before {
  content: '\2022';
  position: absolute;
  left: 0;
  color: var(--text-muted);
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
