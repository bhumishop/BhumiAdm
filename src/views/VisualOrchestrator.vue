<template>
  <div class="visual-orchestrator">
    <!-- Header -->
    <div class="orchestrator-header">
      <div>
        <span class="page-label">INFRASTRUCTURE ORCHESTRATOR</span>
        <h1 class="page-title">VISUAL_ORCHESTRATOR</h1>
      </div>
      <div class="header-actions">
        <button @click="refreshAll" class="btn-flat" :disabled="infraStore.loading">
          REFRESH_ALL
        </button>
        <button @click="togglePanel" class="btn-flat">
          {{ showGraph ? 'TABLE_VIEW' : 'GRAPH_VIEW' }}
        </button>
      </div>
    </div>

    <!-- Overview Stats -->
    <div class="stats-bar">
      <div class="stat-item purple">
        <span class="stat-value">{{ infraStore.functionStatusCounts.active }}</span>
        <span class="stat-label">ACTIVE FUNCTIONS</span>
      </div>
      <div class="stat-item yellow">
        <span class="stat-value">{{ infraStore.functionStatusCounts.degraded }}</span>
        <span class="stat-label">DEGRADED</span>
      </div>
      <div class="stat-item red">
        <span class="stat-value">{{ infraStore.functionStatusCounts.error }}</span>
        <span class="stat-label">ERRORS</span>
      </div>
      <div class="stat-item green">
        <span class="stat-value">{{ infraStore.activeUsersCount }}</span>
        <span class="stat-label">ACTIVE USERS</span>
      </div>
      <div class="stat-item cyan">
        <span class="stat-value">{{ infraStore.sessionCount.total_sessions }}</span>
        <span class="stat-label">TOTAL SESSIONS</span>
      </div>
      <div class="stat-item red">
        <span class="stat-value">{{ infraStore.errorLogsCount }}</span>
        <span class="stat-label">ERROR LOGS</span>
      </div>
      <div v-if="infraStore.overview" class="stat-item green">
        <span class="stat-value">{{ infraStore.overview.success_rate }}%</span>
        <span class="stat-label">SUCCESS RATE</span>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="tab-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
        class="tab-btn"
      >
        {{ tab.label }}
        <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- ===== EDGE FUNCTIONS TAB ===== -->
      <div v-if="activeTab === 'functions'" class="tab-panel">
        <div class="panel-layout">
          <!-- Left: Function List -->
          <div class="panel-left">
            <h3 class="panel-title">[ EDGE_FUNCTIONS ]</h3>
            <div class="function-list">
              <div
                v-for="fn in infraStore.edgeFunctions"
                :key="fn.function_name"
                class="function-item"
                :class="{
                  active: infraStore.selectedFunction?.function_name === fn.function_name,
                  'fn-active': fn.status === 'active',
                  'fn-degraded': fn.status === 'degraded',
                  'fn-error': fn.status === 'error',
                }"
                @click="infraStore.selectFunction(fn)"
              >
                <div class="function-header">
                  <span class="function-status-dot" :class="`status-${fn.status}`"></span>
                  <span class="function-name">{{ fn.function_name }}</span>
                  <span class="function-calls">{{ fn.total_calls }}</span>
                </div>
                <div class="function-meta">
                  <span>Avg: {{ fn.avg_duration_ms?.toFixed(0) || 0 }}ms</span>
                  <span>Errors: {{ fn.error_calls }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Center: Function Detail + Test -->
          <div class="panel-center">
            <template v-if="infraStore.selectedFunction">
              <h3 class="panel-title">[ FUNCTION_DETAIL ]</h3>
              <div class="function-detail">
                <div class="detail-grid">
                  <div class="detail-row">
                    <span class="detail-label">NAME</span>
                    <span class="detail-value">{{ infraStore.selectedFunction.function_name }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">STATUS</span>
                    <span class="detail-value" :class="`status-${infraStore.selectedFunction.status}`">
                      {{ infraStore.selectedFunction.status.toUpperCase() }}
                    </span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">TOTAL CALLS</span>
                    <span class="detail-value">{{ infraStore.selectedFunction.total_calls }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">SUCCESS</span>
                    <span class="detail-value text-green">{{ infraStore.selectedFunction.success_calls }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">ERRORS</span>
                    <span class="detail-value text-red">{{ infraStore.selectedFunction.error_calls }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">AVG DURATION</span>
                    <span class="detail-value">{{ infraStore.selectedFunction.avg_duration_ms?.toFixed(2) || 'N/A' }}ms</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">LAST EXEC</span>
                    <span class="detail-value">{{ formatTime(infraStore.selectedFunction.last_execution) }}</span>
                  </div>
                  <div v-if="infraStore.selectedFunction.last_error" class="detail-row full">
                    <span class="detail-label">LAST ERROR</span>
                    <span class="detail-value text-red">{{ infraStore.selectedFunction.last_error }}</span>
                  </div>
                </div>

                <!-- Status Controls -->
                <div class="status-controls">
                  <label>SET STATUS:</label>
                  <div class="status-buttons">
                    <button
                      v-for="status in ['active', 'inactive', 'degraded', 'error']"
                      :key="status"
                      :class="[
                        'status-btn',
                        `status-btn-${status}`,
                        { active: infraStore.selectedFunction.status === status }
                      ]"
                      @click="infraStore.updateFunctionStatus(infraStore.selectedFunction.function_name, { status })"
                    >
                      {{ status.toUpperCase() }}
                    </button>
                  </div>
                </div>

                <!-- Test Section -->
                <div class="test-section">
                  <h4 class="section-title">[ TEST_FUNCTION ]</h4>
                  <div class="test-args">
                    <label>ARGS (JSON):</label>
                    <textarea
                      v-model="testArgsJson"
                      class="flat-textarea"
                      placeholder='{"key": "value"}'
                      rows="3"
                    ></textarea>
                    <button
                      @click="runTest"
                      class="btn-primary"
                      :disabled="infraStore.loading"
                    >
                      {{ infraStore.loading ? 'TESTING...' : 'RUN_TEST' }}
                    </button>
                  </div>
                  <div v-if="infraStore.functionTestResult" class="test-result">
                    <h5>RESULT:</h5>
                    <pre class="result-json">{{ JSON.stringify(infraStore.functionTestResult, null, 2) }}</pre>
                  </div>
                </div>
              </div>
            </template>
            <div v-else class="empty-state">
              SELECT A FUNCTION TO VIEW DETAILS
            </div>
          </div>
        </div>
      </div>

      <!-- ===== CONNECTIONS / DB RELATIONS TAB ===== -->
      <div v-if="activeTab === 'connections'" class="tab-panel">
        <div class="panel-layout full-height">
          <div class="graph-panel">
            <h3 class="panel-title">[ DATABASE_RELATIONS_GRAPH ]</h3>
            <div ref="connectionsGraphRef" class="graph-canvas"></div>
            <div class="graph-legend">
              <div class="legend-item"><span class="legend-dot" style="background: #8B5CF6;"></span> Edge Function</div>
              <div class="legend-item"><span class="legend-dot" style="background: #00E5FF;"></span> Database Table</div>
              <div class="legend-item"><span class="legend-dot" style="background: #00FF41;"></span> Active</div>
              <div class="legend-item"><span class="legend-dot" style="background: #FF3347;"></span> Error</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== OPERATIONS LOGS TAB ===== -->
      <div v-if="activeTab === 'logs'" class="tab-panel">
        <div class="log-controls">
          <h3 class="panel-title">[ OPERATION_LOGS ]</h3>
          <div class="log-filters">
            <select v-model="logStatusFilter" @change="applyLogFilters" class="flat-select-sm">
              <option value="">ALL STATUS</option>
              <option value="success">SUCCESS</option>
              <option value="error">ERROR</option>
              <option value="running">RUNNING</option>
              <option value="timeout">TIMEOUT</option>
            </select>
            <select v-model="logOperationFilter" @change="applyLogFilters" class="flat-select-sm">
              <option value="">ALL OPERATIONS</option>
              <option value="edge_function_test">EDGE_FUNCTION_TEST</option>
              <option value="edge_function_call">EDGE_FUNCTION_CALL</option>
              <option value="db_query">DB_QUERY</option>
              <option value="config_change">CONFIG_CHANGE</option>
              <option value="auth">AUTH</option>
            </select>
            <button @click="infraStore.fetchOperationLogs" class="btn-flat">REFRESH_LOGS</button>
          </div>
        </div>
        <div class="log-table-wrapper">
          <table class="log-table">
            <thead>
              <tr>
                <th>TIME</th>
                <th>OPERATION</th>
                <th>ENTITY</th>
                <th>STATUS</th>
                <th>DURATION</th>
                <th>USER</th>
                <th>ERROR</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in infraStore.filteredLogs" :key="log.id" class="log-row" :class="`status-${log.status}`">
                <td>{{ formatTime(log.created_at) }}</td>
                <td class="mono">{{ log.operation }}</td>
                <td>{{ log.entity_type }}/{{ log.entity_id }}</td>
                <td>
                  <span class="status-badge" :class="`badge-${log.status}`">{{ log.status }}</span>
                </td>
                <td>{{ log.duration_ms ? `${log.duration_ms}ms` : '-' }}</td>
                <td class="mono truncate">{{ log.user_id?.substring(0, 8) || '-' }}</td>
                <td class="truncate text-red">{{ log.error_message?.substring(0, 50) || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ===== USERS & SESSIONS TAB ===== -->
      <div v-if="activeTab === 'users'" class="tab-panel">
        <div class="panel-layout">
          <!-- Active Users -->
          <div class="panel-left">
            <h3 class="panel-title">[ ACTIVE_USERS ]</h3>
            <div class="user-list">
              <div v-for="user in infraStore.activeUsersWithGeo" :key="user.user_id" class="user-item">
                <div class="user-header">
                  <span class="user-email">{{ user.email || 'anonymous' }}</span>
                  <span class="user-status-dot active"></span>
                </div>
                <div class="user-meta">
                  <span>IP: {{ user.ip_address || 'N/A' }}</span>
                  <span>Last: {{ formatTime(user.last_active) }}</span>
                </div>
                <div v-if="user.geolocation" class="user-geo">
                  <span class="geo-icon">📍</span>
                  {{ user.geolocation.city }}, {{ user.geolocation.country_code }}
                </div>
              </div>
              <div v-if="infraStore.activeUsersWithGeo.length === 0" class="empty-state">
                NO_ACTIVE_USERS
              </div>
            </div>
          </div>

          <!-- Geolocation Map -->
          <div class="panel-center">
            <h3 class="panel-title">[ USER_GEOLOCATION_MAP ]</h3>
            <div ref="geoMapRef" class="map-canvas"></div>
          </div>
        </div>
      </div>

      <!-- ===== OPENTELEMETRY TAB ===== -->
      <div v-if="activeTab === 'telemetry'" class="tab-panel">
        <div class="telemetry-header">
          <div class="telemetry-filters">
            <select v-model="otelHours" @change="fetchOtelData" class="flat-select-sm">
              <option :value="1">LAST 1 HOUR</option>
              <option :value="6">LAST 6 HOURS</option>
              <option :value="24">LAST 24 HOURS</option>
              <option :value="168">LAST 7 DAYS</option>
            </select>
            <button @click="fetchOtelData" class="btn-flat">REFRESH_TELEMETRY</button>
          </div>
        </div>

        <div class="telemetry-grid">
          <!-- Summary -->
          <div v-if="infraStore.otelAnalysis?.summary" class="telemetry-card">
            <h4 class="card-title">[ SUMMARY ]</h4>
            <div class="summary-stats">
              <div class="stat-row">
                <span>Total Spans</span>
                <span class="stat-value">{{ infraStore.otelAnalysis.summary.total_spans }}</span>
              </div>
              <div class="stat-row">
                <span>Errors</span>
                <span class="stat-value text-red">{{ infraStore.otelAnalysis.summary.error_count }}</span>
              </div>
              <div class="stat-row">
                <span>Success Rate</span>
                <span class="stat-value text-green">{{ infraStore.otelAnalysis.summary.success_rate }}%</span>
              </div>
              <div class="stat-row">
                <span>Error Rate</span>
                <span class="stat-value text-red">{{ infraStore.otelAnalysis.summary.error_rate }}%</span>
              </div>
            </div>
          </div>

          <!-- Services -->
          <div v-if="infraStore.otelAnalysis?.services" class="telemetry-card">
            <h4 class="card-title">[ SERVICES ]</h4>
            <div class="service-list">
              <div v-for="svc in infraStore.otelAnalysis.services" :key="svc.service_name" class="service-item">
                <div class="service-header">
                  <span class="service-name">{{ svc.service_name }}</span>
                  <span class="service-error-rate" :class="{ high: parseFloat(svc.error_rate) > 5 }">
                    {{ svc.error_rate }}% errors
                  </span>
                </div>
                <div class="service-stats">
                  <span>{{ svc.total_spans }} spans</span>
                  <span>Avg: {{ svc.avg_duration_ms }}ms</span>
                  <span>P95: {{ svc.p95_duration_ms }}ms</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Errors -->
          <div v-if="infraStore.otelAnalysis?.recent_errors" class="telemetry-card full-width">
            <h4 class="card-title">[ RECENT_ERRORS ]</h4>
            <div class="error-list">
              <div v-for="err in infraStore.otelAnalysis.recent_errors.slice(0, 10)" :key="err.span_id" class="error-item">
                <span class="error-name">{{ err.name }}</span>
                <span class="error-service">{{ err.service_name }}</span>
                <span class="error-message">{{ err.status_message || 'Unknown error' }}</span>
              </div>
              <div v-if="!infraStore.otelAnalysis.recent_errors.length" class="empty-state">
                NO_ERRORS_FOUND
              </div>
            </div>
          </div>

          <!-- Slowest Spans -->
          <div v-if="infraStore.otelAnalysis?.slowest_spans" class="telemetry-card full-width">
            <h4 class="card-title">[ SLOWEST_SPANS ]</h4>
            <div class="slow-list">
              <div v-for="span in infraStore.otelAnalysis.slowest_spans.slice(0, 10)" :key="span.name + span.start_time" class="slow-item">
                <span class="slow-name">{{ span.name }}</span>
                <span class="slow-service">{{ span.service_name }}</span>
                <span class="slow-duration">{{ (span.duration_ns / 1_000_000).toFixed(0) }}ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== GRAPH VIEW TAB ===== -->
      <div v-if="activeTab === 'graph'" class="tab-panel">
        <div class="graph-controls-bar">
          <div class="graph-toggles">
            <button
              :class="{ active: graphView === 'unified' }"
              @click="graphView = 'unified'"
              class="graph-toggle-btn"
            >
              UNIFIED_GRAPH
            </button>
            <button
              :class="{ active: graphView === 'infrastructure' }"
              @click="graphView = 'infrastructure'"
              class="graph-toggle-btn"
            >
              INFRASTRUCTURE
            </button>
            <button
              :class="{ active: graphView === 'shop' }"
              @click="graphView = 'shop'"
              class="graph-toggle-btn"
            >
              SHOP_CONFIG
            </button>
          </div>
          <div class="graph-actions">
            <button @click="saveAllConfig" class="btn-primary" :disabled="saving">
              {{ saving ? 'SAVING...' : 'SAVE_CONFIG' }}
            </button>
            <button @click="applyLocationRules" class="btn-flat">
              APPLY_RULES
            </button>
          </div>
        </div>
        <div class="panel-layout full-height">
          <div class="graph-panel unified-graph">
            <h3 class="panel-title">[ UNIFIED_VISUAL_GRAPH ]</h3>
            <div ref="orchestratorGraphRef" class="graph-canvas"></div>
            <div class="graph-legend">
              <div class="legend-section">
                <span class="legend-label">INFRASTRUCTURE</span>
                <div class="legend-item"><span class="legend-dot" style="background: #8B5CF6;"></span> Orchestrator</div>
                <div class="legend-item"><span class="legend-dot" style="background: #00E5FF;"></span> Edge Function</div>
                <div class="legend-item"><span class="legend-dot" style="background: #00FF41;"></span> User Session</div>
                <div class="legend-item"><span class="legend-dot" style="background: #FFB800;"></span> Geolocation</div>
              </div>
              <div class="legend-section">
                <span class="legend-label">SHOP_SERVICES</span>
                <div class="legend-item"><span class="legend-dot" style="background: #A855F7;"></span> Product Type</div>
                <div class="legend-item"><span class="legend-dot" style="background: #06B6D4;"></span> Provider</div>
                <div class="legend-item"><span class="legend-dot" style="background: #22C55E;"></span> Payment Gateway</div>
                <div class="legend-item"><span class="legend-dot" style="background: #F59E0B;"></span> Location Rule</div>
                <div class="legend-item"><span class="legend-dot" style="background: #FF3347;"></span> Payment Method</div>
              </div>
              <div class="legend-section">
                <span class="legend-label">NETWORK</span>
                <div class="legend-item"><span class="legend-dot" style="background: #7B2CBF;"></span> Store</div>
                <div class="legend-item"><span class="legend-dot" style="background: #FF6B6B;"></span> Order</div>
                <div class="legend-item"><span class="legend-dot" style="background: #FFE66D;"></span> Customer</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Shop Configurator Side Panel (shown in graph tab) -->
  <div v-if="activeTab === 'graph'" class="shop-config-sidebar">
    <div class="sidebar-tabs">
      <button
        :class="{ active: sidebarTab === 'products' }"
        @click="sidebarTab = 'products'"
        class="sidebar-tab"
      >
        PRODUCTS
      </button>
      <button
        :class="{ active: sidebarTab === 'gateways' }"
        @click="sidebarTab = 'gateways'"
        class="sidebar-tab"
      >
        GATEWAYS
      </button>
      <button
        :class="{ active: sidebarTab === 'locations' }"
        @click="sidebarTab = 'locations'"
        class="sidebar-tab"
      >
        LOCATIONS
      </button>
    </div>

    <!-- Product Types Panel -->
    <div v-if="sidebarTab === 'products'" class="sidebar-content">
      <h4 class="sidebar-title">[ PRODUCT_TYPES ]</h4>
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

    <!-- Gateways Panel -->
    <div v-if="sidebarTab === 'gateways'" class="sidebar-content">
      <h4 class="sidebar-title">[ GATEWAYS ]</h4>
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
    </div>

    <!-- Location Rules Panel -->
    <div v-if="sidebarTab === 'locations'" class="sidebar-content">
      <h4 class="sidebar-title">[ LOCATION_RULES ]</h4>
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
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Network, DataSet } from 'vis-network/standalone'
import { useInfraOrchestratorStore } from '../stores/infraOrchestrator'
import { useShopConfigStore } from '../stores/shopConfig'
import { useNetworkStore } from '../stores/network'

const infraStore = useInfraOrchestratorStore()
const shopConfig = useShopConfigStore()
const networkStore = useNetworkStore()

const activeTab = ref('functions')
const showGraph = ref(false)
const testArgsJson = ref('{}')
const logStatusFilter = ref('')
const logOperationFilter = ref('')
const otelHours = ref(24)

// Graph view mode
const graphView = ref('unified')
const sidebarTab = ref('products')
const selectedProductType = ref('tshirt')
const saving = ref(false)
const allGateways = ['mercadopago', 'abacatepay', 'pix_bricks', 'umapenca_native', 'paypal']

const connectionsGraphRef = ref(null)
const geoMapRef = ref(null)
const orchestratorGraphRef = ref(null)

let connectionsNetwork = null
let geoMapNetwork = null
let orchestratorNetwork = null
let nodesDataSet = null
let edgesDataSet = null

const tabs = computed(() => [
  { id: 'functions', label: 'EDGE_FUNCTIONS', badge: infraStore.functionStatusCounts.total },
  { id: 'connections', label: 'CONNECTIONS' },
  { id: 'logs', label: 'OPERATION_LOGS', badge: infraStore.errorLogsCount > 0 ? infraStore.errorLogsCount : null },
  { id: 'users', label: 'USERS_&_GEO', badge: infraStore.activeUsersCount },
  { id: 'telemetry', label: 'OPENTELEMETRY' },
  { id: 'graph', label: 'VISUAL_GRAPH' },
])

function togglePanel() {
  showGraph.value = !showGraph.value
  if (showGraph.value) {
    activeTab.value = 'graph'
  }
}

function formatTime(timestamp) {
  if (!timestamp) return 'N/A'
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

async function runTest() {
  let args = {}
  try {
    args = JSON.parse(testArgsJson.value)
  } catch (e) {
    alert('Invalid JSON')
    return
  }
  if (infraStore.selectedFunction) {
    await infraStore.testEdgeFunction(infraStore.selectedFunction.function_name, args)
  }
}

function applyLogFilters() {
  infraStore.setLogFilter({
    status: logStatusFilter.value,
    operation: logOperationFilter.value,
  })
  infraStore.fetchOperationLogs()
}

async function fetchOtelData() {
  await infraStore.fetchOtelAnalysis(otelHours.value)
}

// ============================================
// Graph: Connections (Database Relations)
// ============================================
function initConnectionsGraph() {
  if (!connectionsGraphRef.value) return

  const functions = infraStore.edgeFunctions
  const nodes = []
  const edges = []

  // Root DB node
  nodes.push({
    id: 'db_supabase',
    label: 'SUPABASE\nPostgreSQL',
    color: '#00E5FF',
    shape: 'box',
    size: 40,
    borderWidth: 2,
    font: { size: 10, face: 'JetBrains Mono, monospace', color: '#e0e0e0' },
  })

  // Database tables
  const tables = [
    { id: 'tbl_products', label: 'products', group: 'table' },
    { id: 'tbl_orders', label: 'orders', group: 'table' },
    { id: 'tbl_users', label: 'user_sessions', group: 'table' },
    { id: 'tbl_geolocations', label: 'user_geolocations', group: 'table' },
    { id: 'tbl_ops_logs', label: 'operation_logs', group: 'table' },
    { id: 'tbl_otel_spans', label: 'otel_spans', group: 'table' },
    { id: 'tbl_otel_metrics', label: 'otel_metrics', group: 'table' },
    { id: 'tbl_fn_status', label: 'edge_function_status', group: 'table' },
  ]

  for (const t of tables) {
    nodes.push({
      id: t.id,
      label: t.label,
      color: '#00E5FF',
      shape: 'box',
      size: 20,
      borderWidth: 1,
      font: { size: 8, face: 'JetBrains Mono, monospace', color: '#e0e0e0' },
    })
    edges.push({
      from: 'db_supabase',
      to: t.id,
      arrows: 'to',
      color: { color: '#2A2A35' },
      font: { size: 7, color: '#606070' },
    })
  }

  // Edge function nodes
  for (const fn of functions) {
    const fnColor = fn.status === 'active' ? '#00FF41' : fn.status === 'error' ? '#FF3347' : fn.status === 'degraded' ? '#FFB800' : '#606070'
    nodes.push({
      id: `fn_${fn.function_name}`,
      label: fn.function_name,
      color: fnColor,
      shape: 'ellipse',
      size: 18,
      borderWidth: 2,
      font: { size: 8, face: 'JetBrains Mono, monospace', color: '#e0e0e0' },
    })

    // Connect functions to tables they use
    if (fn.function_name.includes('products') || fn.function_name === 'list-products') {
      edges.push({ from: `fn_${fn.function_name}`, to: 'tbl_products', arrows: 'to', dashes: true, color: { color: '#404050' } })
    }
    if (fn.function_name.includes('order')) {
      edges.push({ from: `fn_${fn.function_name}`, to: 'tbl_orders', arrows: 'to', dashes: true, color: { color: '#404050' } })
    }
    if (fn.function_name.includes('user-tracker')) {
      edges.push({ from: `fn_${fn.function_name}`, to: 'tbl_users', arrows: 'to', dashes: true, color: { color: '#404050' } })
      edges.push({ from: `fn_${fn.function_name}`, to: 'tbl_geolocations', arrows: 'to', dashes: true, color: { color: '#404050' } })
    }
    if (fn.function_name.includes('infra-manager')) {
      edges.push({ from: `fn_${fn.function_name}`, to: 'tbl_fn_status', arrows: 'to', dashes: true, color: { color: '#404050' } })
      edges.push({ from: `fn_${fn.function_name}`, to: 'tbl_ops_logs', arrows: 'to', dashes: true, color: { color: '#404050' } })
    }
    if (fn.function_name.includes('telemetry')) {
      edges.push({ from: `fn_${fn.function_name}`, to: 'tbl_otel_spans', arrows: 'to', dashes: true, color: { color: '#404050' } })
      edges.push({ from: `fn_${fn.function_name}`, to: 'tbl_otel_metrics', arrows: 'to', dashes: true, color: { color: '#404050' } })
    }
  }

  const data = {
    nodes: new DataSet(nodes),
    edges: new DataSet(edges),
  }

  const options = {
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: { gravitationalConstant: -60, centralGravity: 0.01, springLength: 130, springConstant: 0.05, damping: 0.4 },
      stabilization: { enabled: true, iterations: 100, fit: true },
    },
    interaction: { hover: true, tooltipDelay: 100, dragNodes: true, dragView: true, zoomView: true },
    nodes: { borderWidth: 2, shadow: false },
    edges: { hoverWidth: 0.5, selectionWidth: 2, smooth: { enabled: true, type: 'continuous', roundness: 0.2 } },
    autoResize: true,
  }

  connectionsNetwork = new Network(connectionsGraphRef.value, data, options)
}

// ============================================
// Graph: Geo Map
// ============================================
function initGeoMap() {
  if (!geoMapRef.value) return

  const nodes = []
  const edges = []

  // World center node
  nodes.push({
    id: 'world',
    label: 'WORLD',
    color: '#8B5CF6',
    shape: 'dot',
    size: 30,
    borderWidth: 2,
    font: { size: 10, face: 'JetBrains Mono, monospace', color: '#e0e0e0' },
  })

  for (const geo of infraStore.mapData) {
    if (geo.latitude && geo.longitude) {
      nodes.push({
        id: `geo_${geo.id}`,
        label: `${geo.city || 'Unknown'}`,
        x: geo.longitude * 2,
        y: geo.latitude * 2,
        color: '#00FF41',
        shape: 'dot',
        size: 12,
        borderWidth: 1,
        font: { size: 8, face: 'JetBrains Mono, monospace', color: '#e0e0e0' },
      })
      edges.push({
        from: 'world',
        to: `geo_${geo.id}`,
        arrows: 'to',
        color: { color: '#303040' },
      })
    }
  }

  const data = {
    nodes: new DataSet(nodes),
    edges: new DataSet(edges),
  }

  const options = {
    physics: { enabled: false },
    interaction: { hover: true, dragNodes: true, dragView: true, zoomView: true },
    nodes: { borderWidth: 2, shadow: false },
    edges: { smooth: { enabled: true, type: 'continuous', roundness: 0.2 } },
    autoResize: true,
  }

  geoMapNetwork = new Network(geoMapRef.value, data, options)
}

// ============================================
// Graph: Orchestrator
// ============================================
function initOrchestratorGraph() {
  if (!orchestratorGraphRef.value) return

  const nodes = infraStore.orchestratorNodes.map(node => {
    const colors = {
      orchestrator: '#8B5CF6',
      edge_function: '#00E5FF',
      user_session: '#00FF41',
      geolocation: '#FFB800',
    }
    const shapes = {
      orchestrator: 'box',
      edge_function: 'ellipse',
      user_session: 'dot',
      geolocation: 'diamond',
    }
    return {
      id: node.id,
      label: node.label,
      color: colors[node.type] || '#606070',
      shape: shapes[node.type] || 'dot',
      size: node.type === 'orchestrator' ? 40 : node.type === 'edge_function' ? 25 : 15,
      borderWidth: 2,
      font: { size: 9, face: 'JetBrains Mono, monospace', color: '#e0e0e0' },
      enabled: node.enabled,
    }
  })

  const edges = infraStore.orchestratorEdges.map(edge => ({
    from: edge.from,
    to: edge.to,
    label: edge.label,
    arrows: 'to',
    color: { color: edge.enabled ? '#404050' : '#202030' },
    dashes: !edge.enabled,
    font: { size: 7, color: '#606070' },
    smooth: { type: 'continuous', roundness: 0.2 },
  }))

  const data = {
    nodes: new DataSet(nodes),
    edges: new DataSet(edges),
  }

  const options = {
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: { gravitationalConstant: -50, centralGravity: 0.01, springLength: 120, springConstant: 0.05, damping: 0.4 },
      stabilization: { enabled: true, iterations: 100, fit: true },
    },
    interaction: { hover: true, tooltipDelay: 100, dragNodes: true, dragView: true, zoomView: true },
    nodes: { borderWidth: 2, shadow: false },
    edges: { hoverWidth: 0.5, selectionWidth: 2, smooth: { enabled: true, type: 'continuous', roundness: 0.2 } },
    autoResize: true,
  }

  orchestratorNetwork = new Network(orchestratorGraphRef.value, data, options)

  orchestratorNetwork.on('click', (params) => {
    if (params.nodes.length > 0) {
      const node = infraStore.orchestratorNodes.find(n => n.id === params.nodes[0])
      if (node) infraStore.selectOrchestratorNode(node)
    }
  })
}

// ============================================
// Shop Configurator Functions
// ============================================
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

// ============================================
// Unified Graph Visualization
// ============================================
const NODE_COLORS = {
  orchestrator: { color: '#8B5CF6', shape: 'box', size: 40 },
  edge_function: { color: '#00E5FF', shape: 'ellipse', size: 25 },
  user_session: { color: '#00FF41', shape: 'dot', size: 15 },
  geolocation: { color: '#FFB800', shape: 'diamond', size: 20 },
  product_type: { color: '#A855F7', shape: 'box', size: 30 },
  provider: { color: '#06B6D4', shape: 'diamond', size: 25 },
  payment_gateway: { color: '#22C55E', shape: 'ellipse', size: 20 },
  location_rule: { color: '#F59E0B', shape: 'triangle', size: 25 },
  payment_method: { color: '#FF3347', shape: 'dot', size: 12 },
  store: { color: '#7B2CBF', shape: 'dot', size: 35 },
  order: { color: '#FF6B6B', shape: 'dot', size: 20 },
  customer: { color: '#FFE66D', shape: 'dot', size: 25 },
}

function formatNodes(nodes) {
  return nodes.map(node => {
    const config = NODE_COLORS[node.type] || NODE_COLORS.product_type
    return {
      id: node.id,
      label: node.label,
      ...config,
      borderWidth: 2,
      opacity: node.enabled !== false ? 1 : 0.3,
      font: { size: 9, face: 'JetBrains Mono, monospace', color: '#e0e0e0' },
    }
  })
}

function formatEdges(edges) {
  return edges.map(edge => ({
    from: edge.from,
    to: edge.to,
    label: edge.label,
    arrows: 'to',
    width: edge.enabled !== false ? 1.5 : 0.5,
    color: {
      color: edge.enabled !== false ? '#404050' : '#202030',
    },
    dashes: edge.enabled === false,
    font: { align: 'top', size: 8, color: '#606070', face: 'JetBrains Mono, monospace' },
    smooth: { type: 'continuous', roundness: 0.2 },
  }))
}

function buildUnifiedGraph() {
  const nodes = []
  const edges = []

  // Add infrastructure nodes from infraStore
  if (graphView.value === 'unified' || graphView.value === 'infrastructure') {
    // Orchestrator nodes
    for (const node of infraStore.orchestratorNodes) {
      nodes.push({
        id: `infra_${node.id}`,
        label: node.label,
        type: node.type,
        enabled: node.enabled,
      })
    }
    for (const edge of infraStore.orchestratorEdges) {
      edges.push({
        from: `infra_${edge.from}`,
        to: `infra_${edge.to}`,
        label: edge.label,
        enabled: edge.enabled,
      })
    }

    // Edge function nodes from connections graph
    const functions = infraStore.edgeFunctions
    nodes.push({
      id: 'db_supabase',
      label: 'SUPABASE\nPostgreSQL',
      type: 'edge_function',
      enabled: true,
    })

    for (const fn of functions) {
      const fnColor = fn.status === 'active' ? '#00FF41' : fn.status === 'error' ? '#FF3347' : fn.status === 'degraded' ? '#FFB800' : '#606070'
      nodes.push({
        id: `fn_${fn.function_name}`,
        label: fn.function_name,
        type: 'edge_function',
        enabled: fn.status !== 'inactive',
      })
    }
  }

  // Add shop config nodes (product types, providers, gateways)
  if (graphView.value === 'unified' || graphView.value === 'shop') {
    const shopGraph = shopConfig.visualGraph
    for (const node of shopGraph.nodes) {
      nodes.push({
        id: `shop_${node.id}`,
        label: node.label,
        type: node.type,
        enabled: node.enabled,
      })
    }
    for (const edge of shopGraph.edges) {
      edges.push({
        from: `shop_${edge.from}`,
        to: `shop_${edge.to}`,
        label: edge.label,
        enabled: edge.enabled,
      })
    }
  }

  // Add network nodes (stores, orders)
  if (graphView.value === 'unified') {
    for (const node of networkStore.nodes) {
      nodes.push({
        id: `net_${node.id}`,
        label: node.label,
        type: node.type,
        enabled: true,
      })
    }
    for (const edge of networkStore.edges) {
      edges.push({
        from: `net_${edge.from}`,
        to: `net_${edge.to}`,
        label: edge.label || '',
        enabled: true,
      })
    }

    // Connect infrastructure to shop services
    if (functions?.length > 0) {
      // Connect admin-auth to shop config
      edges.push({
        from: 'fn_admin-auth',
        to: 'shop_provider_umapenca',
        label: 'auth',
        enabled: true,
      })
    }

    // Connect network stores to payment gateways
    for (const store of networkStore.storeNodes) {
      for (const gateway of networkStore.gatewayNodes) {
        edges.push({
          from: `net_${store.id}`,
          to: `shop_gw_${gateway.provider || gateway.id}`,
          label: 'uses',
          enabled: true,
        })
      }
    }
  }

  return { nodes, edges }
}

function initUnifiedGraph() {
  if (!orchestratorGraphRef.value) return

  const graph = buildUnifiedGraph()

  if (nodesDataSet && edgesDataSet) {
    nodesDataSet.clear()
    edgesDataSet.clear()
  } else {
    nodesDataSet = new DataSet(formatNodes(graph.nodes))
    edgesDataSet = new DataSet(formatEdges(graph.edges))
  }

  nodesDataSet.add(formatNodes(graph.nodes))
  edgesDataSet.add(formatEdges(graph.edges))

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

  if (orchestratorNetwork) {
    orchestratorNetwork.setData({ nodes: nodesDataSet, edges: edgesDataSet })
  } else {
    orchestratorNetwork = new Network(orchestratorGraphRef.value, { nodes: nodesDataSet, edges: edgesDataSet }, options)

    orchestratorNetwork.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0]
        // Handle shop config node clicks
        if (nodeId.startsWith('shop_')) {
          shopConfig.selectNode(nodeId.replace('shop_', ''))
        }
        // Handle infra node clicks
        if (nodeId.startsWith('infra_')) {
          const infraNode = infraStore.orchestratorNodes.find(n => n.id === nodeId.replace('infra_', ''))
          if (infraNode) infraStore.selectOrchestratorNode(infraNode)
        }
      }
    })
  }
}

function updateGraph() {
  if (!nodesDataSet || !edgesDataSet) return
  const graph = buildUnifiedGraph()
  nodesDataSet.clear()
  edgesDataSet.clear()
  nodesDataSet.add(formatNodes(graph.nodes))
  edgesDataSet.add(formatEdges(graph.edges))
}

async function refreshAll() {
  await Promise.all([
    infraStore.refreshAll(),
    shopConfig.fetchConfig(),
    networkStore.buildGraph(),
  ])
  setTimeout(() => {
    if (activeTab.value === 'graph') initUnifiedGraph()
    if (activeTab.value === 'connections') initConnectionsGraph()
    if (activeTab.value === 'users') initGeoMap()
  }, 500)
}

// Watch tab changes to init graphs
watch(activeTab, (newTab) => {
  setTimeout(() => {
    if (newTab === 'connections') initConnectionsGraph()
    if (newTab === 'users') initGeoMap()
    if (newTab === 'graph') initUnifiedGraph()
  }, 100)
})

// Watch graph view changes
watch(graphView, () => {
  if (activeTab.value === 'graph') initUnifiedGraph()
})

// Watch data changes to update graphs
watch(() => infraStore.edgeFunctions, () => {
  if (activeTab.value === 'connections') initConnectionsGraph()
}, { deep: true })

watch(() => infraStore.mapData, () => {
  if (activeTab.value === 'users') initGeoMap()
}, { deep: true })

watch(() => infraStore.orchestratorNodes, () => {
  if (activeTab.value === 'graph' && graphView.value === 'infrastructure') initUnifiedGraph()
}, { deep: true })

watch(() => shopConfig.gateways, () => {
  if (activeTab.value === 'graph') updateGraph()
}, { deep: true })

watch(() => shopConfig.productRules, () => {
  if (activeTab.value === 'graph') updateGraph()
}, { deep: true })

watch(() => networkStore.nodes, () => {
  if (activeTab.value === 'graph' && graphView.value === 'unified') updateGraph()
}, { deep: true })

onMounted(async () => {
  await Promise.all([
    infraStore.refreshAll(),
    shopConfig.fetchConfig(),
  ])
  setTimeout(() => {
    initConnectionsGraph()
  }, 300)
})

onUnmounted(() => {
  if (connectionsNetwork) { connectionsNetwork.destroy(); connectionsNetwork = null }
  if (geoMapNetwork) { geoMapNetwork.destroy(); geoMapNetwork = null }
  if (orchestratorNetwork) { orchestratorNetwork.destroy(); orchestratorNetwork = null }
})
</script>

<style scoped>
.visual-orchestrator {
  padding: var(--space-6);
  min-height: 100vh;
  background: var(--bg-base);
}

/* Header */
.orchestrator-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
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
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -1px;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

/* Stats Bar */
.stats-bar {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  overflow-x: auto;
  padding-bottom: var(--space-2);
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
.stat-item.yellow::before { background: var(--yellow); }
.stat-item.red::before { background: var(--red); }
.stat-item.green::before { background: var(--green); }
.stat-item.cyan::before { background: var(--cyan); }

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-muted);
}

/* Tab Navigation */
.tab-nav {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-4);
  border-bottom: var(--border);
  padding-bottom: var(--space-2);
  overflow-x: auto;
}

.tab-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border: var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 1px;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.tab-btn:hover {
  background: var(--bg-hover);
  border-color: var(--purple);
  color: var(--gold);
}

.tab-btn.active {
  background: var(--gold);
  border-color: var(--purple);
  color: white;
}

.tab-badge {
  padding: 1px 5px;
  font-size: 0.6rem;
  background: var(--bg-base);
}

.tab-btn.active .tab-badge {
  background: var(--gold-dark);
}

/* Panel Layout */
.panel-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--space-4);
  min-height: calc(100vh - 350px);
}

.panel-layout.full-height {
  grid-template-columns: 1fr;
  min-height: calc(100vh - 350px);
}

.panel-left, .panel-center {
  background: var(--bg-surface);
  border: var(--border);
  padding: var(--space-4);
  overflow-y: auto;
}

.panel-left {
  max-height: calc(100vh - 350px);
}

.panel-title {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--gold);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: var(--border);
}

/* Function List */
.function-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.function-item {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: var(--border);
  cursor: pointer;
  transition: all 0.15s ease;
}

.function-item:hover {
  border-color: var(--purple);
}

.function-item.active {
  border-color: var(--purple);
  background: rgba(234, 179, 8, 0.1);
}

.function-item.fn-active { border-left: 3px solid var(--green); }
.function-item.fn-degraded { border-left: 3px solid var(--yellow); }
.function-item.fn-error { border-left: 3px solid var(--red); }

.function-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.function-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-active { background: var(--green); }
.status-degraded { background: var(--yellow); }
.status-error { background: var(--red); }
.status-inactive { background: var(--text-muted); }

.function-name {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
}

.function-calls {
  font-size: 0.65rem;
  color: var(--text-muted);
}

.function-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.6rem;
  color: var(--text-secondary);
}

/* Function Detail */
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-1) 0;
  border-bottom: var(--border-light);
  gap: var(--space-3);
}

.detail-row.full {
  grid-column: 1 / -1;
}

.detail-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-muted);
}

.detail-value {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
  word-break: break-word;
}

.mono { font-family: var(--font-mono); }
.text-green { color: var(--green); }
.text-red { color: var(--red); }
.text-cyan { color: var(--cyan); }
.truncate { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Status Controls */
.status-controls {
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: var(--border);
}

.status-controls label {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-muted);
  display: block;
  margin-bottom: var(--space-2);
}

.status-buttons {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.status-btn {
  padding: var(--space-1) var(--space-3);
  font-size: 0.6rem;
  font-family: var(--font-mono);
  font-weight: 700;
  background: var(--bg-base);
  border: var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.status-btn:hover { border-color: var(--purple); color: var(--purple); }
.status-btn.active { color: white; }
.status-btn-active.active { background: var(--green); border-color: var(--green); }
.status-btn-inactive.active { background: var(--text-muted); border-color: var(--text-muted); }
.status-btn-degraded.active { background: var(--yellow); border-color: var(--yellow); }
.status-btn-error.active { background: var(--red); border-color: var(--red); }

/* Test Section */
.test-section {
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: var(--border);
}

.section-title {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--info);
  margin-bottom: var(--space-3);
}

.test-args {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.test-args label {
  font-size: 0.65rem;
  color: var(--text-muted);
}

.flat-textarea {
  width: 100%;
  padding: var(--space-2);
  background: var(--bg-base);
  border: var(--border);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  resize: vertical;
}

.test-result {
  margin-top: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-base);
  border: var(--border);
}

.test-result h5 {
  font-size: 0.65rem;
  color: var(--text-muted);
  margin-bottom: var(--space-2);
}

.result-json {
  font-size: 0.65rem;
  color: var(--success);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
}

/* Graph Panel */
.graph-panel {
  background: var(--bg-surface);
  border: var(--border);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
}

.graph-canvas, .map-canvas {
  flex: 1;
  min-height: 500px;
  background: var(--bg-base);
  border: var(--border);
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
  gap: var(--space-1);
  font-size: 0.65rem;
  color: var(--text-muted);
}

.legend-dot {
  width: 10px;
  height: 10px;
}

/* Log Controls */
.log-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
  gap: var(--space-3);
}

.log-filters {
  display: flex;
  gap: var(--space-2);
}

.flat-select-sm {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-base);
  border: var(--border);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

/* Log Table */
.log-table-wrapper {
  overflow-x: auto;
  max-height: calc(100vh - 400px);
  overflow-y: auto;
}

.log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.7rem;
}

.log-table th {
  position: sticky;
  top: 0;
  background: var(--bg-surface);
  padding: var(--space-2) var(--space-3);
  text-align: left;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--text-muted);
  letter-spacing: 1px;
  border-bottom: var(--border);
}

.log-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: var(--border-light);
  font-size: 0.65rem;
}

.log-row.status-error { background: rgba(255, 51, 71, 0.05); }
.log-row.status-success { background: rgba(0, 255, 65, 0.02); }

.status-badge {
  padding: 1px 5px;
  font-size: 0.55rem;
  font-weight: 700;
  font-family: var(--font-mono);
}

.badge-success { background: var(--green-bg); color: var(--green); }
.badge-error { background: var(--red-bg); color: var(--red); }
.badge-running { background: var(--purple-bg); color: var(--purple); }
.badge-timeout { background: var(--yellow-bg); color: var(--yellow); }

/* User List */
.user-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.user-item {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: var(--border);
}

.user-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}

.user-email {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
}

.user-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.user-status-dot.active { background: var(--green); }

.user-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.6rem;
  color: var(--text-secondary);
}

.user-geo {
  margin-top: var(--space-1);
  font-size: 0.6rem;
  color: var(--info);
}

.geo-icon { margin-right: var(--space-1); }

/* Telemetry */
.telemetry-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-4);
}

.telemetry-filters {
  display: flex;
  gap: var(--space-2);
}

.telemetry-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.telemetry-card {
  background: var(--bg-surface);
  border: var(--border);
  padding: var(--space-4);
}

.telemetry-card.full-width {
  grid-column: 1 / -1;
}

.card-title {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--info);
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: var(--border);
}

.summary-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-1) 0;
  font-size: 0.7rem;
}

.service-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.service-item {
  padding: var(--space-2);
  background: var(--bg-elevated);
  border: var(--border);
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}

.service-name {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
}

.service-error-rate {
  font-size: 0.6rem;
  color: var(--success);
}

.service-error-rate.high {
  color: var(--danger);
}

.service-stats {
  display: flex;
  gap: var(--space-3);
  font-size: 0.6rem;
  color: var(--text-secondary);
}

.error-list, .slow-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.error-item, .slow-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-2);
  background: var(--bg-elevated);
  border-left: 3px solid var(--red);
  font-size: 0.65rem;
}

.error-name, .slow-name {
  font-family: var(--font-mono);
  font-weight: 600;
  flex: 1;
}

.error-service, .slow-service {
  color: var(--text-muted);
}

.error-message {
  color: var(--danger);
  max-width: 200px;
}

.slow-duration {
  color: var(--warning);
  font-weight: 700;
}

/* Buttons */
.btn-flat {
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border: var(--border);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-flat:hover {
  background: var(--bg-hover);
  border-color: var(--purple);
  color: var(--gold);
}

.btn-flat:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  padding: var(--space-2) var(--space-4);
  background: var(--gold);
  border: none;
  color: white;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
  background: var(--gold-light);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: var(--space-6);
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 1px;
}

/* Graph Controls Bar */
.graph-controls-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  background: var(--bg-surface);
  border: var(--border);
  flex-wrap: wrap;
  gap: var(--space-3);
}

.graph-toggles {
  display: flex;
  gap: var(--space-2);
}

.graph-toggle-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border: var(--border);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.graph-toggle-btn:hover {
  background: var(--bg-hover);
  border-color: var(--purple);
  color: var(--gold);
}

.graph-toggle-btn.active {
  background: var(--gold);
  border-color: var(--purple);
  color: white;
}

.graph-actions {
  display: flex;
  gap: var(--space-2);
}

/* Unified Graph Panel */
.graph-panel.unified-graph {
  padding: var(--space-3);
}

.graph-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: var(--border);
  justify-content: center;
}

.legend-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.legend-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-muted);
  margin-bottom: var(--space-1);
}

/* Shop Config Sidebar */
.shop-config-sidebar {
  position: fixed;
  right: 0;
  top: 0;
  width: 320px;
  height: 100vh;
  background: var(--bg-surface);
  border-left: var(--border);
  display: flex;
  flex-direction: column;
  z-index: 100;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.3);
}

.sidebar-tabs {
  display: flex;
  border-bottom: var(--border);
}

.sidebar-tab {
  flex: 1;
  padding: var(--space-2) var(--space-1);
  background: var(--bg-elevated);
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sidebar-tab:hover {
  background: var(--bg-hover);
  color: var(--gold);
}

.sidebar-tab.active {
  background: var(--bg-base);
  border-bottom-color: var(--purple);
  color: var(--gold);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
}

.sidebar-title {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--gold);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: var(--border);
}

/* Product List in Sidebar */
.product-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.product-item {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: var(--border);
  cursor: pointer;
  transition: all 0.15s ease;
}

.product-item:hover {
  border-color: var(--purple);
}

.product-item.active {
  border-color: var(--purple);
  background: rgba(234, 179, 8, 0.1);
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
  background: var(--gold);
  color: white;
  font-family: var(--font-mono);
}

.product-name {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
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
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--text-muted);
  letter-spacing: 1px;
}

.flat-select-sm {
  padding: var(--space-1) var(--space-2);
  background: var(--bg-base);
  border: var(--border);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.flat-checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--purple);
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
  font-size: 0.7rem;
  font-family: var(--font-mono);
  cursor: pointer;
}

/* Gateway List in Sidebar */
.gateway-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.gateway-item {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: var(--border);
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
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.toggle-btn {
  padding: var(--space-1) var(--space-2);
  font-size: 0.6rem;
  font-family: var(--font-mono);
  font-weight: 700;
  background: var(--bg-base);
  border: var(--border);
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
  font-size: 0.65rem;
  color: var(--text-secondary);
}

.gateway-methods {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.method-tag {
  padding: var(--space-1);
  font-size: 0.55rem;
  font-family: var(--font-mono);
  background: var(--bg-base);
  border: var(--border);
  color: var(--info);
}

/* Location Rules in Sidebar */
.location-rules {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.location-rule {
  padding: var(--space-3);
  border: var(--border);
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
  font-size: 0.75rem;
  margin: 0 0 var(--space-2) 0;
}

.location-rule.brazil h3 {
  color: var(--success);
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
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
  font-family: var(--font-mono);
}

/* Responsive */
@media (max-width: 1200px) {
  .panel-layout {
    grid-template-columns: 1fr;
  }

  .panel-left {
    max-height: 300px;
  }

  .telemetry-grid {
    grid-template-columns: 1fr;
  }

  .shop-config-sidebar {
    width: 280px;
  }
}

@media (max-width: 768px) {
  .visual-orchestrator {
    padding: var(--space-4);
  }

  .orchestrator-header {
    flex-direction: column;
  }

  .page-title {
    font-size: 1.5rem;
  }

  .header-actions {
    width: 100%;
  }

  .btn-flat, .btn-primary {
    flex: 1;
  }

  .stats-bar {
    gap: var(--space-2);
  }

  .stat-item {
    min-width: 80px;
    padding: var(--space-2) var(--space-3);
  }

  .stat-value {
    font-size: 1.2rem;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .tab-nav {
    flex-wrap: wrap;
  }

  .log-controls {
    flex-direction: column;
    align-items: flex-start;
  }

  .log-filters {
    flex-wrap: wrap;
  }

  .graph-controls-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .graph-toggles, .graph-actions {
    width: 100%;
  }

  .graph-toggle-btn {
    flex: 1;
  }

  .shop-config-sidebar {
    position: static;
    width: 100%;
    height: auto;
    border-left: none;
    border-top: var(--border);
    margin-top: var(--space-4);
    box-shadow: none;
  }
}
</style>
