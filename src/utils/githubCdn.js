// GitHub CDN utilities for BhumiAdm admin panel
// Uploads images via the Supabase Edge Function proxy (upload-cdn-image)
// The edge function uses GITHUB_TOKEN stored as a Supabase secret (never in frontend)
// Auth is handled via the admin session token from localStorage
//
// CI/CD workflows (Python scrapers) upload directly using the GitHub token from workflow secrets

const JSDELIVR_BASE = 'https://raw.githubusercontent.com'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const EDGE_FUNCTIONS_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : ''

/**
 * Get the admin session token from localStorage
 */
function getAdminToken() {
  return localStorage.getItem('bhumi_admin_token')
}

/**
 * Check if a file already exists on the GitHub CDN by making a HEAD request.
 * jsDelivr returns 200 for existing files, 404 for missing ones.
 * @param {string} cdnUrl - The full jsDelivr CDN URL to check
 * @returns {Promise<boolean>} True if the file exists on the CDN
 */
export async function isFileOnCdn(cdnUrl) {
  try {
    const response = await fetch(cdnUrl, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Upload an image file to GitHub CDN via the Supabase Edge Function proxy.
 * Checks if the file already exists on the CDN before uploading.
 * @param {File|Blob} file - The image file to upload
 * @param {string} objectPath - The path within the CDN repo (e.g., 'products/123/001_image.jpg')
 * @returns {Promise<{cdnUrl: string, sha: string, skipped: boolean}>}
 */
export async function uploadImageToCdn(file, objectPath) {
  if (!EDGE_FUNCTIONS_BASE) {
    throw new Error('Supabase not configured. Set VITE_SUPABASE_URL environment variable.')
  }

  // Check if file already exists on CDN first
  const cdnUrl = generateCdnUrl(objectPath)
  const exists = await isFileOnCdn(cdnUrl)
  if (exists) {
    return { cdnUrl, skipped: true }
  }

  const formData = new FormData()
  formData.append('image', file)
  formData.append('path', objectPath)

  const token = getAdminToken()
  const response = await fetch(`${EDGE_FUNCTIONS_BASE}/upload-cdn-image`, {
    method: 'POST',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(error.error || `Upload failed: ${response.status}`)
  }

  return response.json()
}

/**
 * Upload multiple product images and return CDN URLs.
 * Skips files that already exist on the CDN.
 * @param {string} productId - The product ID
 * @param {File[]} files - Array of image files
 * @param {string} prefix - Directory prefix (default: 'products')
 * @returns {Promise<{urls: string[], skipped: number}>} Object with URLs and skipped count
 */
export async function uploadProductImages(productId, files, prefix = 'products') {
  const results = []
  let skipped = 0

  for (let index = 0; index < files.length; index++) {
    const file = files[index]
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${String(index).padStart(3, '0')}_image.${ext}`
    const objectPath = `${prefix}/${productId}/${filename}`
    const result = await uploadImageToCdn(file, objectPath)
    results.push(result.cdnUrl)
    if (result.skipped) skipped++
  }

  return { urls: results, skipped }
}

/**
 * Transform a Supabase storage URL or relative path to a GitHub CDN URL.
 * @param {string} url - The original URL or path
 * @returns {string} The GitHub CDN URL
 */
export function transformToCdnUrl(url) {
  if (!url) return url
  // If it's a data URL or already a valid external URL, return as-is
  if (url.startsWith('data:') || url.startsWith('http')) return url
  if (!url.includes('supabase')) return url
  try {
    const parts = url.split('/storage/v1/object/public/')
    if (parts.length < 2) return url
    const path = parts[1].split('/').slice(1).join('/')
    if (!path.startsWith('uiclap/') && !path.startsWith('products/')) {
      return generateCdnUrl(`products/${path}`)
    }
    return generateCdnUrl(path)
  } catch {
    return url
  }
}

/**
 * Check if a URL is likely to fail (invalid CDN URL pattern).
 * @param {string} url - The URL to check
 * @returns {boolean} True if the URL looks like it might fail
 */
export function isLikelyBrokenCdnUrl(url) {
  if (!url || !url.startsWith('http')) return false
  // Old jsDelivr URLs that exceeded 50MB limit are now broken
  if (url.includes('cdn.jsdelivr.net') && url.includes('cdn_images')) {
    return true
  }
  return false
}

/**
 * Generate the expected GitHub CDN URL for a product image.
 * @param {string} objectPath - Path within the CDN repo
 * @param {string} prefix - Not used, kept for API compatibility
 * @returns {string}
 */
export function generateCdnUrl(objectPath, prefix = 'products') {
  const CDN_OWNER = import.meta.env.VITE_GITHUB_OWNER || ''
  const CDN_REPO = import.meta.env.VITE_GITHUB_REPO || ''
  const CDN_BRANCH = import.meta.env.VITE_CDN_BRANCH || 'cdn'
  return `https://raw.githubusercontent.com/${CDN_OWNER}/${CDN_REPO}/${CDN_BRANCH}/${objectPath}`
}
