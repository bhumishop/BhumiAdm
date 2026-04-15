// Edge Function: telemetry-collector
// OpenTelemetry data collector for spans, metrics, and trace analysis

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
    // POST /spans - Ingest OpenTelemetry spans
    // ============================================
    if (method === 'POST' && path[0] === 'spans') {
      const body = await req.json()
      const spans = Array.isArray(body) ? body : [body]

      const spanRecords = spans.map((span) => ({
        trace_id: span.trace_id,
        span_id: span.span_id,
        parent_span_id: span.parent_span_id || null,
        name: span.name,
        kind: span.kind || 'INTERNAL',
        start_time: new Date(span.start_time || Date.now()).toISOString(),
        end_time: span.end_time ? new Date(span.end_time).toISOString() : null,
        duration_ns: span.duration_ns || null,
        status_code: span.status_code || 'UNSET',
        status_message: span.status_message || null,
        service_name: span.service_name || 'bhumi-shop',
        resource_attributes: span.resource_attributes || {},
        span_attributes: span.span_attributes || {},
        events: span.events || [],
        links: span.links || [],
      }))

      const result = await supabase.from('otel_spans').insert(spanRecords).select()

      return new Response(JSON.stringify({ data: result.data, accepted: result.data?.length || 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ============================================
    // POST /metrics - Ingest OpenTelemetry metrics
    // ============================================
    if (method === 'POST' && path[0] === 'metrics') {
      const body = await req.json()
      const metrics = Array.isArray(body) ? body : [body]

      const metricRecords = metrics.map((m) => ({
        name: m.name,
        description: m.description || null,
        unit: m.unit || null,
        type: m.type || 'GAUGE',
        value: m.value || null,
        count: m.count || null,
        sum: m.sum || null,
        min: m.min || null,
        max: m.max || null,
        bucket_bounds: m.bucket_bounds || null,
        bucket_counts: m.bucket_counts || null,
        timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString(),
        resource_attributes: m.resource_attributes || {},
        metric_attributes: m.metric_attributes || {},
      }))

      const result = await supabase.from('otel_metrics').insert(metricRecords).select()

      return new Response(JSON.stringify({ data: result.data, accepted: result.data?.length || 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ============================================
    // GET /spans - Query spans
    // ============================================
    if (method === 'GET' && path[0] === 'spans') {
      const traceId = url.searchParams.get('trace_id')
      const name = url.searchParams.get('name')
      const status = url.searchParams.get('status_code')
      const service = url.searchParams.get('service_name')
      const limit = parseInt(url.searchParams.get('limit') || '50')

      let query = supabase.from('otel_spans').select('*').order('start_time', { ascending: false }).limit(limit)

      if (traceId) query = query.eq('trace_id', traceId)
      if (name) query = query.eq('name', name)
      if (status) query = query.eq('status_code', status)
      if (service) query = query.eq('service_name', service)

      const result = await query
      return new Response(JSON.stringify({ data: result.data || [] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ============================================
    // GET /spans/:trace_id - Get full trace
    // ============================================
    if (method === 'GET' && path[0] === 'spans' && path[1]) {
      const spans = await supabase
        .from('otel_spans')
        .select('*')
        .eq('trace_id', path[1])
        .order('start_time', { ascending: true })

      // Build trace tree
      const traceData = buildTraceTree(spans.data || [])

      return new Response(JSON.stringify({ data: traceData }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ============================================
    // GET /metrics - Query metrics
    // ============================================
    if (method === 'GET' && path[0] === 'metrics') {
      const name = url.searchParams.get('name')
      const type = url.searchParams.get('type')
      const hours = parseInt(url.searchParams.get('hours') || '24')
      const limit = parseInt(url.searchParams.get('limit') || '100')

      let query = supabase
        .from('otel_metrics')
        .select('*')
        .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (name) query = query.eq('name', name)
      if (type) query = query.eq('type', type)

      const result = await query
      return new Response(JSON.stringify({ data: result.data || [] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ============================================
    // GET /analysis - Get telemetry analysis
    // ============================================
    if (method === 'GET' && path[0] === 'analysis') {
      const hours = parseInt(url.searchParams.get('hours') || '24')
      const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

      // Get span statistics
      const [spanStats, errorSpans, slowSpans, serviceStats, metricSummary] = await Promise.all([
        supabase
          .from('otel_spans')
          .select('status_code')
          .gte('start_time', cutoffDate),

        supabase
          .from('otel_spans')
          .select('name, duration_ns, status_message, service_name, span_attributes')
          .eq('status_code', 'ERROR')
          .gte('start_time', cutoffDate)
          .order('start_time', { ascending: false })
          .limit(50),

        supabase
          .from('otel_spans')
          .select('name, duration_ns, service_name, start_time')
          .gte('start_time', cutoffDate)
          .not('duration_ns', 'is', null)
          .order('duration_ns', { ascending: false })
          .limit(20),

        supabase
          .from('otel_spans')
          .select('service_name, status_code, duration_ns')
          .gte('start_time', cutoffDate),

        supabase
          .from('otel_metrics')
          .select('name, type, value, timestamp')
          .gte('timestamp', cutoffDate)
          .order('timestamp', { ascending: false }),
      ])

      const totalSpans = spanStats.data?.length || 0
      const errorCount = spanStats.data?.filter(s => s.status_code === 'ERROR').length || 0
      const okCount = spanStats.data?.filter(s => s.status_code === 'OK').length || 0

      // Calculate service-level stats
      const serviceMap: Record<string, { total: number; errors: number; durations: number[] }> = {}
      for (const s of serviceStats.data || []) {
        if (!serviceMap[s.service_name]) {
          serviceMap[s.service_name] = { total: 0, errors: 0, durations: [] }
        }
        serviceMap[s.service_name].total++
        if (s.status_code === 'ERROR') serviceMap[s.service_name].errors++
        if (s.duration_ns) serviceMap[s.service_name].durations.push(s.duration_ns / 1_000_000) // to ms
      }

      const serviceAnalysis = Object.entries(serviceMap).map(([name, stats]) => ({
        service_name: name,
        total_spans: stats.total,
        error_count: stats.errors,
        error_rate: stats.total > 0 ? (stats.errors / stats.total * 100).toFixed(2) : '0',
        avg_duration_ms: stats.durations.length > 0
          ? (stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length).toFixed(2)
          : '0',
        p95_duration_ms: stats.durations.length > 0
          ? percentile(stats.durations, 95).toFixed(2)
          : '0',
      }))

      return new Response(JSON.stringify({
        data: {
          period_hours: hours,
          summary: {
            total_spans: totalSpans,
            error_count: errorCount,
            ok_count: okCount,
            error_rate: totalSpans > 0 ? (errorCount / totalSpans * 100).toFixed(2) : '0',
            success_rate: totalSpans > 0 ? ((totalSpans - errorCount) / totalSpans * 100).toFixed(2) : '0',
          },
          services: serviceAnalysis,
          recent_errors: errorSpans.data || [],
          slowest_spans: slowSpans.data || [],
          metrics: metricSummary.data || [],
        }
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    // ============================================
    // GET /health - Health check
    // ============================================
    if (method === 'GET' && path[0] === 'health') {
      return new Response(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Method not allowed
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })

  } catch (error) {
    console.error('telemetry-collector error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})

// Build trace tree from spans
function buildTraceTree(spans: Array<Record<string, unknown>>) {
  const spanMap = new Map<string, any>()
  const rootSpans: any[] = []

  // Create span nodes
  for (const span of spans) {
    spanMap.set(span.span_id as string, {
      ...span,
      children: [],
      duration_ms: span.duration_ns ? (span.duration_ns as number / 1_000_000).toFixed(2) : '0',
    })
  }

  // Build tree
  for (const span of spans) {
    const node = spanMap.get(span.span_id as string)
    if (span.parent_span_id && spanMap.has(span.parent_span_id as string)) {
      const parent = spanMap.get(span.parent_span_id as string)
      parent.children.push(node)
    } else {
      rootSpans.push(node)
    }
  }

  return {
    trace_id: spans[0]?.trace_id,
    total_spans: spans.length,
    root_spans: rootSpans,
    spans: Array.from(spanMap.values()),
  }
}

// Calculate percentile
function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}
