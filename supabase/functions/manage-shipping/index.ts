/**
 * Supabase Edge Function: manage-shipping
 *
 * Server-side shipping zone, delivery type, and rate management.
 * Also provides authoritative shipping calculation (replaces client-side).
 *
 * Endpoints:
 *   GET    /manage-shipping/zones - List zones (admin, includes inactive)
 *   POST   /manage-shipping/zones - Create shipping zone
 *   PUT    /manage-shipping/zones/{id} - Update zone
 *   DELETE /manage-shipping/zones/{id} - Delete zone
 *   GET    /manage-shipping/delivery-types - List delivery types
 *   POST   /manage-shipping/delivery-types - Create delivery type
 *   PUT    /manage-shipping/delivery-types/{id} - Update delivery type
 *   POST   /manage-shipping/calculate - Authoritative shipping cost (public GET, admin POST)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting for calculations
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 50
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

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const lastPart = pathParts[pathParts.length - 1]
  const isUUID = /^[0-9a-f-]{36}$/i.test(lastPart)

  // Determine if this is a write operation
  const isWriteOperation = ['POST', 'PUT', 'DELETE'].includes(req.method)

  // GET zones is public (for storefront shipping estimate)
  // All other operations require admin auth
  if (isWriteOperation && !await verifyAdmin(req)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  // Rate limit write operations
  if (isWriteOperation) {
    const clientIP = getClientIP(req)
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }
  }

  try {
    // GET /manage-shipping/zones - List zones
    if (req.method === 'GET' && lastPart === 'manage-shipping') {
      const includeInactive = url.searchParams.get('include_inactive') === 'true'

      let query = supabase
        .from('shipping_zones')
        .select('*')
        .order('name', { ascending: true })

      if (!includeInactive) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query
      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST /manage-shipping/zones - Create zone
    if (req.method === 'POST' && lastPart === 'manage-shipping') {
      const body = await req.json()

      if (!body.name) {
        return new Response(
          JSON.stringify({ error: 'name is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Validate states array
      let states: string[] = []
      if (body.states) {
        if (!Array.isArray(body.states) || body.states.length > 50) {
          return new Response(
            JSON.stringify({ error: 'Invalid states array: must be an array with max 50 items' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
        states = body.states.filter((s: unknown) => typeof s === 'string' && s.length <= 2)
      }

      const { data, error } = await supabase
        .from('shipping_zones')
        .insert({
          name: sanitizeString(body.name),
          description: body.description ? sanitizeString(body.description) : null,
          states,
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

    // PUT /manage-shipping/zones/{id} - Update zone
    if (req.method === 'PUT' && isUUID) {
      const body = await req.json()
      const updates: Record<string, unknown> = {}

      if (body.name) updates.name = sanitizeString(body.name)
      if (body.description !== undefined) updates.description = body.description ? sanitizeString(body.description) : null
      if (body.states) updates.states = body.states
      if (body.base_rate !== undefined) updates.base_rate = body.base_rate
      if (body.per_kg_rate !== undefined) updates.per_kg_rate = body.per_kg_rate
      if (body.free_shipping_threshold !== undefined) updates.free_shipping_threshold = body.free_shipping_threshold
      if (body.is_active !== undefined) updates.is_active = body.is_active
      updates.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('shipping_zones')
        .update(updates)
        .eq('id', lastPart)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /manage-shipping/zones/{id} - Delete zone
    if (req.method === 'DELETE' && isUUID) {
      const { error } = await supabase
        .from('shipping_zones')
        .delete()
        .eq('id', lastPart)

      if (error) throw error

      return new Response(
        JSON.stringify({ message: 'Zone deleted' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /manage-shipping/delivery-types - List delivery types
    if (req.method === 'GET' && lastPart === 'delivery-types') {
      const { data, error } = await supabase
        .from('delivery_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) {
        // Table might not exist, return defaults
        return new Response(
          JSON.stringify({
            data: [
              { id: 'standard', name: 'Standard', description: '5-10 business days', sort_order: 1, is_active: true },
              { id: 'express', name: 'Express', description: '2-3 business days', sort_order: 2, is_active: true },
              { id: 'pickup', name: 'Pickup', description: 'Self pickup', sort_order: 3, is_active: true },
            ]
          }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST /manage-shipping/delivery-types - Create delivery type
    if (req.method === 'POST' && lastPart === 'delivery-types') {
      const body = await req.json()

      if (!body.id || !body.name) {
        return new Response(
          JSON.stringify({ error: 'id and name are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('delivery_types')
        .insert({
          id: sanitizeString(body.id),
          name: sanitizeString(body.name),
          description: body.description ? sanitizeString(body.description) : null,
          sort_order: body.sort_order || 0,
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

    // PUT /manage-shipping/delivery-types/{id} - Update delivery type
    if (req.method === 'PUT' && pathParts.includes('delivery-types')) {
      const body = await req.json()
      const typeId = lastPart
      const updates: Record<string, unknown> = {}

      if (body.name) updates.name = sanitizeString(body.name)
      if (body.description !== undefined) updates.description = body.description ? sanitizeString(body.description) : null
      if (body.sort_order !== undefined) updates.sort_order = body.sort_order
      if (body.is_active !== undefined) updates.is_active = body.is_active

      const { data, error } = await supabase
        .from('delivery_types')
        .update(updates)
        .eq('id', typeId)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST /manage-shipping/calculate - Authoritative shipping cost
    if (req.method === 'POST' && lastPart === 'calculate') {
      const body = await req.json()

      if (!body.destination_cep) {
        return new Response(
          JSON.stringify({ error: 'destination_cep is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Use RPC for authoritative calculation
      const { data, error } = await supabase.rpc('calculate_shipping_cost', {
        items: body.items || [],
        destination_cep: body.destination_cep,
      })

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
    console.error('manage-shipping error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
