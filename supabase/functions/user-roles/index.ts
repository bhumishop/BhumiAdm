/**
 * Supabase Edge Function: user-roles
 *
 * Server-side user role management.
 *
 * Endpoints:
 *   GET    /user-roles - List all user roles
 *   POST   /user-roles - Create user role assignment
 *   PUT    /user-roles/{id} - Update user role
 *   DELETE /user-roles/{id} - Delete user role
 *   GET    /user-roles/check/{userId} - Check user's roles
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const lastPart = pathParts[pathParts.length - 1]
  const isCheckPath = pathParts.includes('check')
  const isUUID = /^[0-9a-f-]{36}$/i.test(lastPart)

  try {
    // GET /user-roles - List all
    if (req.method === 'GET' && !isUUID && !isCheckPath) {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*, users(email, name)')
        .order('created_at', { ascending: false })

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /user-roles/check/{userId}
    if (req.method === 'GET' && isCheckPath) {
      const userId = lastPart

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)

      if (error) throw error

      return new Response(
        JSON.stringify({ data: { roles: data?.map(r => r.role) || [] } }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /user-roles/{id}
    if (req.method === 'GET' && isUUID) {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('id', lastPart)
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST /user-roles
    if (req.method === 'POST') {
      const body = await req.json()

      if (!body.user_id || !body.role) {
        return new Response(
          JSON.stringify({ error: 'user_id and role are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const validRoles = ['admin', 'staff', 'support', 'customer']
      if (!validRoles.includes(body.role)) {
        return new Response(
          JSON.stringify({ error: 'Invalid role' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Fix: Only insert whitelisted fields (prevent mass assignment)
      const { data, error } = await supabase
        .from('user_roles')
        .insert({ user_id: body.user_id, role: body.role })
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /user-roles/{id}
    if (req.method === 'PUT' && isUUID) {
      const body = await req.json()

      const validRoles = ['admin', 'staff', 'support', 'customer']
      if (body.role && !validRoles.includes(body.role)) {
        return new Response(
          JSON.stringify({ error: 'Invalid role' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Fix: Only update whitelisted fields (prevent mass assignment)
      const updates: Record<string, unknown> = {}
      if (body.role !== undefined) updates.role = body.role

      if (Object.keys(updates).length === 0) {
        return new Response(
          JSON.stringify({ error: 'No valid fields to update' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('user_roles')
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

    // DELETE /user-roles/{id}
    if (req.method === 'DELETE' && isUUID) {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', lastPart)

      if (error) throw error

      return new Response(
        JSON.stringify({ message: 'Role assignment deleted' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('user-roles error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
