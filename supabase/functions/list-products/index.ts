/**
 * Supabase Edge Function: list-products
 *
 * Server-side product CRUD operations with admin authentication.
 * Replaces direct Supabase API calls from frontend.
 *
 * Endpoints:
 *   GET    /list-products - List products with filters
 *   GET    /list-products/{id} - Get single product
 *   POST   /list-products - Create product
 *   PUT    /list-products/{id} - Update product
 *   DELETE /list-products/{id} - Delete/archive product
 *   POST   /list-products/bulk - Bulk operations
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { jwtVerify } from 'https://esm.sh/jose@5.2.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWT_SECRET = Deno.env.get('JWT_SECRET') || SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting for write operations
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 100 // requests per minute for writes
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

// Max pagination limit to prevent DoS
const MAX_PAGE_LIMIT = 200

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

/**
 * Verify admin session token from Authorization header
 */
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

/**
 * Generate slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Input sanitization
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

  // GET requests don't require auth (for storefront)
  const isReadOperation = req.method === 'GET'
  const auth = isReadOperation ? null : await verifyAdmin(req)

  // Rate limit write operations
  if (!isReadOperation) {
    if (!auth?.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: admin access required' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }
    const clientIP = getClientIP(req)
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
        { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }
  }

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const productId = pathParts[pathParts.length - 1]
  const isSingleProduct = /^\d+$/.test(productId)

  try {
    // ============================================
    // GET /list-products - List products with filters
    // ============================================
    if (req.method === 'GET' && !isSingleProduct) {
      const params = url.searchParams
      const page = Math.max(1, parseInt(params.get('page') || '1', 10))
      const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(params.get('limit') || '50', 10)))
      const offset = (page - 1) * limit
      const category = params.get('category')
      const collectionId = params.get('collection_id')
      const fulfillmentType = params.get('fulfillment_type')
      const search = params.get('search')
      const minPrice = params.get('min_price')
      const maxPrice = params.get('max_price')
      const includeArchived = params.get('include_archived') === 'true'

      let query = supabase
        .from('product_details')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      // Apply filters
      if (!includeArchived) {
        query = query.eq('is_active', true).eq('is_archived', false)
      }
      if (category && category !== 'todos') {
        query = query.eq('category', category)
      }
      if (collectionId) {
        query = query.eq('collection_id', collectionId)
      }
      if (fulfillmentType) {
        query = query.eq('fulfillment_type', fulfillmentType)
      }
      if (minPrice) {
        query = query.gte('price', parseFloat(minPrice))
      }
      if (maxPrice) {
        query = query.lte('price', parseFloat(maxPrice))
      }
      if (search) {
        // Use full-text search RPC
        const { data, error } = await supabase
          .rpc('search_products', {
            search_query: search,
            category_filter: category || null,
            collection_filter: collectionId || null,
            fulfillment_filter: fulfillmentType || null,
            min_price: minPrice ? parseFloat(minPrice) : null,
            max_price: maxPrice ? parseFloat(maxPrice) : null,
            limit_count: limit,
            offset_count: offset,
          })

        if (error) throw error
        return new Response(
          JSON.stringify({ data, count: data?.length || 0, page, limit }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error, count } = await query

      if (error) throw error
      return new Response(
        JSON.stringify({ data, count, page, limit }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // GET /list-products/{id} - Get single product
    // ============================================
    if (req.method === 'GET' && isSingleProduct) {
      const { data, error } = await supabase
        .from('product_details')
        .select('*')
        .eq('id', parseInt(productId, 10))
        .single()

      if (error) throw error
      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // POST /list-products - Create product
    // ============================================
    if (req.method === 'POST' && !isSingleProduct) {
      const body = await req.json()
      const { product, variants } = body

      if (!product?.name || product.price === undefined) {
        return new Response(
          JSON.stringify({ error: 'name and price are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Sanitize product string fields
      const sanitizedProduct: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(product)) {
        if (key === 'price' || key === 'compare_at_price' || key === 'stock_quantity' ||
            key === 'collection_id' || key === 'subcollection_id' || key === 'is_active' ||
            key === 'is_featured' || key === 'is_archived') {
          sanitizedProduct[key] = value
        } else if (typeof value === 'string') {
          sanitizedProduct[key] = sanitizeString(value)
        }
      }

      // Generate slug if not provided
      if (!sanitizedProduct.slug) {
        sanitizedProduct.slug = generateSlug(sanitizedProduct.name as string)
      }

      // Create product
      const { data: newProduct, error: createError } = await supabase
        .from('products')
        .insert(sanitizedProduct)
        .select()
        .single()

      if (createError) throw createError

      // Create variants if provided
      if (variants?.length > 0) {
        const variantsWithProductId = variants.map((v: Record<string, unknown>) => ({
          ...v,
          product_id: newProduct.id,
        }))

        const { error: variantsError } = await supabase
          .from('product_variants')
          .insert(variantsWithProductId)

        if (variantsError) {
          console.error('Failed to create variants:', variantsError)
        }
      }

      return new Response(
        JSON.stringify({ data: newProduct }),
        { status: 201, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // PUT /list-products/{id} - Update product
    // ============================================
    if (req.method === 'PUT' && isSingleProduct) {
      const body = await req.json()
      const { product, variants } = body

      // Sanitize product string fields
      const sanitizedProduct: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const [key, value] of Object.entries(product)) {
        if (key === 'id' || key === 'created_at') continue
        if (key === 'price' || key === 'compare_at_price' || key === 'stock_quantity' ||
            key === 'collection_id' || key === 'subcollection_id' || key === 'is_active' ||
            key === 'is_featured' || key === 'is_archived') {
          sanitizedProduct[key] = value
        } else if (typeof value === 'string') {
          sanitizedProduct[key] = sanitizeString(value)
        }
      }

      // Update product
      const { data: updatedProduct, error: updateError } = await supabase
        .from('products')
        .update(sanitizedProduct)
        .eq('id', parseInt(productId, 10))
        .select()
        .single()

      if (updateError) throw updateError

      // Update variants if provided
      if (variants?.length > 0) {
        // Delete existing variants and recreate
        await supabase
          .from('product_variants')
          .delete()
          .eq('product_id', parseInt(productId, 10))

        const variantsWithProductId = variants.map((v: Record<string, unknown>) => ({
          ...v,
          product_id: parseInt(productId, 10),
        }))

        const { error: variantsError } = await supabase
          .from('product_variants')
          .insert(variantsWithProductId)

        if (variantsError) {
          console.error('Failed to update variants:', variantsError)
        }
      }

      return new Response(
        JSON.stringify({ data: updatedProduct }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // DELETE /list-products/{id} - Archive product
    // ============================================
    if (req.method === 'DELETE' && isSingleProduct) {
      const { error: deleteError } = await supabase
        .from('products')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('id', parseInt(productId, 10))

      if (deleteError) throw deleteError

      return new Response(
        JSON.stringify({ message: 'Product archived successfully' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // POST /list-products/bulk - Bulk operations
    // ============================================
    if (req.method === 'POST' && pathParts.includes('bulk')) {
      const body = await req.json()
      const { action, ids, data } = body

      if (!action || !ids?.length) {
        return new Response(
          JSON.stringify({ error: 'action and ids are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      let result

      switch (action) {
        case 'archive':
          result = await supabase
            .from('products')
            .update({ is_archived: true, updated_at: new Date().toISOString() })
            .in('id', ids)
          break
        case 'activate':
          result = await supabase
            .from('products')
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .in('id', ids)
          break
        case 'deactivate':
          result = await supabase
            .from('products')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .in('id', ids)
          break
        case 'update':
          result = await supabase
            .from('products')
            .update({ ...data, updated_at: new Date().toISOString() })
            .in('id', ids)
          break
        default:
          return new Response(
            JSON.stringify({ error: `Unknown action: ${action}` }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
      }

      if (result.error) throw result.error

      return new Response(
        JSON.stringify({ message: `Bulk ${action} completed`, count: ids.length }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // Variant endpoints
    // ============================================
    if (req.method === 'GET' && pathParts.includes('variants') && !pathParts.includes('bulk') && !pathParts.includes('stock')) {
      const productId = url.searchParams.get('product_id')
      let query = supabase
        .from('product_variants')
        .select('*, products(name)')
        .order('created_at', { ascending: false })

      if (productId) query = query.eq('product_id', parseInt(productId, 10))

      const { data, error } = await query
      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'GET' && pathParts.includes('options')) {
      const { data, error } = await supabase
        .from('product_options')
        .select('*')
        .order('sort_order', { ascending: true })
        .catch(() => ({ data: [], error: null }))

      return new Response(
        JSON.stringify({ data: data || [] }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'POST' && pathParts.includes('variants') && pathParts.includes('stock')) {
      const body = await req.json()
      if (!body.sku || typeof body.quantity !== 'number') {
        return new Response(
          JSON.stringify({ error: 'sku and quantity are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data: variant } = await supabase
        .from('product_variants')
        .select('id, stock_quantity, product_id')
        .eq('sku', body.sku)
        .single()

      if (!variant) {
        return new Response(
          JSON.stringify({ error: 'Variant not found' }),
          { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

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

    if (req.method === 'POST' && pathParts.includes('variants') && !pathParts.includes('stock')) {
      const body = await req.json()
      if (!body.product_id) {
        return new Response(
          JSON.stringify({ error: 'product_id is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      if (pathParts.includes('bulk')) {
        const { variants } = body
        if (!variants || !Array.isArray(variants)) {
          return new Response(
            JSON.stringify({ error: 'variants array is required' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
        const { data, error } = await supabase
          .from('product_variants')
          .insert(variants)
          .select()
        if (error) throw error
        return new Response(
          JSON.stringify({ data }),
          { status: 201, headers: { ...cors, 'Content-Type': 'application/json' } }
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

    if (req.method === 'PUT' && pathParts.includes('variants')) {
      const variantId = pathParts[pathParts.length - 1]
      if (!/^\d+$/.test(variantId)) {
        return new Response(
          JSON.stringify({ error: 'Invalid variant ID' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }
      const body = await req.json()
      const { data, error } = await supabase
        .from('product_variants')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', parseInt(variantId, 10))
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'DELETE' && pathParts.includes('variants')) {
      const variantId = pathParts[pathParts.length - 1]
      if (!/^\d+$/.test(variantId)) {
        return new Response(
          JSON.stringify({ error: 'Invalid variant ID' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', parseInt(variantId, 10))

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
    console.error('list-products error:', error)
    const isDatabaseError = error.message?.includes('database') || error.message?.includes('SQL')
    return new Response(
      JSON.stringify({ error: isDatabaseError ? 'Internal server error' : (error.message || 'Internal server error') }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
