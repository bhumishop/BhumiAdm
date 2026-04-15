/**
 * Supabase Edge Function: storefront-auth
 *
 * Secure session verification for the BhumiShop storefront.
 * Proxies Supabase Auth operations to avoid exposing anon key patterns.
 *
 * Endpoints:
 *   POST   /storefront-auth/verify-session   - Verify current session
 *   POST   /storefront-auth/get-user         - Get current user profile
 *   POST   /storefront-auth/sign-out         - Sign out user
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
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Extract and verify Supabase Auth token from request body.
 * The client sends the session token in the request body (not header)
 * to avoid relying on browser-stored tokens.
 */
async function verifySessionToken(token: string): Promise<{ user: Record<string, unknown> | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      return { user: null, error: error?.message || 'Invalid token' }
    }

    // Return sanitized user profile (no sensitive data)
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        email_confirmed_at: data.user.email_confirmed_at,
        user_metadata: data.user.user_metadata || {},
        app_metadata: { provider: data.user.app_metadata?.provider },
      },
      error: null,
    }
  } catch (err) {
    return { user: null, error: err.message || 'Session verification failed' }
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

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const action = pathParts[pathParts.length - 1]

  try {
    const body = await req.json()

    // ============================================
    // POST /storefront-auth/verify-session
    // ============================================
    if (action === 'verify-session') {
      const { token } = body

      if (!token) {
        return new Response(
          JSON.stringify({ authenticated: false, user: null }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { user, error } = await verifySessionToken(token)

      if (error || !user) {
        return new Response(
          JSON.stringify({ authenticated: false, user: null, error }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ authenticated: true, user }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // POST /storefront-auth/get-user
    // ============================================
    if (action === 'get-user') {
      const { token } = body

      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Session token required' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { user, error } = await verifySessionToken(token)

      if (error || !user) {
        return new Response(
          JSON.stringify({ error: 'Not authenticated' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Fetch additional user data from user_roles table if exists
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()
        .catch(() => ({ data: null }))

      return new Response(
        JSON.stringify({
          user: {
            ...user,
            role: roleData?.role || 'customer',
          }
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // POST /storefront-auth/sign-out
    // ============================================
    if (action === 'sign-out') {
      const { token } = body

      if (token) {
        // Revoke the session via Supabase
        await supabase.auth.admin.signOut(token).catch(() => {})
      }

      return new Response(
        JSON.stringify({ message: 'Signed out successfully' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('storefront-auth error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
