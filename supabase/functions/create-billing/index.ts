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
const RATE_LIMIT_MAX = 20 // requests per window
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
  // Prefer x-real-ip from trusted proxy, never trust x-forwarded-for from untrusted sources
  return req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip') // Cloudflare
    || 'unknown'
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validate Brazilian CPF format (basic check)
 */
function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '')
  return cleaned.length === 11
}

/**
 * Sanitize string input - remove potentially dangerous characters
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[<>'"&]/g, '').trim()
}

async function callAbacatePay(endpoint: string, method: string, body: any, maxRetries = 2) {
  const apiKey = Deno.env.get('ABACATEPAY_API_KEY')
  if (!apiKey) throw new Error('ABACATEPAY_API_KEY not configured')

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }

      if (body) {
        options.body = JSON.stringify(body)
      }

      const response = await fetch(`${ABACATEPAY_API}${endpoint}`, options)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `AbacatePay API error: ${response.status}`)
      }

      return response.json()
    } catch (err) {
      lastError = err as Error
      // Don't retry on client errors (4xx)
      if (err.message?.includes('4')) {
        throw err
      }
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }
  }

  throw lastError || new Error('Unknown error calling AbacatePay API')
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
      case 'create_customer': {
        // Validate required fields
        if (!data.name || !data.email || !data.cellphone) {
          return new Response(
            JSON.stringify({ error: 'name, email, and cellphone are required' }),
            { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
          )
        }

        if (!isValidEmail(data.email)) {
          return new Response(
            JSON.stringify({ error: 'Invalid email format' }),
            { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
          )
        }

        if (data.taxId && !isValidCPF(data.taxId)) {
          return new Response(
            JSON.stringify({ error: 'Invalid CPF format' }),
            { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
          )
        }

        const customerData = {
          name: sanitizeString(data.name),
          cellphone: sanitizeString(data.cellphone),
          email: sanitizeString(data.email).toLowerCase(),
        }
        if (data.taxId) {
          customerData.taxId = sanitizeString(data.taxId)
        }
        result = await callAbacatePay('/v1/customer/create', 'POST', customerData)
        break
      }

      case 'create_pix': {
        // Validate required fields
        if (!data.amount || typeof data.amount !== 'number') {
          return new Response(
            JSON.stringify({ error: 'Valid amount is required' }),
            { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
          )
        }

        if (data.amount <= 0) {
          return new Response(
            JSON.stringify({ error: 'Amount must be positive' }),
            { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
          )
        }

        const pixData = {
          amount: data.amount,
          expiresIn: data.expiresIn || 3600,
          description: data.description ? sanitizeString(data.description) : 'Pagamento BhumiShop',
        }

        if (data.customerId) {
          pixData.customerId = sanitizeString(data.customerId)
        } else if (data.customer) {
          pixData.customer = {
            name: sanitizeString(data.customer.name),
            cellphone: sanitizeString(data.customer.cellphone),
            email: sanitizeString(data.customer.email).toLowerCase(),
            taxId: data.customer.taxId ? sanitizeString(data.customer.taxId) : undefined
          }
        }

        result = await callAbacatePay('/v1/pixQrCode/create', 'POST', pixData)

        // Normalize response
        if (result.data) {
          result = {
            id: result.data.id,
            pixCode: result.data.payload || result.data.pixCode || result.data.qrCodePayload,
            qrCode: result.data.qrCodeBase64 || result.data.brCodeBase64 || null,
            status: result.data.status || 'pending',
          }
        }
        break
      }

      case 'create_billing': {
        // Validate required fields
        if (!data.products || !Array.isArray(data.products) || data.products.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Products array is required' }),
            { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
          )
        }

        // Validate each product
        for (const product of data.products) {
          if (!product.name || !product.price || !product.quantity) {
            return new Response(
              JSON.stringify({ error: 'Each product must have name, price, and quantity' }),
              { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
            )
          }
          if (typeof product.price !== 'number' || product.price <= 0) {
            return new Response(
              JSON.stringify({ error: 'Invalid product price' }),
              { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
            )
          }
          if (typeof product.quantity !== 'number' || product.quantity <= 0) {
            return new Response(
              JSON.stringify({ error: 'Invalid product quantity' }),
              { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
            )
          }
        }

        // Validate frequency
        const validFrequencies = ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']
        const frequency = data.frequency || 'ONE_TIME'
        if (!validFrequencies.includes(frequency)) {
          return new Response(
            JSON.stringify({ error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}` }),
            { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
          )
        }

        // Validate payment methods
        const validMethods = ['CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO', 'INSTALLMENTS']
        const methods = data.methods || ['CREDIT_CARD', 'PIX']
        if (!Array.isArray(methods) || !methods.every((m: string) => validMethods.includes(m))) {
          return new Response(
            JSON.stringify({ error: `Invalid payment methods. Allowed: ${validMethods.join(', ')}` }),
            { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
          )
        }

        const billingData = {
          frequency,
          methods,
          products: data.products.map(p => ({
            name: sanitizeString(p.name).substring(0, 200),
            price: p.price,
            quantity: p.quantity,
            description: p.description ? sanitizeString(p.description).substring(0, 500) : undefined
          })),
        }

        // Validate return URLs against allowed domains
        const allowedDomains = (Deno.env.get('ALLOWED_RETURN_URL_DOMAINS') || '').split(',').filter(Boolean)
        if (data.returnUrl) {
          try {
            const url = new URL(data.returnUrl)
            if (allowedDomains.length > 0 && !allowedDomains.includes(url.hostname)) {
              return new Response(
                JSON.stringify({ error: 'returnUrl domain not allowed' }),
                { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
              )
            }
            billingData.returnUrl = data.returnUrl
          } catch {
            return new Response(
              JSON.stringify({ error: 'Invalid returnUrl URL' }),
              { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
            )
          }
        }

        if (data.completionUrl) {
          try {
            const url = new URL(data.completionUrl)
            if (allowedDomains.length > 0 && !allowedDomains.includes(url.hostname)) {
              return new Response(
                JSON.stringify({ error: 'completionUrl domain not allowed' }),
                { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
              )
            }
            billingData.completionUrl = data.completionUrl
          } catch {
            return new Response(
              JSON.stringify({ error: 'Invalid completionUrl URL' }),
              { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
            )
          }
        }

        if (data.customerId) {
          billingData.customerId = sanitizeString(data.customerId)
        } else if (data.customer) {
          billingData.customer = {
            name: sanitizeString(data.customer.name),
            cellphone: sanitizeString(data.customer.cellphone),
            email: sanitizeString(data.customer.email).toLowerCase(),
            taxId: data.customer.taxId ? sanitizeString(data.customer.taxId) : undefined
          }
        }

        result = await callAbacatePay('/v1/billing/create', 'POST', billingData)

        // Normalize response
        if (result.data) {
          result = {
            id: result.data.id,
            url: result.data.url || result.data.checkoutUrl || null,
            status: result.data.status || 'pending',
          }
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
    console.error('create-billing error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }
})
