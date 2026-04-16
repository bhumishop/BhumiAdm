/**
 * Supabase Edge Function: inventory-management
 *
 * Server-side inventory management.
 *
 * Endpoints:
 *   GET    /inventory-management - List inventory movements
 *   POST   /inventory-management - Record inventory movement
 *   GET    /inventory-management/stock - Get current stock status
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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
    // GET /inventory-management - List movements
    if (req.method === 'GET' && action === 'inventory-management') {
      const params = url.searchParams
      const productId = params.get('product_id')
      const movementType = params.get('movement_type')
      const limit = parseInt(params.get('limit') || '100', 10)

      let query = supabase
        .from('inventory_movements')
        .select('*, products(name), product_variants(size, color)')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (productId) {
        query = query.eq('product_id', parseInt(productId, 10))
      }
      if (movementType) {
        query = query.eq('movement_type', movementType)
      }

      const { data, error } = await query
      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST /inventory-management - Record movement
    if (req.method === 'POST') {
      const body = await req.json()
      const { product_id, variant_id, movement_type, quantity, order_id, notes } = body

      if (!product_id || !movement_type || !quantity) {
        return new Response(
          JSON.stringify({ error: 'product_id, movement_type, and quantity are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase.rpc('record_inventory_movement', {
        p_product_id: product_id,
        p_variant_id: variant_id || null,
        p_movement_type: movement_type,
        p_quantity: quantity,
        p_order_id: order_id || null,
        p_notes: notes || null,
      })

      if (error) throw error

      return new Response(
        JSON.stringify({ data, message: 'Inventory movement recorded' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /inventory-management/stock - Get stock status
    if (req.method === 'GET' && action === 'stock') {
      const productId = url.searchParams.get('product_id')

      if (!productId) {
        // Get all products with stock status
        const { data, error } = await supabase
          .from('products')
          .select('id, name, stock_quantity, stock_type, low_stock_threshold')
          .eq('is_active', true)
          .eq('is_archived', false)
          .order('stock_quantity', { ascending: true })

        if (error) throw error

        return new Response(
          JSON.stringify({ data }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase.rpc('get_product_stock_status', {
        product_id_param: parseInt(productId, 10),
      })

      if (error) throw error

      return new Response(
        JSON.stringify({ data: data?.[0] }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /inventory-management/stock - Direct stock adjustment
    if (req.method === 'PUT' && action === 'stock') {
      const body = await req.json()
      const { product_id, variant_id, quantity_change } = body

      if (!product_id || typeof quantity_change !== 'number') {
        return new Response(
          JSON.stringify({ error: 'product_id and quantity_change are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const movementType = quantity_change > 0 ? 'in' : 'out'
      const absQuantity = Math.abs(quantity_change)

      // Record movement
      await supabase.rpc('record_inventory_movement', {
        p_product_id: product_id,
        p_variant_id: variant_id || null,
        p_movement_type: movementType,
        p_quantity: absQuantity,
        p_order_id: body.order_id || null,
        p_notes: body.notes || 'Manual stock adjustment',
      }).catch(() => {})

      // Update product stock using raw SQL via RPC
      const { data, error } = await supabase.rpc('update_product_stock', {
        p_product_id: product_id,
        p_quantity_change: quantity_change,
      }).catch(async () => {
        // Fallback: fetch current stock and update manually
        const { data: product } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', product_id)
          .single()

        if (!product) throw new Error('Product not found')

        return await supabase
          .from('products')
          .update({
            stock_quantity: product.stock_quantity + quantity_change,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product_id)
          .select()
          .single()
      })

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /inventory-management/low-stock - Get low stock alerts
    if (req.method === 'GET' && action === 'low-stock') {
      const threshold = parseInt(url.searchParams.get('threshold') || '10', 10)

      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock_quantity, stock_type, low_stock_threshold')
        .eq('is_active', true)
        .eq('is_archived', false)
        .lte('stock_quantity', threshold)
        .order('stock_quantity', { ascending: true })

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /inventory-management/products - Get products with stock status
    if (req.method === 'GET' && action === 'products') {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock_quantity, stock_type, low_stock_threshold, is_active, is_archived')
        .eq('is_archived', false)
        .order('stock_quantity', { ascending: true })

      if (error) throw error

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
    console.error('inventory-management error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
