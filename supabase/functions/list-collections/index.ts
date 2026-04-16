/**
 * Supabase Edge Function: list-collections
 *
 * Server-side collection, subcollection, and category management.
 *
 * Endpoints:
 *   GET    /list-collections?type=collections - List collections
 *   GET    /list-collections?type=subcollections - List subcollections
 *   GET    /list-collections?type=categories - List categories
 *   POST   /list-collections - Create collection/subcollection/category
 *   PUT    /list-collections/{id} - Update
 *   DELETE /list-collections/{id} - Delete
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting for write operations
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 50
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

// Input sanitization
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[<>'"&]/g, '').trim()
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
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
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

  const isRead = req.method === 'GET'
  if (!isRead && !await verifyAdmin(req)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  // Rate limit write operations
  if (!isRead) {
    const clientIP = getClientIP(req)
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
        { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }
  }

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const action = pathParts[pathParts.length - 1]
  // For GET without ID, type comes from query param; for mutations, type is the action
  const type = action === 'list-collections' ? (url.searchParams.get('type') || 'collections') : action
  const id = url.searchParams.get('id')

  // Validate type parameter
  const validTypes = ['collections', 'subcollections', 'categories']
  if (!validTypes.includes(type)) {
    return new Response(
      JSON.stringify({ error: 'Invalid type. Must be: collections, subcollections, or categories' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // GET operations
    if (req.method === 'GET') {
      let table: string
      let order = 'sort_order'

      switch (type) {
        case 'subcollections':
          table = 'subcollections'
          break
        case 'categories':
          table = 'categories'
          break
        default:
          table = 'collections'
      }

      let query = supabase.from(table).select('*').order(order, { ascending: true })

      if (id) {
        query = query.eq('id', id).single()
      } else if (type === 'collections') {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query
      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST operations - Create
    if (req.method === 'POST') {
      const body = await req.json()

      // Validate required fields based on type
      if (type === 'collections' && (!body.name || !body.slug)) {
        return new Response(
          JSON.stringify({ error: 'name and slug are required for collections' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Sanitize string inputs
      const sanitizedBody: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(body)) {
        sanitizedBody[key] = typeof value === 'string' ? sanitizeString(value) : value
      }

      let table: string
      switch (type) {
        case 'subcollections':
          table = 'subcollections'
          break
        case 'categories':
          table = 'categories'
          break
        default:
          table = 'collections'
      }

      const { data, error } = await supabase
        .from(table)
        .insert(sanitizedBody)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // PUT operations - Update
    if (req.method === 'PUT') {
      const body = await req.json()

      if (!id) {
        return new Response(
          JSON.stringify({ error: 'id is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Sanitize string inputs
      const sanitizedBody: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(body)) {
        if (key === 'updated_at') continue // Skip timestamp
        sanitizedBody[key] = typeof value === 'string' ? sanitizeString(value) : value
      }
      sanitizedBody.updated_at = new Date().toISOString()

      let table: string
      switch (type) {
        case 'subcollections':
          table = 'subcollections'
          break
        case 'categories':
          table = 'categories'
          break
        default:
          table = 'collections'
      }

      const { data, error } = await supabase
        .from(table)
        .update(sanitizedBody)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE operations
    if (req.method === 'DELETE') {
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'id is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      let table: string
      switch (type) {
        case 'subcollections':
          table = 'subcollections'
          break
        case 'categories':
          table = 'categories'
          break
        default:
          table = 'collections'
      }

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)

      if (error) throw error

      return new Response(
        JSON.stringify({ message: 'Deleted successfully' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('list-collections error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
