/**
 * Supabase Edge Function: manage-variants
 *
 * Server-side product variant CRUD operations with admin authentication.
 * Handles product_variants and product_options tables.
 *
 * Endpoints:
 *   GET    /manage-variants?product_id=X - List variants for a product
 *   GET    /manage-variants/{id} - Get single variant
 *   POST   /manage-variants - Create variant
 *   PUT    /manage-variants/{id} - Update variant
 *   DELETE /manage-variants/{id} - Delete variant
 *   POST   /manage-variants/bulk - Bulk operations
 *   POST   /manage-variants/stock - Update variant stock
 *   GET    /manage-variants/options - Get product options (size, color, etc.)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 100
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
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
  const lastPart = pathParts[pathParts.length - 1]
  const variantId = /^[0-9]+$/.test(lastPart) ? parseInt(lastPart, 10) : null

  try {
    // GET /manage-variants?product_id=X - List variants
    if (req.method === 'GET' && !variantId) {
      const productId = url.searchParams.get('product_id')
      const sku = url.searchParams.get('sku')

      let query = supabase
        .from('product_variants')
        .select('*, products(name)')
        .order('created_at', { ascending: false })

      if (productId) query = query.eq('product_id', parseInt(productId, 10))
      if (sku) query = query.eq('sku', sku)

      const { data, error } = await query
      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /manage-variants/{id} - Get single variant
    if (req.method === 'GET' && variantId) {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*, products(name)')
        .eq('id', variantId)
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST /manage-variants - Create variant
    if (req.method === 'POST' && lastPart === 'manage-variants') {
      const body = await req.json()

      if (!body.product_id) {
        return new Response(
          JSON.stringify({ error: 'product_id is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Verify product exists
      const { data: product } = await supabase
        .from('products')
        .select('id, name')
        .eq('id', body.product_id)
        .single()

      if (!product) {
        return new Response(
          JSON.stringify({ error: 'Product not found' }),
          { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('product_variants')
        .insert(body)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST /manage-variants/bulk - Bulk create variants
    if (req.method === 'POST' && lastPart === 'bulk') {
      const body = await req.json()

      if (!body.variants || !Array.isArray(body.variants) || body.variants.length === 0) {
        return new Response(
          JSON.stringify({ error: 'variants array is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      if (body.variants.length > 100) {
        return new Response(
          JSON.stringify({ error: 'Maximum 100 variants per bulk operation' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('product_variants')
        .insert(body.variants)
        .select()

      if (error) throw error

      return new Response(
        JSON.stringify({ data, count: data.length }),
        { status: 201, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST /manage-variants/stock - Update variant stock
    if (req.method === 'POST' && lastPart === 'stock') {
      const body = await req.json()

      if (!body.sku || typeof body.quantity !== 'number') {
        return new Response(
          JSON.stringify({ error: 'sku and quantity are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Find variant by SKU
      const { data: variant, error: findError } = await supabase
        .from('product_variants')
        .select('id, stock_quantity, product_id')
        .eq('sku', body.sku)
        .single()

      if (findError || !variant) {
        return new Response(
          JSON.stringify({ error: 'Variant not found' }),
          { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const movementType = body.movement_type || (body.quantity > 0 ? 'in' : 'out')
      const absQuantity = Math.abs(body.quantity)

      // Record inventory movement
      await supabase.rpc('record_inventory_movement', {
        p_product_id: variant.product_id,
        p_variant_id: variant.id,
        p_movement_type: movementType,
        p_quantity: absQuantity,
        p_order_id: body.order_id || null,
        p_notes: body.notes || null,
      }).catch(() => {})

      // Update stock
      const { data, error } = await supabase
        .from('product_variants')
        .update({
          stock_quantity: variant.stock_quantity + body.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', variant.id)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /manage-variants/options - Get product options
    if (req.method === 'GET' && lastPart === 'options') {
      const { data, error } = await supabase
        .from('product_options')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) {
        // Table might not exist, return empty
        return new Response(
          JSON.stringify({ data: [] }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /manage-variants/{id} - Update variant
    if (req.method === 'PUT' && variantId) {
      const body = await req.json()

      const { data, error } = await supabase
        .from('product_variants')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', variantId)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /manage-variants/{id} - Delete variant
    if (req.method === 'DELETE' && variantId) {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', variantId)

      if (error) throw error

      return new Response(
        JSON.stringify({ message: 'Variant deleted' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('manage-variants error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
