/**
 * Supabase Edge Function: admin-auth
 *
 * Centralized authentication middleware for all admin operations.
 * This is the ONLY function that reads the admin_users table.
 * All other admin functions delegate authentication to this function.
 *
 * Endpoints:
 *   POST /admin-auth/login        - Login with Google OAuth ID token
 *   POST /admin-auth/verify       - Verify admin session (called by other functions)
 *   POST /admin-auth/refresh      - Refresh session token
 *   DELETE /admin-auth            - Sign out
 *   GET  /admin-auth/me           - Get current admin info
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { SignJWT, jwtVerify } from 'https://esm.sh/jose@5.2.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWT_SECRET = Deno.env.get('JWT_SECRET') || SUPABASE_SERVICE_ROLE_KEY
const SESSION_TTL = parseInt(Deno.env.get('SESSION_TTL') || '14400', 10) // 4 hours

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting for login attempts
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 20
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
  return req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip')
    || 'unknown'
}

// Google JWKS for verifying ID tokens
const googleJWKS = (await import('https://esm.sh/jose@5.2.0')).createRemoteJWKSet(
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
 * Generate a session JWT for an admin
 */
async function generateSessionToken(admin: { admin_uuid: string; email: string; role: string }): Promise<string> {
  return new SignJWT({
    admin_uuid: admin.admin_uuid,
    email: admin.email,
    role: admin.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(new TextEncoder().encode(JWT_SECRET))
}

/**
 * Verify a session JWT - returns payload without database query
 * This is fast and used by all admin functions
 */
async function verifyToken(token: string): Promise<{ admin_uuid: string; email: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET),
      { algorithms: ['HS256'] }
    )
    return payload as { admin_uuid: string; email: string; role: string }
  } catch {
    return null
  }
}

/**
 * Verify Google ID token and look up/create admin in database
 * This is the ONLY place that reads admin_users table for login
 */
async function loginWithGoogle(idToken: string): Promise<{ token: string; admin: Record<string, unknown> } | { error: string; status: number }> {
  // Verify Google token
  let googlePayload: Record<string, unknown>
  try {
    const { jwtVerify } = await import('https://esm.sh/jose@5.2.0')
    const result = await jwtVerify(idToken, googleJWKS, {
      algorithms: ['RS256'],
      audience: Deno.env.get('GOOGLE_CLIENT_ID'),
    })
    googlePayload = result.payload as Record<string, unknown>
  } catch (error) {
    console.error('Google token verification failed:', error)
    return { error: 'Invalid Google token', status: 401 }
  }

  const email = (googlePayload.email as string)?.toLowerCase()
  const name = googlePayload.name as string
  const googleSub = googlePayload.sub as string

  if (!email) {
    return { error: 'Email não fornecido pelo Google', status: 400 }
  }

  // Check allowed emails
  const allowedEmails = (Deno.env.get('ADMIN_ALLOWED_EMAILS') || '').split(',').filter(Boolean).map(e => e.trim().toLowerCase())
  if (allowedEmails.length === 0) {
    console.error('ADMIN_ALLOWED_EMAILS not configured - denying all access')
    return { error: 'Acesso negado: configuração inválida', status: 500 }
  }
  if (!allowedEmails.includes(email)) {
    return { error: 'Acesso negado: conta nao autorizada', status: 403 }
  }

  // Look up or create admin in admin_users table
  const { data: existingAdmin } = await supabase
    .from('admin_users')
    .select('admin_uuid, google_sub, email, name, role')
    .eq('email', email)
    .single()

  let adminRecord: Record<string, unknown>

  if (!existingAdmin) {
    // Create new admin
    const { data: newAdmin, error: insertError } = await supabase
      .from('admin_users')
      .insert({ google_sub: googleSub, email, name, last_login: new Date().toISOString() })
      .select('admin_uuid, google_sub, email, name, role')
      .single()

    if (insertError || !newAdmin) {
      console.error('Failed to create admin user:', insertError)
      return { error: 'Erro ao criar registro de admin', status: 500 }
    }
    adminRecord = newAdmin
  } else {
    // Update existing admin
    const { data: updatedAdmin } = await supabase
      .from('admin_users')
      .update({ last_login: new Date().toISOString(), name, google_sub: googleSub })
      .eq('email', email)
      .select('admin_uuid, google_sub, email, name, role')
      .single()

    adminRecord = updatedAdmin || existingAdmin
  }

  // Generate session token
  const sessionToken = await generateSessionToken({
    admin_uuid: adminRecord.admin_uuid,
    email: adminRecord.email,
    role: adminRecord.role || 'admin',
  })

  return {
    token: sessionToken,
    admin: {
      admin_uuid: adminRecord.admin_uuid,
      email: adminRecord.email,
      name: adminRecord.name,
      role: adminRecord.role || 'admin',
    },
  }
}

/**
 * Verify admin token - called by other edge functions internally
 * Checks token validity AND queries admin_users to confirm admin still exists
 */
async function verifyAdmin(token: string): Promise<{ valid: boolean; admin?: Record<string, unknown>; error?: string }> {
  // First verify the JWT signature
  const payload = await verifyToken(token)
  if (!payload) {
    return { valid: false, error: 'Invalid or expired token' }
  }

  // Then query admin_users to confirm admin still exists and is active
  const { data: admin, error } = await supabase
    .from('admin_users')
    .select('admin_uuid, email, name, role')
    .eq('admin_uuid', payload.admin_uuid)
    .single()

  if (error || !admin) {
    return { valid: false, error: 'Admin not found' }
  }

  return {
    valid: true,
    admin: {
      admin_uuid: admin.admin_uuid,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    },
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  const url = new URL(req.url)
  const path = url.pathname.split('/').pop() || 'admin-auth'

  try {
    // ============================================
    // POST /admin-auth/login - Google OAuth login
    // ============================================
    if (req.method === 'POST' && path === 'login') {
      const clientIP = getClientIP(req)
      if (!checkRateLimit(clientIP)) {
        return new Response(
          JSON.stringify({ error: 'Too many login attempts. Try again later.' }),
          { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const body = await req.json()
      const { idToken } = body

      if (!idToken) {
        return new Response(
          JSON.stringify({ error: 'idToken is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const result = await loginWithGoogle(idToken)

      if ('error' in result) {
        return new Response(
          JSON.stringify({ error: result.error }),
          { status: result.status, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // ============================================
    // POST /admin-auth/verify - Verify admin (used by other functions)
    // ============================================
    if (req.method === 'POST' && path === 'verify') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ valid: false, error: 'No token provided' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const token = authHeader.substring(7)
      const result = await verifyAdmin(token)

      return new Response(JSON.stringify(result), {
        status: result.valid ? 200 : 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // ============================================
    // POST /admin-auth/refresh - Refresh session
    // ============================================
    if (req.method === 'POST' && path === 'refresh') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'No token provided' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const token = authHeader.substring(7)
      const result = await verifyAdmin(token)

      if (!result.valid) {
        return new Response(
          JSON.stringify({ error: result.error }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const newToken = await generateSessionToken(result.admin as { admin_uuid: string; email: string; role: string })

      return new Response(
        JSON.stringify({ token: newToken, admin: result.admin }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // GET /admin-auth/me - Get current admin info
    // ============================================
    if (req.method === 'GET' && path === 'me') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const token = authHeader.substring(7)
      const result = await verifyAdmin(token)

      if (!result.valid) {
        return new Response(
          JSON.stringify({ error: result.error }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ admin: result.admin }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // Legacy: POST /admin-auth (for backwards compatibility)
    // ============================================
    if (req.method === 'POST' && path === 'admin-auth') {
      const body = await req.json()
      const { googleToken, action } = body

      // Verify action
      if (action === 'verify' && googleToken) {
        const result = await verifyAdmin(googleToken)
        return new Response(JSON.stringify(result), {
          status: result.valid ? 200 : 401,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      // Refresh action
      if (action === 'refresh' && googleToken) {
        const result = await verifyAdmin(googleToken)
        if (!result.valid) {
          return new Response(
            JSON.stringify({ error: result.error }),
            { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
        const newToken = await generateSessionToken(result.admin as { admin_uuid: string; email: string; role: string })
        return new Response(
          JSON.stringify({ token: newToken }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Login with googleToken (idToken)
      if (googleToken) {
        const result = await loginWithGoogle(googleToken)
        if ('error' in result) {
          return new Response(
            JSON.stringify({ error: result.error }),
            { status: result.status, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      return new Response(
        JSON.stringify({ error: 'googleToken is required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // DELETE /admin-auth - Sign out
    // ============================================
    if (req.method === 'DELETE' && (path === 'admin-auth' || path === 'logout')) {
      return new Response(
        JSON.stringify({ message: 'Signed out successfully' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // Not found
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
