/**
 * Supabase Edge Function: admin-auth
 *
 * Server-side admin authentication and authorization.
 * Validates Google OAuth tokens and checks admin UUIDs stored as secrets.
 * Returns a short-lived session token for subsequent API calls.
 *
 * Endpoints:
 *   POST /admin-auth - Validate Google token and get session
 *   GET  /admin-auth/verify - Verify session token
 *   POST /admin-auth/refresh - Refresh session token
 *   DELETE /admin-auth - Sign out (invalidate session)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { createRemoteJWKSet, jwtVerify } from 'https://esm.sh/jose@5.2.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ADMIN_GOOGLE_SUBS = Deno.env.get('ADMIN_GOOGLE_SUBS') || '' // Comma-separated Google sub values
const JWT_SECRET = Deno.env.get('JWT_SECRET') || SUPABASE_SERVICE_ROLE_KEY // For session tokens
const SESSION_TTL = parseInt(Deno.env.get('SESSION_TTL') || '86400', 10) // 24 hours default

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Google's public keys for verifying ID tokens
const googleJWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
)

function corsHeaders(origin?: string) {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)
  const allowOrigin = allowedOrigins.includes(origin || '') ? origin : (allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Generate a short-lived session JWT for admin
 */
async function generateSessionToken(admin: Record<string, unknown>): Promise<string> {
  const { SignJWT } = await import('https://esm.sh/jose@5.2.0')

  const token = await new SignJWT({
    admin_id: admin.google_sub,
    email: admin.email,
    role: 'admin',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(new TextEncoder().encode(JWT_SECRET))

  return token
}

/**
 * Verify a session token and return admin data
 */
async function verifySessionToken(token: string): Promise<Record<string, unknown> | null> {
  const { jwtVerify } = await import('https://esm.sh/jose@5.2.0')

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET),
      { algorithms: ['HS256'] }
    )
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Check if Google sub is in admin allowlist
 */
function isAdminSub(googleSub: string): boolean {
  const allowedSubs = ADMIN_GOOGLE_SUBS.split(',').filter(Boolean)
  if (allowedSubs.length === 0) return true // Setup mode - allow all
  return allowedSubs.includes(googleSub)
}

/**
 * Verify Google ID token with Google's servers
 */
async function verifyGoogleIdToken(idToken: string): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jwtVerify(idToken, googleJWKS, {
      algorithms: ['RS256'],
      audience: Deno.env.get('GOOGLE_CLIENT_ID'),
    })
    return payload as Record<string, unknown>
  } catch (error) {
    console.error('Google token verification failed:', error)
    return null
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined
  const cors = corsHeaders(origin)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  const url = new URL(req.url)
  const path = url.pathname.split('/').pop() || 'admin-auth'

  try {
    // ============================================
    // POST /admin-auth - Validate Google token and get session
    // ============================================
    if (req.method === 'POST' && path === 'admin-auth') {
      const body = await req.json()
      const { googleToken, action } = body

      if (action === 'verify' && googleToken) {
        // Verify existing session token
        const admin = await verifySessionToken(googleToken)
        if (!admin) {
          return new Response(
            JSON.stringify({ valid: false, error: 'Invalid or expired session' }),
            { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify({ valid: true, admin: { google_sub: admin.admin_id, email: admin.email, role: admin.role } }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'refresh' && googleToken) {
        // Refresh session token
        const admin = await verifySessionToken(googleToken)
        if (!admin) {
          return new Response(
            JSON.stringify({ error: 'Invalid session' }),
            { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
        const newToken = await generateSessionToken(admin as Record<string, unknown>)
        return new Response(
          JSON.stringify({ token: newToken }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      if (!googleToken) {
        return new Response(
          JSON.stringify({ error: 'googleToken is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Verify Google ID token
      const googlePayload = await verifyGoogleIdToken(googleToken)
      if (!googlePayload) {
        return new Response(
          JSON.stringify({ error: 'Invalid Google token' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const googleSub = googlePayload.sub as string
      const email = googlePayload.email as string
      const name = googlePayload.name as string

      // Check if user is admin
      if (!isAdminSub(googleSub)) {
        return new Response(
          JSON.stringify({ error: 'Acesso negado: conta nao autorizada' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Upsert admin in database
      const { error: upsertError } = await supabase
        .from('admin_users')
        .upsert({
          google_sub: googleSub,
          email,
          name,
          last_login: new Date().toISOString(),
        }, { onConflict: 'google_sub' })

      if (upsertError) {
        console.error('Failed to upsert admin user:', upsertError)
      }

      // Generate session token
      const sessionToken = await generateSessionToken({
        google_sub: googleSub,
        email,
        name,
      })

      return new Response(
        JSON.stringify({
          token: sessionToken,
          admin: { google_sub: googleSub, email, name },
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // DELETE /admin-auth - Sign out
    // ============================================
    if (req.method === 'DELETE' && path === 'admin-auth') {
      // Session tokens are stateless JWTs - client should discard token
      // Optionally: add token to blacklist in Redis/DB
      return new Response(
        JSON.stringify({ message: 'Signed out successfully' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // Unknown endpoint
    // ============================================
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('admin-auth error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
