/**
 * Supabase Edge Function: storefront-products
 *
 * Server-side product and category listing for the BhumiShop storefront.
 * Replaces direct Supabase table access from the frontend.
 *
 * Endpoints:
 *   GET /storefront-products - List all active products
 *   GET /storefront-products/categories - List all active categories
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
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  // Only GET allowed (read-only for storefront)
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const action = pathParts[pathParts.length - 1]

  try {
    // GET /storefront-products/categories - List categories
    if (action === 'categories') {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, is_active, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /storefront-products - List products (public storefront fields only)
    {
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)))
      const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10))

      const { data, error, count } = await supabase
        .from('products')
        .select(
          `
          id,
          name,
          slug,
          category,
          price,
          compare_at_price,
          description,
          short_description,
          stock_type,
          stock_quantity,
          fulfillment_type,
          image,
          images,
          artist,
          brand,
          tags,
          collection_id,
          subcollection_id,
          is_active,
          is_featured,
          created_at
        `,
          { count: 'exact' }
        )
        .eq('is_active', true)
        .eq('is_archived', false)
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return new Response(
        JSON.stringify({ data, count, limit, offset }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('storefront-products error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
