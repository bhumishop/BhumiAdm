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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pyidnhtwlxlyuwswaazf.supabase.co'
const EDGE_FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`

/**
 * Get stored auth token from localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('bhumi_admin_token')
}

/**
 * Make authenticated request to edge function
 */
async function fetchWithAuth<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  }

  const response = await fetch(`${EDGE_FUNCTIONS_BASE}/${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    localStorage.removeItem('bhumi_admin_token')
    localStorage.removeItem('bhumi_admin')
    window.location.href = '/login'
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
      return fetchWithAuth('admin-auth', {
        method: 'POST',
        body: JSON.stringify({ googleToken: googleIdToken }),
      })
    },

    async verify(token: string): Promise<{ valid: boolean; admin: AdminUser }> {
      return fetchWithAuth('admin-auth', {
        method: 'POST',
        body: JSON.stringify({ googleToken: token, action: 'verify' }),
      })
    },

    async refresh(token: string): Promise<{ token: string }> {
      return fetchWithAuth('admin-auth', {
        method: 'POST',
        body: JSON.stringify({ googleToken: token, action: 'refresh' }),
      })
    },

    async signOut(): Promise<{ message: string }> {
      return fetchWithAuth('admin-auth', { method: 'DELETE' })
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
  // CDN Image Upload
  // ============================================
  cdn: {
    async uploadImage(
      file: File,
      path: string
    ): Promise<{ cdnUrl: string; sha: string | null; path: string }> {
      const token = getAuthToken()
      const formData = new FormData()
      formData.append('image', file)
      formData.append('path', path)

      const response = await fetch(`${EDGE_FUNCTIONS_BASE}/upload-cdn-image`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(error.error || 'Upload failed')
      }

      return response.json()
    },
  },
}
