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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting for shipping calculations
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 50 // requests per window
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

function corsHeaders(origin?: string) {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)
  const allowOrigin = allowedOrigins.includes(origin || '') ? origin : (allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
  }
}

/**
 * Get client IP from request headers
 */
function getClientIP(req: Request): string {
  // Prefer x-real-ip from trusted proxy, never trust x-forwarded-for from untrusted sources
  return req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip') // Cloudflare
    || 'unknown'
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

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const action = pathParts[pathParts.length - 1]

  try {
    // POST /shipping-calculator/calculate - Calculate shipping
    if (req.method === 'POST' && action === 'calculate') {
      // Rate limit shipping calculations
      const clientIP = getClientIP(req)
      if (!checkRateLimit(clientIP)) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
          { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const body = await req.json()
      const { items, destination_cep, country = 'BR' } = body

      if (!items?.length || !destination_cep) {
        return new Response(
          JSON.stringify({ error: 'items and destination_cep are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Validate CEP format (Brazil: 8 digits)
      const cleanCep = String(destination_cep).replace(/\D/g, '')
      if (country === 'BR' && cleanCep.length !== 8) {
        return new Response(
          JSON.stringify({ error: 'Invalid CEP format. Must be 8 digits (e.g., 01310100 or 01310-100)' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Calculate total weight from items
      const totalWeight = items.reduce((sum: number, item: { weight?: number; qty?: number }) => {
        const weight = item.weight || 0.3 // Default 300g per item
        const qty = item.qty || 1
        return sum + (weight * qty)
      }, 0)

      // Try RPC function first
      let data = null
      let error = null
      try {
        const rpcResult = await supabase.rpc('calculate_shipping_cost', {
          items,
          destination_cep: cleanCep,
        })
        data = rpcResult.data
        error = rpcResult.error
      } catch (rpcError) {
        // RPC failed, will use fallback estimates
        console.warn('RPC calculate_shipping_cost failed, using fallback:', rpcError.message)
        error = rpcError
      }

      // If RPC failed or returned null, use fallback estimates
      if (error || !data || data.cost === null || data.cost === undefined) {
        // Fallback shipping estimates
        if (country === 'BR') {
          // Brazil domestic: R$20-30 range based on weight
          const baseCost = 20.00
          const perKg = 5.00
          const estimatedCost = baseCost + (Math.ceil(totalWeight) * perKg)
          // Cap at R$30 for typical items
          const cappedCost = Math.min(estimatedCost, 30.00)

          data = {
            cost: Number(cappedCost.toFixed(2)),
            days_min: 3,
            days_max: 7,
            subtotal: Number(cappedCost.toFixed(2)),
            weight_kg: totalWeight,
            free_shipping_applied: false,
            note: 'Estimated shipping cost (Brazil domestic)',
          }
        } else {
          // International: R$100-200 range
          const baseCost = 100.00
          const perKg = 25.00
          const estimatedCost = baseCost + (Math.ceil(totalWeight) * perKg)
          // Cap at R$200 for typical items
          const cappedCost = Math.min(estimatedCost, 200.00)

          data = {
            cost: Number(cappedCost.toFixed(2)),
            days_min: 10,
            days_max: 20,
            subtotal: Number(cappedCost.toFixed(2)),
            weight_kg: totalWeight,
            free_shipping_applied: false,
            note: 'Estimated international shipping cost',
          }
        }
      }

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

    // POST /shipping-calculator/zones - Create zone (admin)
    if (req.method === 'POST' && action === 'zones') {
      if (!await verifyAdmin(req)) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const body = await req.json()
      if (!body.name) {
        return new Response(
          JSON.stringify({ error: 'name is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('shipping_zones')
        .insert({
          name: body.name,
          description: body.description || null,
          states: body.states || [],
          base_rate: body.base_rate || 0,
          per_kg_rate: body.per_kg_rate || 0,
          free_shipping_threshold: body.free_shipping_threshold || null,
          is_active: body.is_active !== false,
        })
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /shipping-calculator/zones/{id} - Update zone (admin)
    if (req.method === 'PUT' && action === 'zones') {
      if (!await verifyAdmin(req)) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const body = await req.json()
      // Prefer path-based ID over query parameter or body
      const zoneId = pathParts[pathParts.length - 1]
      if (!zoneId || zoneId === 'zones' || !/^[0-9a-f-]{36}$/i.test(zoneId)) {
        return new Response(
          JSON.stringify({ error: 'Valid zone ID is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (body.name) updates.name = body.name
      if (body.description !== undefined) updates.description = body.description
      if (body.states) updates.states = body.states
      if (body.base_rate !== undefined) updates.base_rate = body.base_rate
      if (body.per_kg_rate !== undefined) updates.per_kg_rate = body.per_kg_rate
      if (body.free_shipping_threshold !== undefined) updates.free_shipping_threshold = body.free_shipping_threshold
      if (body.is_active !== undefined) updates.is_active = body.is_active

      const { data, error } = await supabase
        .from('shipping_zones')
        .update(updates)
        .eq('id', zoneId)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /shipping-calculator/zones/{id} - Delete zone (admin)
    if (req.method === 'DELETE' && action === 'zones') {
      if (!await verifyAdmin(req)) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const zoneId = pathParts[pathParts.length - 1]
      if (!zoneId || zoneId === 'zones' || !/^[0-9a-f-]{36}$/i.test(zoneId)) {
        return new Response(
          JSON.stringify({ error: 'Valid zone ID is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { error } = await supabase
        .from('shipping_zones')
        .delete()
        .eq('id', zoneId)

      if (error) throw error

      return new Response(
        JSON.stringify({ message: 'Zone deleted' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /shipping-calculator/delivery-types
    if (req.method === 'GET' && action === 'delivery-types') {
      const { data, error } = await supabase
        .from('delivery_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .catch(() => ({ data: [
          { id: 'standard', name: 'Standard', sort_order: 1 },
          { id: 'express', name: 'Express', sort_order: 2 },
          { id: 'pickup', name: 'Pickup', sort_order: 3 },
        ], error: null }))

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST /shipping-calculator/delivery-types - Create (admin)
    if (req.method === 'POST' && action === 'delivery-types') {
      if (!await verifyAdmin(req)) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const body = await req.json()
      if (!body.id || !body.name) {
        return new Response(
          JSON.stringify({ error: 'id and name are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('delivery_types')
        .insert(body)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /shipping-calculator/delivery-types/{id} - Update (admin)
    if (req.method === 'PUT' && action === 'delivery-types') {
      if (!await verifyAdmin(req)) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const body = await req.json()
      const typeId = url.searchParams.get('id') || body.id
      if (!typeId) {
        return new Response(
          JSON.stringify({ error: 'delivery type id is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('delivery_types')
        .update(body)
        .eq('id', typeId)
        .select()
        .single()

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
    console.error('shipping-calculator error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
