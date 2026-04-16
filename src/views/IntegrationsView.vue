<template>
  <div class="integrations-view">
    <div class="page-header">
      <div>
        <span class="page-label">INTEGRATIONS</span>
        <h1 class="page-title">CONEXOES</h1>
      </div>
      <div class="header-actions">
        <button @click="openNewWebhookModal" class="btn-flat">
          <svg class="btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          WEBHOOK
        </button>
        <button @click="refreshData" class="btn-flat">
          <svg class="btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          REFRESH
        </button>
      </div>
    </div>

    <div class="tabs">
      <button
        :class="['tab-btn', { active: activeTab === 'gateways' }]"
        @click="activeTab = 'gateways'"
      >
        <span class="tab-indicator"></span>
        <svg class="tab-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        GATEWAYS
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'webhooks' }]"
        @click="activeTab = 'webhooks'"
      >
        <span class="tab-indicator"></span>
        <svg class="tab-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        WEBHOOKS
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'sync' }]"
        @click="activeTab = 'sync'"
      >
        <span class="tab-indicator"></span>
        <svg class="tab-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        SYNC
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'mappings' }]"
        @click="activeTab = 'mappings'"
      >
        <span class="tab-indicator"></span>
        <svg class="tab-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        MAPPINGS
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span class="loading-text">LOADING...</span>
    </div>

    <div v-if="activeTab === 'gateways'" class="gateways-section">
      <div class="gateways-grid">
        <div v-for="gateway in paymentGateways" :key="gateway.id" class="gateway-card" :class="{ active: gateway.enabled }">
          <div class="gateway-header">
            <div class="gateway-logo">
              <span class="gateway-icon">
                <svg v-if="gateway.id === 'mercadopago'" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                <svg v-else-if="gateway.id === 'abacatepay'" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <svg v-else-if="gateway.id === 'pix'" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                <svg v-else viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </span>
              <h3>{{ gateway.name }}</h3>
            </div>
            <span :class="['status-badge', gateway.enabled ? 'active' : 'inactive']">
              {{ gateway.enabled ? 'ATIVO' : 'INATIVO' }}
            </span>
          </div>
          <div class="gateway-details">
            <div class="detail-row">
              <span class="detail-label">PROVEDOR</span>
              <span class="detail-value mono">{{ gateway.provider }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">TRANSAÇÕES</span>
              <span class="detail-value">{{ gateway.transactions || 0 }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">RECEITA</span>
              <span class="detail-value text-success">R$ {{ gateway.revenue?.toFixed(2) || '0.00' }}</span>
            </div>
            <div class="detail-row" v-if="gateway.description">
              <span class="detail-label">DESCRIÇÃO</span>
              <span class="detail-value">{{ gateway.description }}</span>
            </div>
          </div>
          <div class="gateway-actions">
            <button @click="toggleGateway(gateway)" class="btn-action-toggle">
              {{ gateway.enabled ? 'DESATIVAR' : 'ATIVAR' }}
            </button>
            <button @click="configureGateway(gateway)" class="btn-action">CONFIGURAR</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'webhooks'" class="webhooks-section">
      <div class="webhooks-list">
        <div v-for="webhook in webhooks" :key="webhook.id" class="webhook-card">
          <div class="webhook-header">
            <div>
              <span class="webhook-label">WEBHOOK_ENDPOINT</span>
              <h3 class="webhook-url">{{ webhook.url }}</h3>
            </div>
            <div class="webhook-actions">
              <button @click="editWebhook(webhook)" class="btn-action">
                <svg class="btn-icon-sm" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                EDIT
              </button>
              <button @click="deleteWebhookConfirm(webhook.id)" class="btn-action-delete">
                <svg class="btn-icon-sm" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                DELETE
              </button>
            </div>
          </div>
          <div class="webhook-details">
            <div class="detail-row">
              <span class="detail-label">EVENTS</span>
              <span class="detail-value mono">{{ webhook.events?.join(', ') || 'ALL' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">STATUS</span>
              <span :class="['status-tag', webhook.is_active ? 'active' : 'inactive']">
                {{ webhook.is_active ? 'ACTIVE' : 'INACTIVE' }}
              </span>
            </div>
            <div class="detail-row" v-if="webhook.description">
              <span class="detail-label">DESCRIPTION</span>
              <span class="detail-value">{{ webhook.description }}</span>
            </div>
          </div>
        </div>
        <div v-if="webhooks.length === 0" class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <p>NO_WEBHOOKS_CONFIGURED</p>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'sync'" class="sync-section">
      <div class="sync-controls">
        <select v-model="syncSource" class="flat-select">
          <option value="uma_penca">UMA_PENCA</option>
          <option value="other">OTHER</option>
        </select>
        <select v-model="syncType" class="flat-select">
          <option v-for="type in syncTypes" :key="type" :value="type">
            {{ type.toUpperCase() }}
          </option>
        </select>
        <button @click="triggerSync" class="btn-primary">
          <svg class="btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          START_SYNC
        </button>
      </div>

      <div class="sync-log">
        <h3 class="section-title">SYNC_LOG</h3>
        <div class="table-wrapper">
          <table class="flat-table">
            <thead>
              <tr>
                <th>SOURCE</th>
                <th>TYPE</th>
                <th>STATUS</th>
                <th>STARTED</th>
                <th>FINISHED</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in syncLogs" :key="log.id">
                <td class="mono">{{ log.source }}</td>
                <td class="mono">{{ log.sync_type.toUpperCase() }}</td>
                <td>
                  <span :class="['status-tag', getSyncStatusColor(log.status)]">
                    {{ log.status.toUpperCase() }}
                  </span>
                </td>
                <td class="date-cell">{{ formatDateTime(log.started_at) }}</td>
                <td class="date-cell">{{ formatDateTime(log.finished_at) }}</td>
              </tr>
              <tr v-if="syncLogs.length === 0">
                <td colspan="5" class="empty-cell">NO_SYNC_LOGS</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'mappings'" class="mappings-section">
      <h3 class="section-title">PRODUCT_MAPPINGS</h3>
      <div class="table-wrapper">
        <table class="flat-table">
          <thead>
            <tr>
              <th>SOURCE</th>
              <th>EXTERNAL_ID</th>
              <th>INTERNAL_PRODUCT</th>
              <th>SYNC</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="mapping in productMappings" :key="mapping.id">
              <td class="mono">{{ mapping.source.toUpperCase() }}</td>
              <td class="mono">{{ mapping.external_product_id }}</td>
              <td>{{ mapping.product?.name || '-' }}</td>
              <td>
                <span :class="['status-tag', mapping.sync_enabled ? 'active' : 'inactive']">
                  {{ mapping.sync_enabled ? 'ACTIVE' : 'INACTIVE' }}
                </span>
              </td>
              <td>
                <button @click="toggleMappingSync(mapping)" class="btn-action-toggle">
                  {{ mapping.sync_enabled ? 'PAUSE' : 'RESUME' }}
                </button>
              </td>
            </tr>
            <tr v-if="productMappings.length === 0">
              <td colspan="5" class="empty-cell">NO_MAPPINGS</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showWebhookModal" class="modal-overlay" @click.self="closeWebhookModal">
      <div class="flat-modal">
        <div class="modal-header">
          <div>
            <span class="modal-label">{{ editingWebhook ? 'EDIT_WEBHOOK' : 'NEW_WEBHOOK' }}</span>
            <h2>{{ editingWebhook ? 'UPDATE_WEBHOOK' : 'ADD_WEBHOOK' }}</h2>
          </div>
          <button @click="closeWebhookModal" class="close-btn">
            <svg class="close-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form @submit.prevent="saveWebhook" class="modal-form">
          <div class="form-group">
            <label>URL</label>
            <input v-model="webhookForm.url" type="url" required placeholder="https://example.com/webhook">
          </div>

          <div class="form-group">
            <label>SECRET</label>
            <input v-model="webhookForm.secret" placeholder="HMAC_VERIFICATION_KEY">
          </div>

          <div class="form-group">
            <label>EVENTS</label>
            <input v-model="eventsInput" placeholder="billing.paid, pix.paid, pix.expired">
          </div>

          <div class="form-group">
            <label>DESCRIPTION</label>
            <textarea v-model="webhookForm.description" rows="3"></textarea>
          </div>

          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" v-model="webhookForm.is_active">
              <svg class="check-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ACTIVE
            </label>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeWebhookModal" class="btn-flat">
              CANCEL
            </button>
            <button type="submit" class="btn-primary">
              {{ editingWebhook ? 'SAVE' : 'ADD' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useIntegrationsStore } from '../stores/integrations'

const integrationsStore = useIntegrationsStore()

const activeTab = ref('gateways')
const showWebhookModal = ref(false)
const editingWebhook = ref(null)
const syncSource = ref('uma_penca')
const syncType = ref('full')
const eventsInput = ref('')

const webhooks = computed(() => integrationsStore.webhooks)
const syncLogs = computed(() => integrationsStore.syncLogs)
const productMappings = computed(() => integrationsStore.productMappings)
const loading = computed(() => integrationsStore.loading)
const syncTypes = computed(() => integrationsStore.syncTypes)

const paymentGateways = ref([
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    provider: 'mercadopago',
    icon: '💳',
    enabled: true,
    description: 'Gateway de pagamento principal',
    transactions: 0,
    revenue: 0,
    config: {
      accessToken: '',
      publicKey: ''
    }
  },
  {
    id: 'abacatepay',
    name: 'Abacate Pay',
    provider: 'abacatepay',
    icon: '🥑',
    enabled: true,
    description: 'Gateway alternativo',
    transactions: 0,
    revenue: 0,
    config: {
      apiKey: ''
    }
  },
  {
    id: 'pix',
    name: 'PIX',
    provider: 'pix',
    icon: '💰',
    enabled: true,
    description: 'Pagamento instantâneo',
    transactions: 0,
    revenue: 0,
    config: {}
  }
])

const webhookForm = ref({
  url: '',
  secret: '',
  events: [],
  description: '',
  is_active: true
})

function formatDateTime(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('pt-BR')
}

function getSyncStatusColor(status) {
  return status.toLowerCase()
}

function openNewWebhookModal() {
  editingWebhook.value = null
  webhookForm.value = {
    url: '',
    secret: '',
    events: [],
    description: '',
    is_active: true
  }
  eventsInput.value = ''
  showWebhookModal.value = true
}

function editWebhook(webhook) {
  editingWebhook.value = webhook
  webhookForm.value = {
    url: webhook.url,
    secret: webhook.secret,
    events: webhook.events || [],
    description: webhook.description || '',
    is_active: webhook.is_active
  }
  eventsInput.value = (webhook.events || []).join(', ')
  showWebhookModal.value = true
}

function deleteWebhookConfirm(id) {
  if (confirm('Delete this webhook?')) {
    integrationsStore.deleteWebhook(id)
  }
}

function closeWebhookModal() {
  showWebhookModal.value = false
  editingWebhook.value = null
  webhookForm.value = {
    url: '',
    secret: '',
    events: [],
    description: '',
    is_active: true
  }
  eventsInput.value = ''
}

async function saveWebhook() {
  try {
    webhookForm.value.events = eventsInput.value
      .split(',')
      .map(e => e.trim())
      .filter(e => e)

    if (editingWebhook.value) {
      await integrationsStore.updateWebhook(editingWebhook.value.id, webhookForm.value)
    } else {
      await integrationsStore.addWebhook(webhookForm.value)
    }
    closeWebhookModal()
  } catch (err) {
    console.error('Error saving webhook:', err)
  }
}

async function triggerSync() {
  try {
    await integrationsStore.triggerSync(syncSource.value, syncType.value)
    await refreshData()
  } catch (err) {
    console.error('Error triggering sync:', err)
  }
}

async function toggleMappingSync(mapping) {
  try {
    await integrationsStore.updateProductMapping(mapping.id, {
      sync_enabled: !mapping.sync_enabled
    })
    await refreshData()
  } catch (err) {
    console.error('Error updating mapping:', err)
  }
}

async function refreshData() {
  await integrationsStore.fetchWebhooks()
  await integrationsStore.fetchSyncLogs()
  await integrationsStore.fetchProductMappings()
}

function toggleGateway(gateway) {
  gateway.enabled = !gateway.enabled
}

function configureGateway(gateway) {
  alert(`Configuração do ${gateway.name} em breve...`)
}

onMounted(async () => {
  await refreshData()
})
</script>

<style scoped>
.integrations-view {
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
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

.btn-icon {
  vertical-align: middle;
  margin-right: var(--space-1);
}

/* Tabs */
.tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
  border-bottom: 1px solid var(--border);
  padding-bottom: var(--space-2);
}

.tab-btn {
  background: transparent;
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  border: 1px solid transparent;
  border-radius: 0;
  transition: all 0.15s ease;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  position: relative;
}

.tab-icon {
  opacity: 0.6;
}

.tab-indicator {
  width: 0;
  height: 2px;
  background: var(--gold);
  transition: width 0.15s ease;
}

.tab-btn.active {
  color: var(--gold);
  border-bottom-color: var(--gold);
}

.tab-btn.active .tab-indicator {
  width: 100%;
  position: absolute;
  bottom: -9px;
  left: 0;
}

.tab-btn:hover:not(.active) {
  color: var(--text-primary);
}

/* Loading */
.loading-state {
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
}

.loading-text {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--text-muted);
  letter-spacing: 2px;
}

/* Gateways */
.gateways-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-4);
}

.gateway-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  padding: var(--space-5);
  transition: all 0.15s ease;
}

.gateway-card.active {
  border-color: var(--success);
}

.gateway-card:hover {
  border-color: var(--gold);
}

.gateway-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
  gap: var(--space-3);
}

.gateway-logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.gateway-icon {
  display: flex;
  align-items: center;
  color: var(--gold);
}

.gateway-logo h3 {
  font-family: var(--font-display);
  font-size: 1.25rem;
  color: var(--text-primary);
  margin: 0;
}

.status-badge {
  padding: var(--space-1) var(--space-2);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 1px;
}

.status-badge.active {
  background: var(--success);
  color: var(--bg-base);
}

.status-badge.inactive {
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.gateway-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.text-success {
  color: var(--success);
}

.gateway-actions {
  display: flex;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border);
}

/* Webhooks */
.webhooks-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.webhook-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: var(--space-4);
  transition: border-color 0.15s ease;
}

.webhook-card:hover {
  border-color: var(--gold);
}

.webhook-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-3);
  gap: var(--space-4);
  flex-wrap: wrap;
}

.webhook-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
  letter-spacing: 1px;
  display: block;
  margin-bottom: var(--space-1);
}

.webhook-url {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  color: var(--info);
  word-break: break-all;
  margin: 0;
}

.webhook-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.webhook-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
  letter-spacing: 1px;
}

.detail-value {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.detail-value.mono {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-primary);
}

/* Sync */
.sync-controls {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
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

.section-title {
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--text-muted);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border);
}

/* Tables */
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
}

.flat-table tbody tr:hover {
  background: var(--bg-elevated);
}

.mono {
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.date-cell {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.empty-cell {
  text-align: center;
  padding: var(--space-8);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 1px;
}

/* Status Tags */
.status-tag {
  padding: var(--space-1) var(--space-2);
  border-radius: 0;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 1px;
  display: inline-block;
}

.status-tag.active,
.status-tag.success,
.status-tag.completed {
  background: var(--success);
  color: var(--bg-base);
}

.status-tag.inactive,
.status-tag.neutral {
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.status-tag.pending,
.status-tag.warning {
  background: var(--warning);
  color: var(--bg-base);
}

.status-tag.failed,
.status-tag.error,
.status-tag.cancelled {
  background: var(--danger);
  color: var(--bg-base);
}

.status-tag.running,
.status-tag.info,
.status-tag.processing {
  background: var(--info);
  color: var(--bg-base);
}

/* Buttons */
.btn-flat {
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 0;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.btn-flat:hover {
  border-color: var(--gold);
  color: var(--gold);
}

.btn-primary {
  padding: var(--space-2) var(--space-4);
  background: var(--gold);
  border: 1px solid var(--gold);
  border-radius: 0;
  color: var(--bg-base);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.btn-primary:hover {
  background: var(--gold-light);
  border-color: var(--gold-light);
}

.btn-action,
.btn-action-delete,
.btn-action-toggle {
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 0;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.btn-action:hover {
  background: var(--gold);
  color: var(--bg-base);
  border-color: var(--gold);
}

.btn-action-delete:hover {
  background: var(--danger);
  color: var(--bg-base);
  border-color: var(--danger);
}

.btn-action-toggle:hover {
  background: var(--success);
  color: var(--bg-base);
  border-color: var(--success);
}

.btn-icon-sm {
  vertical-align: middle;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: var(--space-16);
  border: 1px dashed var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.empty-icon {
  color: var(--text-muted);
  opacity: 0.4;
}

.empty-state p {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--text-muted);
  letter-spacing: 2px;
  margin: 0;
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
  border-radius: 0;
  width: 100%;
  max-width: 600px;
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
  background: var(--gold);
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
  border-radius: 0;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--danger);
  color: var(--bg-base);
  border-color: var(--danger);
}

.close-icon {
  display: block;
}

.modal-form {
  padding: var(--space-6);
}

.form-group {
  margin-bottom: var(--space-4);
}

.form-group label {
  display: block;
  margin-bottom: var(--space-2);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--text-muted);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 0;
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-mono);
  font-size: 0.85rem;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--gold);
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.check-icon {
  color: var(--gold);
  flex-shrink: 0;
}

.checkbox-group input[type="checkbox"] {
  width: auto;
  accent-color: var(--gold);
}

.modal-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  margin-top: var(--space-6);
}

/* Responsive */
@media (max-width: 768px) {
  .integrations-view {
    padding: var(--space-4);
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .page-title {
    font-size: 1.75rem;
  }

  .tabs {
    flex-wrap: wrap;
  }

  .sync-controls {
    flex-direction: column;
  }

  .flat-select {
    width: 100%;
  }

  .webhook-header {
    flex-direction: column;
  }

  .webhook-actions {
    width: 100%;
  }

  .btn-action,
  .btn-action-delete {
    flex: 1;
    text-align: center;
    justify-content: center;
  }

  .flat-modal {
    margin: var(--space-2);
  }

  .modal-header,
  .modal-form {
    padding: var(--space-4);
  }
}
</style>
