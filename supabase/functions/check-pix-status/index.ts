import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jwtVerify } from 'https://esm.sh/jose@5.2.0'

const ABACATEPAY_API = 'https://api.abacatepay.com'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWT_SECRET = Deno.env.get('JWT_SECRET') || SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting: track requests per IP
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 30
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

/**
 * Verify admin session token or customer session.
 * Admins can check any order, customers can only check their own.
 */
async function verifyAuth(req: Request): Promise<{ isAdmin: boolean; userId: string | null }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { isAdmin: false, userId: null }

  try {
    const { payload } = await jwtVerify(
      authHeader.substring(7),
      new TextEncoder().encode(JWT_SECRET),
      { algorithms: ['HS256'] }
    )
    return {
      isAdmin: payload.role === 'admin',
      userId: payload.sub || null,
    }
  } catch {
    return { isAdmin: false, userId: null }
  }
}

function corsHeaders(origin?: string) {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)
  const allowOrigin = allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || '*')

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
}

function getClientIP(req: Request): string {
  // Prefer x-real-ip from trusted proxy, never trust x-forwarded-for from untrusted sources
  return req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip') // Cloudflare
    || 'unknown'
}

async function checkPixWithAbacatePay(pixId: string): Promise<{ status: string; paidAt: string | null }> {
  const apiKey = Deno.env.get('ABACATEPAY_API_KEY')
  if (!apiKey) throw new Error('Payment service not configured')

  const response = await fetch(
    `${ABACATEPAY_API}/v1/pixQrCode/check?id=${encodeURIComponent(pixId.trim())}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `AbacatePay API error: ${response.status}`)
  }

  const data = await response.json()
  const status = data.data?.status || data.status || 'pending'
  const paidAt = data.data?.paidAt || data.data?.paid_at || null

  return { status, paidAt }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin') || undefined) })
  }

  // Rate limiting
  const clientIP = getClientIP(req)
  if (!checkRateLimit(clientIP)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      { status: 429, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }

  // Require authentication
  const auth = await verifyAuth(req)
  if (!auth.isAdmin && !auth.userId) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: authentication required' }),
      { status: 401, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { pixId, orderId } = await req.json()

    if (!pixId && !orderId) {
      return new Response(
        JSON.stringify({ error: 'pixId or orderId is required' }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    let pixIdToCheck: string

    // If checking by orderId, verify ownership for non-admins
    if (orderId) {
      // Validate UUID format before querying
      if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
        return new Response(
          JSON.stringify({ error: 'Invalid order ID format' }),
          { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
      }

      const { data: order } = await supabase
        .from('orders')
        .select('id, user_id')
        .eq('id', orderId)
        .single()

      if (!order) {
        return new Response(
          JSON.stringify({ error: 'Order not found' }),
          { status: 404, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
      }

      // Non-admin must own the order
      if (!auth.isAdmin && order.user_id !== auth.userId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: you do not own this order' }),
          { status: 403, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
      }

      pixIdToCheck = order.pix_key
      if (!pixIdToCheck) {
        return new Response(
          JSON.stringify({ status: 'no_payment', message: 'No PIX payment associated with this order' }),
          { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Admin checking by direct pixId
      pixIdToCheck = pixId
    }

    const { status, paidAt } = await checkPixWithAbacatePay(pixIdToCheck)

    return new Response(
      JSON.stringify({
        status,
        paidAt,
        updatedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('check-pix-status error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }
})
