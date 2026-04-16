/**
 * Supabase Edge Function: network-graph
 *
 * Returns graph data for product/collection network visualization.
 *
 * Endpoints:
 *   GET /network-graph - Get nodes and edges
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

async function verifyAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-auth/verify`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
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

  try {
    // Get collections as nodes
    const { data: collections } = await supabase
      .from('collections')
      .select('id, name, slug')
      .eq('is_active', true)

    // Get products as nodes
    const { data: products } = await supabase
      .from('products')
      .select('id, name, slug, category, collection_id')
      .eq('is_active', true)
      .eq('is_archived', false)
      .limit(500)

    // Build edges (product -> collection relationships)
    const edges = (products || [])
      .filter(p => p.collection_id)
      .map(p => ({
        source: p.collection_id,
        target: `product-${p.id}`,
        type: 'contains',
      }))

    // Format nodes
    const nodes = [
      ...(collections || []).map(c => ({
        id: c.id,
        label: c.name,
        type: 'collection',
        slug: c.slug,
      })),
      ...(products || []).map(p => ({
        id: `product-${p.id}`,
        label: p.name,
        type: 'product',
        slug: p.slug,
        category: p.category,
      })),
    ]

    return new Response(
      JSON.stringify({ data: { nodes, edges } }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('network-graph error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
