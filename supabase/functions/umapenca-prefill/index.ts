/**
 * Supabase Edge Function: umapenca-prefill
 *
 * Generates a signed JWT token containing user registration data
 * and returns a redirect URL to UmaPenca registration page with pre-filled form.
 *
 * Flow:
 * 1. User registers on BhumiShop
 * 2. After successful registration, call this function with user data
 * 3. Function creates JWT with user info and returns redirect URL
 * 4. Client redirects to UmaPenca registration with ?token=JWT
 * 5. UmaPenca (or client-side script) decodes token and pre-fills form
 * 6. User only needs to set password and confirm (no re-typing data)
 *
 * Usage:
 *   POST /umapenca-prefill
 *   Body: {
 *     user: { name, email, phone, cpf, birthdate, country, address, ... },
 *     redirect: true  // if true, returns redirect URL; if false/omitted, returns token
 *   }
 *   Response: { url, token, expiresIn }
 *
 * International Shipping Support:
 * - Supports Brazilian CPF and international tax IDs
 * - Stores country_id for shipping calculation
 * - Pre-fills address data for both domestic and international
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { SignJWT } from 'https://esm.sh/jose@5.2.0'

const JWT_SECRET = Deno.env.get('JWT_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const UMA_PENCA_STORE_URL = Deno.env.get('UMA_PENCA_STORE_URL') || 'https://prataprint.bhumisparshaschool.org'
const UMA_PENCA_REGISTER_URL = `${UMA_PENCA_STORE_URL}/cadastrar`

// Country ID mapping (Chico Rei platform)
const COUNTRY_IDS: Record<string, number> = {
  'BR': 245,  // Brazil
  'AR': 41,   // Argentina
  'US': 243,  // United States
  'PT': 183,  // Portugal
  'DE': 82,   // Germany
  'FR': 75,   // France
  'ES': 203,  // Spain
  'GB': 232,  // United Kingdom
  'CA': 39,   // Canada
  'AU': 14,   // Australia
}

function corsHeaders(origin?: string) {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)
  const allowOrigin = allowedOrigins.includes(origin || '') ? origin : (allowedOrigins[0] || '*')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Sanitize string input to prevent XSS
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[<>'"&]/g, '').trim()
}

/**
 * Extract name parts
 */
function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) {
    return { first: parts[0], last: '.' }
  }
  return {
    first: parts[0],
    last: parts.slice(1).join(' ')
  }
}

/**
 * Validate Brazilian CPF
 */
function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return false
  if (/^(\d)\1+$/.test(digits)) return false // Reject all same digits
  // Basic validation - can be enhanced with full CPF algorithm
  return true
}

/**
 * Create signed JWT with user registration data
 */
async function createPrefillToken(userData: Record<string, unknown>): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET)

  return await new SignJWT({
    type: 'umapenca_prefill',
    user: userData,
    ref: 'bhumi-shop',
    created_at: new Date().toISOString()
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30m') // Token valid for 30 minutes
    .setJti(crypto.randomUUID())
    .sign(secret)
}

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = await req.json()
    const { user, redirect = true } = body

    if (!user || !user.name || !user.email) {
      return new Response(
        JSON.stringify({ error: 'user object with name and email is required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Determine country
    const countryCode = (user.country || 'BR').toUpperCase()
    const countryId = COUNTRY_IDS[countryCode] || 245 // Default to Brazil

    // Sanitize and prepare user data
    const fullName = sanitizeString(user.name)
    const { first, last } = splitName(fullName)

    // Handle CPF/tax ID validation
    let docNumber = sanitizeString(user.cpf || user.taxId || '')
    if (countryCode === 'BR' && docNumber && !validateCPF(docNumber)) {
      // Invalid CPF for Brazil - will be caught by UmaPenca
      console.warn(`Invalid CPF provided: ${docNumber}`)
    }

    // Parse birthdate
    let birthdate = { date: '1990-01-01' } // Default
    if (user.birthdate) {
      if (typeof user.birthdate === 'string') {
        birthdate = { date: user.birthdate }
      } else if (typeof user.birthdate === 'object' && user.birthdate.date) {
        birthdate = { date: user.birthdate.date }
      }
    }

    const prefillData = {
      first_name: first.toUpperCase(),
      last_name: last.toUpperCase(),
      email: sanitizeString(user.email).toLowerCase(),
      phone: sanitizeString(user.phone || ''),
      ddi: user.ddi || (countryCode === 'BR' ? 55 : 1),
      doc_number: docNumber,
      birthdate,
      country_id: countryId,
      country_code: countryCode,
      tipo_pessoa: user.tipo_pessoa || 0,
      from_store: 'bhumisprint',
      // Address fields (for international shipping)
      address: sanitizeString(user.address || ''),
      number: sanitizeString(user.number || ''),
      complement: sanitizeString(user.complement || ''),
      neighborhood: sanitizeString(user.neighborhood || ''),
      city: sanitizeString(user.city || ''),
      state: sanitizeString(user.state || ''),
      postal_code: sanitizeString(user.postalCode || user.cep || ''),
      // Shipping metadata
      shipping_notes: sanitizeString(user.notes || ''),
    }

    // Create signed token
    const token = await createPrefillToken(prefillData)

    // Log the prefill attempt for audit
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      await fetch(`${SUPABASE_URL}/rest/v1/umapenca_prefill_logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          user_email: prefillData.email,
          user_country: countryCode,
          created_at: new Date().toISOString(),
          ref: 'bhumi-shop',
          token_jti: crypto.randomUUID()
        })
      }).catch(() => {}) // Table may not exist, don't fail
    } catch {
      // Silent fail for audit logging
    }

    // Build redirect URL with token
    const redirectUrl = `${UMA_PENCA_REGISTER_URL}?token=${token}&ref=bhumi-shop`

    // Return based on redirect preference
    if (redirect) {
      return new Response(
        JSON.stringify({
          url: redirectUrl,
          token,
          expiresIn: '30m',
          message: 'Redirect to UmaPenca registration'
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({
          token,
          expiresIn: '30m',
          user: prefillData,
          message: 'Token generated - client should handle redirect'
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('umapenca-prefill error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
