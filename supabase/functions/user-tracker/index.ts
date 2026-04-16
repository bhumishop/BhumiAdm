// Edge Function: user-tracker
// User session management, geolocation tracking, and active user monitoring

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  const url = new URL(req.url)
  const method = req.method
  const pathParts = url.pathname.split('/').filter(Boolean)
  // Strip function name from path
  const path = pathParts.length >= 1 ? pathParts.slice(1) : []

  // Add CORS headers to all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  }

  try {
    // ============================================
    // POST /session - Create or update user session
    // ============================================
    if (method === 'POST' && path[0] === 'session') {
      const body = await req.json()
      const now = new Date().toISOString()

      // Check for existing active session
      if (body.session_token) {
        const existing = await supabase
          .from('user_sessions')
          .select('*')
          .eq('session_token', body.session_token)
          .eq('is_active', true)
          .maybeSingle()

        if (existing.data) {
          // Update existing session
          const updated = await supabase
            .from('user_sessions')
            .update({
              last_active: now,
              ip_address: body.ip_address || existing.data.ip_address,
              user_agent: body.user_agent || existing.data.user_agent,
              metadata: { ...existing.data.metadata, ...body.metadata },
            })
            .eq('id', existing.data.id)
            .select()
            .single()

          return new Response(JSON.stringify({ data: updated.data, action: 'updated' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      // Create new session
      const newSession = {
        user_id: body.user_id,
        email: body.email || null,
        session_token: body.session_token || crypto.randomUUID(),
        ip_address: body.ip_address || null,
        user_agent: body.user_agent || null,
        started_at: now,
        last_active: now,
        is_active: true,
        metadata: body.metadata || {},
      }

      const result = await supabase.from('user_sessions').insert(newSession).select().single()

      return new Response(JSON.stringify({ data: result.data, action: 'created' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ============================================
    // PUT /session/:id - End user session
    // ============================================
    if (method === 'PUT' && path[0] === 'session' && path[1]) {
      const body = await req.json()

      if (body.action === 'end') {
        const result = await supabase
          .from('user_sessions')
          .update({ is_active: false, ended_at: new Date().toISOString(), last_active: new Date().toISOString() })
          .eq('id', path[1])
          .select()
          .single()

        return new Response(JSON.stringify({ data: result.data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Heartbeat - update last_active
      const result = await supabase
        .from('user_sessions')
        .update({ last_active: new Date().toISOString() })
        .eq('id', path[1])
        .select()
        .single()

      return new Response(JSON.stringify({ data: result.data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ============================================
    // GET /sessions - Get active user sessions
    // ============================================
    if (method === 'GET' && path[0] === 'sessions') {
      const limit = parseInt(url.searchParams.get('limit') || '100')
      const activeOnly = url.searchParams.get('active') !== 'false'

      let query = supabase
        .from('user_sessions')
        .select('*')
        .order('last_active', { ascending: false })
        .limit(limit)

      if (activeOnly) {
        query = query.eq('is_active', true)
      }

      const result = await query
      return new Response(JSON.stringify({ data: result.data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ============================================
    // GET /sessions/count - Get session counts
    // ============================================
    if (method === 'GET' && path[0] === 'sessions' && path[1] === 'count') {
      const [activeResult, totalResult] = await Promise.all([
        supabase.from('user_sessions').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('user_sessions').select('id', { count: 'exact', head: true }),
      ])

      return new Response(JSON.stringify({
        data: {
          active_sessions: activeResult.count || 0,
          total_sessions: totalResult.count || 0,
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ============================================
    // POST /geolocation - Record user geolocation
    // ============================================
    if (method === 'POST' && path[0] === 'geolocation') {
      const body = await req.json()

      const geoEntry = {
        user_id: body.user_id,
        session_id: body.session_id || null,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        city: body.city || null,
        region: body.region || null,
        country: body.country || null,
        country_code: body.country_code || null,
        ip_address: body.ip_address || null,
        accuracy_meters: body.accuracy_meters || null,
        source: body.source || 'ip',
        recorded_at: new Date().toISOString(),
        metadata: body.metadata || {},
      }

      const result = await supabase.from('user_geolocations').insert(geoEntry).select().single()

      return new Response(JSON.stringify({ data: result.data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ============================================
    // GET /geolocations - Get user geolocations
    // ============================================
    if (method === 'GET' && path[0] === 'geolocations') {
      const userId = url.searchParams.get('user_id')
      const limit = parseInt(url.searchParams.get('limit') || '50')

      let query = supabase
        .from('user_geolocations')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(limit)

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const result = await query
      return new Response(JSON.stringify({ data: result.data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ============================================
    // GET /map - Get geolocation map data
    // ============================================
    if (method === 'GET' && path[0] === 'map') {
      const geolocations = await supabase
        .from('user_geolocations')
        .select('id, user_id, latitude, longitude, city, region, country, country_code, ip_address, source, recorded_at')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('recorded_at', { ascending: false })
        .limit(200)

      return new Response(JSON.stringify({ data: geolocations.data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ============================================
    // GET /active-users - Get active users with geolocation
    // ============================================
    if (method === 'GET' && path[0] === 'active-users') {
      const activeSessions = await supabase
        .from('user_sessions')
        .select('id, user_id, email, ip_address, last_active, metadata')
        .eq('is_active', true)
        .order('last_active', { ascending: false })

      // Get latest geolocation for each active user
      const usersWithGeo = []
      for (const session of activeSessions.data || []) {
        const latestGeo = await supabase
          .from('user_geolocations')
          .select('city, country, country_code, latitude, longitude')
          .eq('user_id', session.user_id)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        usersWithGeo.push({
          user_id: session.user_id,
          email: session.email,
          ip_address: session.ip_address,
          last_active: session.last_active,
          geolocation: latestGeo.data || null,
        })
      }

      return new Response(JSON.stringify({ data: usersWithGeo }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Method not allowed
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('user-tracker error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
