import { defineStore } from 'pinia'
import { ref } from 'vue'
import { edgeApi } from '../api/edgeApi'
import type { OrderStats, DailyMetrics, FulfillmentMetrics, FulfillmentAverages, Collection } from '../types'

interface DashboardStats {
  totalOrders: number
  pendingOrders: number
  totalRevenue: number
  totalProducts: number
  activeProducts: number
  lowStockProducts: number
  totalCustomers: number
  averageOrderValue: number
}

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    activeProducts: 0,
    lowStockProducts: 0,
    totalCustomers: 0,
    averageOrderValue: 0
  })

  const recentOrders = ref<Record<string, unknown>[]>([])
  const topProducts = ref<Record<string, unknown>[]>([])
  const revenueByDay = ref<Record<string, unknown>[]>([])
  const ordersByStatus = ref<Record<string, unknown>[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const dateRange = ref<{ start: string | null; end: string | null }>({ start: null, end: null })

  async function fetchDashboardStats(days: number = 30) {
    loading.value = true
    error.value = null

    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      dateRange.value = { start: startDate.toISOString(), end: new Date().toISOString() }

      const result = await edgeApi.dashboard.getOverview({ days })

      if (result.data) {
        const data = result.data as Record<string, unknown>
        const orderStats = data.orderStats as OrderStats | undefined

        stats.value = {
          totalOrders: orderStats?.total_orders || 0,
          pendingOrders: orderStats?.pending_orders || 0,
          totalRevenue: orderStats?.gross_revenue || 0,
          totalProducts: (data.totalProducts as number) || 0,
          activeProducts: (data.activeProducts as number) || 0,
          lowStockProducts: (data.lowStock as unknown[])?.length || 0,
          totalCustomers: (data.totalCustomers as number) || 0,
          averageOrderValue: orderStats?.average_order_value || 0
        }

        recentOrders.value = (data.recentOrders as Record<string, unknown>[]) || []
        topProducts.value = (data.topProducts as Record<string, unknown>[]) || []

        if (orderStats) {
          ordersByStatus.value = []
        }
      }
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar dashboard'
      console.error('fetchDashboardStats error:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchRevenueByDay(days: number = 30) {
    try {
      const result = await edgeApi.dashboard.getMetrics({ days })
      if (result.data) {
        const metrics = result.data as DailyMetrics[]
        revenueByDay.value = metrics
          .filter(m => m.net_revenue > 0)
          .map(m => ({ date: m.date, revenue: m.net_revenue }))
          .sort((a, b) => (a.date as string).localeCompare(b.date as string))
      } else {
        revenueByDay.value = []
      }
    } catch (err: unknown) {
      console.error('fetchRevenueByDay error:', err)
      revenueByDay.value = []
    }
  }

  async function fetchTopProducts(limit: number = 10) {
    try {
      const result = await edgeApi.dashboard.getTopProducts({ limit })
      topProducts.value = (result.data as Record<string, unknown>[]) || []
    } catch (err: unknown) {
      console.error('fetchTopProducts error:', err)
      topProducts.value = []
    }
  }

  async function fetchInventoryMovements(limit: number = 20): Promise<Record<string, unknown>[]> {
    try {
      const result = await edgeApi.inventory.getMovements({ limit })
      return (result.data as unknown as Record<string, unknown>[]) || []
    } catch (err: unknown) {
      console.error('fetchInventoryMovements error:', err)
      return []
    }
  }

  async function fetchDailyMetrics(days: number = 30): Promise<DailyMetrics[]> {
    try {
      const result = await edgeApi.dashboard.getMetrics({ days })
      return (result.data as DailyMetrics[]) || []
    } catch (err: unknown) {
      console.error('fetchDailyMetrics error:', err)
      return []
    }
  }

  async function fetchFulfillmentAverages(): Promise<FulfillmentAverages> {
    try {
      const result = await edgeApi.dashboard.getFulfillmentAverages()
      return (result.data as FulfillmentAverages) || {
        preparation_time_hours: 0,
        shipping_time_hours: 0,
        on_time_rate_percent: 0
      }
    } catch (err: unknown) {
      console.error('fetchFulfillmentAverages error:', err)
      return {
        preparation_time_hours: 0,
        shipping_time_hours: 0,
        on_time_rate_percent: 0
      }
    }
  }

  async function fetchCollections(): Promise<Collection[]> {
    try {
      const result = await edgeApi.collections.list()
      return (result.data as Collection[]) || []
    } catch (err: unknown) {
      console.error('fetchCollections error:', err)
      return []
    }
  }

  return {
    stats,
    recentOrders,
    topProducts,
    revenueByDay,
    ordersByStatus,
    loading,
    error,
    dateRange,
    fetchDashboardStats,
    fetchRevenueByDay,
    fetchTopProducts,
    fetchInventoryMovements,
    fetchDailyMetrics,
    fetchFulfillmentAverages,
    fetchCollections
  }
})
