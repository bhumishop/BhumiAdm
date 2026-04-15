import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { edgeApi } from '../api/edgeApi'
import type { Order, PaymentMethod, PaymentStatus } from '../types'

interface PaymentOrder extends Partial<Order> {
  order_items?: Record<string, unknown>[]
}

type PaymentProvider = 'abacatepay' | 'pix_bricks' | 'uma_penca' | 'paypal' | 'mercadopago'

export const usePaymentStore = defineStore('payments', () => {
  const payments = ref<PaymentOrder[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedPayment = ref<PaymentOrder | null>(null)
  const pixStatus = ref<Record<string, unknown> | null>(null)

  const paymentMethods: PaymentMethod[] = ['pix', 'billing', 'pix_bricks', 'uma_penca', 'paypal', 'mercadopago']
  const paymentProviders: PaymentProvider[] = ['abacatepay', 'pix_bricks', 'uma_penca', 'paypal', 'mercadopago']
  const paymentStatuses: string[] = ['pending', 'confirmed', 'paid', 'failed', 'refunded', 'expired']

  const paymentStats = computed(() => {
    return {
      total: payments.value.length,
      pending: payments.value.filter(p => p.payment_status === 'pending').length,
      paid: payments.value.filter(p => p.payment_status === 'paid').length,
      failed: payments.value.filter(p => p.payment_status === 'failed').length,
      totalRevenue: payments.value
        .filter(p => p.payment_status === 'paid')
        .reduce((sum, p) => sum + (p.total || 0), 0)
    }
  })

  async function fetchPayments() {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.orders.list({})
      payments.value = (result.data as PaymentOrder[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar pagamentos'
      console.error('fetchPayments error:', err)
      payments.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchPaymentById(orderId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.orders.get(orderId)
      selectedPayment.value = result.data as PaymentOrder | null
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar pagamento'
      console.error('fetchPaymentById error:', err)
    } finally {
      loading.value = false
    }
  }

  async function createBilling(action: string, params: Record<string, unknown>) {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.payments.createBilling(action, params)
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao criar cobrança'
      console.error('createBilling error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function checkPixStatus(paymentReference: string) {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.payments.checkPixStatus(paymentReference)
      pixStatus.value = result.data as Record<string, unknown> | null
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao verificar status PIX'
      console.error('checkPixStatus error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updatePaymentStatus(orderId: string, newStatus: PaymentStatus, paymentReference: string = '') {
    error.value = null

    try {
      const updates: Record<string, unknown> = {
        payment_status: newStatus,
        updated_at: new Date().toISOString()
      }

      if (paymentReference) {
        updates.payment_reference = paymentReference
      }

      if (newStatus === 'paid') {
        updates.payment_paid_at = new Date().toISOString()
      }

      const result = await edgeApi.orders.update(orderId, updates as Partial<Order>)

      await fetchPayments()

      if (selectedPayment.value?.id === orderId) {
        await fetchPaymentById(orderId)
      }

      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao atualizar status do pagamento'
      console.error('updatePaymentStatus error:', err)
      throw err
    }
  }

  async function createPixPayment(orderData: {
    customer_email: string
    customer_name: string
    customer_tax_id?: string
    total: number
    order_id: string
    order_number: string
  }) {
    loading.value = true
    error.value = null

    try {
      const customerResult = await createBilling('create_customer', {
        email: orderData.customer_email,
        name: orderData.customer_name,
        tax_id: orderData.customer_tax_id
      })

      const pixResult = await createBilling('create_pix', {
        customer_id: (customerResult as Record<string, unknown>)?.customer_id,
        amount: orderData.total,
        order_id: orderData.order_id,
        description: `Pedido ${orderData.order_number}`
      })

      return pixResult
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao criar pagamento PIX'
      console.error('createPixPayment error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  function getPaymentMethodName(method: PaymentMethod | string): string {
    const methods: Record<PaymentMethod, string> = {
      pix: 'PIX',
      billing: 'Boleto',
      pix_bricks: 'PIX Bricks',
      uma_penca: 'UmaPenca',
      paypal: 'PayPal',
      mercadopago: 'MercadoPago'
    }
    return methods[method as PaymentMethod] || method
  }

  function getPaymentStatusName(status: string): string {
    const statuses: Record<string, string> = {
      pending: 'Pendente',
      confirmed: 'Confirmado',
      paid: 'Pago',
      failed: 'Falhou',
      refunded: 'Reembolsado',
      expired: 'Expirado'
    }
    return statuses[status] || status
  }

  function getPaymentStatusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: 'warning',
      confirmed: 'info',
      paid: 'success',
      failed: 'error',
      refunded: 'neutral',
      expired: 'neutral'
    }
    return colors[status] || 'neutral'
  }

  return {
    payments,
    loading,
    error,
    selectedPayment,
    pixStatus,
    paymentMethods,
    paymentProviders,
    paymentStatuses,
    paymentStats,
    fetchPayments,
    fetchPaymentById,
    createBilling,
    checkPixStatus,
    updatePaymentStatus,
    createPixPayment,
    getPaymentMethodName,
    getPaymentStatusName,
    getPaymentStatusColor
  }
})
