import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { edgeApi } from '../api/edgeApi'
import type {
  SaleRecord,
  SalesStats,
  SaleStatus,
  PaymentGateway,
  ProductType,
  PaymentMethodType,
  CustomerLocation,
  PaymentProvider,
} from '../types'

const SALE_STATUS_CONFIG: Record<SaleStatus, { label: string; color: string; icon: string }> = {
  payment_cancelled: { label: 'Pagamento Cancelado', color: '#FF3347', icon: 'X' },
  payment_pending: { label: 'Pagamento Pendente', color: '#FFB800', icon: '!' },
  payment_processing: { label: 'Pagamento em Processamento', color: '#00E5FF', icon: '~' },
  direct_umapenca: { label: 'Venda Direta UmaPenca', color: '#8B5CF6', icon: 'U' },
  sold_abacatepay: { label: 'Venda AbacatePay', color: '#00FF41', icon: 'A' },
  sold_mercadopago: { label: 'Venda MercadoPago', color: '#00D4AA', icon: 'M' },
  sold_pix_bricks: { label: 'Venda PixBricks', color: '#3B82F6', icon: 'P' },
  completed: { label: 'Concluido', color: '#22C55E', icon: 'OK' },
  refunded: { label: 'Reembolsado', color: '#6B7280', icon: 'R' },
}

function mapOrderToSaleRecord(order: Record<string, unknown>): SaleRecord {
  const paymentProvider = (order.payment_provider as string) || ''
  const paymentMethod = (order.payment_method as string) || ''
  const status = (order.status as string) || 'pending'
  const paymentStatus = (order.payment_status as string) || 'pending'

  let saleStatus: SaleStatus = 'payment_pending'

  if (paymentStatus === 'failed' || status === 'cancelled') {
    saleStatus = 'payment_cancelled'
  } else if (paymentStatus === 'processing') {
    saleStatus = 'payment_processing'
  } else if (paymentStatus === 'paid' || status === 'paid' || status === 'delivered') {
    // Determine sale status based on payment gateway
    if (paymentProvider === 'umapenca') {
      saleStatus = 'direct_umapenca'
    } else if (paymentProvider === 'abacatepay') {
      saleStatus = 'sold_abacatepay'
    } else if (paymentProvider === 'mercadopago') {
      saleStatus = 'sold_mercadopago'
    } else if (paymentProvider === 'pix_bricks') {
      saleStatus = 'sold_pix_bricks'
    } else {
      saleStatus = 'completed'
    }
  }

  if (paymentStatus === 'refunded' || status === 'refunded') {
    saleStatus = 'refunded'
  }

  const address = (order.shipping_address as string) || ''
  const addressStruct = (order.shipping_address_structured as Record<string, unknown>) || {}
  const country = (addressStruct?.country as string) || (address.includes('Brazil') || address.match(/\bBR\b/) ? 'BR' : 'XX')
  const state = (addressStruct?.state as string) || ''
  const isBrazil = country === 'BR' || state.length === 2

  return {
    id: (order.id as string) || '',
    order_id: (order.id as string) || '',
    order_number: (order.order_number as string) || '',
    status: saleStatus,
    payment_gateway: (paymentProvider as PaymentGateway) || null,
    product_type: null,
    provider: (paymentProvider as PaymentProvider) || null,
    customer_location: isBrazil ? 'brazil' : 'international',
    customer_name: (order.customer_name as string) || '',
    customer_email: (order.customer_email as string) || '',
    customer_address: address || null,
    customer_state: state || null,
    customer_country: country || (isBrazil ? 'BR' : 'XX'),
    total: (order.total as number) || 0,
    currency: (order.currency as string) || 'BRL',
    items: ((order.items as Array<Record<string, unknown>>) || []).map(item => ({
      product_name: (item.product_name as string) || '',
      quantity: (item.quantity as number) || 1,
      price: (item.product_price as number) || 0,
    })),
    payment_method_type: (paymentMethod as PaymentMethodType) || null,
    created_at: (order.created_at as string) || '',
    updated_at: (order.updated_at as string) || '',
    metadata: (order.metadata as Record<string, unknown>) || {},
  }
}

export const useSalesStore = defineStore('sales', () => {
  const sales = ref<SaleRecord[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const statusFilter = ref<SaleStatus | 'all'>('all')
  const locationFilter = ref<CustomerLocation | 'all'>('all')
  const gatewayFilter = ref<PaymentGateway | 'all'>('all')
  const searchQuery = ref('')

  // Computed: filtered sales
  const filteredSales = computed(() => {
    let result = sales.value

    if (statusFilter.value !== 'all') {
      result = result.filter(s => s.status === statusFilter.value)
    }

    if (locationFilter.value !== 'all') {
      result = result.filter(s => s.customer_location === locationFilter.value)
    }

    if (gatewayFilter.value !== 'all') {
      result = result.filter(s => s.payment_gateway === gatewayFilter.value)
    }

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      result = result.filter(
        s =>
          s.customer_name.toLowerCase().includes(query) ||
          s.customer_email.toLowerCase().includes(query) ||
          s.order_number.toLowerCase().includes(query)
      )
    }

    return result
  })

  // Computed: sales statistics
  const stats = computed<SalesStats>(() => {
    const byStatus: Record<SaleStatus, { count: number; revenue: number }> = {
      payment_cancelled: { count: 0, revenue: 0 },
      payment_pending: { count: 0, revenue: 0 },
      payment_processing: { count: 0, revenue: 0 },
      direct_umapenca: { count: 0, revenue: 0 },
      sold_abacatepay: { count: 0, revenue: 0 },
      sold_mercadopago: { count: 0, revenue: 0 },
      sold_pix_bricks: { count: 0, revenue: 0 },
      completed: { count: 0, revenue: 0 },
      refunded: { count: 0, revenue: 0 },
    }

    const byGateway: Record<string, { count: number; revenue: number }> = {}
    const byProductType: Record<string, { count: number; revenue: number }> = {}
    const byPaymentMethod: Record<string, { count: number; revenue: number }> = {}

    const byLocation = {
      brazil: { count: 0, revenue: 0 },
      international: { count: 0, revenue: 0 },
    }

    let totalRevenue = 0

    for (const sale of sales.value) {
      // By status
      byStatus[sale.status].count++
      if (sale.status !== 'payment_cancelled' && sale.status !== 'refunded') {
        byStatus[sale.status].revenue += sale.total
        totalRevenue += sale.total
      }

      // By gateway
      if (sale.payment_gateway) {
        if (!byGateway[sale.payment_gateway]) {
          byGateway[sale.payment_gateway] = { count: 0, revenue: 0 }
        }
        byGateway[sale.payment_gateway].count++
        if (sale.status !== 'payment_cancelled' && sale.status !== 'refunded') {
          byGateway[sale.payment_gateway].revenue += sale.total
        }
      }

      // By location
      byLocation[sale.customer_location].count++
      if (sale.status !== 'payment_cancelled' && sale.status !== 'refunded') {
        byLocation[sale.customer_location].revenue += sale.total
      }

      // By product type
      if (sale.product_type) {
        if (!byProductType[sale.product_type]) {
          byProductType[sale.product_type] = { count: 0, revenue: 0 }
        }
        byProductType[sale.product_type].count++
        byProductType[sale.product_type].revenue += sale.total
      }

      // By payment method
      if (sale.payment_method_type) {
        if (!byPaymentMethod[sale.payment_method_type]) {
          byPaymentMethod[sale.payment_method_type] = { count: 0, revenue: 0 }
        }
        byPaymentMethod[sale.payment_method_type].count++
        byPaymentMethod[sale.payment_method_type].revenue += sale.total
      }
    }

    return {
      total_sales: sales.value.length,
      total_revenue: totalRevenue,
      by_status: byStatus,
      by_gateway: byGateway as Record<PaymentGateway, { count: number; revenue: number }>,
      by_location: byLocation,
      by_product_type: byProductType as Record<ProductType, { count: number; revenue: number }>,
      by_payment_method: byPaymentMethod as Record<PaymentMethodType, { count: number; revenue: number }>,
      recent_orders: sales.value.slice(0, 20),
    }
  })

  // Actions
  async function fetchSales(params: Record<string, unknown> = {}) {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.orders.list(params as Record<string, string>)
      const rawOrders = result.data as unknown as Record<string, unknown>[]
      sales.value = rawOrders.map(mapOrderToSaleRecord)
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar vendas'
      console.error('fetchSales error:', err)
    } finally {
      loading.value = false
    }
  }

  function setStatusFilter(status: SaleStatus | 'all') {
    statusFilter.value = status
  }

  function setLocationFilter(location: CustomerLocation | 'all') {
    locationFilter.value = location
  }

  function setGatewayFilter(gateway: PaymentGateway | 'all') {
    gatewayFilter.value = gateway
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  function getStatusConfig(status: SaleStatus) {
    return SALE_STATUS_CONFIG[status] || { label: status, color: '#6B7280', icon: '?' }
  }

  function formatCurrency(value: number): string {
    return `R$ ${value.toFixed(2).replace('.', ',')}`
  }

  return {
    sales,
    filteredSales,
    loading,
    error,
    statusFilter,
    locationFilter,
    gatewayFilter,
    searchQuery,
    stats,
    fetchSales,
    setStatusFilter,
    setLocationFilter,
    setGatewayFilter,
    setSearchQuery,
    getStatusConfig,
    formatCurrency,
  }
})
