import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { edgeApi } from '../api/edgeApi'
import { supabase } from '../supabase'

type NodeType = 'store' | 'gateway' | 'order' | 'product' | 'customer' | 'sync'

interface NetworkNode {
  id: string
  label: string
  type: NodeType
  [key: string]: unknown
}

interface NetworkEdge {
  from: string
  to: string
  label?: string
  value?: number
  arrows?: string
  color?: { color: string }
  dashes?: boolean
}

interface LiveEvent {
  id: number
  table: string
  eventType: string
  record: Record<string, unknown>
  timestamp: string
}

interface NodeCounts {
  total: number
  [key: string]: number
}

export const useNetworkStore = defineStore('network', () => {
  // Node and edge data for the graph
  const nodes = ref<NetworkNode[]>([])
  const edges = ref<NetworkEdge[]>([])

  // Real-time state
  const channels = ref<Array<{ unsubscribe: () => void }>>([])
  const isConnected = ref(false)
  const lastActivity = ref<string | null>(null)
  const liveEvents = ref<LiveEvent[]>([])

  // Loading and error state
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Filter state
  const selectedNode = ref<NetworkNode | null>(null)
  const nodeFilter = ref<NodeType | 'all'>('all')
  const highlightConnected = ref(true)

  // Computed: node counts by type
  const nodeCounts = computed<NodeCounts>(() => {
    const counts: NodeCounts = { total: nodes.value.length }
    nodes.value.forEach(n => {
      counts[n.type] = (counts[n.type] || 0) + 1
    })
    return counts
  })

  // Computed: active connections count
  const connectionCount = computed(() => edges.value.length)

  // Computed: recent live events (last 50)
  const recentEvents = computed(() => liveEvents.value.slice(0, 50))

  // Computed: store nodes
  const storeNodes = computed(() =>
    nodes.value.filter(n => n.type === 'store')
  )

  // Computed: gateway nodes
  const gatewayNodes = computed(() =>
    nodes.value.filter(n => n.type === 'gateway')
  )

  // Computed: recent order nodes
  const orderNodes = computed(() =>
    nodes.value.filter(n => n.type === 'order').slice(0, 20)
  )

  // Node type configurations
  const nodeTypeConfig: Record<NodeType, { color: string; icon: string; size: number; shape: string }> = {
    store: {
      color: '#7B2CBF',
      icon: '🏪',
      size: 40,
      shape: 'dot'
    },
    gateway: {
      color: '#00FF41',
      icon: '💳',
      size: 35,
      shape: 'diamond'
    },
    order: {
      color: '#FF6B6B',
      icon: '🛒',
      size: 20,
      shape: 'dot'
    },
    product: {
      color: '#4ECDC4',
      icon: '📦',
      size: 15,
      shape: 'dot'
    },
    customer: {
      color: '#FFE66D',
      icon: '👤',
      size: 25,
      shape: 'dot'
    },
    sync: {
      color: '#95E1D3',
      icon: '🔄',
      size: 20,
      shape: 'triangle'
    }
  }

  // Build graph nodes from database data
  async function buildGraph() {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.network.getGraph()
      if (result.data) {
        const data = result.data as unknown as { nodes: NetworkNode[]; edges: NetworkEdge[] }
        nodes.value = data.nodes || []
        edges.value = data.edges || []
        isConnected.value = true
      }
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao construir grafo'
      console.error('buildGraph error:', err)
      isConnected.value = false
    } finally {
      loading.value = false
    }
  }

  // Subscribe to realtime events from Supabase
  async function subscribeToRealtime() {
    // Unsubscribe from existing channels
    await unsubscribe()

    if (!supabase) {
      console.warn('[Network] Supabase not available, realtime disabled')
      return
    }

    try {
      // Subscribe to orders table changes
      const ordersChannel = supabase
        .channel('network-orders')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload) => {
            handleRealtimeEvent('orders', {
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old
            })
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            isConnected.value = true
          }
        })

      channels.value.push(ordersChannel)

      // Subscribe to third_party_sync_log table changes
      const syncChannel = supabase
        .channel('network-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'third_party_sync_log' },
          (payload) => {
            handleRealtimeEvent('third_party_sync_log', {
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old
            })
          }
        )
        .subscribe()

      channels.value.push(syncChannel)
    } catch (err) {
      console.error('[Network] Failed to subscribe to realtime:', err)
    }
  }

  // Handle realtime events and update graph
  function handleRealtimeEvent(table: string, payload: Record<string, unknown>) {
    const eventType = (payload.eventType as string) || ''
    const record = (payload.new || payload.old) as Record<string, unknown>

    lastActivity.value = new Date().toISOString()

    const event: LiveEvent = {
      id: Date.now(),
      table,
      eventType,
      record,
      timestamp: new Date().toISOString()
    }

    liveEvents.value.unshift(event)

    // Rebuild affected parts of graph
    if (table === 'orders') {
      refreshOrderNodes().catch(console.error)
    } else if (table === 'third_party_sync_log') {
      refreshStoreNodes().catch(console.error)
    }
  }

  // Refresh order nodes when new order arrives
  async function refreshOrderNodes() {
    const result = await edgeApi.network.getGraph()
    if (!result.data) return

    const data = result.data as unknown as { nodes: NetworkNode[] }
    const newOrders = data.nodes.filter(n => n.type === 'order')
    const existingOrderIds = new Set(nodes.value.filter(n => n.type === 'order').map(n => n.id))

    // Add new order nodes
    newOrders.forEach(order => {
      if (!existingOrderIds.has(order.id)) {
        nodes.value.push(order)

        // Add edges
        const source = order.source as string | undefined
        const paymentMethod = order.payment_method as string | undefined

        if (source) {
          const storeId = `store_${source}`
          if (nodes.value.some(n => n.id === storeId)) {
            edges.value.push({
              from: order.id,
              to: storeId,
              label: 'from',
              arrows: 'to',
              color: { color: '#7B2CBF' }
            })
          }
        }

        if (paymentMethod) {
          const gatewayId = `gateway_${paymentMethod}`
          if (nodes.value.some(n => n.id === gatewayId)) {
            edges.value.push({
              from: order.id,
              to: gatewayId,
              label: 'paid via',
              arrows: 'to',
              color: { color: '#00FF41' }
            })
          }
        }
      }
    })
  }

  // Refresh store nodes when sync completes
  async function refreshStoreNodes() {
    const result = await edgeApi.network.getGraph()
    if (!result.data) return

    const data = result.data as unknown as { nodes: NetworkNode[] }
    const stores = data.nodes.filter(n => n.type === 'store')
    stores.forEach(store => {
      const existingIndex = nodes.value.findIndex(n => n.id === store.id)
      if (existingIndex >= 0) {
        nodes.value[existingIndex] = store
      } else {
        nodes.value.push(store)
      }
    })
  }

  // Unsubscribe from realtime channels
  async function unsubscribe() {
    channels.value = []
    isConnected.value = false
  }

  // Select a node for detail view
  function selectNode(nodeId: string) {
    selectedNode.value = nodes.value.find(n => n.id === nodeId) || null
  }

  // Clear node selection
  function clearSelection() {
    selectedNode.value = null
  }

  // Set node filter
  function setFilter(filter: NodeType | 'all') {
    nodeFilter.value = filter
  }

  // Get node configuration
  function getNodeConfig(type: NodeType | string) {
    return nodeTypeConfig[type as NodeType] || nodeTypeConfig.product
  }

  // Get filtered nodes based on current filter
  const filteredNodes = computed(() => {
    if (nodeFilter.value === 'all') return nodes.value
    return nodes.value.filter(n => n.type === nodeFilter.value)
  })

  return {
    nodes,
    edges,
    channels,
    isConnected,
    lastActivity,
    liveEvents,
    loading,
    error,
    selectedNode,
    nodeFilter,
    highlightConnected,
    nodeCounts,
    connectionCount,
    recentEvents,
    storeNodes,
    gatewayNodes,
    orderNodes,
    filteredNodes,
    buildGraph,
    subscribeToRealtime,
    handleRealtimeEvent,
    unsubscribe,
    refreshOrderNodes,
    refreshStoreNodes,
    selectNode,
    clearSelection,
    setFilter,
    getNodeConfig
  }
})
