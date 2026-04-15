// Edge Function: infra-manager
// Infrastructure management, edge function status, operation logs, and orchestrator data

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  const url = new URL(req.url)
  const method = req.method
  const path = url.pathname.split('/').filter(Boolean)

  try {
    // ============================================
    // GET / - Get infrastructure overview
    // ============================================
    if (method === 'GET' && path.length === 0) {
      const [functions, sessions, operations] = await Promise.all([
        supabase.from('edge_function_status').select('*').order('function_name'),
        supabase.from('user_sessions').select('id, user_id, email, ip_address, started_at, last_active, is_active').eq('is_active', true).order('last_active', { ascending: false }).limit(100),
        supabase.from('operation_logs').select('*').order('created_at', { ascending: false }).limit(100),
      ])

      // Calculate overview stats
      const activeFunctions = functions.data?.filter(f => f.status === 'active').length || 0
      const degradedFunctions = functions.data?.filter(f => f.status === 'degraded').length || 0
      const errorFunctions = functions.data?.filter(f => f.status === 'error').length || 0

      const totalOps = operations.data?.length || 0
      const successOps = operations.data?.filter(o => o.status === 'success').length || 0
      const errorOps = operations.data?.filter(o => o.status === 'error').length || 0

      return new Response(JSON.stringify({
        data: {
          overview: {
            total_functions: functions.data?.length || 0,
            active_functions: activeFunctions,
            degraded_functions: degradedFunctions,
            error_functions: errorFunctions,
            total_sessions: sessions.data?.length || 0,
            active_sessions: sessions.data?.filter(s => s.is_active).length || 0,
            total_operations: totalOps,
            success_rate: totalOps > 0 ? (successOps / totalOps * 100).toFixed(1) : 0,
            error_rate: totalOps > 0 ? (errorOps / totalOps * 100).toFixed(1) : 0,
          },
          functions: functions.data || [],
          sessions: sessions.data || [],
          recent_operations: operations.data || [],
        }
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    // ============================================
    // GET /functions - Get all edge function statuses
    // ============================================
    if (method === 'GET' && path[0] === 'functions') {
      const functions = await supabase.from('edge_function_status').select('*').order('function_name')
      return new Response(JSON.stringify({ data: functions.data || [] }), { headers: { 'Content-Type': 'application/json' } })
    }

    // ============================================
    // GET /functions/:name - Get specific function status
    // ============================================
    if (method === 'GET' && path[0] === 'functions' && path[1]) {
      const fn = await supabase.from('edge_function_status').select('*').eq('function_name', path[1]).single()
      return new Response(JSON.stringify({ data: fn.data }), { headers: { 'Content-Type': 'application/json' } })
    }

    // ============================================
    // PUT /functions/:name - Update function status
    // ============================================
    if (method === 'PUT' && path[0] === 'functions' && path[1]) {
      const body = await req.json()
      const updates = {
        status: body.status,
        config: body.config,
        updated_at: new Date().toISOString(),
      }

      const result = await supabase.from('edge_function_status').update(updates).eq('function_name', path[1]).select().single()
      return new Response(JSON.stringify({ data: result.data }), { headers: { 'Content-Type': 'application/json' } })
    }

    // ============================================
    // GET /logs - Get operation logs
    // ============================================
    if (method === 'GET' && path[0] === 'logs') {
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const status = url.searchParams.get('status')
      const operation = url.searchParams.get('operation')

      let query = supabase.from('operation_logs').select('*').order('created_at', { ascending: false }).limit(limit)

      if (status) query = query.eq('status', status)
      if (operation) query = query.eq('operation', operation)

      const result = await query
      return new Response(JSON.stringify({ data: result.data || [] }), { headers: { 'Content-Type': 'application/json' } })
    }

    // ============================================
    // POST /log - Create operation log entry
    // ============================================
    if (method === 'POST' && path[0] === 'log') {
      const body = await req.json()
      const logEntry = {
        operation: body.operation,
        entity_type: body.entity_type || null,
        entity_id: body.entity_id || null,
        user_id: body.user_id || null,
        status: body.status || 'running',
        duration_ms: body.duration_ms || null,
        request_payload: body.request_payload || null,
        response_payload: body.response_payload || null,
        error_message: body.error_message || null,
        ip_address: body.ip_address || null,
        user_agent: body.user_agent || null,
        metadata: body.metadata || {},
      }

      const result = await supabase.from('operation_logs').insert(logEntry).select().single()
      return new Response(JSON.stringify({ data: result.data }), { headers: { 'Content-Type': 'application/json' } })
    }

    // ============================================
    // POST /functions/:name/test - Test an edge function
    // ============================================
    if (method === 'POST' && path[0] === 'functions' && path[1] && path[2] === 'test') {
      const body = await req.json()
      const functionName = path[1]
      const testArgs = body.args || {}
      const startTime = Date.now()

      try {
        // Call the edge function with test arguments
        const testResponse = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ ...testArgs, _test_mode: true }),
        })

        const duration = Date.now() - startTime
        const responseText = await testResponse.text()
        let responseData
        try {
          responseData = JSON.parse(responseText)
        } catch {
          responseData = { raw: responseText }
        }

        // Update function status
        await supabase.from('edge_function_status').update({
          last_execution: new Date().toISOString(),
          last_status: testResponse.ok ? 'success' : 'error',
          last_error: testResponse.ok ? null : responseText.substring(0, 500),
          total_calls: supabase.raw('total_calls + 1'),
          success_calls: testResponse.ok ? supabase.raw('success_calls + 1') : undefined,
          error_calls: !testResponse.ok ? supabase.raw('error_calls + 1') : undefined,
          avg_duration_ms: duration,
          updated_at: new Date().toISOString(),
        }).eq('function_name', functionName)

        // Log the operation
        await supabase.from('operation_logs').insert({
          operation: 'edge_function_test',
          entity_type: 'edge_function',
          entity_id: functionName,
          status: testResponse.ok ? 'success' : 'error',
          duration_ms: duration,
          request_payload: testArgs,
          response_payload: responseData,
          error_message: testResponse.ok ? null : responseText.substring(0, 500),
        })

        return new Response(JSON.stringify({
          data: {
            success: testResponse.ok,
            status_code: testResponse.status,
            duration_ms: duration,
            response: responseData,
          }
        }), { headers: { 'Content-Type': 'application/json' } })
      } catch (error) {
        const duration = Date.now() - startTime

        await supabase.from('edge_function_status').update({
          last_execution: new Date().toISOString(),
          last_status: 'error',
          last_error: error.message,
          error_calls: supabase.raw('error_calls + 1'),
          updated_at: new Date().toISOString(),
        }).eq('function_name', functionName)

        return new Response(JSON.stringify({
          error: `Failed to test function: ${error.message}`,
          duration_ms: duration,
        }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }

    // ============================================
    // GET /orchestrator-graph - Get orchestrator visual graph data
    // ============================================
    if (method === 'GET' && path[0] === 'orchestrator-graph') {
      const [functions, sessions, geolocations] = await Promise.all([
        supabase.from('edge_function_status').select('*').order('function_name'),
        supabase.from('user_sessions').select('id, user_id, email, ip_address, started_at, last_active, is_active').eq('is_active', true).order('last_active', { ascending: false }).limit(50),
        supabase.from('user_geolocations').select('id, user_id, latitude, longitude, city, region, country, country_code, recorded_at').order('recorded_at', { ascending: false }).limit(50),
      ])

      // Build nodes
      const nodes = []
      const edges = []

      // Root node
      nodes.push({
        id: 'orchestrator_root',
        type: 'orchestrator',
        label: 'BHUMI SHOP ORCHESTRATOR',
        status: 'active',
        data: { version: '1.0.0' },
        enabled: true,
      })

      // Edge function nodes
      for (const fn of functions.data || []) {
        nodes.push({
          id: `fn_${fn.function_name}`,
          type: 'edge_function',
          label: fn.function_name,
          status: fn.status,
          data: {
            total_calls: fn.total_calls,
            success_calls: fn.success_calls,
            error_calls: fn.error_calls,
            avg_duration_ms: fn.avg_duration_ms,
            last_error: fn.last_error,
          },
          enabled: fn.status === 'active',
        })

        edges.push({
          from: 'orchestrator_root',
          to: `fn_${fn.function_name}`,
          type: 'manages',
          label: fn.status,
          enabled: fn.status === 'active',
        })
      }

      // Active user session nodes
      for (const session of sessions.data || []) {
        const userId = session.user_id.substring(0, 8)
        nodes.push({
          id: `session_${session.id}`,
          type: 'user_session',
          label: `${session.email || userId}...`,
          status: session.is_active ? 'active' : 'inactive',
          data: {
            user_id: session.user_id,
            email: session.email,
            ip_address: session.ip_address,
            last_active: session.last_active,
          },
          enabled: session.is_active,
        })
      }

      // Geolocation nodes
      for (const geo of geolocations.data || []) {
        if (geo.latitude && geo.longitude) {
          nodes.push({
            id: `geo_${geo.id}`,
            type: 'geolocation',
            label: `${geo.city || 'Unknown'}, ${geo.country_code || ''}`,
            status: 'tracked',
            data: {
              latitude: geo.latitude,
              longitude: geo.longitude,
              city: geo.city,
              country: geo.country,
              country_code: geo.country_code,
            },
            enabled: true,
          })

          edges.push({
            from: `session_${sessions.data?.find(s => s.user_id === geo.user_id)?.id || 'unknown'}`,
            to: `geo_${geo.id}`,
            type: 'located_at',
            label: 'geo',
            enabled: true,
          })
        }
      }

      return new Response(JSON.stringify({ data: { nodes, edges } }), { headers: { 'Content-Type': 'application/json' } })
    }

    // Method not allowed
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })

  } catch (error) {
    console.error('infra-manager error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
