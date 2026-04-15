/**
 * Supabase Edge Function: shop-config
 *
 * Manages shop configuration including payment gateways, product rules, and location settings.
 *
 * Endpoints:
 *   GET    /shop-config              - Get current config
 *   POST   /shop-config              - Save/update config
 *   PUT    /shop-config/gateways     - Update gateway config
 *   PUT    /shop-config/rules        - Update product payment rules
 *   GET    /shop-config/available    - Get available gateways for location/product
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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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
    return payload.role === 'admin' || payload.role === 'super_admin'
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
  const action = pathParts[pathParts.length - 1]

  try {
    // GET /shop-config - Get current configuration
    if (req.method === 'GET' && action === 'shop-config') {
      const { data: config, error: configError } = await supabase
        .from('shop_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (configError && configError.code !== 'PGRST116') {
        // Config doesn't exist yet, return defaults
        return new Response(
          JSON.stringify({ data: getDefaultConfig() }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      // Get payment gateways (mask credentials)
      const { data: gateways } = await supabase
        .from('payment_gateway_config')
        .select('*')
        .order('gateway')

      // Mask credentials in response
      const maskedGateways = (gateways || []).map((gw: Record<string, unknown>) => {
        const masked = { ...gw }
        if (masked.credentials && typeof masked.credentials === 'object') {
          const cred = masked.credentials as Record<string, unknown>
          const maskedCred: Record<string, unknown> = {}
          for (const key of Object.keys(cred)) {
            const val = String(cred[key] || '')
            maskedCred[key] = val.length > 4 ? `${'*'.repeat(val.length - 4)}${val.slice(-4)}` : '****'
          }
          masked.credentials = maskedCred
        }
        return masked
      })

      // Get product payment rules
      const { data: rules } = await supabase
        .from('product_payment_rules')
        .select('*')
        .order('priority')

      return new Response(
        JSON.stringify({
          data: {
            ...config,
            payment_gateways: maskedGateways,
            product_payment_rules: rules || [],
          }
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // POST /shop-config - Save configuration
    if (req.method === 'POST' && action === 'shop-config') {
      const body = await req.json()

      // Save main config
      const { data: config, error: configError } = await supabase
        .from('shop_config')
        .upsert({
          id: body.id || 'default',
          store_name: body.store_name,
          store_description: body.store_description,
          contact_email: body.contact_email,
          whatsapp: body.whatsapp,
          instagram: body.instagram,
          external_links: body.external_links,
          shipping: body.shipping,
          policies: body.policies,
          banner: body.banner,
          location_rules: body.location_rules,
          metadata: body.metadata,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (configError) {
        // Try insert if upsert fails
        const { data: insertedConfig } = await supabase
          .from('shop_config')
          .insert({
            id: 'default',
            store_name: body.store_name,
            store_description: body.store_description,
            contact_email: body.contact_email,
            whatsapp: body.whatsapp,
            instagram: body.instagram,
            external_links: body.external_links,
            shipping: body.shipping,
            policies: body.policies,
            banner: body.banner,
            location_rules: body.location_rules,
            metadata: body.metadata,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single()

        body.id = 'default'
      } else {
        body.id = config?.id || 'default'
      }

      // Save payment gateways
      if (body.payment_gateways?.length) {
        for (const gw of body.payment_gateways) {
          await supabase
            .from('payment_gateway_config')
            .upsert({
              id: gw.id,
              gateway: gw.gateway,
              provider: gw.provider,
              enabled: gw.enabled,
              supported_methods: gw.supported_methods,
              credentials: gw.credentials,
              location_restriction: gw.location_restriction,
              min_amount: gw.min_amount,
              max_amount: gw.max_amount,
              metadata: gw.metadata,
            })
        }
      }

      // Save product payment rules
      if (body.product_payment_rules?.length) {
        for (const rule of body.product_payment_rules) {
          await supabase
            .from('product_payment_rules')
            .upsert({
              id: rule.id,
              product_type: rule.product_type,
              provider: rule.provider,
              gateways: rule.gateways,
              location_overrides: rule.location_overrides,
              priority: rule.priority,
              is_active: rule.is_active,
            })
        }
      }

      return new Response(
        JSON.stringify({
          data: {
            ...body,
            updated_at: new Date().toISOString(),
          },
          message: 'Configuration saved successfully'
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /shop-config/gateways - Update gateway configuration
    if (req.method === 'PUT' && action === 'gateways') {
      const body = await req.json()
      const { gateway, updates } = body

      if (!gateway) {
        return new Response(
          JSON.stringify({ error: 'gateway is required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('payment_gateway_config')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('gateway', gateway)
        .select()
        .single()

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to update gateway', details: error.message }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /shop-config/rules - Update product payment rules
    if (req.method === 'PUT' && action === 'rules') {
      const body = await req.json()
      const { product_type, rule } = body

      if (!product_type || !rule) {
        return new Response(
          JSON.stringify({ error: 'product_type and rule are required' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabase
        .from('product_payment_rules')
        .upsert({
          id: rule.id || `rule_${product_type}`,
          product_type,
          ...rule,
        })
        .select()
        .single()

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to update rule', details: error.message }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ data }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // GET /shop-config/available - Get available gateways
    if (req.method === 'GET' && action === 'available') {
      const location = url.searchParams.get('location')
      const productType = url.searchParams.get('product_type')

      // Get enabled gateways
      let gatewaysQuery = supabase
        .from('payment_gateway_config')
        .select('*')
        .eq('enabled', true)

      if (location) {
        gatewaysQuery = gatewaysQuery.or(`location_restriction.eq.all,location_restriction.eq.${location}`)
      }

      const { data: gateways } = await gatewaysQuery

      let result = gateways || []

      // Filter by product type rules if specified
      if (productType) {
        const { data: rule } = await supabase
          .from('product_payment_rules')
          .select('*')
          .eq('product_type', productType)
          .eq('is_active', true)
          .single()

        if (rule) {
          const allowedGateways = rule.location_overrides?.[location || ''] || rule.gateways || []
          result = result.filter(gw => allowedGateways.includes(gw.gateway))
        }
      }

      return new Response(
        JSON.stringify({ data: result }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('shop-config error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})

function getDefaultConfig() {
  return {
    id: 'default',
    store_name: 'BHUMI SHOP',
    store_description: 'Arte, Conhecimento e Criatividade',
    contact_email: '',
    whatsapp: '',
    instagram: '@bhumi',
    external_links: {},
    shipping: {
      free_shipping_above: 199,
      default_shipping: 15,
      production_days: 5,
    },
    policies: {
      return_policy: '',
      shipping_info: '',
    },
    banner: {
      title: 'BHUMI SHOP',
      subtitle: 'Arte, Conhecimento e Criatividade',
      image_url: '',
    },
    payment_gateways: [],
    product_payment_rules: [],
    location_rules: {
      brazil_gateways: ['mercadopago', 'abacatepay', 'pix_bricks'],
      international_gateways: ['mercadopago', 'abacatepay'],
    },
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}
