/**
 * Supabase Edge Function: storefront-shipping
 *
 * Client-facing shipping calculation for the BhumiShop storefront.
 * Wraps shipping-calculator with proper CORS and no admin auth requirement.
 *
 * Endpoints:
 *   POST   /storefront-shipping/calculate  - Calculate shipping cost
 *   GET    /storefront-shipping/state?cep= - Get state from CEP
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 60 // requests per minute
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

/**
 * Brazilian CEP to state mapping (server-side)
 */
const CEP_RANGES: [number, number, string][] = [
  [1000000, 1999999, 'SP'],
  [2000000, 2899999, 'RJ'],
  [2900000, 3999999, 'MG'],
  [4000000, 4999999, 'BA'],
  [5000000, 5699999, 'PE'],
  [5700000, 5799999, 'SE'],
  [5800000, 5999999, 'PB'],
  [6000000, 6399999, 'CE'],
  [6400000, 6499999, 'PI'],
  [6500000, 6599999, 'MA'],
  [6600000, 6999999, 'PA'],
  [6900000, 6929999, 'AM'],
  [6930000, 6949999, 'RR'],
  [6940000, 6959999, 'AP'],
  [6960000, 6989999, 'AM'],
  [7680000, 7699999, 'RO'],
  [7700000, 7799999, 'TO'],
  [7800000, 7889999, 'MT'],
  [7890000, 7899999, 'MS'],
  [7900000, 7999999, 'MS'],
  [8000000, 8799999, 'PR'],
  [8800000, 8999999, 'SC'],
  [9000000, 9999999, 'RS'],
  [7000000, 7099999, 'DF'],
  [7100000, 7279999, 'DF'],
  [7280000, 7369999, 'GO'],
  [7370000, 7679999, 'GO'],
]

function getStateFromCEP(cep: string): string | null {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null
  const num = parseInt(digits, 10)
  for (const [start, end, state] of CEP_RANGES) {
    if (num >= start && num <= end) return state
  }
  return null
}

const SHIPPING_ZONES: Record<string, { states: string[]; base: number; perKg: number; days: string }> = {
  'southeast': { states: ['SP', 'RJ', 'MG', 'ES'], base: 12.90, perKg: 3.50, days: '3-5' },
  'south': { states: ['PR', 'SC', 'RS'], base: 15.90, perKg: 4.50, days: '4-6' },
  'northeast': { states: ['BA', 'SE', 'AL', 'PE', 'PB', 'RN', 'CE', 'PI', 'MA'], base: 22.90, perKg: 6.90, days: '6-10' },
  'north': { states: ['PA', 'AM', 'RR', 'AP', 'TO', 'RO', 'AC'], base: 28.90, perKg: 8.90, days: '8-14' },
  'midwest': { states: ['GO', 'MT', 'MS', 'DF'], base: 18.90, perKg: 5.50, days: '5-8' },
}

const FREE_SHIPPING_ABOVE = 200

function getZoneFromState(state: string): string | null {
  for (const [zone, config] of Object.entries(SHIPPING_ZONES)) {
    if (config.states.includes(state)) return zone
  }
  return null
}

function sanitizeItem(item: Record<string, unknown>): Record<string, unknown> {
  return {
    id: item.id,
    name: typeof item.name === 'string' ? item.name.replace(/[<>'"&]/g, '').trim() : '',
    price: typeof item.price === 'number' ? item.price : 0,
    quantity: typeof item.quantity === 'number' ? Math.min(Math.max(item.quantity, 1), 99) : 1,
    weight: typeof item.weight === 'number' ? item.weight : 0.3,
    fulfillment_type: typeof item.fulfillment_type === 'string' ? item.fulfillment_type : 'custom',
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  // Rate limit
  const clientIP = getClientIP(req)
  if (!checkRateLimit(clientIP)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const action = pathParts[pathParts.length - 1]

  try {
    // ============================================
    // POST /storefront-shipping/calculate
    // ============================================
    if (req.method === 'POST' && action === 'calculate') {
      const body = await req.json()
      const { items, destination_cep, country } = body

      if (!items || !Array.isArray(items) || items.length === 0) {
        return new Response(
          JSON.stringify({ error: 'items array is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Sanitize items
      const sanitizedItems = items.map(sanitizeItem)

      // For non-Brazil orders, use flat international rate
      if (country && country !== 'BR') {
        const intlItems = sanitizedItems.filter(i => i.fulfillment_type !== 'uiclap')
        if (intlItems.length === 0) {
          return new Response(
            JSON.stringify({
              data: {
                own: { cost: 0, days: null },
                uma_penca: { cost: null, days: null, note: 'Calculated by Uma Penca' },
                digital: { cost: 0, days: null, note: 'Immediate digital delivery' }
              }
            }),
            { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        const intlRate = 45.00
        return new Response(
          JSON.stringify({
            data: {
              own: { cost: intlRate, days: '10-20', note: 'International shipping' },
              uma_penca: { cost: null, days: null, note: 'Calculated by Uma Penca' },
              digital: { cost: 0, days: null, note: 'Immediate digital delivery' }
            }
          }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Brazil: require 8-digit CEP
      if (!destination_cep || destination_cep.replace(/\D/g, '').length !== 8) {
        return new Response(
          JSON.stringify({ error: 'Valid Brazilian CEP (8 digits) is required for Brazil shipping' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Try database calculation first (via RPC)
      const { data: dbResult, error: dbError } = await supabase.rpc('calculate_shipping_cost', {
        p_items: sanitizedItems,
        p_destination_cep: destination_cep.replace(/\D/g, ''),
      }).catch(() => ({ data: null, error: new Error('RPC not available') }))

      if (dbResult && !dbError) {
        return new Response(
          JSON.stringify({ data: dbResult }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Fallback to server-side calculation
      const state = getStateFromCEP(destination_cep)
      const zone = state ? getZoneFromState(state) : null

      if (!zone) {
        return new Response(
          JSON.stringify({
            data: {
              own: { cost: null, days: null, error: 'Invalid CEP or unsupported region' },
              uma_penca: { cost: null, days: null, note: 'Calculated by Uma Penca' },
              digital: { cost: 0, days: null, note: 'Immediate digital delivery' }
            }
          }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const zoneConfig = SHIPPING_ZONES[zone]

      // Calculate custom items shipping
      const customItems = sanitizedItems.filter(i => !i.fulfillment_type || i.fulfillment_type === 'custom')
      let customCost: number | null = null
      let customDays: string | null = null

      if (customItems.length > 0) {
        const totalWeight = customItems.reduce((sum, i) => sum + ((i.weight || 0.3) * i.quantity), 0)
        const customSubtotal = customItems.reduce((sum, i) => sum + (i.price * i.quantity), 0)

        customCost = zoneConfig.base + (Math.ceil(totalWeight) * zoneConfig.perKg)
        customDays = zoneConfig.days

        // Apply free shipping threshold
        if (customSubtotal >= FREE_SHIPPING_ABOVE) {
          customCost = 0
        }
      }

      // Calculate uma_penca items shipping (estimate)
      const umaPencaItems = sanitizedItems.filter(i => i.fulfillment_type === 'uma penca')
      let umaPencaCost: number | null = null
      let umaPencaDays: string | null = null

      if (umaPencaItems.length > 0) {
        const totalWeight = umaPencaItems.reduce((sum, i) => sum + ((i.weight || 0.2) * i.quantity), 0)
        umaPencaCost = zoneConfig.base + (Math.ceil(totalWeight) * zoneConfig.perKg)
        umaPencaDays = zoneConfig.days
      }

      return new Response(
        JSON.stringify({
          data: {
            own: { cost: customCost, days: customDays },
            uma_penca: { cost: umaPencaCost, days: umaPencaDays, note: 'Calculated by Uma Penca' },
            digital: { cost: 0, days: null, note: 'Immediate digital delivery' },
            _metadata: { state, zone }
          }
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // GET /storefront-shipping/state?cep=
    // ============================================
    if (req.method === 'GET' && action === 'state') {
      const cep = url.searchParams.get('cep')

      if (!cep) {
        return new Response(
          JSON.stringify({ error: 'cep parameter is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Try RPC first
      const { data: rpcState, error: rpcError } = await supabase.rpc('get_state_from_cep', { cep }).catch(() => ({ data: null, error: null }))

      if (rpcState && !rpcError) {
        return new Response(
          JSON.stringify({ state: rpcState }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Fallback to local calculation
      const state = getStateFromCEP(cep)
      const zone = state ? getZoneFromState(state) : null

      return new Response(
        JSON.stringify({ state, zone }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('storefront-shipping error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
