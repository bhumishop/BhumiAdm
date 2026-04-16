/**
 * Supabase Edge Function: uma-penca-shipping
 *
 * Calculates shipping rates for UmaPenca products.
 * Supports TWO modes:
 *
 * Mode 1: Exact rates (requires user's UmaPenca session)
 *   - User must be logged into UmaPenca
 *   - API key extracted from user's session cookies/headers
 *   - Returns real carrier rates from UmaPenca API
 *
 * Mode 2: Regional estimate (fallback, no login required)
 *   - Uses region-based pricing from database
 *   - Returns estimated shipping cost by Brazilian region
 *   - Shows disclaimer that exact price requires login
 *
 * Usage:
 *   POST /uma-penca-shipping/calculate
 *   {
 *     cep: "12313-131",           // Brazilian CEP
 *     country: "BR",              // Country code
 *     cart_id: "4911900",         // UmaPenca cart ID (optional, for exact rates)
 *     api_key: "abc123...",       // UmaPenca API key from user session (optional)
 *     items: [{ id, qty, weight }] // For fallback calculation
 *   }
 *
 * Response:
 *   {
 *     mode: "exact" | "estimate",
 *     carriers: [...],            // For exact mode
 *     estimated_cost: 15.90,      // For estimate mode
 *     estimated_days: "3-5",
 *     region: "southeast",
 *     requires_login: false
 *   }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const UMA_PENCA_API_URL = 'https://arcoiro.chicorei.com/umapenca/carriers'
const DEFAULT_GROUP = 1

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Brazilian shipping zones (fallback when no API key)
const SHIPPING_ZONES: Record<string, { states: string[]; base: number; perKg: number; days: string }> = {
  'southeast': { states: ['SP', 'RJ', 'MG', 'ES'], base: 15.90, perKg: 3.50, days: '3-5' },
  'south': { states: ['PR', 'SC', 'RS'], base: 18.90, perKg: 4.50, days: '4-6' },
  'northeast': { states: ['BA', 'SE', 'AL', 'PE', 'PB', 'RN', 'CE', 'PI', 'MA'], base: 28.90, perKg: 6.90, days: '6-10' },
  'north': { states: ['PA', 'AM', 'RR', 'AP', 'TO', 'RO', 'AC'], base: 35.90, perKg: 8.90, days: '8-14' },
  'midwest': { states: ['GO', 'MT', 'MS', 'DF'], base: 22.90, perKg: 5.50, days: '5-8' },
}

// CEP to state mapping
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

function getZoneFromState(state: string): string | null {
  for (const [zone, config] of Object.entries(SHIPPING_ZONES)) {
    if (config.states.includes(state)) return zone
  }
  return null
}

function corsHeaders(origin?: string) {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)
  const allowOrigin = allowedOrigins.includes(origin || '') ? origin : (allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

// Rate limiting
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 60
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
  return req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip')
    || 'unknown'
}

/**
 * Mode 1: Get exact shipping rates from UmaPenca API
 * Requires: api_key and cart_id from logged-in user
 */
async function getExactRates(cartId: string, cep: string, countryId: number, apiKey: string) {
  const params = new URLSearchParams({
    cart: String(cartId),
    pais: String(countryId),
    defaultGroup: String(DEFAULT_GROUP),
  })

  if (cep && countryId === 245) {
    params.set('cep', cep.replace(/\D/g, ''))
  }

  const url = `${UMA_PENCA_API_URL}?${params.toString()}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'cr-api-auth': apiKey,
    },
  })

  if (!response.ok) {
    throw new Error(`UmaPenca API error: ${response.status}`)
  }

  const result = await response.json()
  const carriers = result?.data?.responses || result?.responses || []

  return {
    mode: 'exact',
    requires_login: false,
    carriers: carriers.map((carrier: any) => ({
      id: carrier.id,
      name: carrier.name,
      price: parseFloat(carrier.price || '0'),
      price_real: carrier.price_real || '0.00',
      weight: carrier.weight || 0,
      delivery_time: carrier.delivery_time || null,
    })),
  }
}

/**
 * Mode 2: Estimate shipping by region (fallback)
 * No login required, uses CEP to determine region
 */
function estimateByRegion(cep: string, items: Array<{ weight?: number; qty?: number }> = []) {
  const state = getStateFromCEP(cep)

  if (!state) {
    return {
      mode: 'estimate',
      requires_login: true,
      error: 'Invalid CEP. Please login for accurate shipping calculation.',
      message: 'Login required for exact shipping price',
    }
  }

  const zone = getZoneFromState(state)
  if (!zone) {
    return {
      mode: 'estimate',
      requires_login: true,
      error: 'Unsupported region',
      message: 'Login required for shipping calculation',
    }
  }

  const zoneConfig = SHIPPING_ZONES[zone]

  // Calculate estimated cost based on items
  const totalWeight = items.reduce((sum, item) => {
    return sum + ((item.weight || 0.3) * (item.qty || 1))
  }, 0)

  const estimatedCost = zoneConfig.base + (Math.ceil(totalWeight) * zoneConfig.perKg)

  return {
    mode: 'estimate',
    requires_login: false,
    estimated_cost: estimatedCost,
    estimated_days: zoneConfig.days,
    region: zone,
    state,
    message: `Estimated shipping to ${zone} region. Login for exact price.`,
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  // Rate limit
  const clientIP = getClientIP(req)
  if (!checkRateLimit(clientIP)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = await req.json()
    const { cep, country = 'BR', cart_id, api_key, items = [] } = body

    // Determine country ID
    const countryIds: Record<string, number> = { 'BR': 245, 'AR': 41, 'US': 243 }
    const countryId = countryIds[country] || 245

    // Mode 1: Exact rates (user logged in with API key)
    if (api_key && cart_id) {
      try {
        const exactRates = await getExactRates(cart_id, cep, countryId, api_key)
        return new Response(
          JSON.stringify(exactRates),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      } catch (error) {
        console.warn('Exact rate calculation failed, falling back to estimate:', error.message)
        // Fall through to Mode 2
      }
    }

    // Mode 2: Regional estimate (no login required)
    const estimate = estimateByRegion(cep, items)

    return new Response(
      JSON.stringify(estimate),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('uma-penca-shipping error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
