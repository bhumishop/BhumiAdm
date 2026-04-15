/**
 * Supabase Edge Function: track-analytics
 *
 * Records customer analytics events from the BhumiShop storefront.
 * Public endpoint with rate limiting - no authentication required.
 *
 * Endpoints:
 *   POST /track-analytics/view - Record product view
 *   POST /track-analytics/search - Record search query
 *   POST /track-analytics/cart-add - Record cart addition
 *   POST /track-analytics/cart-remove - Record cart removal
 *   POST /track-analytics/checkout-start - Record checkout begin
 *   GET  /track-analytics/session - Get session tracking config
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting - stricter for analytics
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 200 // events per minute per IP
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

function sanitizeString(str: string): string {
  if (typeof str !== 'string') return ''
  // Strip dangerous chars and limit length to prevent DB bloat
  return str.replace(/[<>'"&]/g, '').trim().substring(0, 255)
}

function isValidProductId(id: unknown): boolean {
  return typeof id === 'number' && id > 0
}

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  // Rate limit all analytics events
  const clientIP = getClientIP(req)
  if (!checkRateLimit(clientIP)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded' }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const action = pathParts[pathParts.length - 1]

  try {
    // GET /track-analytics/session - Get tracking config
    if (req.method === 'GET' && action === 'session') {
      return new Response(
        JSON.stringify({
          data: {
            enabled: true,
            events: ['view', 'search', 'cart-add', 'cart-remove', 'checkout-start'],
            batch_size: 10,
            flush_interval_ms: 5000,
          }
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST events
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()

    switch (action) {
      case 'view': {
        if (!isValidProductId(body.product_id)) {
          return new Response(
            JSON.stringify({ error: 'Valid product_id is required' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        // Record in product_analytics table
        const { error } = await supabase
          .from('product_analytics')
          .insert({
            product_id: body.product_id,
            event_type: 'view',
            session_id: sanitizeString(body.session_id || ''),
            user_id: typeof body.user_id === 'string' ? body.user_id.substring(0, 100) : null,
            referrer: body.referrer ? sanitizeString(body.referrer) : null,
            count: 1,
          })

        if (error) {
          console.error('Failed to record product view:', error)
        }

        return new Response(
          JSON.stringify({ received: true }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      case 'search': {
        if (!body.query || typeof body.query !== 'string') {
          return new Response(
            JSON.stringify({ error: 'Search query is required' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        const { error } = await supabase
          .from('search_analytics')
          .insert({
            query: sanitizeString(body.query),
            results_count: body.results_count || 0,
            session_id: sanitizeString(body.session_id || ''),
            user_id: typeof body.user_id === 'string' ? body.user_id.substring(0, 100) : null,
            category_filter: body.category ? sanitizeString(body.category) : null,
          })
          .catch(() => null) // Table might not exist yet

        return new Response(
          JSON.stringify({ received: true }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      case 'cart-add': {
        if (!isValidProductId(body.product_id)) {
          return new Response(
            JSON.stringify({ error: 'Valid product_id is required' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        const { error } = await supabase
          .from('product_analytics')
          .insert({
            product_id: body.product_id,
            event_type: 'cart_add',
            session_id: sanitizeString(body.session_id || ''),
            user_id: typeof body.user_id === 'string' ? body.user_id.substring(0, 100) : null,
            count: 1,
            metadata: body.quantity ? { quantity: body.quantity } : null,
          })

        if (error) {
          console.error('Failed to record cart-add:', error)
        }

        return new Response(
          JSON.stringify({ received: true }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      case 'cart-remove': {
        if (!isValidProductId(body.product_id)) {
          return new Response(
            JSON.stringify({ error: 'Valid product_id is required' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        const { error } = await supabase
          .from('product_analytics')
          .insert({
            product_id: body.product_id,
            event_type: 'cart_remove',
            session_id: sanitizeString(body.session_id || ''),
            user_id: typeof body.user_id === 'string' ? body.user_id.substring(0, 100) : null,
            count: 1,
          })

        if (error) {
          console.error('Failed to record cart-remove:', error)
        }

        return new Response(
          JSON.stringify({ received: true }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      case 'checkout-start': {
        if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Items array is required' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }

        const total = body.items.reduce((sum: number, item: { price: number; quantity: number }) => {
          return sum + (item.price || 0) * (item.quantity || 1)
        }, 0)

        const { error } = await supabase
          .from('checkout_analytics')
          .insert({
            session_id: sanitizeString(body.session_id || ''),
            user_id: typeof body.user_id === 'string' ? body.user_id.substring(0, 100) : null,
            items_count: body.items.length,
            total,
            payment_method: body.payment_method ? sanitizeString(body.payment_method) : null,
          })
          .catch(() => null) // Table might not exist yet

        return new Response(
          JSON.stringify({ received: true }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown event type' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('track-analytics error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
