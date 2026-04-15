/**
 * Supabase Edge Function: dashboard-metrics
 *
 * Server-side dashboard metrics and analytics.
 *
 * Endpoints:
 *   GET    /dashboard-metrics/overview - Get dashboard overview
 *   GET    /dashboard-metrics/sales - Get sales metrics
 *   GET    /dashboard-metrics/products - Get product metrics
 *   GET    /dashboard-metrics/fulfillment - Get fulfillment metrics
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  const metric = pathParts[pathParts.length - 1] || 'overview'
  const params = url.searchParams
  const dateFrom = params.get('date_from')
  const dateTo = params.get('date_to')

  try {
    // ============================================
    // GET /dashboard-metrics/overview
    // ============================================
    if (metric === 'overview' || metric === 'dashboard-metrics') {
      // Get order stats
      const { data: orderStats } = await supabase
        .rpc('get_order_stats', {
          start_date: dateFrom || null,
          end_date: dateTo || null,
        })

      // Get recent orders
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('id, order_number, status, payment_status, total, created_at, customer_name')
        .order('created_at', { ascending: false })
        .limit(10)

      // Get low stock products
      const { data: lowStock } = await supabase
        .from('products')
        .select('id, name, stock_quantity, low_stock_threshold')
        .eq('is_active', true)
        .eq('is_archived', false)
        .lte('stock_quantity', supabase.raw('low_stock_threshold'))
        .limit(10)

      // Get collection summary
      const { data: collections } = await supabase
        .from('collection_summary')
        .select('*')
        .eq('is_active', true)

      // Get sync status
      const { data: syncStatus } = await supabase
        .from('third_party_sync_log')
        .select('source, status, items_processed, started_at')
        .order('started_at', { ascending: false })
        .limit(5)

      return new Response(
        JSON.stringify({
          orderStats: orderStats?.[0] || {},
          recentOrders,
          lowStock,
          collections,
          syncStatus,
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // GET /dashboard-metrics/sales
    // ============================================
    if (metric === 'sales') {
      const { data: dailyMetrics } = await supabase
        .from('daily_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(30)

      const { data: orderStats } = await supabase
        .rpc('get_order_stats', {
          start_date: dateFrom || null,
          end_date: dateTo || null,
        })

      return new Response(
        JSON.stringify({ dailyMetrics, orderStats: orderStats?.[0] || {} }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // GET /dashboard-metrics/products
    // ============================================
    if (metric === 'products') {
      // Get top products by views
      const { data: topViewed } = await supabase
        .from('product_analytics')
        .select('product_id, count')
        .eq('event_type', 'view')
        .order('count', { ascending: false })
        .limit(10)

      // Get top products by purchases
      const { data: topPurchased } = await supabase
        .from('product_analytics')
        .select('product_id, count')
        .eq('event_type', 'purchase')
        .order('count', { ascending: false })
        .limit(10)

      // Get product stock status
      const { data: products } = await supabase
        .from('products')
        .select('id, name, stock_quantity, stock_type, is_active')
        .eq('is_archived', false)
        .order('stock_quantity', { ascending: true })
        .limit(20)

      return new Response(
        JSON.stringify({ topViewed, topPurchased, products }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // GET /dashboard-metrics/fulfillment
    // ============================================
    if (metric === 'fulfillment') {
      const { data: fulfillmentMetrics } = await supabase
        .from('fulfillment_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      // Calculate averages
      const avgPrepTime = fulfillmentMetrics?.reduce((sum, m) => sum + (m.preparation_time_hours || 0), 0) /
        (fulfillmentMetrics?.filter(m => m.preparation_time_hours).length || 1)

      const avgShipTime = fulfillmentMetrics?.reduce((sum, m) => sum + (m.shipping_time_hours || 0), 0) /
        (fulfillmentMetrics?.filter(m => m.shipping_time_hours).length || 1)

      const onTimeRate = fulfillmentMetrics?.filter(m => m.is_on_time === true).length /
        (fulfillmentMetrics?.filter(m => m.is_on_time !== null).length || 1) * 100

      return new Response(
        JSON.stringify({
          fulfillmentMetrics,
          averages: {
            preparation_time_hours: Math.round(avgPrepTime * 100) / 100,
            shipping_time_hours: Math.round(avgShipTime * 100) / 100,
            on_time_rate_percent: Math.round(onTimeRate * 100) / 100,
          }
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Metric not found' }),
      { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('dashboard-metrics error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
