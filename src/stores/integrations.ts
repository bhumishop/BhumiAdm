import { defineStore } from 'pinia'
import { ref } from 'vue'
import { edgeApi } from '../api/edgeApi'
import type { SyncLog, ProductMapping, WebhookEvent, SyncType, SyncStatus } from '../types'

interface WebhookEndpoint {
  id: string
  url: string
  secret?: string
  events: string[]
  is_active: boolean
  description?: string
  headers?: Record<string, unknown>
  created_at?: string
}

export const useIntegrationsStore = defineStore('integrations', () => {
  const webhooks = ref<WebhookEndpoint[]>([])
  const webhookEvents = ref<WebhookEvent[]>([])
  const syncLogs = ref<SyncLog[]>([])
  const productMappings = ref<ProductMapping[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const integrationStatuses: Record<SyncStatus | string, string> = {
    success: 'Ativo',
    running: 'Sincronizando',
    failed: 'Erro',
    partial: 'Parcial',
    active: 'Ativo',
    inactive: 'Inativo',
    error: 'Erro',
    syncing: 'Sincronizando'
  }

  const syncTypes: SyncType[] = ['full', 'incremental', 'products', 'inventory', 'orders', 'pricing']

  async function fetchWebhooks() {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.integrations.getWebhooks()
      webhooks.value = (result.data as unknown as WebhookEndpoint[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar webhooks'
      console.error('fetchWebhooks error:', err)
      webhooks.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchWebhookEvents(limit: number = 50) {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.integrations.getWebhookEvents({ limit })
      webhookEvents.value = (result.data as WebhookEvent[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar eventos de webhook'
      console.error('fetchWebhookEvents error:', err)
      webhookEvents.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchSyncLogs(limit: number = 50) {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.integrations.getSyncLogs({ limit })
      syncLogs.value = (result.data as SyncLog[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar logs de sincronização'
      console.error('fetchSyncLogs error:', err)
      syncLogs.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchProductMappings() {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.integrations.getProductMappings()
      productMappings.value = (result.data as ProductMapping[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar mapeamentos de produtos'
      console.error('fetchProductMappings error:', err)
      productMappings.value = []
    } finally {
      loading.value = false
    }
  }

  async function addWebhook(webhook: Partial<WebhookEndpoint>) {
    error.value = null

    try {
      const result = await edgeApi.integrations.createWebhook(webhook)
      await fetchWebhooks()
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao adicionar webhook'
      console.error('addWebhook error:', err)
      throw err
    }
  }

  async function updateWebhook(id: string, updates: Partial<WebhookEndpoint>) {
    error.value = null

    try {
      const result = await edgeApi.integrations.updateWebhook(id, updates)
      await fetchWebhooks()
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao atualizar webhook'
      console.error('updateWebhook error:', err)
      throw err
    }
  }

  async function deleteWebhook(id: string) {
    error.value = null

    try {
      await edgeApi.integrations.deleteWebhook(id)
      webhooks.value = webhooks.value.filter(w => w.id !== id)
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao excluir webhook'
      console.error('deleteWebhook error:', err)
      throw err
    }
  }

  async function triggerSync(source: string, syncType: SyncType = 'full') {
    error.value = null

    try {
      const result = await edgeApi.integrations.triggerSync(source, syncType)
      await fetchSyncLogs()
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao iniciar sincronização'
      console.error('triggerSync error:', err)
      throw err
    }
  }

  async function addProductMapping(mapping: Partial<ProductMapping>) {
    error.value = null

    try {
      const result = await edgeApi.integrations.createProductMapping(mapping)
      await fetchProductMappings()
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao adicionar mapeamento de produto'
      console.error('addProductMapping error:', err)
      throw err
    }
  }

  async function updateProductMapping(id: number, updates: Partial<ProductMapping>) {
    error.value = null

    try {
      const result = await edgeApi.integrations.updateProductMapping(id, updates)
      await fetchProductMappings()
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao atualizar mapeamento'
      console.error('updateProductMapping error:', err)
      throw err
    }
  }

  function getStatusColor(status: SyncStatus | string): string {
    const colors: Record<string, string> = {
      active: 'success',
      inactive: 'neutral',
      error: 'error',
      syncing: 'warning',
      pending: 'warning',
      success: 'success',
      failed: 'error',
      running: 'warning',
      partial: 'warning'
    }
    return colors[status] || 'neutral'
  }

  function getStatusLabel(status: SyncStatus | string): string {
    return integrationStatuses[status] || status
  }

  return {
    webhooks,
    webhookEvents,
    syncLogs,
    productMappings,
    loading,
    error,
    syncTypes,
    fetchWebhooks,
    fetchWebhookEvents,
    fetchSyncLogs,
    fetchProductMappings,
    addWebhook,
    updateWebhook,
    deleteWebhook,
    triggerSync,
    addProductMapping,
    updateProductMapping,
    getStatusColor,
    getStatusLabel
  }
})
