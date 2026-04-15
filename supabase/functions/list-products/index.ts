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

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  // GET requests don't require auth (for storefront)
  const isReadOperation = req.method === 'GET'
  const auth = isReadOperation ? null : await verifyAdmin(req)

  if (!isReadOperation && !auth?.valid) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: admin access required' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
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
      const page = parseInt(params.get('page') || '1', 10)
      const limit = parseInt(params.get('limit') || '50', 10)
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

      // Generate slug if not provided
      if (!product.slug) {
        product.slug = generateSlug(product.name)
      }

      // Create product
      const { data: newProduct, error: createError } = await supabase
        .from('products')
        .insert(product)
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

      // Update product
      const { data: updatedProduct, error: updateError } = await supabase
        .from('products')
        .update({ ...product, updated_at: new Date().toISOString() })
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

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('list-products error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
