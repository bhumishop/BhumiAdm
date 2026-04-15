import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ABACATEPAY_API = 'https://api.abacatepay.com'

function corsHeaders(origin?: string) {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)
  const allowOrigin = allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || '*')

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
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

        const billingData = {
          frequency: data.frequency || 'ONE_TIME',
          methods: data.methods || ['CREDIT_CARD', 'PIX'],
          products: data.products.map(p => ({
            name: sanitizeString(p.name),
            price: p.price,
            quantity: p.quantity,
            description: p.description ? sanitizeString(p.description) : undefined
          })),
        }

        // Validate return URLs
        if (data.returnUrl) {
          try {
            new URL(data.returnUrl)
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
            new URL(data.completionUrl)
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
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    )
  }
})
