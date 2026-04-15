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
import { jwtVerify } from 'https://esm.sh/jose@5.2.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWT_SECRET = Deno.env.get('JWT_SECRET') || SUPABASE_SERVICE_ROLE_KEY

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

  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'collections'
  const id = url.searchParams.get('id')

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
          table = 'collection_summary'
          order = 'sort_order'
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
        .insert(body)
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
        .update({ ...body, updated_at: new Date().toISOString() })
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
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
