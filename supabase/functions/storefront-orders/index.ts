/**
 * Supabase Edge Function: storefront-orders
 *
 * Server-side order management for the BhumiShop storefront.
 * Replaces direct Supabase table access from the frontend.
 *
 * Endpoints:
 *   GET    /storefront-orders - List user's orders (requires auth)
 *   GET    /storefront-orders/{orderNumber} - Get single order (requires auth)
 *   POST   /storefront-orders - Create new order
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting for order creation
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 10 // orders per minute per IP
const RATE_LIMIT_WINDOW = 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(ip)

  if (!record || now > record.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false
  }

  record.count++
  return true
}

function getClientIP(req: Request): string {
  // Prefer x-real-ip from trusted proxy, never trust x-forwarded-for from untrusted sources
  return req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip') // Cloudflare
    || 'unknown'
}

// Input sanitization
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[<>'"&]/g, '').trim()
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Max items per order
const MAX_ITEMS_PER_ORDER = 50

function corsHeaders(origin?: string) {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)
  const allowOrigin = allowedOrigins.includes(origin || '') ? origin : (allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Verify Supabase Auth session from Authorization header.
 * Returns the user ID if authenticated, null otherwise.
 */
async function getUserIdFromAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  try {
    const token = authHeader.substring(7)
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return null
    return data.user.id
  } catch {
    return null
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  // Path is like /storefront-orders or /storefront-orders/BHS-2024-001
  const lastPart = pathParts[pathParts.length - 1]
  const isOrderNumber = lastPart !== 'storefront-orders' && /^\w+-\d+-\d+$/.test(lastPart)

  try {
    // ============================================
    // GET /storefront-orders - List user's orders
    // ============================================
    if (req.method === 'GET' && !isOrderNumber) {
      const userId = await getUserIdFromAuth(req)
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('orders')
        .select('*, order_status_history(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // GET /storefront-orders/{orderNumber} - Get single order
    // ============================================
    if (req.method === 'GET' && isOrderNumber) {
      const userId = await getUserIdFromAuth(req)
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*), order_status_history(*)')
        .eq('order_number', lastPart)
        .eq('user_id', userId)
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // POST /storefront-orders - Create new order
    // ============================================
    if (req.method === 'POST') {
      // Rate limit order creation
      const clientIP = getClientIP(req)
      if (!checkRateLimit(clientIP)) {
        return new Response(
          JSON.stringify({ error: 'Too many orders. Try again later.' }),
          { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const body = await req.json()
      const {
        idempotencyKey,
        total,
        paymentMethod,
        paymentProvider,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        shippingCost,
        notes,
        pixKey,
        paymentReference,
        items,
      } = body

      if (!items || !Array.isArray(items) || items.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Items array is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      if (items.length > MAX_ITEMS_PER_ORDER) {
        return new Response(
          JSON.stringify({ error: `Maximum ${MAX_ITEMS_PER_ORDER} items per order` }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Validate customer email if provided
      if (customerEmail && !isValidEmail(customerEmail)) {
        return new Response(
          JSON.stringify({ error: 'Invalid email format' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Validate items have required fields
      for (const item of items) {
        if (!item.name || typeof item.price !== 'number' || item.price <= 0) {
          return new Response(
            JSON.stringify({ error: 'Each item must have a name and valid price' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
        if (typeof item.quantity !== 'number' || item.quantity < 1) {
          return new Response(
            JSON.stringify({ error: 'Each item must have a valid quantity' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
      }

      // Check for idempotency key to prevent duplicate orders
      if (idempotencyKey) {
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id, order_number')
          .eq('idempotency_key', idempotencyKey)
          .single()

        if (existingOrder) {
          console.warn('Duplicate order detected via idempotency key:', idempotencyKey)
          return new Response(
            JSON.stringify({ data: existingOrder, duplicate: true }),
            { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
      }

      // Generate order number via RPC
      const { data: orderNumber, error: numError } = await supabase.rpc('generate_order_number')
      if (numError) throw numError

      // Get authenticated user ID if available
      const userId = await getUserIdFromAuth(req)

      // Create order with sanitized inputs
      const orderPayload: Record<string, unknown> = {
        order_number: orderNumber,
        idempotency_key: idempotencyKey || null,
        status: 'pending',
        total: typeof total === 'number' ? total : 0,
        payment_method: sanitizeString(paymentMethod || 'pix'),
        payment_provider: paymentProvider ? sanitizeString(paymentProvider) : null,
        payment_status: 'pending',
        customer_name: customerName ? sanitizeString(customerName) : 'Guest',
        customer_email: customerEmail ? sanitizeString(customerEmail).toLowerCase() : null,
        customer_phone: customerPhone ? sanitizeString(customerPhone) : null,
        shipping_address: shippingAddress ? sanitizeString(shippingAddress) : null,
        shipping_cost: typeof shippingCost === 'number' ? shippingCost : 0,
        notes: notes ? sanitizeString(notes) : null,
        pix_key: pixKey ? sanitizeString(pixKey) : null,
        payment_reference: paymentReference ? sanitizeString(paymentReference) : null,
        user_id: userId || null,
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .single()

      if (orderError) throw orderError

      // Create order items
      const itemsPayload = items.map((item: Record<string, unknown>) => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        product_price: item.price,
        quantity: item.quantity,
        size: item.size || null,
        fulfillment_type: item.fulfillment_type || null,
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsPayload)

      if (itemsError) {
        console.error('Failed to create order items:', itemsError)
        // Don't throw - order was created successfully
      }

      return new Response(
        JSON.stringify({ data: order }),
        { status: 201, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // Unknown endpoint
    // ============================================
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('storefront-orders error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
