<template>
  <div class="mercadopago-config">
    <div class="page-header">
      <div>
        <span class="page-label">MERCADO PAGO</span>
        <h1 class="page-title">CONFIGURACAO_MERCADO_PAGO</h1>
      </div>
      <div class="header-actions">
        <button @click="testConnection" class="btn-flat" :disabled="testing">
          <svg v-if="!testing" class="btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <svg v-else class="spinner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"/>
          </svg>
          {{ testing ? 'TESTING...' : 'TEST_CONNECTION' }}
        </button>
        <button @click="saveConfig" class="btn-primary" :disabled="saving">
          <svg v-if="!saving" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          <svg v-else class="spinner-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"/>
          </svg>
          {{ saving ? 'SAVING...' : 'SAVE_CONFIG' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span class="loading-text">LOADING...</span>
    </div>

    <div v-else class="config-content">
      <!-- Status Card -->
      <div class="status-card" :class="{ 'status-active': isConnected }">
        <div class="status-icon">
          <svg v-if="isConnected" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <svg v-else width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div class="status-info">
          <h3>{{ isConnected ? 'CONECTADO' : 'NAO_CONECTADO' }}</h3>
          <p>{{ isConnected ? 'MercadoPago integration is active and ready' : 'Configure your MercadoPago credentials below' }}</p>
        </div>
      </div>

      <!-- Credentials Form -->
      <div class="config-form">
        <h2 class="form-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          CREDENCIAIS
        </h2>

        <div class="form-grid">
          <div class="form-group">
            <label for="public-key">Public Key (Frontend)</label>
            <input
              id="public-key"
              v-model="config.publicKey"
              type="text"
              class="form-input"
              placeholder="APP_USR-xxxx-xxxx-xxxx-xxxx"
            />
            <p class="form-hint">Used in BhumiShop frontend for PIX Bricks widget</p>
          </div>

          <div class="form-group">
            <label for="access-token">Access Token (Backend)</label>
            <input
              id="access-token"
              v-model="config.accessToken"
              type="password"
              class="form-input"
              placeholder="APP_USR-xxxx-xxxx-xxxx-xxxx"
            />
            <p class="form-hint">Used by edge functions for webhooks and payment creation</p>
          </div>

          <div class="form-group">
            <label for="client-id">Client ID</label>
            <input
              id="client-id"
              v-model="config.clientId"
              type="text"
              class="form-input"
              placeholder="1234567890123456"
            />
            <p class="form-hint">Your MercadoPago application ID</p>
          </div>

          <div class="form-group">
            <label for="client-secret">Client Secret</label>
            <input
              id="client-secret"
              v-model="config.clientSecret"
              type="password"
              class="form-input"
              placeholder="xxxxxxxxxxxxxxxx"
            />
            <p class="form-hint">Keep this secure - never expose in frontend code</p>
          </div>

          <div class="form-group">
            <label for="user-id">User ID</label>
            <input
              id="user-id"
              v-model="config.userId"
              type="text"
              class="form-input"
              placeholder="123456789"
            />
            <p class="form-hint">Your MercadoPago seller account ID</p>
          </div>

          <div class="form-group">
            <label for="app-id">Application Number</label>
            <input
              id="app-id"
              v-model="config.appId"
              type="text"
              class="form-input"
              placeholder="1234567890123456"
            />
            <p class="form-hint">Application ID from MercadoPago Developers</p>
          </div>
        </div>
      </div>

      <!-- PIX Bricks Configuration -->
      <div class="config-form">
        <h2 class="form-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
          </svg>
          PIX_BRICKS_SETTINGS
        </h2>

        <div class="form-grid">
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="config.pixEnabled" />
              <span class="checkmark"></span>
              Enable PIX Payment Method
            </label>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="config.cardEnabled" />
              <span class="checkmark"></span>
              Enable Credit/Debit Card via Bricks
            </label>
          </div>

          <div class="form-group">
            <label for="webhook-url">Webhook URL (copy to MercadoPago)</label>
            <div class="input-with-copy">
              <input
                id="webhook-url"
                :value="webhookUrl"
                type="text"
                class="form-input"
                readonly
              />
              <button @click="copyWebhookUrl" class="btn-copy">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                COPY
              </button>
            </div>
            <p class="form-hint">Add this URL to your MercadoPago application webhook settings</p>
          </div>
        </div>
      </div>

      <!-- Environment Variables -->
      <div class="config-form">
        <h2 class="form-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
          ENV_VARIABLES
        </h2>

        <div class="env-vars">
          <div class="env-item">
            <label>BhumiShop .env (Frontend)</label>
            <code class="env-code">
              VITE_MERCADOPAGO_PUBLIC_KEY={{ config.publicKey || 'APP_USR-xxx' }}
            </code>
          </div>
          <div class="env-item">
            <label>Supabase Edge Functions (Secrets)</label>
            <code class="env-code">
              MERCADOPAGO_ACCESS_TOKEN={{ config.accessToken ? 'APP_USR-***' : 'not_set' }}
            </code>
          </div>
        </div>
      </div>

      <!-- Test Results -->
      <div v-if="testResult" class="test-results" :class="testResult.success ? 'test-success' : 'test-failed'">
        <div class="test-icon">
          <svg v-if="testResult.success" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <div class="test-info">
          <h4>{{ testResult.success ? 'CONNECTION_SUCCESSFUL' : 'CONNECTION_FAILED' }}</h4>
          <p>{{ testResult.message }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useNotificationStore } from '../stores/notifications'

const notifications = useNotificationStore()

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const testResult = ref(null)

const config = ref({
  publicKey: '',
  accessToken: '',
  clientId: '',
  clientSecret: '',
  userId: '',
  appId: '',
  pixEnabled: true,
  cardEnabled: true,
})

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pyidnhtwlxlyuwswaazf.supabase.co'
const webhookUrl = computed(() => `${supabaseUrl}/functions/v1/mercadopago-webhook`)

const isConnected = computed(() => {
  return config.value.publicKey && config.value.accessToken
})

async function loadConfig() {
  loading.value = true
  try {
    // Load from environment / shop config
    const mpPublicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || ''
    if (mpPublicKey && mpPublicKey !== 'your-mp-public-key') {
      config.value.publicKey = mpPublicKey
    }

    // Try to load from shop config store if available
    const { useShopConfigStore } = await import('../stores/shopConfig')
    const shopConfig = useShopConfigStore()
    const mpGateway = shopConfig.gateways.find(g => g.gateway === 'mercadopago')
    if (mpGateway?.credentials) {
      if (mpGateway.credentials.publicKey) config.value.publicKey = mpGateway.credentials.publicKey
      if (mpGateway.credentials.clientId) config.value.clientId = mpGateway.credentials.clientId
      if (mpGateway.credentials.appId) config.value.appId = mpGateway.credentials.appId
      if (mpGateway.credentials.userId) config.value.userId = mpGateway.credentials.userId
    }
  } catch (err) {
    console.error('Error loading MercadoPago config:', err)
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  try {
    const { useShopConfigStore } = await import('../stores/shopConfig')
    const shopConfig = useShopConfigStore()

    // Update gateway credentials
    const mpGateway = shopConfig.gateways.find(g => g.gateway === 'mercadopago')
    if (mpGateway) {
      mpGateway.credentials = {
        ...mpGateway.credentials,
        publicKey: config.value.publicKey,
        clientId: config.value.clientId,
        clientSecret: config.value.clientSecret,
        accessToken: config.value.accessToken,
        userId: config.value.userId,
        appId: config.value.appId,
        pixEnabled: config.value.pixEnabled,
        cardEnabled: config.value.cardEnabled,
      }
    }

    await shopConfig.saveConfig({
      payment_gateways: shopConfig.gateways,
    })

    notifications.success('Configuração MercadoPago salva com sucesso')
  } catch (err) {
    console.error('Error saving MercadoPago config:', err)
    notifications.error('Falha ao salvar configuração MercadoPago')
  } finally {
    saving.value = false
  }
}

async function testConnection() {
  testing.value = true
  testResult.value = null

  try {
    if (!config.value.accessToken) {
      testResult.value = {
        success: false,
        message: 'Access Token is required for testing connection',
      }
      return
    }

    // Test MercadoPago API connection
    const response = await fetch('https://api.mercadopago.com/users/me', {
      headers: {
        'Authorization': `Bearer ${config.value.accessToken}`,
      },
    })

    if (response.ok) {
      const userData = await response.json()
      testResult.value = {
        success: true,
        message: `Connected as ${userData.nickname} (${userData.email}). Account ID: ${userData.id}`,
      }
      config.value.userId = userData.id?.toString() || config.value.userId
    } else {
      const errorData = await response.json().catch(() => ({}))
      testResult.value = {
        success: false,
        message: errorData.message || `HTTP ${response.status}: Invalid credentials`,
      }
    }
  } catch (err) {
    testResult.value = {
      success: false,
      message: `Connection error: ${err.message}`,
    }
  } finally {
    testing.value = false
  }
}

async function copyWebhookUrl() {
  try {
    await navigator.clipboard.writeText(webhookUrl.value)
    notifications.success('URL do webhook copiada')
  } catch {
    notifications.error('Falha ao copiar URL')
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.mercadopago-config {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.page-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0.25rem 0 0;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.btn-flat,
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-flat {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.btn-flat:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-primary {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-flat:disabled,
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

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 0;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--surface-2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 0.05em;
}

.config-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--surface-1);
  border: 2px solid var(--border);
  border-radius: var(--radius-lg);
}

.status-card.status-active {
  border-color: #10b981;
  background: #f0fdf4;
}

.status-info h3 {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
  color: var(--text-primary);
}

.status-info p {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0;
}

.config-form {
  padding: 1.5rem;
  background: var(--surface-0);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.form-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 1.25rem;
  color: var(--text-primary);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-group label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.form-input {
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-0);
  color: var(--text-primary);
  font-size: 0.9rem;
  font-family: var(--font-mono);
  transition: border-color var(--transition-fast);
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.form-input:read-only {
  background: var(--surface-1);
  cursor: default;
}

.form-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
}

.checkmark {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-radius: 4px;
  transition: all var(--transition-fast);
}

input[type="checkbox"]:checked + .checkmark {
  background: var(--accent);
  border-color: var(--accent);
}

.input-with-copy {
  display: flex;
  gap: 0.5rem;
}

.input-with-copy .form-input {
  flex: 1;
}

.btn-copy {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.btn-copy:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.env-vars {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.env-item {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.env-item label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.env-code {
  padding: 0.75rem 1rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-family: var(--font-mono);
  color: var(--accent);
  word-break: break-all;
}

.test-results {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: var(--radius-lg);
  border: 2px solid;
}

.test-success {
  background: #f0fdf4;
  border-color: #10b981;
}

.test-failed {
  background: #fef2f2;
  border-color: #ef4444;
}

.test-icon {
  flex-shrink: 0;
}

.test-info h4 {
  font-size: 0.95rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
  color: var(--text-primary);
}

.test-info p {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0;
}

@media (max-width: 768px) {
  .mercadopago-config {
    padding: 1rem;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: stretch;
  }

  .header-actions button {
    flex: 1;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
