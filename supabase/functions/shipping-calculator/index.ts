/**
 * Supabase Edge Function: shipping-calculator
 *
 * Server-side shipping calculation and zone management.
 *
 * Endpoints:
 *   POST   /shipping-calculator/calculate - Calculate shipping cost
 *   GET    /shipping-calculator/zones - List shipping zones
 *   GET    /shipping-calculator/state?cep=12345678 - Get state from CEP
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

async function verifyAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false
  try {
    const { payload } = await jwtVerify(
      authHeader.substring(7),
      new TextEncoder().encode(JWT_SECRET),
      { algorithms: ['HS256'] }
    )
    return payload.role === 'admin'
  } catch {
    return false
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
  const action = pathParts[pathParts.length - 1]

  try {
    // POST /shipping-calculator/calculate - Calculate shipping
    if (req.method === 'POST' && action === 'calculate') {
      const body = await req.json()
      const { items, destination_cep } = body

      if (!items?.length || !destination_cep) {
        return new Response(
          JSON.stringify({ error: 'items and destination_cep are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Use the RPC function
      const { data, error } = await supabase.rpc('calculate_shipping_cost', {
        items,
        destination_cep,
      })

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /shipping-calculator/zones - List zones
    if (req.method === 'GET' && action === 'zones') {
      const isAdmin = await verifyAdmin(req)

      let query = supabase
        .from('shipping_zones')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (isAdmin) {
        query = supabase.from('shipping_zones').select('*').order('name')
      }

      const { data, error } = await query
      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /shipping-calculator/state - Get state from CEP
    if (req.method === 'GET' && action === 'state') {
      const cep = url.searchParams.get('cep')

      if (!cep) {
        return new Response(
          JSON.stringify({ error: 'cep parameter is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase.rpc('get_state_from_cep', { cep })
      if (error) throw error

      return new Response(
        JSON.stringify({ state: data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('shipping-calculator error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
