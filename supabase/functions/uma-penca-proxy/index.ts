/**
 * Supabase Edge Function: uma-penca-proxy
 *
 * Secure proxy for Uma Penca checkout redirect.
 * Creates a signed, time-limited token instead of exposing cart data in URL.
 *
 * Endpoints:
 *   POST   /uma-penca-proxy/create-checkout-url - Create signed checkout URL
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { SignJWT } from 'https://esm.sh/jose@5.2.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWT_SECRET = Deno.env.get('JWT_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const UMA_PENCA_STORE_URL = Deno.env.get('UMA_PENCA_STORE_URL') || 'https://prataprint.bhumisparshaschool.org'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 30 // checkouts per minute
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
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

function sanitizeString(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[<>'"&]/g, '').trim()
}

/**
 * Create a signed JWT token containing the cart payload.
 * Token expires in 10 minutes to prevent replay attacks.
 */
async function createSignedCartToken(cartPayload: Record<string, unknown>[]): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET)

  return await new SignJWT({ cart: cartPayload, ref: 'bhumi-shop' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .setJti(crypto.randomUUID())
    .sign(secret)
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

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = await req.json()
    const { items } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'items array is required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Validate and sanitize items
    const MAX_QUANTITY = 99
    const sanitizedItems = items.map((item: Record<string, unknown>) => {
      const id = parseInt(String(item.id), 10)
      if (isNaN(id)) {
        throw new Error(`Invalid product id: ${item.id}`)
      }

      const qty = Math.min(Math.max(parseInt(String(item.quantity), 10) || 1, 1), MAX_QUANTITY)

      return {
        id,
        qty,
        size: item.size ? sanitizeString(String(item.size)) : null,
      }
    })

    // Create signed token
    const signedToken = await createSignedCartToken(sanitizedItems)

    // Log the checkout attempt for audit
    try {
      await supabase
        .from('checkout_redirects')
        .insert({
          redirect_type: 'uma_penca',
          items_count: sanitizedItems.length,
          token_jti: signedToken.split('.')[1], // Can't decode without secret, but log approximate
          created_at: new Date().toISOString(),
        })
        .catch(() => {}) // Table may not exist yet, don't fail
    } catch {
      // Silent fail for audit logging
    }

    // Build the checkout URL with signed token
    const checkoutUrl = `${UMA_PENCA_STORE_URL}/sacola/checkout?token=${signedToken}&ref=bhumi-shop`

    return new Response(
      JSON.stringify({
        url: checkoutUrl,
        expiresIn: '10m',
        itemCount: sanitizedItems.length,
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('uma-penca-proxy error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
