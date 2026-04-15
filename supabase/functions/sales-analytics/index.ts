/**
 * Supabase Edge Function: sales-analytics
 *
 * Provides sales analytics and order status breakdown.
 *
 * Endpoints:
 *   GET    /sales-analytics              - Get sales stats
 *   GET    /sales-analytics/by-status    - Get sales by status
 *   GET    /sales-analytics/by-gateway   - Get sales by gateway
 *   GET    /sales-analytics/by-location  - Get sales by location
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { jwtVerify } from 'https://esm.sh/jose@5.2.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWT_SECRET = Deno.env.get('JWT_SECRET') || SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function corsHeaders(origin?: string) {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)
  const allowOrigin = allowedOrigins.includes(origin || '') ? origin : (allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

async function verifyAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false
  try {
    const { payload } = await jwtVerify(
      authHeader.substring(7),
      new TextEncoder().encode(JWT_SECRET),
      { algorithms: ['HS256'] }
    )
    return payload.role === 'admin' || payload.role === 'super_admin'
  } catch {
    return false
  }
}

function mapOrderToSaleStatus(order: Record<string, unknown>): string {
  const paymentProvider = (order.payment_provider as string) || ''
  const paymentStatus = (order.payment_status as string) || 'pending'
  const status = (order.status as string) || 'pending'

  if (paymentStatus === 'failed' || status === 'cancelled') {
    return 'payment_cancelled'
  }
  if (paymentStatus === 'processing') {
    return 'payment_processing'
  }
  if (paymentStatus === 'refunded' || status === 'refunded') {
    return 'refunded'
  }
  if (paymentStatus === 'paid' || status === 'paid' || status === 'delivered') {
    if (paymentProvider === 'umapenca') return 'direct_umapenca'
    if (paymentProvider === 'abacatepay') return 'sold_abacatepay'
    if (paymentProvider === 'mercadopago') return 'sold_mercadopago'
    if (paymentProvider === 'pix_bricks') return 'sold_pix_bricks'
    return 'completed'
  }
  return 'payment_pending'
}

function detectCustomerLocation(order: Record<string, unknown>): { location: string; country: string; state: string } {
  const addressStruct = (order.shipping_address_structured as Record<string, unknown>) || {}
  const address = (order.shipping_address as string) || ''
  const country = (addressStruct?.country as string) || ''
  const state = (addressStruct?.state as string) || ''

  // Detect Brazil by country code or Brazilian state codes
  const isBrazil = country === 'BR' || country === 'Brazil' ||
    state.length === 2 || // Brazilian states are 2 chars
    address.includes('Brazil') || address.match(/\bBR\b/)

  return {
    location: isBrazil ? 'brazil' : 'international',
    country: country || (isBrazil ? 'BR' : 'XX'),
    state,
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (!await verifyAdmin(req)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const action = pathParts[pathParts.length - 1]

  try {
    // GET /sales-analytics or GET /sales-analytics/by-status
    if (req.method === 'GET' && (action === 'sales-analytics' || action === 'by-status')) {
      const days = parseInt(url.searchParams.get('days') || '30', 10)
      const dateFrom = new Date()
      dateFrom.setDate(dateFrom.getDate() - days)

      const { data: orders, error } = await supabase
        .from('orders')
        .select('*, items(*)')
        .gte('created_at', dateFrom.toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch orders' }),
          { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Process sales analytics
      const byStatus: Record<string, { count: number; revenue: number }> = {
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
      const byLocation = {
        brazil: { count: 0, revenue: 0 },
        international: { count: 0, revenue: 0 },
      }
      const byPaymentMethod: Record<string, { count: number; revenue: number }> = {}
      let totalRevenue = 0

      const salesData = (orders || []).map(order => {
        const status = mapOrderToSaleStatus(order)
        const loc = detectCustomerLocation(order)
        const total = (order.total as number) || 0
        const paymentGateway = (order.payment_provider as string) || ''
        const paymentMethod = (order.payment_method as string) || ''

        // Update status stats
        if (!byStatus[status]) {
          byStatus[status] = { count: 0, revenue: 0 }
        }
        byStatus[status].count++
        if (status !== 'payment_cancelled' && status !== 'refunded') {
          byStatus[status].revenue += total
          totalRevenue += total
        }

        // Update gateway stats
        if (paymentGateway) {
          if (!byGateway[paymentGateway]) {
            byGateway[paymentGateway] = { count: 0, revenue: 0 }
          }
          byGateway[paymentGateway].count++
          if (status !== 'payment_cancelled' && status !== 'refunded') {
            byGateway[paymentGateway].revenue += total
          }
        }

        // Update location stats
        byLocation[loc.location].count++
        if (status !== 'payment_cancelled' && status !== 'refunded') {
          byLocation[loc.location].revenue += total
        }

        // Update payment method stats
        if (paymentMethod) {
          if (!byPaymentMethod[paymentMethod]) {
            byPaymentMethod[paymentMethod] = { count: 0, revenue: 0 }
          }
          byPaymentMethod[paymentMethod].count++
          if (status !== 'payment_cancelled' && status !== 'refunded') {
            byPaymentMethod[paymentMethod].revenue += total
          }
        }

        return {
          id: order.id,
          order_number: order.order_number,
          status,
          payment_gateway: paymentGateway,
          customer_location: loc.location,
          customer_name: order.customer_name,
          customer_state: loc.state,
          customer_country: loc.country,
          total,
          currency: order.currency || 'BRL',
          payment_method_type: paymentMethod,
          created_at: order.created_at,
        }
      })

      return new Response(
        JSON.stringify({
          data: {
            total_sales: salesData.length,
            total_revenue: totalRevenue,
            by_status: byStatus,
            by_gateway: byGateway,
            by_location: byLocation,
            by_payment_method: byPaymentMethod,
            recent_orders: salesData.slice(0, 50),
          }
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /sales-analytics/by-gateway
    if (req.method === 'GET' && action === 'by-gateway') {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total, payment_provider, payment_status, status, created_at')
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false })

      const byGateway: Record<string, { count: number; revenue: number }> = {}

      for (const order of orders || []) {
        const gateway = (order.payment_provider as string) || 'unknown'
        const total = (order.total as number) || 0

        if (!byGateway[gateway]) {
          byGateway[gateway] = { count: 0, revenue: 0 }
        }
        byGateway[gateway].count++
        byGateway[gateway].revenue += total
      }

      return new Response(
        JSON.stringify({ data: byGateway }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /sales-analytics/by-location
    if (req.method === 'GET' && action === 'by-location') {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total, payment_status, shipping_address, shipping_address_structured, created_at')
        .order('created_at', { ascending: false })

      const byLocation = {
        brazil: { count: 0, revenue: 0, orders: [] as unknown[] },
        international: { count: 0, revenue: 0, orders: [] as unknown[] },
      }

      for (const order of orders || []) {
        const loc = detectCustomerLocation(order)
        const total = (order.total as number) || 0
        const isPaid = (order.payment_status as string) === 'paid'

        byLocation[loc.location].count++
        if (isPaid) {
          byLocation[loc.location].revenue += total
        }
      }

      return new Response(
        JSON.stringify({ data: byLocation }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('sales-analytics error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
