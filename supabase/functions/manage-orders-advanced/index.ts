/**
 * Supabase Edge Function: manage-orders-advanced
 *
 * Server-side order cancellation, refund, fulfillment, and admin operations.
 *
 * Endpoints:
 *   POST /manage-orders-advanced/{id}/cancel - Cancel order
 *   POST /manage-orders-advanced/{id}/refund - Process refund
 *   POST /manage-orders-advanced/{id}/fulfill - Mark as fulfilled/shipped
 *   POST /manage-orders-advanced/{id}/note - Add admin note
 *   POST /manage-orders-advanced/{id}/invoice - Generate invoice data
 *   GET  /manage-orders-advanced/stats - Advanced order statistics
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 50
const RATE_LIMIT_WINDOW = 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(ip)
  if (!record || now > record.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }
  if (record.count >= RATE_LIMIT_MAX) return false
  record.count++
  return true
}

function getClientIP(req: Request): string {
  // Prefer x-real-ip from trusted proxy, never trust x-forwarded-for from untrusted sources
  return req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip') // Cloudflare
    || 'unknown'
}

function corsHeaders(origin?: string) {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)
  const allowOrigin = allowedOrigins.includes(origin || '') ? origin : (allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

async function verifyAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-auth/verify`, {
    method: 'POST',
    headers: { Authorization: authHeader },
  })

  if (!response.ok) return false

  const result = await response.json()
  return result.valid === true
}

function sanitizeString(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[<>'"&]/g, '').trim()
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

  const clientIP = getClientIP(req)
  if (!checkRateLimit(clientIP)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded' }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  // Path: /manage-orders-advanced/{id}/cancel, /manage-orders-advanced/{id}/refund, etc.
  const lastPart = pathParts[pathParts.length - 1]
  const orderId = pathParts[pathParts.length - 3]
  const isUUID = /^[0-9a-f-]{36}$/i.test(orderId)
  const action = lastPart // cancel, refund, fulfill, note, invoice

  try {
    // GET /manage-orders-advanced/stats - Advanced order statistics
    if (req.method === 'GET' && !isUUID) {
      const dateFrom = url.searchParams.get('date_from')
      const dateTo = url.searchParams.get('date_to')

      // Get order counts by status
      const { data: statusCounts } = await supabase
        .from('orders')
        .select('status, payment_status')
        .gte('created_at', dateFrom || '2000-01-01')
        .lte('created_at', dateTo || '2099-12-31')

      // Get revenue metrics
      const { data: revenueData } = await supabase
        .from('orders')
        .select('total, payment_status, created_at')
        .eq('payment_status', 'paid')
        .gte('created_at', dateFrom || '2000-01-01')
        .lte('created_at', dateTo || '2099-12-31')

      const totalRevenue = revenueData?.reduce((sum, o) => sum + (o.total || 0), 0) || 0
      const avgOrderValue = revenueData?.length ? totalRevenue / revenueData.length : 0

      // Get cancellation rate
      const cancelled = statusCounts?.filter(o => o.status === 'cancelled').length || 0
      const total = statusCounts?.length || 1
      const cancellationRate = (cancelled / total) * 100

      // Get top products by orders
      const { data: topProducts } = await supabase
        .from('order_items')
        .select('product_name, quantity, product_price')
        .gte('created_at', dateFrom || '2000-01-01')
        .lte('created_at', dateTo || '2099-12-31')

      const productSales: Record<string, { count: number; revenue: number }> = {}
      topProducts?.forEach(item => {
        if (!productSales[item.product_name]) {
          productSales[item.product_name] = { count: 0, revenue: 0 }
        }
        productSales[item.product_name].count += item.quantity || 1
        productSales[item.product_name].revenue += (item.product_price || 0) * (item.quantity || 1)
      })

      const topProductsList = Object.entries(productSales)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      return new Response(
        JSON.stringify({
          data: {
            total_orders: total,
            total_revenue: totalRevenue,
            avg_order_value: avgOrderValue,
            cancellation_rate: Math.round(cancellationRate * 100) / 100,
            status_breakdown: statusCounts?.reduce((acc: Record<string, number>, o) => {
              acc[o.status] = (acc[o.status] || 0) + 1
              return acc
            }, {}) || {},
            payment_breakdown: statusCounts?.reduce((acc: Record<string, number>, o) => {
              acc[o.payment_status] = (acc[o.payment_status] || 0) + 1
              return acc
            }, {}) || {},
            top_products: topProductsList,
          }
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // All POST actions require an order ID
    if (!isUUID) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    switch (action) {
      // POST /manage-orders-advanced/{id}/cancel
      case 'cancel': {
        if (order.status === 'cancelled') {
          return new Response(
            JSON.stringify({ message: 'Order already cancelled' }),
            { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        if (order.status === 'shipped' || order.status === 'delivered') {
          return new Response(
            JSON.stringify({ error: 'Cannot cancel shipped or delivered orders' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        const body = await req.json()
        const reason = body.reason ? sanitizeString(body.reason) : 'Cancelled by admin'

        // Update order
        const { data: updatedOrder, error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
            admin_notes: reason,
          })
          .eq('id', orderId)
          .select()
          .single()

        if (updateError) throw updateError

        // Record status history
        await supabase
          .from('order_status_history')
          .insert({
            order_id: orderId,
            from_status: order.status,
            to_status: 'cancelled',
            changed_by: 'admin',
            changed_by_role: 'admin',
            description: reason,
          })
          .catch(() => {})

        // If items had stock reserved, release it
        for (const item of order.order_items || []) {
          if (item.product_id) {
            await supabase.rpc('record_inventory_movement', {
              p_product_id: item.product_id,
              p_variant_id: item.variant_id || null,
              p_movement_type: 'in',
              p_quantity: item.quantity || 1,
              p_order_id: orderId,
              p_notes: 'Stock released from cancelled order',
            }).catch(() => {})
          }
        }

        return new Response(
          JSON.stringify({ data: updatedOrder, message: 'Order cancelled' }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // POST /manage-orders-advanced/{id}/refund
      case 'refund': {
        if (order.payment_status !== 'paid') {
          return new Response(
            JSON.stringify({ error: 'Can only refund paid orders' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        if (order.status === 'refunded') {
          return new Response(
            JSON.stringify({ message: 'Order already refunded' }),
            { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        const body = await req.json()
        const amount = body.amount ?? order.total
        const reason = body.reason ? sanitizeString(body.reason) : 'Refunded by admin'

        // Validate refund amount
        if (typeof amount !== 'number' || amount <= 0 || amount > order.total) {
          return new Response(
            JSON.stringify({ error: 'Invalid refund amount: must be between 0 and order total' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        // Update order
        const { data: updatedOrder, error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'refunded',
            payment_status: 'refunded',
            payment_refunded_at: new Date().toISOString(),
            refund_amount: amount,
            updated_at: new Date().toISOString(),
            admin_notes: reason,
          })
          .eq('id', orderId)
          .select()
          .single()

        if (updateError) throw updateError

        // Record status history
        await supabase
          .from('order_status_history')
          .insert({
            order_id: orderId,
            from_status: order.status,
            to_status: 'refunded',
            changed_by: 'admin',
            changed_by_role: 'admin',
            description: `${reason} - Amount: ${amount}`,
          })
          .catch(() => {})

        return new Response(
          JSON.stringify({ data: updatedOrder, message: 'Order refunded' }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // POST /manage-orders-advanced/{id}/fulfill
      case 'fulfill': {
        if (order.status === 'delivered') {
          return new Response(
            JSON.stringify({ message: 'Order already delivered' }),
            { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        const body = await req.json()
        const newStatus = body.status || 'shipped'
        const trackingNumber = body.tracking_number ? sanitizeString(body.tracking_number) : null
        const carrier = body.carrier ? sanitizeString(body.carrier) : null

        if (!['preparing', 'shipped', 'delivered'].includes(newStatus)) {
          return new Response(
            JSON.stringify({ error: 'Invalid fulfillment status' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        const updates: Record<string, unknown> = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        }

        if (trackingNumber) updates.tracking_number = trackingNumber
        if (carrier) updates.carrier = carrier
        if (newStatus === 'shipped') updates.shipped_at = new Date().toISOString()
        if (newStatus === 'delivered') updates.delivered_at = new Date().toISOString()

        const { data: updatedOrder, error: updateError } = await supabase
          .from('orders')
          .update(updates)
          .eq('id', orderId)
          .select()
          .single()

        if (updateError) throw updateError

        // Record status history
        await supabase
          .from('order_status_history')
          .insert({
            order_id: orderId,
            from_status: order.status,
            to_status: newStatus,
            changed_by: 'admin',
            changed_by_role: 'admin',
            description: trackingNumber ? `Tracking: ${trackingNumber} (${carrier})` : 'Fulfillment update',
          })
          .catch(() => {})

        // Add tracking if provided
        if (trackingNumber && carrier) {
          await supabase
            .from('shipment_tracking')
            .insert({
              order_id: orderId,
              carrier,
              tracking_number: trackingNumber,
              status: 'info_received',
            })
            .catch(() => {})
        }

        return new Response(
          JSON.stringify({ data: updatedOrder, message: 'Order fulfillment updated' }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // POST /manage-orders-advanced/{id}/note
      case 'note': {
        const body = await req.json()

        if (!body.note || typeof body.note !== 'string') {
          return new Response(
            JSON.stringify({ error: 'note is required' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        const note = sanitizeString(body.note)
        const existingNotes = order.admin_notes || ''
        const newNotes = existingNotes
          ? `${existingNotes}\n[${new Date().toISOString().split('T')[0]}] ${note}`
          : `[${new Date().toISOString().split('T')[0]}] ${note}`

        const { data: updatedOrder, error: updateError } = await supabase
          .from('orders')
          .update({
            admin_notes: newNotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId)
          .select()
          .single()

        if (updateError) throw updateError

        return new Response(
          JSON.stringify({ data: updatedOrder, message: 'Note added' }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // POST /manage-orders-advanced/{id}/invoice
      case 'invoice': {
        // Generate invoice data (front-end can use this to render PDF)
        const invoice = {
          order_number: order.order_number,
          order_date: order.created_at,
          customer: {
            name: order.customer_name,
            email: order.customer_email,
            phone: order.customer_phone,
            tax_id: order.customer_tax_id,
            address: order.shipping_address,
          },
          items: (order.order_items || []).map((item: Record<string, unknown>) => ({
            name: item.product_name,
            quantity: item.quantity,
            unit_price: item.product_price,
            total: (item.product_price || 0) * (item.quantity || 1),
          })),
          subtotal: order.total - (order.shipping_cost || 0),
          shipping_cost: order.shipping_cost || 0,
          total: order.total,
          payment_method: order.payment_method,
          payment_status: order.payment_status,
          payment_date: order.payment_paid_at,
        }

        return new Response(
          JSON.stringify({ data: invoice }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('manage-orders-advanced error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
