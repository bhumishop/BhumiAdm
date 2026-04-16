import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function corsHeaders(origin?: string) {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)
  if (!allowedOrigins.length) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
  }
  const allowOrigin = allowedOrigins.includes(origin || '') ? origin : allowedOrigins[0]

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// Rate limiting for webhook endpoint
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 100
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute

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

/**
 * Find order by MercadoPago payment ID or preference ID
 */
async function findOrderByMercadoPagoId(supabase: any, mpPaymentId: string) {
  // First try to find by payment_reference (external payment ID)
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, payment_status, total, pix_key')
    .eq('pix_key', mpPaymentId)
    .limit(1)

  if (error) {
    console.error('Error finding order by MP payment ID:', error)
    return null
  }

  if (orders && orders.length > 0) {
    return orders[0]
  }

  // If not found, try to find by querying the payment_reference column
  const { data: orders2, error: error2 } = await supabase
    .from('orders')
    .select('id, order_number, payment_status, total, pix_key')
    .ilike('pix_key', `%${mpPaymentId}%`)
    .limit(1)

  if (error2) {
    console.error('Error finding order by MP payment ID (ilike):', error2)
    return null
  }

  return orders2?.[0] || null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin') || undefined) })
  }

  // Rate limit webhook requests
  const clientIP = getClientIP(req)
  if (!checkRateLimit(clientIP)) {
    console.warn('MercadoPago webhook rate limit exceeded from IP:', clientIP)
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

    // Read body
    const rawBody = await req.text()
    const payload = JSON.parse(rawBody)

    // Mercado Pago webhook data format
    // V2: { type: 'payment', action: 'payment.updated', data: { id: '123456' } }
    // V1: { id: '123456', topic: 'payment' }
    const eventType = payload.type || payload.topic || 'unknown'
    const action = payload.action || ''
    const paymentId = payload.data?.id || payload.id
    const eventId = `${eventType}-${paymentId}-${Date.now()}`

    console.log('MercadoPago webhook received:', eventType, 'action:', action, 'paymentId:', paymentId)

    // Log successful webhook reception
    await supabase.rpc('log_webhook_verification', {
      p_webhook_type: 'mercadopago',
      p_success: true,
      p_event_id: paymentId || eventId
    }).catch(() => {})

    if (!paymentId) {
      console.log('No payment ID in webhook payload, ignoring')
      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    // Check idempotency - skip if already processed
    const alreadyProcessed = await isEventAlreadyProcessed(supabase, eventId)
    if (alreadyProcessed) {
      console.log('MercadoPago webhook event already processed:', eventId)
      return new Response(
        JSON.stringify({ received: true, message: 'Already processed' }),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    // Only handle payment updates
    if (eventType === 'payment' || action.includes('payment')) {
      // Fetch payment details from MercadoPago API
      const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
      if (!mpAccessToken) {
        console.error('MERCADOPAGO_ACCESS_TOKEN not configured')
        return new Response(
          JSON.stringify({ error: 'MercadoPago not configured' }),
          { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
      }

      // Get payment details from MercadoPago API
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!paymentResponse.ok) {
        console.error('Failed to fetch payment details from MercadoPago:', paymentResponse.status)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch payment details' }),
          { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
      }

      const paymentDetails = await paymentResponse.json()
      const status = paymentDetails.status // 'approved', 'pending', 'rejected', 'cancelled', 'refunded'
      const externalReference = paymentDetails.external_reference // This should contain the order ID

      console.log('MercadoPago payment status:', status, 'external_reference:', externalReference)

      let order = null

      // Try to find order by external_reference (if it contains order_number)
      if (externalReference) {
        const { data: ordersByRef } = await supabase
          .from('orders')
          .select('id, order_number, payment_status, total, pix_key')
          .or(`order_number.eq.${externalReference},pix_key.eq.${externalReference}`)
          .limit(1)

        if (ordersByRef && ordersByRef.length > 0) {
          order = ordersByRef[0]
        }
      }

      // If not found by external_reference, try by payment ID
      if (!order) {
        order = await findOrderByMercadoPagoId(supabase, paymentId.toString())
      }

      if (!order) {
        console.log('No order found for MercadoPago payment:', paymentId)
        await recordWebhookEvent(supabase, eventId, eventType, payload)
        return new Response(
          JSON.stringify({ message: 'No matching order' }),
          { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
      }

      // Idempotency check: skip if already marked as paid
      if (order.payment_status === 'paid') {
        console.log('Order already marked as paid:', order.order_number)
        await recordWebhookEvent(supabase, eventId, eventType, payload)
        return new Response(
          JSON.stringify({ message: 'Already processed' }),
          { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
      }

      // Handle different payment statuses
      if (status === 'approved') {
        // Update order payment status
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            status: 'processing',
            payment_paid_at: new Date().toISOString(),
            pix_key: paymentId.toString(), // Store MP payment ID
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id)
          .eq('payment_status', 'pending') // Only update if still pending

        if (updateError) {
          console.error('Error updating order:', updateError)
          throw updateError
        }

        // Add status history entry
        await supabase
          .from('order_status_history')
          .insert({
            order_id: order.id,
            from_status: 'pending',
            to_status: 'processing',
            changed_by: 'system',
            changed_by_role: 'webhook',
            description: `Pagamento confirmado via MercadoPago - Payment ID: ${paymentId}`
          })
          .catch((err: any) => console.error('Error inserting status history:', err))

        console.log('Order marked as paid via MercadoPago:', order.order_number)
      } else if (status === 'rejected' || status === 'cancelled') {
        // Update order as failed/cancelled
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            payment_status: status === 'cancelled' ? 'expired' : 'failed',
            status: 'cancelled',
            pix_key: paymentId.toString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id)
          .eq('payment_status', 'pending')

        if (updateError) {
          console.error('Error updating order:', updateError)
          throw updateError
        }

        await supabase
          .from('order_status_history')
          .insert({
            order_id: order.id,
            from_status: 'pending',
            to_status: 'cancelled',
            changed_by: 'system',
            changed_by_role: 'webhook',
            description: `Pagamento ${status} via MercadoPago - Payment ID: ${paymentId}`
          })
          .catch((err: any) => console.error('Error inserting status history:', err))

        console.log('Order marked as cancelled via MercadoPago:', order.order_number)
      } else if (status === 'refunded') {
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            payment_status: 'refunded',
            pix_key: paymentId.toString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id)

        if (updateError) {
          console.error('Error updating order:', updateError)
          throw updateError
        }

        await supabase
          .from('order_status_history')
          .insert({
            order_id: order.id,
            from_status: order.payment_status,
            to_status: 'refunded',
            changed_by: 'system',
            changed_by_role: 'webhook',
            description: `Pagamento reembolsado via MercadoPago - Payment ID: ${paymentId}`
          })
          .catch((err: any) => console.error('Error inserting status history:', err))

        console.log('Order marked as refunded via MercadoPago:', order.order_number)
      }

      // Record the webhook event for idempotency
      await recordWebhookEvent(supabase, eventId, eventType, payload)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('MercadoPago webhook error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }
})
