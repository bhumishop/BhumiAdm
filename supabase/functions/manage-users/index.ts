/**
 * Supabase Edge Function: manage-users
 *
 * Server-side user and role management with admin authentication.
 *
 * Endpoints:
 *   GET    /manage-users - List all users with pagination
 *   GET    /manage-users/{id} - Get user profile + order history
 *   PUT    /manage-users/{id} - Update user details
 *   GET    /manage-users/{id}/roles - Get user roles
 *   POST   /manage-users/{id}/roles - Assign role
 *   DELETE /manage-users/{id}/roles/{role} - Remove role
 *   PUT    /manage-users/{id}/status - Activate/deactivate/ban user
 *   GET    /manage-users/check/{userId} - Check user role (for access control)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { jwtVerify } from 'https://esm.sh/jose@5.2.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWT_SECRET = Deno.env.get('JWT_SECRET') || SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 100
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

// Sanitize search input to prevent SQL injection via ilike
function sanitizeSearchInput(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[%;_]/g, '').trim()
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
  try {
    const { payload } = await jwtVerify(
      authHeader.substring(7),
      new TextEncoder().encode(JWT_SECRET),
      { algorithms: ['HS256'] }
    )
    return payload.role === 'admin'
  } catch {
    return false
  }
}

const MAX_PAGE_LIMIT = 200

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (!await verifyAdmin(req)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  const clientIP = getClientIP(req)
  if (!checkRateLimit(clientIP)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded' }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  // Path: /manage-users, /manage-users/{id}, /manage-users/{id}/roles, /manage-users/check/{userId}
  const lastPart = pathParts[pathParts.length - 1]
  const secondLast = pathParts[pathParts.length - 2]
  const isUUID = /^[0-9a-f-]{36}$/i.test(lastPart)
  const isCheckPath = pathParts.includes('check')

  try {
    // GET /manage-users - List users
    if (req.method === 'GET' && !isUUID && !isCheckPath) {
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
      const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)))
      const offset = (page - 1) * limit
      const search = sanitizeSearchInput(url.searchParams.get('search') || '')
      const role = url.searchParams.get('role')

      let query = supabase
        .from('users')
        .select('id, email, name, phone, created_at, last_sign_in_at, status', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (search) {
        query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`)
      }

      const { data, error, count } = await query
      if (error) throw error

      // Get roles for each user
      const userIds = data?.map(u => u.id) || []
      let roles: Record<string, unknown>[] = []
      if (userIds.length > 0) {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds)
        roles = rolesData || []
      }

      // Attach roles to users
      const usersWithRoles = data?.map(user => ({
        ...user,
        roles: roles.filter(r => r.user_id === user.id).map(r => r.role),
      })) || []

      return new Response(
        JSON.stringify({ data: usersWithRoles, count, page, limit }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /manage-users/check/{userId} - Check user role
    if (req.method === 'GET' && isCheckPath) {
      const userId = lastPart

      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)

      if (error) throw error

      return new Response(
        JSON.stringify({ data: { roles: roles?.map(r => r.role) || [] } }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /manage-users/{id}/roles - Get user roles
    if (req.method === 'GET' && isUUID && secondLast !== 'roles') {
      const userId = lastPart

      // Get user details
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError) throw userError

      // Get user's roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)

      // Get user's recent orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, status, payment_status, total, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      return new Response(
        JSON.stringify({ data: { ...user, roles, recent_orders: orders || [] } }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /manage-users/{id} - Get user (fallback for when id is not UUID but still GET)
    if (req.method === 'GET' && isUUID) {
      const userId = lastPart

      const { data: roles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)

      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, status, payment_status, total, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data: { ...user, roles, recent_orders: orders || [] } }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /manage-users/{id} - Update user
    if (req.method === 'PUT' && isUUID && secondLast !== 'roles' && secondLast !== 'status') {
      const body = await req.json()
      const userId = lastPart

      // Whitelist allowed fields to prevent mass assignment
      const allowedFields = ['name', 'phone']
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const key of allowedFields) {
        if (body[key] !== undefined) updates[key] = body[key]
      }

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST /manage-users/{id}/roles - Assign role
    if (req.method === 'POST' && secondLast === 'roles') {
      const body = await req.json()
      const userId = pathParts[pathParts.length - 3]

      if (!body.role) {
        return new Response(
          JSON.stringify({ error: 'role is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Validate role
      const validRoles = ['admin', 'staff', 'support', 'customer']
      if (!validRoles.includes(body.role)) {
        return new Response(
          JSON.stringify({ error: 'Invalid role' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Check if role already exists
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', body.role)
        .single()

      if (existing) {
        return new Response(
          JSON.stringify({ message: 'Role already assigned' }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: body.role })
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /manage-users/{id}/roles/{role} - Remove role
    if (req.method === 'DELETE' && secondLast === 'roles') {
      const role = lastPart
      const userId = pathParts[pathParts.length - 3]

      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role)

      if (error) throw error

      return new Response(
        JSON.stringify({ message: 'Role removed' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /manage-users/{id}/status - Activate/deactivate/ban
    if (req.method === 'PUT' && secondLast === 'status') {
      const body = await req.json()
      const userId = pathParts[pathParts.length - 3]

      if (!body.status || !['active', 'inactive', 'banned'].includes(body.status)) {
        return new Response(
          JSON.stringify({ error: 'Valid status required (active, inactive, banned)' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('users')
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('id', userId)
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
    console.error('manage-users error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
