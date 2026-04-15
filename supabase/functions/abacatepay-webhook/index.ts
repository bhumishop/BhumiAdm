import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac, timingSafeEqual } from 'node:crypto'

function corsHeaders(origin?: string) {
  // In production, replace '*' with your actual domain(s)
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)
  const allowOrigin = allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || '*')

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

/**
 * Verify webhook signature using HMAC-SHA256
 * AbacatePay sends signature in x-webhook-signature header
 */
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const webhookSecret = Deno.env.get('ABACATEPAY_WEBHOOK_SECRET')
  if (!webhookSecret) {
    // In production, signature verification MUST be enforced
    console.error('ABACATEPAY_WEBHOOK_SECRET not configured - rejecting webhook')
    return false
  }

  const expectedSignature = createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex')

  // Use timing-safe comparison to prevent timing attacks
  const signatureBuffer = new TextEncoder().encode(signature)
  const expectedBuffer = new TextEncoder().encode(expectedSignature)

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(signatureBuffer, expectedBuffer)
}

/**
 * Check and record webhook event for idempotency
 * Returns true if event was already processed
 */
async function isEventAlreadyProcessed(supabase: any, eventId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('event_id', eventId)
    .eq('status', 'processed')
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
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
        payload: payload,
        status: 'processed',
        processed_at: new Date().toISOString()
      })
  } catch (err) {
    console.error('Failed to record webhook event:', err)
    // Don't throw - event was already processed
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin') || undefined) })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Read raw body for signature verification
    const rawBody = await req.text()
    const signature = req.headers.get('x-webhook-signature') || req.headers.get('X-Webhook-Signature')

    // Verify signature - required for all webhook calls
    if (!signature) {
      console.error('Missing webhook signature')
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    const isValid = verifyWebhookSignature(rawBody, signature)
    if (!isValid) {
      console.error('Invalid webhook signature')
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    const payload = JSON.parse(rawBody)
    const event = payload.event || payload.type
    const eventId = payload.id || payload.event_id || `${event}-${Date.now()}`

    console.log('Webhook received:', event, 'ID:', eventId)

    // Check idempotency - skip if already processed
    const alreadyProcessed = await isEventAlreadyProcessed(supabase, eventId)
    if (alreadyProcessed) {
      console.log('Webhook event already processed:', eventId)
      return new Response(
        JSON.stringify({ received: true, message: 'Already processed' }),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    if (event === 'billing.paid' || event === 'pix.paid') {
      // Extract payment reference
      const billingId = payload.data?.id || payload.data?.billing_id || payload.billing_id
      const pixId = payload.data?.id || payload.data?.pix_qr_code_id || payload.pix_qr_code_id
      const paymentRef = billingId || pixId

      if (!paymentRef) {
        console.error('No payment reference found in webhook payload')
        return new Response(
          JSON.stringify({ error: 'No payment reference' }),
          { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
      }

      // Find order by payment reference (stored in pix_key column)
      const { data: orders, error: findError } = await supabase
        .from('orders')
        .select('id, order_number, payment_status, total')
        .eq('pix_key', paymentRef)
        .limit(1)

      if (findError) {
        console.error('Error finding order:', findError)
        throw findError
      }

      if (!orders || orders.length === 0) {
        console.log('No order found for payment ref:', paymentRef)
        // Record event even if no order found (to avoid reprocessing)
        await recordWebhookEvent(supabase, eventId, event, payload)
        return new Response(
          JSON.stringify({ message: 'No matching order' }),
          { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
      }

      const order = orders[0]

      // Idempotency check: skip if already marked as paid
      if (order.payment_status === 'paid') {
        console.log('Order already marked as paid:', order.order_number)
        await recordWebhookEvent(supabase, eventId, event, payload)
        return new Response(
          JSON.stringify({ message: 'Already processed' }),
          { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
      }

      // Update order payment status atomically
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'processing',
          payment_paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
        .eq('payment_status', 'pending') // Ensure we only update if still pending

      if (updateError) {
        console.error('Error updating order:', updateError)
        throw updateError
      }

      // Add status history entry
      const { error: historyError } = await supabase
        .from('order_status_history')
        .insert({
          order_id: order.id,
          from_status: 'pending',
          to_status: 'processing',
          changed_by: 'system',
          changed_by_role: 'webhook',
          description: `Pagamento confirmado via AbacatePay - ${event}`
        })

      if (historyError) {
        console.error('Error inserting status history:', historyError)
        // Don't throw — order is already updated
      }

      // Record the webhook event for idempotency
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

          console.log('Order marked as expired:', orders[0].order_number)
        }
      }

      // Record the webhook event
      await recordWebhookEvent(supabase, eventId, event, payload)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }
})
