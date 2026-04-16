/**
 * Edge Functions API Client - Full TypeScript
 *
 * Replaces all direct Supabase API calls with edge function calls.
 * All business logic and authentication happens server-side.
 */

import type {
  AdminUser,
  Product,
  ProductFilters,
  ProductListResponse,
  Order,
  OrderFilters,
  OrderListResponse,
  OrderStats,
  Collection,
  Subcollection,
  Category,
  ShippingCalculationRequest,
  ShippingCalculationResult,
  ShippingZone,
  DashboardOverview,
  DailyMetrics,
  FulfillmentMetrics,
  FulfillmentAverages,
  InventoryMovement,
  StockStatus,
  SyncLog,
  ProductMapping,
  WebhookEvent,
  BulkAction,
} from '../types'
import router from '../router'

// Get SUPABASE_URL from Vite env variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

// Don't throw on import - fail gracefully when API is actually used
const EDGE_FUNCTIONS_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : ''

/**
 * Sanitize error messages for display to users
 * Prevents XSS via reflected error messages from backend
 */
export function sanitizeErrorMessage(msg: unknown): string {
  if (typeof msg !== 'string') return 'An unexpected error occurred'
  // Strip HTML tags and limit length
  const sanitized = msg.replace(/<[^>]*>/g, '').replace(/[<>&"']/g, (c) => {
    const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }
    return entities[c] || c
  })
  return sanitized.substring(0, 200) // Limit length
}

/**
 * Get stored auth token from localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('bhumi_admin_token')
}

/**
 * Decode JWT and check if it's near expiry (within 5 minutes)
 */
function isTokenNearExpiry(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    const payload = JSON.parse(atob(parts[1]))
    if (!payload.exp) return true
    const expiryMs = payload.exp * 1000
    const fiveMinutes = 5 * 60 * 1000
    return Date.now() >= expiryMs - fiveMinutes
  } catch {
    return true
  }
}

/**
 * Refresh the auth token
 */
async function refreshToken(): Promise<string | null> {
  try {
    if (!EDGE_FUNCTIONS_BASE) return null

    const currentToken = getAuthToken()
    if (!currentToken) return null

    const response = await fetch(`${EDGE_FUNCTIONS_BASE}/admin-auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_KEY || '',
        'Authorization': `Bearer ${currentToken}`,
      },
    })

    if (!response.ok) return null

    const data = await response.json()
    if (data.token) {
      localStorage.setItem('bhumi_admin_token', data.token)
      if (data.admin) {
        localStorage.setItem('bhumi_admin', JSON.stringify(data.admin))
      }
      localStorage.setItem('bhumi_admin_timestamp', Date.now().toString())
      return data.token
    }
    return null
  } catch {
    return null
  }
}

/**
 * Clear auth state and redirect to login
 */
function clearAuthAndRedirect(): void {
  localStorage.removeItem('bhumi_admin_token')
  localStorage.removeItem('bhumi_admin')
  localStorage.removeItem('bhumi_admin_timestamp')
  console.warn('[BhumiAdm] Authentication expired or invalid, redirecting to login')
  router.push({ name: 'login' }).catch(() => {
    window.location.href = import.meta.env.BASE_URL + 'login'
  })
}

/**
 * Make authenticated request to edge function
 */
async function fetchWithAuth<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!EDGE_FUNCTIONS_BASE) {
    throw new Error(
      'VITE_SUPABASE_URL is not configured. ' +
      'Please set it in your environment variables or GitHub repository settings.'
    )
  }

  // Login endpoint doesn't need token attachment
  const isLoginEndpoint = endpoint === 'admin-auth/login'

  let token = getAuthToken()

  // If token is near expiry, try to refresh it (skip for login)
  if (token && isTokenNearExpiry(token) && !isLoginEndpoint) {
    token = await refreshToken()
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    ...(token && !isLoginEndpoint ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  }

  const response = await fetch(`${EDGE_FUNCTIONS_BASE}/${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    // Try to refresh the token once (skip for login)
    if (!isLoginEndpoint) {
      const newToken = await refreshToken()
      if (newToken) {
        // Retry with new token
        headers['Authorization'] = `Bearer ${newToken}`
        const retryResponse = await fetch(`${EDGE_FUNCTIONS_BASE}/${endpoint}`, {
          ...options,
          headers,
        })

        if (retryResponse.ok) {
          return retryResponse.json() as Promise<T>
        }
      }
    }

    // Refresh failed or login endpoint
    console.warn(`[BhumiAdm] 401 Unauthorized on ${endpoint}`)
    clearAuthAndRedirect()
    throw new Error('Unauthorized')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

/**
 * Edge Functions API
 */
export const edgeApi = {
  // ============================================
  // Admin Authentication
  // ============================================
  auth: {
    async signIn(googleIdToken: string): Promise<{ token: string; admin: AdminUser }> {
      return fetchWithAuth('admin-auth/login', {
        method: 'POST',
        body: JSON.stringify({ idToken: googleIdToken }),
      })
    },

    async verify(): Promise<{ valid: boolean; admin: AdminUser }> {
      return fetchWithAuth('admin-auth/verify', {
        method: 'POST',
      })
    },

    async refresh(): Promise<{ token: string; admin: AdminUser }> {
      return fetchWithAuth('admin-auth/refresh', {
        method: 'POST',
      })
    },

    async signOut(): Promise<{ message: string }> {
      return fetchWithAuth('admin-auth/logout', { method: 'DELETE' })
    },

    async getAdmin(): Promise<{ admin: AdminUser }> {
      return fetchWithAuth('admin-auth/me')
    },
  },

  // ============================================
  // Products
  // ============================================
  products: {
    async list(params: ProductFilters = {}): Promise<ProductListResponse> {
      const query = new URLSearchParams(
        Object.entries(params).reduce((acc, [k, v]) => {
          if (v !== null && v !== undefined) acc[k] = String(v)
          return acc
        }, {} as Record<string, string>)
      ).toString()
      return fetchWithAuth(`list-products?${query}`)
    },

    async get(id: number): Promise<{ data: Product }> {
      return fetchWithAuth(`list-products/${id}`)
    },

    async create(
      product: Partial<Product>,
      variants?: Array<Partial<Omit<Product, 'variants'> & { variant?: Record<string, unknown> }>>
    ): Promise<{ data: Product }> {
      return fetchWithAuth('list-products', {
        method: 'POST',
        body: JSON.stringify({ product, variants }),
      })
    },

    async update(
      id: number,
      product: Partial<Product>,
      variants?: Array<Partial<Omit<Product, 'variants'> & { variant?: Record<string, unknown> }>>
    ): Promise<{ data: Product }> {
      return fetchWithAuth(`list-products/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ product, variants }),
      })
    },

    async archive(id: number): Promise<{ message: string }> {
      return fetchWithAuth(`list-products/${id}`, { method: 'DELETE' })
    },

    async bulk(
      action: BulkAction,
      ids: number[],
      data?: Record<string, unknown>
    ): Promise<{ message: string; count: number }> {
      return fetchWithAuth('list-products/bulk', {
        method: 'POST',
        body: JSON.stringify({ action, ids, data }),
      })
    },

    async getVariants(params?: { product_id?: number }): Promise<{ data: Record<string, unknown>[] }> {
      const query = params ? `?${new URLSearchParams({ product_id: String(params.product_id) }).toString()}` : ''
      return fetchWithAuth(`list-products/variants${query}`)
    },

    async getOptions(): Promise<{ data: Record<string, unknown>[] }> {
      return fetchWithAuth('list-products/options')
    },

    async createVariant(variant: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth('list-products/variants', {
        method: 'POST',
        body: JSON.stringify(variant),
      })
    },

    async createVariantsBulk(variants: Record<string, unknown>[]): Promise<{ data: Record<string, unknown>[] }> {
      return fetchWithAuth('list-products/variants/bulk', {
        method: 'POST',
        body: JSON.stringify({ variants }),
      })
    },

    async updateVariant(id: number, variant: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth(`list-products/variants/${id}`, {
        method: 'PUT',
        body: JSON.stringify(variant),
      })
    },

    async deleteVariant(id: number): Promise<{ message: string }> {
      return fetchWithAuth(`list-products/variants/${id}`, { method: 'DELETE' })
    },

    async updateVariantStock(sku: string, quantity: number, movementType: string): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth('list-products/variants/stock', {
        method: 'POST',
        body: JSON.stringify({ sku, quantity, movement_type: movementType }),
      })
    },
  },

  // ============================================
  // Orders
  // ============================================
  orders: {
    async list(params: OrderFilters = {}): Promise<OrderListResponse> {
      const query = new URLSearchParams(
        Object.entries(params).reduce((acc, [k, v]) => {
          if (v !== null && v !== undefined) acc[k] = String(v)
          return acc
        }, {} as Record<string, string>)
      ).toString()
      return fetchWithAuth(`list-orders?${query}`)
    },

    async get(id: string): Promise<{
      data: Order
      tracking: Record<string, unknown>[]
      history: Record<string, unknown>[]
    }> {
      return fetchWithAuth(`list-orders/${id}`)
    },

    async create(
      order: Partial<Order>,
      items: Record<string, unknown>[]
    ): Promise<{ data: { order_id: string; order_number: string; total: number } }> {
      return fetchWithAuth('list-orders', {
        method: 'POST',
        body: JSON.stringify({ order, items }),
      })
    },

    async update(
      id: string,
      updates: Partial<Order>
    ): Promise<{ data: Order }> {
      return fetchWithAuth(`list-orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
    },

    async updateStatus(
      id: string,
      updates: {
        status?: string
        payment_status?: string
        admin_notes?: string
        tracking_number?: string
        carrier?: string
      }
    ): Promise<{ data: Order }> {
      return fetchWithAuth(`list-orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
    },

    async addTracking(
      id: string,
      tracking: {
        tracking_number: string
        carrier: string
        delivery_type?: string
        estimated_delivery_date?: string
      }
    ): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth(`list-orders/${id}/track`, {
        method: 'POST',
        body: JSON.stringify(tracking),
      })
    },
  },

  // ============================================
  // Collections
  // ============================================
  collections: {
    async list(): Promise<{ data: Collection[] }> {
      return fetchWithAuth('list-collections?type=collections')
    },

    async create(data: Partial<Collection>): Promise<{ data: Collection }> {
      return fetchWithAuth('list-collections?type=collections', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    async update(id: string, data: Partial<Collection>): Promise<{ data: Collection }> {
      return fetchWithAuth(`list-collections?type=collections&id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },

    async delete(id: string): Promise<{ message: string }> {
      return fetchWithAuth(`list-collections?type=collections&id=${id}`, { method: 'DELETE' })
    },
  },

  // ============================================
  // Subcollections
  // ============================================
  subcollections: {
    async list(): Promise<{ data: Subcollection[] }> {
      return fetchWithAuth('list-collections?type=subcollections')
    },

    async create(data: Partial<Subcollection>): Promise<{ data: Subcollection }> {
      return fetchWithAuth('list-collections?type=subcollections', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    async update(id: string, data: Partial<Subcollection>): Promise<{ data: Subcollection }> {
      return fetchWithAuth(`list-collections?type=subcollections&id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },

    async delete(id: string): Promise<{ message: string }> {
      return fetchWithAuth(`list-collections?type=subcollections&id=${id}`, { method: 'DELETE' })
    },
  },

  // ============================================
  // Categories (legacy - via list-collections)
  // ============================================
  categories: {
    async list(): Promise<{ data: Category[] }> {
      return fetchWithAuth('list-collections?type=categories')
    },

    async create(data: Partial<Category>): Promise<{ data: Category }> {
      return fetchWithAuth('list-collections?type=categories', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    async update(id: string, data: Partial<Category>): Promise<{ data: Category }> {
      return fetchWithAuth(`list-collections?type=categories&id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },

    async delete(id: string): Promise<{ message: string }> {
      return fetchWithAuth(`list-collections?type=categories&id=${id}`, { method: 'DELETE' })
    },
  },

  // ============================================
  // Variants (alias to products.variants)
  // ============================================
  variants: {
    async list(params?: { product_id?: number }): Promise<{ data: Record<string, unknown>[] }> {
      return edgeApi.products.getVariants(params)
    },

    async getOptions(): Promise<{ data: Record<string, unknown>[] }> {
      return edgeApi.products.getOptions()
    },

    async create(variant: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
      return edgeApi.products.createVariant(variant)
    },

    async bulkCreate(variants: Record<string, unknown>[]): Promise<{ data: Record<string, unknown>[] }> {
      return edgeApi.products.createVariantsBulk(variants)
    },

    async update(id: number, variant: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
      return edgeApi.products.updateVariant(id, variant)
    },

    async delete(id: number): Promise<{ message: string }> {
      return edgeApi.products.deleteVariant(id)
    },

    async updateStock(sku: string, quantity: number, movementType: string): Promise<{ data: Record<string, unknown> }> {
      return edgeApi.products.updateVariantStock(sku, quantity, movementType)
    },
  },

  // ============================================
  // Shipping
  // ============================================
  shipping: {
    async calculate(request: ShippingCalculationRequest): Promise<{ data: ShippingCalculationResult }> {
      return fetchWithAuth('shipping-calculator/calculate', {
        method: 'POST',
        body: JSON.stringify(request),
      })
    },

    async getZones(): Promise<{ data: ShippingZone[] }> {
      return fetchWithAuth('shipping-calculator/zones')
    },

    async getDeliveryTypes(): Promise<{ data: Record<string, unknown>[] }> {
      return fetchWithAuth('shipping-calculator/delivery-types')
    },

    async createZone(zone: Partial<ShippingZone>): Promise<{ data: ShippingZone }> {
      return fetchWithAuth('shipping-calculator/zones', {
        method: 'POST',
        body: JSON.stringify(zone),
      })
    },

    async updateZone(id: string, zone: Partial<ShippingZone>): Promise<{ data: ShippingZone }> {
      return fetchWithAuth(`shipping-calculator/zones/${id}`, {
        method: 'PUT',
        body: JSON.stringify(zone),
      })
    },

    async deleteZone(id: string): Promise<{ message: string }> {
      return fetchWithAuth(`shipping-calculator/zones/${id}`, { method: 'DELETE' })
    },

    async createDeliveryType(type: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth('shipping-calculator/delivery-types', {
        method: 'POST',
        body: JSON.stringify(type),
      })
    },

    async updateDeliveryType(id: string, type: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth(`shipping-calculator/delivery-types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(type),
      })
    },

    async getStateFromCep(cep: string): Promise<{ state: string }> {
      return fetchWithAuth(`shipping-calculator/state?cep=${cep}`)
    },
  },

  // ============================================
  // Dashboard Metrics
  // ============================================
  dashboard: {
    async getOverview(params?: { days?: number }): Promise<{ data: Record<string, unknown> }> {
      const query = params ? `?days=${params.days}` : ''
      return fetchWithAuth(`dashboard-metrics/overview${query}`)
    },

    async getMetrics(params?: { days?: number }): Promise<{ data: DailyMetrics[] }> {
      const query = params ? `?days=${params.days}` : ''
      return fetchWithAuth(`dashboard-metrics/sales${query}`)
    },

    async getTopProducts(params?: { limit?: number }): Promise<{ data: Record<string, unknown>[] }> {
      const query = params ? `?limit=${params.limit}` : ''
      return fetchWithAuth(`dashboard-metrics/products${query}`)
    },

    async getFulfillmentAverages(): Promise<{ data: FulfillmentAverages }> {
      return fetchWithAuth('dashboard-metrics/fulfillment')
    },
  },

  // ============================================
  // Inventory
  // ============================================
  inventory: {
    async getMovements(params?: { limit?: number }): Promise<{ data: InventoryMovement[] }> {
      const query = params ? `?limit=${params.limit}` : ''
      return fetchWithAuth(`inventory-management${query}`)
    },

    async getProducts(): Promise<{ data: Record<string, unknown>[] }> {
      return fetchWithAuth('inventory-management/products')
    },

    async recordMovement(movement: {
      product_id: number
      variant_id?: number | null
      movement_type: string
      quantity: number
      order_id?: string | null
      notes?: string | null
    }): Promise<{ data: number; message: string }> {
      return fetchWithAuth('inventory-management', {
        method: 'POST',
        body: JSON.stringify(movement),
      })
    },

    async updateStock(productId: number, variantId: number | null, quantityChange: number): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth('inventory-management/stock', {
        method: 'PUT',
        body: JSON.stringify({ product_id: productId, variant_id: variantId, quantity_change: quantityChange }),
      })
    },

    async getLowStock(params?: { threshold?: number }): Promise<{ data: StockStatus[] }> {
      const query = params ? `?threshold=${params.threshold}` : ''
      return fetchWithAuth(`inventory-management/low-stock${query}`)
    },
  },

  // ============================================
  // Integrations
  // ============================================
  integrations: {
    async getSyncLogs(params?: { limit?: number }): Promise<{ data: SyncLog[] }> {
      const query = params ? `?limit=${params.limit}` : ''
      return fetchWithAuth(`manage-integrations/sync-log${query}`)
    },

    async triggerSync(source: string, syncType: string): Promise<{ data: SyncLog; message: string }> {
      return fetchWithAuth('manage-integrations/trigger-sync', {
        method: 'POST',
        body: JSON.stringify({ source, sync_type: syncType }),
      })
    },

    async getProductMappings(): Promise<{ data: ProductMapping[] }> {
      return fetchWithAuth('manage-integrations/mappings')
    },

    async getWebhooks(): Promise<{ data: Record<string, unknown>[] }> {
      return fetchWithAuth('manage-integrations/webhooks')
    },

    async getWebhookEvents(params?: { limit?: number }): Promise<{ data: WebhookEvent[] }> {
      const query = params ? `?limit=${params.limit}` : ''
      return fetchWithAuth(`manage-integrations/webhook-events${query}`)
    },

    async createWebhook(webhook: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth('manage-integrations/webhooks', {
        method: 'POST',
        body: JSON.stringify(webhook),
      })
    },

    async updateWebhook(id: string, webhook: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth(`manage-integrations/webhooks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(webhook),
      })
    },

    async deleteWebhook(id: string): Promise<{ message: string }> {
      return fetchWithAuth(`manage-integrations/webhooks/${id}`, { method: 'DELETE' })
    },

    async createProductMapping(mapping: Partial<ProductMapping>): Promise<{ data: ProductMapping }> {
      return fetchWithAuth('manage-integrations/mappings', {
        method: 'POST',
        body: JSON.stringify(mapping),
      })
    },

    async updateProductMapping(id: number, mapping: Partial<ProductMapping>): Promise<{ data: ProductMapping }> {
      return fetchWithAuth(`manage-integrations/mappings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(mapping),
      })
    },
  },

  // ============================================
  // Payments
  // ============================================
  payments: {
    async createBilling(action: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
      return fetchWithAuth('create-billing', {
        method: 'POST',
        body: JSON.stringify({ action, ...params }),
      })
    },

    async checkPixStatus(paymentReference: string): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth('check-pix-status', {
        method: 'POST',
        body: JSON.stringify({ payment_reference: paymentReference }),
      })
    },
  },

  // ============================================
  // Network
  // ============================================
  network: {
    async getGraph(): Promise<{ data: { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] } }> {
      return fetchWithAuth('network-graph')
    },
  },

  // ============================================
  // User Roles
  // ============================================
  userRoles: {
    async list(): Promise<{ data: Record<string, unknown>[] }> {
      return fetchWithAuth('user-roles')
    },

    async create(userRole: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth('user-roles', {
        method: 'POST',
        body: JSON.stringify(userRole),
      })
    },

    async update(id: string, userRole: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth(`user-roles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userRole),
      })
    },

    async delete(id: string): Promise<{ message: string }> {
      return fetchWithAuth(`user-roles/${id}`, { method: 'DELETE' })
    },

    async checkRole(userId: string): Promise<{ data: { role: string } }> {
      return fetchWithAuth(`user-roles/check/${userId}`)
    },
  },

  // ============================================
  // Shop Configuration
  // ============================================
  shopConfig: {
    async get(): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth('shop-config')
    },

    async save(config: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth('shop-config', {
        method: 'POST',
        body: JSON.stringify(config),
      })
    },

    async updateGateway(gateway: string, updates: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth('shop-config/gateways', {
        method: 'PUT',
        body: JSON.stringify({ gateway, updates }),
      })
    },

    async updateProductRule(productType: string, rule: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth('shop-config/rules', {
        method: 'PUT',
        body: JSON.stringify({ product_type: productType, rule }),
      })
    },

    async getAvailableGateways(location?: string, productType?: string): Promise<{ data: Record<string, unknown>[] }> {
      const params = new URLSearchParams()
      if (location) params.set('location', location)
      if (productType) params.set('product_type', productType)
      const query = params.toString() ? `?${params.toString()}` : ''
      return fetchWithAuth(`shop-config/available${query}`)
    },
  },

  // ============================================
  // Sales Analytics
  // ============================================
  sales: {
    async getStats(days?: number): Promise<{ data: Record<string, unknown> }> {
      const query = days ? `?days=${days}` : ''
      return fetchWithAuth(`sales-analytics${query}`)
    },

    async getByGateway(): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth('sales-analytics/by-gateway')
    },

    async getByLocation(): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth('sales-analytics/by-location')
    },
  },

  // ============================================
  // CDN Image Upload
  // ============================================
  cdn: {
    async uploadImage(
      file: File,
      path: string
    ): Promise<{ cdnUrl: string; sha: string | null; path: string }> {
      if (!EDGE_FUNCTIONS_BASE) {
        throw new Error(
          'VITE_SUPABASE_URL is not configured. ' +
          'Please set it in your environment variables or GitHub repository settings.'
        )
      }

      let token = getAuthToken()

      // If token is near expiry, try to refresh it
      if (token && isTokenNearExpiry(token)) {
        token = await refreshToken()
      }

      const formData = new FormData()
      formData.append('image', file)
      formData.append('path', path)

      const response = await fetch(`${EDGE_FUNCTIONS_BASE}/upload-cdn-image`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      if (response.status === 401) {
        const newToken = await refreshToken()
        if (newToken) {
          const retryResponse = await fetch(`${EDGE_FUNCTIONS_BASE}/upload-cdn-image`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${newToken}`,
            },
            body: formData,
          })

          if (retryResponse.ok) {
            return retryResponse.json()
          }
        }

        clearAuthAndRedirect()
        throw new Error('Unauthorized')
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(error.error || 'Upload failed')
      }

      return response.json()
    },
  },

  // ============================================
  // Infrastructure Manager
  // ============================================
  infraManager: {
    async getOverview(): Promise<{ data: { overview: Record<string, unknown>; functions: Record<string, unknown>[]; sessions: Record<string, unknown>[]; recent_operations: Record<string, unknown>[] } }> {
      return fetchWithAuth('infra-manager')
    },

    async getFunctions(): Promise<{ data: Record<string, unknown>[] }> {
      return fetchWithAuth('infra-manager/functions')
    },

    async getFunction(name: string): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth(`infra-manager/functions/${name}`)
    },

    async updateFunction(name: string, updates: { status?: string; config?: Record<string, unknown> }): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth(`infra-manager/functions/${name}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
    },

    async testFunction(name: string, args: Record<string, unknown> = {}): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth(`infra-manager/functions/${name}/test`, {
        method: 'POST',
        body: JSON.stringify({ args }),
      })
    },

    async getLogs(limit = 50): Promise<{ data: Record<string, unknown>[] }> {
      return fetchWithAuth(`infra-manager/logs?limit=${limit}`)
    },

    async logOperation(logEntry: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth('infra-manager/log', {
        method: 'POST',
        body: JSON.stringify(logEntry),
      })
    },

    async getOrchestratorGraph(): Promise<{ data: { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] } }> {
      return fetchWithAuth('infra-manager/orchestrator-graph')
    },
  },

  // ============================================
  // User Tracker
  // ============================================
  userTracker: {
    async createSession(sessionData: Record<string, unknown>): Promise<{ data: Record<string, unknown>; action: string }> {
      return fetchWithAuth('user-tracker/session', {
        method: 'POST',
        body: JSON.stringify(sessionData),
      })
    },

    async updateSession(sessionId: string, action: string): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth(`user-tracker/session/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      })
    },

    async getSessions(activeOnly = true): Promise<{ data: Record<string, unknown>[] }> {
      return fetchWithAuth(`user-tracker/sessions${activeOnly ? '' : '?active=false'}`)
    },

    async getSessionCounts(): Promise<{ data: { active_sessions: number; total_sessions: number } }> {
      return fetchWithAuth('user-tracker/sessions/count')
    },

    async recordGeolocation(geoData: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth('user-tracker/geolocation', {
        method: 'POST',
        body: JSON.stringify(geoData),
      })
    },

    async getGeolocations(userId?: string, limit = 50): Promise<{ data: Record<string, unknown>[] }> {
      const query = userId ? `?user_id=${userId}&limit=${limit}` : `?limit=${limit}`
      return fetchWithAuth(`user-tracker/geolocations${query}`)
    },

    async getMapData(): Promise<{ data: Record<string, unknown>[] }> {
      return fetchWithAuth('user-tracker/map')
    },

    async getActiveUsersWithGeo(): Promise<{ data: Record<string, unknown>[] }> {
      return fetchWithAuth('user-tracker/active-users')
    },
  },

  // ============================================
  // Telemetry Collector
  // ============================================
  telemetryCollector: {
    async ingestSpans(spans: Record<string, unknown>[]): Promise<{ data: Record<string, unknown>[]; accepted: number }> {
      return fetchWithAuth('telemetry-collector/spans', {
        method: 'POST',
        body: JSON.stringify(spans),
      })
    },

    async ingestMetrics(metrics: Record<string, unknown>[]): Promise<{ data: Record<string, unknown>[]; accepted: number }> {
      return fetchWithAuth('telemetry-collector/metrics', {
        method: 'POST',
        body: JSON.stringify(metrics),
      })
    },

    async getSpans(
      traceId?: string,
      name?: string,
      status?: string,
      service?: string,
      limit = 50
    ): Promise<{ data: Record<string, unknown>[] }> {
      const params = new URLSearchParams()
      if (traceId) params.set('trace_id', traceId)
      if (name) params.set('name', name)
      if (status) params.set('status_code', status)
      if (service) params.set('service_name', service)
      params.set('limit', String(limit))
      return fetchWithAuth(`telemetry-collector/spans?${params.toString()}`)
    },

    async getTrace(traceId: string): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth(`telemetry-collector/spans/${traceId}`)
    },

    async getMetrics(name?: string, type?: string, hours = 24, limit = 100): Promise<{ data: Record<string, unknown>[] }> {
      const params = new URLSearchParams()
      if (name) params.set('name', name)
      if (type) params.set('type', type)
      params.set('hours', String(hours))
      params.set('limit', String(limit))
      return fetchWithAuth(`telemetry-collector/metrics?${params.toString()}`)
    },

    async getAnalysis(hours = 24): Promise<{ data: Record<string, unknown> }> {
      return fetchWithAuth(`telemetry-collector/analysis?hours=${hours}`)
    },

    async healthCheck(): Promise<{ status: string; timestamp: string }> {
      return fetchWithAuth('telemetry-collector/health')
    },
  },
}
