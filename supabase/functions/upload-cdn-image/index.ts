/**
 * Supabase Edge Function: upload-cdn-image
 *
 * Uploads product images to the GitHub CDN branch (BhumiAdm/cdn)
 * using the GitHub Contents API. The GITHUB_TOKEN is stored as a
 * Supabase secret (never exposed to the frontend).
 *
 * DEPLOYMENT:
 *   1. Set GITHUB_TOKEN as a Supabase secret:
 *      supabase secrets set GITHUB_TOKEN=ghp_your_token_here
 *      (The token needs repo:contents permission for BhumiAdm repo)
 *   2. Deploy the function:
 *      supabase functions deploy upload-cdn-image
 *   3. (Optional) Set GITHUB_OWNER and GITHUB_REPO secrets if different
 *
 * Usage (from frontend or workflow):
 *   POST /functions/v1/upload-cdn-image
 *   Headers: Authorization: Bearer <supabase-key>
 *   FormData:
 *     image: <file>
 *     path:  products/12345/000_image.jpg
 *
 * Response:
 *   { cdnUrl: "https://cdn.jsdelivr.net/gh/owner/repo@cdn/products/12345/000_image.jpg", sha: "..." }
 *
 * The function also generates a WebP version and uploads it alongside.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { jwtVerify } from 'https://esm.sh/jose@5.2.0'

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') || ''
const GITHUB_OWNER = Deno.env.get('GITHUB_OWNER') || 'BhumiAdm'
const GITHUB_REPO = Deno.env.get('GITHUB_REPO') || 'BhumiAdm'
const CDN_BRANCH = Deno.env.get('CDN_BRANCH') || 'cdn'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const JWT_SECRET = Deno.env.get('JWT_SECRET') || SUPABASE_SERVICE_ROLE_KEY

const CDN_BASE = `https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@${CDN_BRANCH}`
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents`

// Production CORS - restrict to your domain
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)

function getCorsHeaders(origin?: string) {
  const allowOrigin = ALLOWED_ORIGINS.includes(origin || '') ? origin : (ALLOWED_ORIGINS[0] || 'null')
  if (ALLOWED_ORIGINS.length === 0 && !origin) {
    console.warn('ALLOWED_ORIGINS not configured - CORS will be restrictive')
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

// Allowed image content types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Validate path to prevent directory traversal
function isValidPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/')
  return (
    /^products\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|gif)$/i.test(normalized) &&
    !normalized.includes('..') &&
    !normalized.includes('//')
  )
}

/**
 * Validate JWT token for admin access using custom session tokens
 * Also accepts raw SUPABASE_SERVICE_ROLE_KEY as fallback
 */
async function validateAdminAuth(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false

  const token = authHeader.substring(7)

  // Also accept raw service role key (for server-to-server calls)
  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    return true
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET),
      { algorithms: ['HS256'] }
    )
    return payload.role === 'admin'
  } catch {
    return false
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req.headers.get('origin') || undefined) })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
    )
  }

  // Require admin authentication
  const isAdmin = await validateAdminAuth(req)
  if (!isAdmin) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: admin access required' }),
      { status: 401, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
    )
  }

  if (!GITHUB_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get('image')
    const objectPath = formData.get('path') || ''

    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'Missing "image" field in FormData' }),
        { status: 400, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: `Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}` }),
        { status: 400, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` }),
        { status: 400, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    if (!objectPath || !isValidPath(objectPath)) {
      return new Response(
        JSON.stringify({ error: 'Invalid path format. Use: products/{id}/{filename}.{ext}' }),
        { status: 400, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    // Read file as bytes
    const fileBytes = new Uint8Array(await file.arrayBuffer())

    // Upload original
    const uploadResult = await uploadToGitHub(fileBytes, objectPath, file.type)

    if (!uploadResult) {
      return new Response(
        JSON.stringify({ error: 'Failed to upload image to CDN' }),
        { status: 500, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        cdnUrl: uploadResult.cdnUrl,
        path: objectPath
      }),
      { status: 200, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('upload-cdn-image error:', err)
    return new Response(
      JSON.stringify({ error: 'Upload failed' }),
      { status: 500, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Upload a file to GitHub via the Contents API.
 */
async function uploadToGitHub(fileBytes: Uint8Array, objectPath: string, contentType: string) {
  const headers = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }

  // Check if file already exists
  const checkUrl = `${GITHUB_API}/${objectPath}?ref=${CDN_BRANCH}`
  const checkResp = await fetch(checkUrl, { headers })
  let sha: string | null = null
  if (checkResp.ok) {
    const existing = await checkResp.json()
    sha = existing.sha
    console.log(`File already exists: ${objectPath}, sha: ${sha}`)
    return { cdnUrl: `${CDN_BASE}/${objectPath}`, sha }
  }

  // Encode file as base64
  const contentB64 = btoa(String.fromCharCode(...fileBytes))

  // Upload via Contents API
  const uploadUrl = `${GITHUB_API}/${objectPath}`
  const uploadResp = await fetch(uploadUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `chore: add product image ${objectPath}`,
      content: contentB64,
      branch: CDN_BRANCH,
    }),
  })

  if (!uploadResp.ok) {
    const errorText = await uploadResp.text()
    console.error(`GitHub upload failed for ${objectPath}: ${uploadResp.status} ${errorText}`)
    return null
  }

  const data = await uploadResp.json()
  const cdnUrl = `${CDN_BASE}/${objectPath}`
  console.log(`Uploaded: ${objectPath} -> ${cdnUrl}`)
  return { cdnUrl, sha: data.content?.sha }
}

/**
 * Ensure the CDN branch exists. Creates it from default branch if needed.
 */
export async function ensureCdnBranch() {
  const headers = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
  }

  // Check if branch exists
  const branchUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/branches/${CDN_BRANCH}`
  const branchResp = await fetch(branchUrl, { headers })

  if (branchResp.ok) {
    console.log(`CDN branch '${CDN_BRANCH}' already exists`)
    return true
  }

  // Get default branch
  const repoUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`
  const repoResp = await fetch(repoUrl, { headers })
  if (!repoResp.ok) return false
  const repoData = await repoResp.json()
  const defaultBranch = repoData.default_branch || 'main'

  // Get the SHA of the default branch
  const refUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${defaultBranch}`
  const refResp = await fetch(refUrl, { headers })
  if (!refResp.ok) return false
  const refData = await refResp.json()
  const sha = refData.object.sha

  // Create the branch
  const createUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`
  const createResp = await fetch(createUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ref: `refs/heads/${CDN_BRANCH}`,
      sha,
    }),
  })

  if (createResp.ok) {
    console.log(`Created CDN branch '${CDN_BRANCH}'`)
    return true
  }

  console.error(`Failed to create branch: ${createResp.status}`)
  return false
}
