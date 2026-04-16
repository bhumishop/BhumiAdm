import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Rate limiting: track requests per IP
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 20
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

/**
 * Verify admin session token from Authorization header
 */
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

/**
 * Get client IP from request headers
 */
function getClientIP(req: Request): string {
  return req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip')
    || 'unknown'
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Sanitize string input
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[<>'"&]/g, '').trim()
}

/**
 * Call MercadoPago API
 */
async function callMercadoPago(endpoint: string, method: string, body: any) {
  const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN not configured')
  }

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    },
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(`https://api.mercadopago.com${endpoint}`, options)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `MercadoPago API error: ${response.status}`)
  }

  return response.json()
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

  // Require admin authentication
  const isAdmin = await verifyAdmin(req)
  if (!isAdmin) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: admin access required' }),
      { status: 401, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { action, data } = await req.json()

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    if (!data || typeof data !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Data is required' }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    let result

    switch (action) {
      case 'create_preference': {
        // Validate required fields
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Items array is required' }),
            { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
          )
        }

        // Validate items
        for (const item of data.items) {
          if (!item.title || !item.unit_price || !item.quantity) {
            return new Response(
              JSON.stringify({ error: 'Each item must have title, unit_price, and quantity' }),
              { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
            )
          }
          if (typeof item.unit_price !== 'number' || item.unit_price < 0) {
            return new Response(
              JSON.stringify({ error: 'Invalid item price' }),
              { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
            )
          }
        }

        // Build preference payload
        const preferencePayload: any = {
          items: data.items.map((item: any) => ({
            id: item.id || `item-${Date.now()}`,
            title: sanitizeString(item.title).substring(0, 256),
            description: item.description ? sanitizeString(item.description).substring(0, 256) : undefined,
            unit_price: item.unit_price,
            quantity: item.quantity,
            currency_id: 'BRL',
          })),
          payer: {
            name: data.payer?.name ? sanitizeString(data.payer.name) : undefined,
            email: data.payer?.email ? sanitizeString(data.payer.email).toLowerCase() : undefined,
            phone: {
              number: data.payer?.phone || undefined,
            },
          },
          external_reference: data.external_reference || `order-${Date.now()}`,
          notification_url: data.notification_url || `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
          back_urls: {
            success: data.back_urls?.success || data.return_url || `${Deno.env.get('ALLOWED_ORIGINS')?.split(',')[0]}/minhas-compras`,
            failure: data.back_urls?.failure || data.return_url || `${Deno.env.get('ALLOWED_ORIGINS')?.split(',')[0]}/minhas-compras`,
            pending: data.back_urls?.pending || data.return_url || `${Deno.env.get('ALLOWED_ORIGINS')?.split(',')[0]}/minhas-compras`,
          },
          payment_methods: {
            excluded_payment_types: [],
            installments: 12,
          },
          expires: false,
        }

        // Add metadata if provided
        if (data.metadata) {
          preferencePayload.metadata = data.metadata
        }

        // Add shipments if provided
        if (data.shipments) {
          preferencePayload.shipments = data.shipments
        }

        // Create preference via MercadoPago API
        result = await callMercadoPago('/checkout/preferences', 'POST', preferencePayload)

        // Return simplified response
        result = {
          id: result.id,
          init_point: result.init_point, // Checkout URL
          sandbox_init_point: result.sandbox_init_point,
          client_id: result.client_id,
          collector_id: result.collector_id,
          external_reference: result.external_reference,
        }
        break
      }

      case 'create_payment': {
        // Direct payment creation (for PIX without checkout preference)
        if (!data.transaction_amount || !data.payment_method_id) {
          return new Response(
            JSON.stringify({ error: 'transaction_amount and payment_method_id are required' }),
            { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
          )
        }

        const paymentPayload: any = {
          transaction_amount: data.transaction_amount,
          payment_method_id: data.payment_method_id, // 'pix' for PIX payments
          payer: {
            email: data.payer?.email ? sanitizeString(data.payer.email).toLowerCase() : undefined,
            first_name: data.payer?.name ? sanitizeString(data.payer.name).split(' ')[0] : undefined,
            last_name: data.payer?.name ? sanitizeString(data.payer.name).split(' ').slice(1).join(' ') : undefined,
            identification: {
              type: data.payer?.doc_type || 'CPF',
              number: data.payer?.doc_number || undefined,
            },
          },
          external_reference: data.external_reference || `order-${Date.now()}`,
          notification_url: data.notification_url || `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
          description: data.description ? sanitizeString(data.description) : 'Pagamento BhumiShop',
        }

        // Add binary mode for instant approval
        if (data.binary_mode) {
          paymentPayload.binary_mode = data.binary_mode
        }

        result = await callMercadoPago('/v1/payments', 'POST', paymentPayload)

        // For PIX, extract point_of_interaction data
        if (result.point_of_interaction?.transaction_data) {
          result = {
            id: result.id,
            status: result.status,
            point_of_interaction: {
              transaction_data: {
                qr_code: result.point_of_interaction.transaction_data.qr_code,
                qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64,
                ticket_url: result.point_of_interaction.transaction_data.ticket_url,
              }
            },
            external_reference: result.external_reference,
          }
        } else {
          result = {
            id: result.id,
            status: result.status,
            external_reference: result.external_reference,
          }
        }
        break
      }

      case 'get_payment': {
        if (!data.payment_id) {
          return new Response(
            JSON.stringify({ error: 'payment_id is required' }),
            { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
          )
        }

        result = await callMercadoPago(`/v1/payments/${data.payment_id}`, 'GET', null)

        result = {
          id: result.id,
          status: result.status,
          status_detail: result.status_detail,
          payment_method_id: result.payment_method_id,
          transaction_amount: result.transaction_amount,
          external_reference: result.external_reference,
          date_created: result.date_created,
          date_approved: result.date_approved,
          point_of_interaction: result.point_of_interaction || null,
        }
        break
      }

      default:
        return new Response(
          JSON.stringify({ error: `Invalid action: ${action}` }),
          { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        )
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('create-mercadopago-preference error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }
})
