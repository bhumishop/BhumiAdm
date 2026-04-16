/**
 * Supabase Edge Function: storefront-cart
 *
 * Server-side cart persistence for the BhumiShop storefront.
 * Carts are associated with user sessions (authenticated) or anonymous session IDs.
 *
 * Endpoints:
 *   GET    /storefront-cart              - Get current user's cart
 *   POST   /storefront-cart              - Create/update cart (add items)
 *   PUT    /storefront-cart              - Update cart item quantity
 *   DELETE /storefront-cart/{itemId}     - Remove item from cart
 *   DELETE /storefront-cart              - Clear cart
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 100 // requests per window
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute

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

/**
 * Get user identifier from auth session or anonymous ID header
 */
async function getUserIdentifier(req: Request): Promise<{ userId: string | null; anonymousId: string | null }> {
  const authHeader = req.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7)
      const { data, error } = await supabase.auth.getUser(token)
      if (data?.user) {
        return { userId: data.user.id, anonymousId: null }
      }
    } catch {
      // Fall through to anonymous
    }
  }

  // Anonymous session via header or generate from IP + timestamp
  const anonymousId = req.headers.get('x-anonymous-id')
    || `anon_${getClientIP(req)}_${Date.now()}`
  return { userId: null, anonymousId }
}

function corsHeaders(origin?: string) {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)
  const allowOrigin = allowedOrigins.includes(origin || '') ? origin : (allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-anonymous-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

function sanitizeString(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[<>'"&]/g, '').trim()
}

const MAX_ITEMS = 50
const MAX_QUANTITY = 99

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  // Rate limit all cart operations
  const clientIP = getClientIP(req)
  if (!checkRateLimit(clientIP)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  const { userId, anonymousId } = await getUserIdentifier(req)
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const lastPart = pathParts[pathParts.length - 1]
  const isItemId = lastPart !== 'storefront-cart' && lastPart !== ''

  try {
    // ============================================
    // GET /storefront-cart - Get current cart
    // ============================================
    if (req.method === 'GET' && !isItemId) {
      let query = supabase
        .from('carts')
        .select('*, cart_items(*)')
        .order('updated_at', { ascending: false })

      if (userId) {
        query = query.eq('user_id', userId)
      } else {
        query = query.eq('anonymous_id', anonymousId)
      }

      const { data, error } = await query.limit(1).single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (!data) {
        // Create empty cart if none exists
        const { data: newCart, error: createError } = await supabase
          .from('carts')
          .insert({
            user_id: userId,
            anonymous_id: anonymousId,
          })
          .select('*, cart_items(*)')
          .single()

        if (createError) throw createError

        return new Response(
          JSON.stringify({ data: newCart, items: [] }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ data, items: data.cart_items || [] }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // POST /storefront-cart - Add/update items
    // ============================================
    if (req.method === 'POST' && !isItemId) {
      const body = await req.json()
      const { items } = body

      if (!items || !Array.isArray(items) || items.length === 0) {
        return new Response(
          JSON.stringify({ error: 'items array is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      if (items.length > MAX_ITEMS) {
        return new Response(
          JSON.stringify({ error: `Maximum ${MAX_ITEMS} items per cart` }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Validate and sanitize items
      for (const item of items) {
        if (!item.id || typeof item.price !== 'number' || item.price < 0) {
          return new Response(
            JSON.stringify({ error: 'Each item must have a valid id and price' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
        if (typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
          return new Response(
            JSON.stringify({ error: `Quantity must be between 1 and ${MAX_QUANTITY}` }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
      }

      // Get or create cart
      let query = supabase
        .from('carts')
        .select('*')
        .order('updated_at', { ascending: false })

      if (userId) {
        query = query.eq('user_id', userId)
      } else {
        query = query.eq('anonymous_id', anonymousId)
      }

      const { data: existingCart } = await query.limit(1).single()

      let cartId: number

      if (existingCart) {
        cartId = existingCart.id
        // Clear existing items to replace with new set
        await supabase.from('cart_items').delete().eq('cart_id', cartId)
      } else {
        const { data: newCart, error: createError } = await supabase
          .from('carts')
          .insert({
            user_id: userId,
            anonymous_id: anonymousId,
          })
          .select()
          .single()

        if (createError) throw createError
        cartId = newCart.id
      }

      // Insert cart items
      const cartItemsPayload = items.map((item: Record<string, unknown>) => ({
        cart_id: cartId,
        product_id: item.id,
        product_name: sanitizeString(item.name || ''),
        product_price: item.price,
        quantity: Math.min(Math.max(item.quantity, 1), MAX_QUANTITY),
        size: item.size ? sanitizeString(item.size) : null,
        fulfillment_type: item.fulfillment_type ? sanitizeString(item.fulfillment_type) : 'custom',
        weight: typeof item.weight === 'number' ? item.weight : 0.3,
        image: item.image ? sanitizeString(item.image) : null,
      }))

      const { error: itemsError } = await supabase
        .from('cart_items')
        .insert(cartItemsPayload)

      if (itemsError) throw itemsError

      // Update cart timestamp
      await supabase
        .from('carts')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', cartId)

      // Fetch updated cart
      const { data: updatedCart } = await supabase
        .from('carts')
        .select('*, cart_items(*)')
        .eq('id', cartId)
        .single()

      return new Response(
        JSON.stringify({ data: updatedCart, items: updatedCart?.cart_items || [] }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // PUT /storefront-cart - Update item quantity
    // ============================================
    if (req.method === 'PUT' && !isItemId) {
      const body = await req.json()
      const { product_id, quantity, size } = body

      if (!product_id || typeof quantity !== 'number') {
        return new Response(
          JSON.stringify({ error: 'product_id and quantity are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      if (quantity < 1 || quantity > MAX_QUANTITY) {
        return new Response(
          JSON.stringify({ error: `Quantity must be between 1 and ${MAX_QUANTITY}` }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Get cart
      let query = supabase
        .from('carts')
        .select('*, cart_items(*)')
        .order('updated_at', { ascending: false })

      if (userId) {
        query = query.eq('user_id', userId)
      } else {
        query = query.eq('anonymous_id', anonymousId)
      }

      const { data: cart } = await query.limit(1).single()

      if (!cart) {
        return new Response(
          JSON.stringify({ error: 'Cart not found' }),
          { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Update item quantity
      const { error: updateError } = await supabase
        .from('cart_items')
        .update({
          quantity: Math.min(Math.max(quantity, 1), MAX_QUANTITY),
          updated_at: new Date().toISOString(),
        })
        .eq('cart_id', cart.id)
        .eq('product_id', product_id)
        .eq('size', size || null)

      if (updateError) throw updateError

      // Fetch updated cart
      const { data: updatedCart } = await supabase
        .from('carts')
        .select('*, cart_items(*)')
        .eq('id', cart.id)
        .single()

      return new Response(
        JSON.stringify({ data: updatedCart, items: updatedCart?.cart_items || [] }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // DELETE /storefront-cart/{itemId} - Remove item
    // ============================================
    if (req.method === 'DELETE' && isItemId) {
      // Get cart
      let query = supabase
        .from('carts')
        .select('*')
        .order('updated_at', { ascending: false })

      if (userId) {
        query = query.eq('user_id', userId)
      } else {
        query = query.eq('anonymous_id', anonymousId)
      }

      const { data: cart } = await query.limit(1).single()

      if (!cart) {
        return new Response(
          JSON.stringify({ error: 'Cart not found' }),
          { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const productId = parseInt(lastPart, 10) || lastPart

      // Delete item
      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id)
        .eq('product_id', productId)

      if (deleteError) throw deleteError

      // Fetch updated cart
      const { data: updatedCart } = await supabase
        .from('carts')
        .select('*, cart_items(*)')
        .eq('id', cart.id)
        .single()

      return new Response(
        JSON.stringify({ data: updatedCart, items: updatedCart?.cart_items || [] }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // DELETE /storefront-cart - Clear cart
    // ============================================
    if (req.method === 'DELETE' && !isItemId) {
      // Get cart
      let query = supabase
        .from('carts')
        .select('*')
        .order('updated_at', { ascending: false })

      if (userId) {
        query = query.eq('user_id', userId)
      } else {
        query = query.eq('anonymous_id', anonymousId)
      }

      const { data: cart } = await query.limit(1).single()

      if (cart) {
        // Delete all cart items
        await supabase.from('cart_items').delete().eq('cart_id', cart.id)
        // Delete the cart
        await supabase.from('carts').delete().eq('id', cart.id)
      }

      return new Response(
        JSON.stringify({ message: 'Cart cleared', items: [] }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('storefront-cart error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
  }
})
