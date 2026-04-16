import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function corsHeaders(origin?: string) {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)
  if (!allowedOrigins.length) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
  }
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0]

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// Rate limiting for webhook endpoint
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 100
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
  return req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip')
    || 'unknown'
}

/**
 * Verify webhook signature using HMAC-SHA256 (Web Crypto API)
 */
async function verifyWebhookSignature(payload: string, signature: string): Promise<boolean> {
  const webhookSecret = Deno.env.get('ABACATEPAY_WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.error('ABACATEPAY_WEBHOOK_SECRET not configured')
    return false
  }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  )

  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // Timing-safe comparison
  if (signature.length !== expectedSignature.length) {
    return false
  }

  const sigBytes = encoder.encode(signature)
  const expBytes = encoder.encode(expectedSignature)
  let result = 0
  for (let i = 0; i < sigBytes.length; i++) {
    result |= sigBytes[i] ^ expBytes[i]
  }
  return result === 0
}

/**
 * Validate webhook payload structure
 */
function validatePayload(payload: any): { valid: boolean; event?: string; eventId?: string; error?: string } {
  const event = payload.event || payload.type
  const allowedEvents = ['billing.paid', 'pix.paid', 'pix.expired']

  if (!event || typeof event !== 'string') {
    return { valid: false, error: 'Missing or invalid event type' }
  }

  if (!allowedEvents.includes(event)) {
    return { valid: false, error: `Unknown event type: ${event}` }
  }

  const eventId = payload.id || payload.event_id
  if (!eventId || typeof eventId !== 'string' || eventId.length > 255) {
    return { valid: false, error: 'Missing or invalid event ID' }
  }

  return { valid: true, event, eventId }
}

/**
 * Check and record webhook event for idempotency
 */
async function isEventAlreadyProcessed(supabase: any, eventId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('event_id', eventId)
    .eq('status', 'processed')
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking webhook idempotency:', error)
  }

  return !!data
}

/**
 * Record webhook event for idempotency tracking
 */
async function recordWebhookEvent(supabase: any, eventId: string, eventType: string, payload: any) {
  try {
    await supabase
      .from('webhook_events')
      .insert({
        event_id: eventId,
        event_type: eventType,
        payload: {
          event: eventType,
          id: payload.id,
          data: payload.data ? {
            id: payload.data.id,
            billing_id: payload.data.billing_id,
            pix_qr_code_id: payload.data.pix_qr_code_id,
            status: payload.data.status
          } : null
        },
        status: 'processed',
        processed_at: new Date().toISOString()
      })
  } catch (err) {
    console.error('Failed to record webhook event:', err)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin') || undefined) })
  }

  // Rate limit webhook requests
  const clientIP = getClientIP(req)
  if (!checkRateLimit(clientIP)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded' }),
      { status: 429, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const rawBody = await req.text()
    const signature = req.headers.get('x-webhook-signature') || req.headers.get('X-Webhook-Signature')

    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    const isValid = await verifyWebhookSignature(rawBody, signature)
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    const payload = JSON.parse(rawBody)
    const validation = validatePayload(payload)

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    const { event, eventId } = validation

    console.log('Webhook received:', event, 'ID:', eventId)

    // Check idempotency
    const alreadyProcessed = await isEventAlreadyProcessed(supabase, eventId)
    if (alreadyProcessed) {
      return new Response(
        JSON.stringify({ received: true, message: 'Already processed' }),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    if (event === 'billing.paid' || event === 'pix.paid') {
      const billingId = payload.data?.id || payload.data?.billing_id || payload.billing_id
      const pixId = payload.data?.id || payload.data?.pix_qr_code_id || payload.pix_qr_code_id
      const paymentRef = billingId || pixId

      if (!paymentRef) {
        await recordWebhookEvent(supabase, eventId, event, payload)
        return new Response(
          JSON.stringify({ error: 'No payment reference' }),
          { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
      }

      const { data: orders, error: findError } = await supabase
        .from('orders')
        .select('id, order_number, payment_status, total')
        .eq('pix_key', paymentRef)
        .limit(1)

      if (findError) {
        throw findError
      }

      if (!orders || orders.length === 0) {
        await recordWebhookEvent(supabase, eventId, event, payload)
        return new Response(
          JSON.stringify({ message: 'No matching order' }),
          { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
      }

      const order = orders[0]

      if (order.payment_status === 'paid') {
        await recordWebhookEvent(supabase, eventId, event, payload)
        return new Response(
          JSON.stringify({ message: 'Already processed' }),
          { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'processing',
          payment_paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
        .eq('payment_status', 'pending')

      if (updateError) {
        throw updateError
      }

      try {
        await supabase
          .from('order_status_history')
          .insert({
            order_id: order.id,
            from_status: 'pending',
            to_status: 'processing',
            changed_by: 'system',
            changed_by_role: 'webhook',
            description: `Pagamento confirmado via AbacatePay - ${event}`
          })
      } catch { /* ignore history errors */ }

      await recordWebhookEvent(supabase, eventId, event, payload)
      console.log('Order updated to paid:', order.order_number)
    }

    if (event === 'pix.expired') {
      const pixId = payload.data?.id || payload.data?.pix_qr_code_id

      if (pixId) {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, order_number')
          .eq('pix_key', pixId)
          .eq('payment_status', 'pending')
          .limit(1)

        if (orders && orders.length > 0) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'expired',
              status: 'cancelled',
              updated_at: new Date().toISOString()
            })
            .eq('id', orders[0].id)

          try {
            await supabase
              .from('order_status_history')
              .insert({
                order_id: orders[0].id,
                from_status: 'pending',
                to_status: 'cancelled',
                changed_by: 'system',
                changed_by_role: 'webhook',
                description: 'PIX expirou - pagamento nao concluido'
              })
          } catch { /* ignore history errors */ }

          console.log('Order marked as expired:', orders[0].order_number)
        }
      }

      await recordWebhookEvent(supabase, eventId, event, payload)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }
})
