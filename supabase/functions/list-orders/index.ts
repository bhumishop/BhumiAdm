/**
 * Supabase Edge Function: list-orders
 *
 * Server-side order management with admin authentication.
 * Replaces direct Supabase API calls from frontend.
 *
 * Endpoints:
 *   GET    /list-orders - List orders with filters
 *   GET    /list-orders/{id} - Get single order with items
 *   POST   /list-orders - Create order
 *   PUT    /list-orders/{id} - Update order status
 *   POST   /list-orders/{id}/track - Add tracking info
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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

async function verifyAdmin(req: Request): Promise<{ valid: boolean; admin?: Record<string, unknown> }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false }
  }

  const token = authHeader.substring(7)

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET),
      { algorithms: ['HS256'] }
    )
    if (payload.role !== 'admin') return { valid: false }
    return { valid: true, admin: payload as Record<string, unknown> }
  } catch {
    return { valid: false }
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  const auth = await verifyAdmin(req)
  if (!auth?.valid) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: admin access required' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const orderId = pathParts[pathParts.length - 1]
  const isSingleOrder = /^[0-9a-f-]{36}$/i.test(orderId)

  try {
    // ============================================
    // GET /list-orders - List orders with filters
    // ============================================
    if (req.method === 'GET' && !isSingleOrder) {
      const params = url.searchParams
      const page = parseInt(params.get('page') || '1', 10)
      const limit = parseInt(params.get('limit') || '50', 10)
      const offset = (page - 1) * limit
      const status = params.get('status')
      const paymentStatus = params.get('payment_status')
      const fulfillmentType = params.get('fulfillment_type')
      const search = params.get('search')
      const dateFrom = params.get('date_from')
      const dateTo = params.get('date_to')

      let query = supabase
        .from('order_details')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (status) {
        query = query.eq('status', status)
      }
      if (paymentStatus) {
        query = query.eq('payment_status', paymentStatus)
      }
      if (dateFrom) {
        query = query.gte('created_at', dateFrom)
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo)
      }
      if (search) {
        query = query.or(`order_number.ilike.%${search}%,customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`)
      }

      const { data, error, count } = await query

      if (error) throw error

      // Get order stats
      const { data: stats } = await supabase
        .rpc('get_order_stats', {
          start_date: dateFrom || null,
          end_date: dateTo || null,
        })

      return new Response(
        JSON.stringify({ data, count, page, limit, stats: stats?.[0] || {} }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // GET /list-orders/{id} - Get single order
    // ============================================
    if (req.method === 'GET' && isSingleOrder) {
      const { data, error } = await supabase
        .from('order_details')
        .select('*')
        .eq('id', orderId)
        .single()

      if (error) throw error

      // Get shipment tracking
      const { data: tracking } = await supabase
        .from('shipment_tracking')
        .select('*')
        .eq('order_id', orderId)

      // Get status history
      const { data: history } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })

      return new Response(
        JSON.stringify({ data, tracking, history }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // POST /list-orders - Create order
    // ============================================
    if (req.method === 'POST' && !isSingleOrder) {
      const body = await req.json()
      const { order, items } = body

      if (!order?.customer_name || !order?.customer_email || !items?.length) {
        return new Response(
          JSON.stringify({ error: 'customer_name, customer_email, and items are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Use the RPC function to create order atomically
      const { data, error } = await supabase.rpc('create_order_with_items', {
        p_customer_name: order.customer_name,
        p_customer_email: order.customer_email,
        p_payment_method: order.payment_method || 'pix',
        p_items: items,
        p_user_id: order.user_id || null,
        p_guest_email: order.guest_email || null,
        p_customer_phone: order.customer_phone || null,
        p_customer_tax_id: order.customer_tax_id || null,
        p_shipping_address: order.shipping_address || null,
        p_shipping_address_structured: order.shipping_address_structured || null,
        p_payment_provider: order.payment_provider || null,
        p_notes: order.notes || null,
      })

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // PUT /list-orders/{id} - Update order status
    // ============================================
    if (req.method === 'PUT' && isSingleOrder) {
      const body = await req.json()
      const { status, payment_status, admin_notes, tracking_number, carrier } = body

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      if (status) updates.status = status
      if (payment_status) updates.payment_status = payment_status
      if (admin_notes) updates.admin_notes = admin_notes

      // Update order
      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single()

      if (updateError) throw updateError

      // Add tracking if provided
      if (tracking_number && carrier) {
        await supabase
          .from('shipment_tracking')
          .insert({
            order_id: orderId,
            carrier,
            tracking_number,
            status: 'info_received',
          })

        // Update order items with tracking
        await supabase
          .from('order_items')
          .update({
            tracking_number,
            carrier,
          })
          .eq('order_id', orderId)
      }

      return new Response(
        JSON.stringify({ data: updatedOrder }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // POST /list-orders/{id}/track - Add tracking info
    // ============================================
    if (req.method === 'POST' && pathParts.includes('track')) {
      const body = await req.json()
      const { tracking_number, carrier, delivery_type, estimated_delivery_date } = body

      if (!tracking_number || !carrier) {
        return new Response(
          JSON.stringify({ error: 'tracking_number and carrier are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('shipment_tracking')
        .insert({
          order_id: orderId,
          carrier,
          tracking_number,
          delivery_type: delivery_type || 'standard',
          estimated_delivery_date,
          status: 'info_received',
        })
        .select()
        .single()

      if (error) throw error

      // Update order status to shipped
      await supabase
        .from('orders')
        .update({
          status: 'shipped',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      // Update order items
      await supabase
        .from('order_items')
        .update({
          tracking_number,
          carrier,
          status: 'shipped',
          shipped_at: new Date().toISOString(),
        })
        .eq('order_id', orderId)

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('list-orders error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
