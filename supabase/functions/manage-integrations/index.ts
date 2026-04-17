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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function corsHeaders(origin?: string) {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)
  const allowOrigin = allowedOrigins.includes(origin || '') ? origin : (allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

function sanitizeString(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[<>'"&]/g, '').trim()
}

// Validate URL format
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
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

      // Validate against whitelists
      const validSources = ['shopify', 'woocommerce', 'mercadolibre', 'umapenca', 'abacatepay']
      const validSyncTypes = ['products', 'orders', 'inventory', 'pricing', 'full', 'incremental']
      const validTriggers = ['manual', 'scheduled', 'webhook', 'admin']
      if (!validSources.includes(source)) {
        return new Response(
          JSON.stringify({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }
      if (!validSyncTypes.includes(sync_type)) {
        return new Response(
          JSON.stringify({ error: `Invalid sync_type. Must be one of: ${validSyncTypes.join(', ')}` }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }
      if (triggered_by && !validTriggers.includes(triggered_by)) {
        return new Response(
          JSON.stringify({ error: `Invalid triggered_by. Must be one of: ${validTriggers.join(', ')}` }),
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
        .from('webhook_config')
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
      if (error) {
        // Table might not exist
        return new Response(
          JSON.stringify({ data: [] }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /manage-integrations/webhook-events
    if (req.method === 'GET' && action === 'webhook-events') {
      const limit = parseInt(url.searchParams.get('limit') || '100', 10)

      const { data, error } = await supabase
        .from('webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        return new Response(
          JSON.stringify({ data: [] }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST /manage-integrations/webhooks - Create webhook config
    if (req.method === 'POST' && action === 'webhooks') {
      const body = await req.json()

      if (!body.source || !body.url) {
        return new Response(
          JSON.stringify({ error: 'source and url are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Validate URL
      if (!isValidUrl(body.url)) {
        return new Response(
          JSON.stringify({ error: 'Invalid URL format' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Sanitize inputs
      const sanitizedBody: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(body)) {
        sanitizedBody[key] = typeof value === 'string' ? sanitizeString(value) : value
      }

      const { data, error } = await supabase
        .from('webhook_config')
        .insert(sanitizedBody)
        .select()
        .single()

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to create webhook config' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /manage-integrations/webhooks/{id} - Update webhook config
    if (req.method === 'PUT' && action === 'webhooks') {
      const body = await req.json()
      const webhookId = body.id || url.searchParams.get('id')

      if (!webhookId) {
        return new Response(
          JSON.stringify({ error: 'webhook id is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Sanitize string inputs and validate URL if provided
      const sanitizedBody: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const [key, value] of Object.entries(body)) {
        if (key === 'id' || key === 'created_at') continue
        if (key === 'url' && typeof value === 'string' && !isValidUrl(value)) {
          return new Response(
            JSON.stringify({ error: 'Invalid URL format' }),
            { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
          )
        }
        sanitizedBody[key] = typeof value === 'string' ? sanitizeString(value) : value
      }

      const { data, error } = await supabase
        .from('webhook_config')
        .update(sanitizedBody)
        .eq('id', webhookId)
        .select()
        .single()

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to update webhook' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /manage-integrations/webhooks/{id} - Delete webhook config
    if (req.method === 'DELETE' && action === 'webhooks') {
      const webhookId = url.searchParams.get('id')

      if (!webhookId) {
        return new Response(
          JSON.stringify({ error: 'webhook id is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { error } = await supabase
        .from('webhook_config')
        .delete()
        .eq('id', webhookId)

      if (error) throw error

      return new Response(
        JSON.stringify({ message: 'Webhook config deleted' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST /manage-integrations/mappings - Create product mapping
    if (req.method === 'POST' && action === 'mappings') {
      const body = await req.json()

      if (!body.source || !body.external_id) {
        return new Response(
          JSON.stringify({ error: 'source and external_id are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Sanitize string inputs
      const sanitizedBody: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(body)) {
        sanitizedBody[key] = typeof value === 'string' ? sanitizeString(value) : value
      }

      const { data, error } = await supabase
        .from('third_party_product_mapping')
        .insert(sanitizedBody)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /manage-integrations/mappings/{id} - Update product mapping
    if (req.method === 'PUT' && action === 'mappings') {
      const body = await req.json()
      const mappingId = body.id || url.searchParams.get('id')

      if (!mappingId) {
        return new Response(
          JSON.stringify({ error: 'mapping id is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Sanitize string inputs
      const sanitizedBody: Record<string, unknown> = { last_synced_at: new Date().toISOString() }
      for (const [key, value] of Object.entries(body)) {
        if (key === 'id' || key === 'created_at') continue
        sanitizedBody[key] = typeof value === 'string' ? sanitizeString(value) : value
      }

      const { data, error } = await supabase
        .from('third_party_product_mapping')
        .update(sanitizedBody)
        .eq('id', mappingId)
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
    console.error('manage-integrations error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
