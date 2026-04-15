/**
 * Supabase Edge Function: manage-integrations
 *
 * Server-side third-party integrations management.
 *
 * Endpoints:
 *   GET    /manage-integrations/sync-log - List sync logs
 *   POST   /manage-integrations/trigger-sync - Trigger sync
 *   GET    /manage-integrations/mappings - List product mappings
 *   GET    /manage-integrations/webhooks - List webhook events
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  if (!await verifyAdmin(req)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const action = pathParts[pathParts.length - 1]

  try {
    // GET /manage-integrations/sync-log
    if (req.method === 'GET' && action === 'sync-log') {
      const params = url.searchParams
      const source = params.get('source')
      const limit = parseInt(params.get('limit') || '50', 10)

      let query = supabase
        .from('third_party_sync_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit)

      if (source) {
        query = query.eq('source', source)
      }

      const { data, error } = await query
      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST /manage-integrations/trigger-sync
    if (req.method === 'POST' && action === 'trigger-sync') {
      const body = await req.json()
      const { source, sync_type, triggered_by } = body

      if (!source || !sync_type) {
        return new Response(
          JSON.stringify({ error: 'source and sync_type are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Create sync log entry
      const { data, error } = await supabase
        .from('third_party_sync_log')
        .insert({
          source,
          sync_type,
          status: 'running',
          triggered_by: triggered_by || 'manual',
          started_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      // Note: Actual sync would be triggered here via webhook or queue
      // For now, we just log the request

      return new Response(
        JSON.stringify({ data, message: 'Sync triggered' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /manage-integrations/mappings
    if (req.method === 'GET' && action === 'mappings') {
      const params = url.searchParams
      const source = params.get('source')
      const status = params.get('status')
      const limit = parseInt(params.get('limit') || '100', 10)

      let query = supabase
        .from('third_party_product_mapping')
        .select('*, products(name, slug)')
        .order('last_synced_at', { ascending: false })
        .limit(limit)

      if (source) {
        query = query.eq('source', source)
      }
      if (status) {
        query = query.eq('sync_status', status)
      }

      const { data, error } = await query
      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /manage-integrations/webhooks
    if (req.method === 'GET' && action === 'webhooks') {
      const params = url.searchParams
      const source = params.get('source')
      const status = params.get('status')
      const limit = parseInt(params.get('limit') || '100', 10)

      let query = supabase
        .from('webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (source) {
        query = query.eq('source', source)
      }
      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query
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
    console.error('manage-integrations error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
