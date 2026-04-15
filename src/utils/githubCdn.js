// GitHub CDN utilities for BhumiAdm admin panel
// Uploads images via the Supabase Edge Function proxy (upload-cdn-image)
// The edge function uses GITHUB_TOKEN stored as a Supabase secret (never in frontend)
// Auth is handled via the admin session token from localStorage
//
// CI/CD workflows (Python scrapers) upload directly using the GitHub token from workflow secrets

const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pyidnhtwlxlyuwswaazf.supabase.co'
const EDGE_FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`

/**
 * Get the admin session token from localStorage
 */
function getAdminToken() {
  return localStorage.getItem('bhumi_admin_token')
}

/**
 * Upload an image file to GitHub CDN via the Supabase Edge Function proxy.
 * @param {File|Blob} file - The image file to upload
 * @param {string} objectPath - The path within the CDN repo (e.g., 'products/123/001_image.jpg')
 * @returns {Promise<{cdnUrl: string, sha: string}>}
 */
export async function uploadImageToCdn(file, objectPath) {
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
 * @param {string} productId - The product ID
 * @param {File[]} files - Array of image files
 * @param {string} prefix - Directory prefix (default: 'products')
 * @returns {Promise<string[]>} Array of CDN URLs
 */
export async function uploadProductImages(productId, files, prefix = 'products') {
  const uploadPromises = files.map((file, index) => {
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${String(index).padStart(3, '0')}_image.${ext}`
    const objectPath = `${prefix}/${productId}/${filename}`
    return uploadImageToCdn(file, objectPath)
  })

  const results = await Promise.all(uploadPromises)
  return results.map(r => r.cdnUrl)
}

/**
 * Transform a Supabase storage URL or relative path to a GitHub CDN URL.
 * @param {string} url - The original URL or path
 * @returns {string} The GitHub CDN URL
 */
export function transformToCdnUrl(url) {
  if (!url || !url.includes('supabase')) return url
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
 * Generate the expected GitHub CDN URL for a product image.
 * @param {string} objectPath - Path within the CDN repo
 * @param {string} prefix - Not used, kept for API compatibility
 * @returns {string}
 */
export function generateCdnUrl(objectPath, prefix = 'products') {
  const CDN_OWNER = import.meta.env.VITE_GITHUB_OWNER || ''
  const CDN_REPO = import.meta.env.VITE_GITHUB_REPO || ''
  const CDN_BRANCH = import.meta.env.VITE_CDN_BRANCH || 'cdn'
  return `https://cdn.jsdelivr.net/gh/${CDN_OWNER}/${CDN_REPO}@${CDN_BRANCH}/${objectPath}`
}
