<template>
  <div class="integrations-view">
    <div class="page-header">
      <div>
        <span class="page-label">INTEGRATIONS</span>
        <h1 class="page-title">CONEXOES</h1>
      </div>
      <div class="header-actions">
        <button @click="openNewWebhookModal" class="btn-flat">
          + WEBHOOK
        </button>
        <button @click="refreshData" class="btn-flat">
          REFRESH
        </button>
      </div>
    </div>

    <div class="tabs">
      <button
        :class="['tab-btn', { active: activeTab === 'webhooks' }]"
        @click="activeTab = 'webhooks'"
      >
        <span class="tab-indicator"></span>
        WEBHOOKS
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'sync' }]"
        @click="activeTab = 'sync'"
      >
        <span class="tab-indicator"></span>
        SYNC
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'mappings' }]"
        @click="activeTab = 'mappings'"
      >
        <span class="tab-indicator"></span>
        MAPPINGS
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span class="loading-text">LOADING...</span>
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
              <button @click="editWebhook(webhook)" class="btn-action">EDIT</button>
              <button @click="deleteWebhookConfirm(webhook.id)" class="btn-action-delete">DELETE</button>
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
          <button @click="closeWebhookModal" class="close-btn">X</button>
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

const activeTab = ref('webhooks')
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

onMounted(async () => {
  await refreshData()
})
</script>

<style scoped>
.integrations-view {
  padding: var(--space-6);
  min-height: 100vh;
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

.tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
  border-bottom: 1px solid var(--border-color);
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

.tab-indicator {
  width: 0;
  height: 2px;
  background: var(--purple);
  transition: width 0.15s ease;
}

.tab-btn.active {
  color: var(--purple);
  border-bottom-color: var(--purple);
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

.loading-state {
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

/* Webhooks */
.webhooks-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.webhook-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 0;
  padding: var(--space-4);
  transition: border-color 0.15s ease;
}

.webhook-card:hover {
  border-color: var(--purple);
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
  color: var(--cyan);
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
  border-bottom: 1px solid var(--border-color);
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
  border: 1px solid var(--border-color);
  border-radius: 0;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 1px;
  cursor: pointer;
}

.flat-select:focus {
  outline: none;
  border-color: var(--purple);
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

/* Tables */
.table-wrapper {
  border: 1px solid var(--border-color);
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
  border-bottom: 1px solid var(--border-color);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: var(--text-muted);
}

.flat-table td {
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-color);
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
  background: var(--green);
  color: var(--bg-base);
}

.status-tag.inactive,
.status-tag.neutral {
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.status-tag.pending,
.status-tag.warning {
  background: var(--yellow);
  color: var(--bg-base);
}

.status-tag.failed,
.status-tag.error,
.status-tag.cancelled {
  background: var(--red);
  color: white;
}

.status-tag.running,
.status-tag.info,
.status-tag.processing {
  background: var(--cyan);
  color: var(--bg-base);
}

/* Buttons */
.btn-action,
.btn-action-delete,
.btn-action-toggle {
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-action:hover {
  background: var(--purple);
  color: white;
  border-color: var(--purple);
}

.btn-action-delete:hover {
  background: var(--red);
  color: white;
  border-color: var(--red);
}

.btn-action-toggle:hover {
  background: var(--green);
  color: var(--bg-base);
  border-color: var(--green);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: var(--space-16);
  border: 1px dashed var(--border-color);
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
  border: 1px solid var(--border-color);
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
  border: 1px solid var(--border-color);
  border-radius: 0;
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-mono);
  font-size: 0.85rem;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--purple);
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

.checkbox-group input[type="checkbox"] {
  width: auto;
  accent-color: var(--purple);
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
