import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { edgeApi } from '../api/edgeApi'
import type { Order, OrderFilters, OrderStats } from '../types'

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes for orders
let ordersCache: Order[] | null = null
let cacheTimestamp = 0

function isCacheValid(): boolean {
  return ordersCache !== null && (Date.now() - cacheTimestamp) < CACHE_TTL
}

function clearCache(): void {
  ordersCache = null
  cacheTimestamp = 0
}

// Export for cross-store cache clearing on signOut
export function clearOrdersCache(): void {
  clearCache()
}

export const useOrderStore = defineStore('orders', () => {
  const orders = ref<Order[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedOrder = ref<Order | null>(null)
  const statusFilter = ref<string>('')
  const searchQuery = ref<string>('')
  const filters = ref<OrderFilters>({})

  const filteredOrders = computed(() => {
    let result = orders.value

    if (statusFilter.value) {
      result = result.filter(o => o.status === statusFilter.value)
    }

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      result = result.filter(o =>
        o.customer_name?.toLowerCase().includes(query) ||
        o.customer_email?.toLowerCase().includes(query) ||
        o.order_number?.toLowerCase().includes(query) ||
        o.id.toString().includes(query)
      )
    }

    return result
  })

  const orderStats = computed<OrderStats>(() => {
    return {
      total_orders: orders.value.length,
      completed_orders: orders.value.filter(o => o.status === 'delivered').length,
      pending_orders: orders.value.filter(o => o.status === 'pending').length,
      cancelled_orders: orders.value.filter(o => o.status === 'cancelled').length,
      gross_revenue: orders.value
        .filter(o => o.status !== 'cancelled')
        .reduce((sum, o) => sum + (o.total || 0), 0),
      net_revenue: 0,
      average_order_value: 0,
      total_items_sold: 0
    }
  })

  async function fetchOrders() {
    loading.value = true
    error.value = null

    try {
      if (isCacheValid() && ordersCache) {
        orders.value = ordersCache
        loading.value = false
        return
      }

      const result = await edgeApi.orders.list(filters.value)
      orders.value = result.data || []
      ordersCache = orders.value
      cacheTimestamp = Date.now()
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar pedidos'
      console.error('fetchOrders error:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchOrderById(id: string) {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.orders.get(id)
      selectedOrder.value = result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar pedido'
      console.error('fetchOrderById error:', err)
    } finally {
      loading.value = false
    }
  }

  async function updateOrderStatus(orderId: string, newStatus: Order['status'], description: string = '') {
    error.value = null

    try {
      await edgeApi.orders.updateStatus(orderId, {
        status: newStatus,
        admin_notes: description
      })

      clearCache()
      await fetchOrders()

      if (selectedOrder.value?.id === orderId) {
        await fetchOrderById(orderId)
      }
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao atualizar status do pedido'
      console.error('updateOrderStatus error:', err)
      throw err
    }
  }

  async function updateOrder(orderId: string, updates: Partial<Order>) {
    error.value = null

    try {
      const result = await edgeApi.orders.update(orderId, updates)

      clearCache()
      await fetchOrders()

      if (selectedOrder.value?.id === orderId) {
        await fetchOrderById(orderId)
      }

      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao atualizar pedido'
      console.error('updateOrder error:', err)
      throw err
    }
  }

  async function addTracking(orderId: string, trackingData: { tracking_number: string; carrier?: string; tracking_url?: string }) {
    error.value = null

    try {
      await edgeApi.orders.addTracking(orderId, {
        tracking_number: trackingData.tracking_number,
        carrier: trackingData.carrier || '',
        tracking_url: trackingData.tracking_url
      } as { tracking_number: string; carrier: string; delivery_type?: string; estimated_delivery_date?: string })

      if (selectedOrder.value?.id === orderId) {
        await fetchOrderById(orderId)
      }
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao adicionar rastreamento'
      console.error('addTracking error:', err)
      throw err
    }
  }

  function setStatusFilter(status: string) {
    statusFilter.value = status
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  function setFilters(newFilters: OrderFilters) {
    filters.value = { ...filters.value, ...newFilters }
  }

  function clearSelection() {
    selectedOrder.value = null
  }

  return {
    orders,
    loading,
    error,
    selectedOrder,
    statusFilter,
    searchQuery,
    filters,
    filteredOrders,
    orderStats,
    fetchOrders,
    fetchOrderById,
    updateOrderStatus,
    updateOrder,
    addTracking,
    setStatusFilter,
    setSearchQuery,
    setFilters,
    clearSelection
  }
})
