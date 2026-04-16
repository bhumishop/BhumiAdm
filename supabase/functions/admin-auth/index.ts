/**
 * Supabase Edge Function: admin-auth
 *
 * Server-side admin authentication and authorization.
 * Validates Google OAuth tokens and checks admin emails against allowlist.
 * Uses UUID as the primary admin identifier for session management.
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
const ADMIN_ALLOWED_EMAILS = Deno.env.get('ADMIN_ALLOWED_EMAILS') || '' // Comma-separated allowed admin emails
const JWT_SECRET = Deno.env.get('JWT_SECRET') || SUPABASE_SERVICE_ROLE_KEY // For session tokens
const SESSION_TTL = parseInt(Deno.env.get('SESSION_TTL') || '14400', 10) // 4 hours default (reduced from 24h)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting: max 20 login attempts per IP per minute
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 20
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

// Higher rate limit for GET/DELETE (session verification)
const RATE_LIMIT_GENERAL_MAX = 200
function checkRateLimitGeneral(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(ip)

  if (!record || now > record.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT_GENERAL_MAX) {
    return false
  }

  record.count++
  return true
}

function getClientIP(req: Request): string {
  // Prefer x-real-ip from trusted proxy, never trust x-forwarded-for from untrusted sources
  // In production, configure your reverse proxy to set x-real-ip correctly
  return req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip') // Cloudflare
    || 'unknown'
}

// Google's public keys for verifying ID tokens
const googleJWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
)

function corsHeaders(origin?: string): Record<string, string> {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)
  const allowOrigin = allowedOrigins.includes(origin || '') ? origin : (allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin ?? '*',
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
    admin_uuid: admin.admin_uuid,
    email: admin.email,
    role: admin.role || 'admin',
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
 * Check if email is in admin allowlist
 */
function isAllowedEmail(email: string): boolean {
  const allowedEmails = ADMIN_ALLOWED_EMAILS.split(',').filter(Boolean).map(e => e.trim().toLowerCase())
  if (allowedEmails.length === 0) {
    console.error('ADMIN_ALLOWED_EMAILS not configured - denying all access')
    return false // Deny by default - never allow unconfigured access
  }
  return allowedEmails.includes(email.toLowerCase())
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

  // Rate limit all requests (stricter for login, lighter for verification)
  const clientIP = getClientIP(req)
  if (req.method === 'POST') {
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ error: 'Too many login attempts. Try again later.' }),
        { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }
  } else if (req.method === 'GET' || req.method === 'DELETE') {
    // Higher limit for verification/sign-out
    if (!checkRateLimitGeneral(clientIP)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
        { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }
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
          JSON.stringify({ valid: true, admin: { admin_uuid: admin.admin_uuid, email: admin.email, role: admin.role, name: admin.name, nome: admin.name } }),
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
      const email = (googlePayload.email as string)?.toLowerCase()
      const name = googlePayload.name as string

      if (!email) {
        return new Response(
          JSON.stringify({ error: 'Email não fornecido pelo Google' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Check if user email is allowed
      if (!isAllowedEmail(email)) {
        return new Response(
          JSON.stringify({ error: 'Acesso negado: conta nao autorizada' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Look up or create admin user by email (UUID-based identification)
      const { data: existingAdmin, error: lookupError } = await supabase
        .from('admin_users')
        .select('admin_uuid, google_sub, email, name, role')
        .eq('email', email)
        .single()

      let adminRecord: Record<string, unknown>

      if (lookupError || !existingAdmin) {
        // First login for this email - create new admin record with UUID
        const { data: newAdmin, error: insertError } = await supabase
          .from('admin_users')
          .insert({
            google_sub: googleSub,
            email,
            name,
            last_login: new Date().toISOString(),
          })
          .select('admin_uuid, google_sub, email, name, role')
          .single()

        if (insertError || !newAdmin) {
          console.error('Failed to create admin user:', insertError)
          return new Response(
            JSON.stringify({ error: 'Erro ao criar registro de admin' }),
            { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
        adminRecord = newAdmin
      } else {
        // Existing admin - update last_login and ensure google_sub is current
        const { data: updatedAdmin, error: updateError } = await supabase
          .from('admin_users')
          .update({
            last_login: new Date().toISOString(),
            name,
            google_sub: googleSub, // Update in case they changed Google account
          })
          .eq('email', email)
          .select('admin_uuid, google_sub, email, name, role')
          .single()

        if (updateError || !updatedAdmin) {
          console.error('Failed to update admin user:', updateError)
          // Still allow login with existing data
          adminRecord = existingAdmin
        } else {
          adminRecord = updatedAdmin
        }
      }

      // Generate session token with UUID
      const sessionToken = await generateSessionToken({
        admin_uuid: adminRecord.admin_uuid,
        email: adminRecord.email,
        role: adminRecord.role || 'admin',
      })

      return new Response(
        JSON.stringify({
          token: sessionToken,
          admin: {
            admin_uuid: adminRecord.admin_uuid,
            email: adminRecord.email,
            name: adminRecord.name,
            nome: adminRecord.name, // Alias for backwards compatibility
            role: adminRecord.role || 'admin',
          },
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
