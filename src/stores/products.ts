import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Product, Category, ProductFilters } from '../types'
import { isDemo } from '../supabase'
import { edgeApi } from '../api/edgeApi'
import { uploadProductImages, generateCdnUrl } from '../utils/githubCdn'

const PAGE_SIZE = 20
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
let productsCache: Product[] | null = null
let categoriesCache: Category[] | null = null
let cacheTimestamp = 0

function normalizeCategoryMatch(productCat: string, categoryId: string): boolean {
  if (productCat === categoryId) return true
  const normalize = (s: string) => s.toLowerCase().replace(/s$/, '').replace(/es$/, 'e')
  return normalize(productCat) === normalize(categoryId)
}

function isCacheValid(): boolean {
  return !!(productsCache && categoriesCache && (Date.now() - cacheTimestamp) < CACHE_TTL)
}

function clearCache(): void {
  productsCache = null
  categoriesCache = null
  cacheTimestamp = 0
}

// Mock data for demo mode
const mockCategories = [
  { id: 'camisetas', name: 'Camisetas', icon: '👕', sort_order: 1, is_active: true, metadata: {}, created_at: '', updated_at: '', description: null as string | null, parent_id: null as string | null, collection_id: null as string | null },
  { id: 'acessorios', name: 'Acessórios', icon: '🎀', sort_order: 2, is_active: true, metadata: {}, created_at: '', updated_at: '', description: null as string | null, parent_id: null as string | null, collection_id: null as string | null },
  { id: 'artes', name: 'Artes', icon: '🎨', sort_order: 3, is_active: true, metadata: {}, created_at: '', updated_at: '', description: null as string | null, parent_id: null as string | null, collection_id: null as string | null },
  { id: 'livros', name: 'Livros', icon: '📚', sort_order: 4, is_active: true, metadata: {}, created_at: '', updated_at: '', description: null as string | null, parent_id: null as string | null, collection_id: null as string | null },
  { id: 'canecas', name: 'Canecas', icon: '☕', sort_order: 5, is_active: true, metadata: {}, created_at: '', updated_at: '', description: null as string | null, parent_id: null as string | null, collection_id: null as string | null },
] as Partial<Category>[]

const mockProducts: Product[] = [
  {
    id: 1,
    name: 'Camiseta Bhumisparsha - Buddha Touching Earth',
    slug: 'camiseta-bhumisparsha-buddha',
    category: 'camisetas',
    price: 79.90,
    description: 'Camiseta premium com a icônica imagem do Buddha Bhumisparsha.',
    stock_type: 'print-on-demand',
    stock_quantity: 0,
    image: '/mock/tshirt-bhumisparsha.jpg',
    images: [],
    artist: 'Bhumisparsha Design',
    info: '100% algodão orgânico\nEstampa em serigrafia',
    is_active: true,
    is_featured: true,
    is_archived: false,
    tags: ['buddha', 'meditation', 'buddhist'],
    materials: [],
    color_swatches: [],
    seo_keywords: [],
    shipping_zones: [],
    weight: 0.3,
    low_stock_threshold: 5,
    fulfillment_type: 'own',
    metadata: {},
    dimensions: null,
    video_url: null,
    shipping_class: null,
    is_free_shipping: false,
    seo_title: null,
    seo_description: null,
    cost_price: null,
    compare_at_price: null,
    collection_id: null,
    subcollection_id: null,
    brand: null,
    short_description: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    variants: [
      { size: 'P', color: 'black', stock_quantity: 0, is_active: true, sort_order: 0, metadata: {} },
      { size: 'M', color: 'black', stock_quantity: 0, is_active: true, sort_order: 1, metadata: {} },
      { size: 'G', color: 'black', stock_quantity: 0, is_active: true, sort_order: 2, metadata: {} },
    ],
  },
]

export const useProductsStore = defineStore('products', () => {
  const products = ref<Product[]>([])
  const categories = ref<Category[]>([])
  const selectedProduct = ref<Product | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentPage = ref(1)
  const totalPages = ref(1)
  const totalProducts = ref(0)

  // Filter state
  const selectedCategory = ref('todos')
  const searchQuery = ref('')
  const fulfillmentFilter = ref('')
  const priceRange = ref<{ min: number | null; max: number | null }>({ min: null, max: null })

  // Computed
  const filteredProducts = computed(() => {
    let filtered = products.value

    if (selectedCategory.value !== 'todos') {
      filtered = filtered.filter(p =>
        p.category ? normalizeCategoryMatch(p.category, selectedCategory.value) : false
      )
    }

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.artist?.toLowerCase().includes(query) ||
        p.tags?.some(t => t.toLowerCase().includes(query))
      )
    }

    if (fulfillmentFilter.value) {
      filtered = filtered.filter(p => p.fulfillment_type === fulfillmentFilter.value)
    }

    if (priceRange.value.min !== null) {
      filtered = filtered.filter(p => p.price >= (priceRange.value.min ?? 0))
    }

    if (priceRange.value.max !== null) {
      filtered = filtered.filter(p => p.price <= (priceRange.value.max ?? Infinity))
    }

    return filtered
  })

  const featuredProducts = computed(() =>
    products.value.filter(p => p.is_featured && p.is_active)
  )

  const lowStockProducts = computed(() =>
    products.value.filter(p =>
      p.is_active &&
      p.stock_type !== 'print-on-demand' &&
      p.stock_quantity <= (p.low_stock_threshold || 5)
    )
  )

  // Actions
  async function fetchProducts(params: Partial<ProductFilters> = {}): Promise<void> {
    if (isDemo) {
      products.value = mockProducts
      return
    }

    loading.value = true
    error.value = null

    try {
      const response = await edgeApi.products.list({
        page: Number(params.page || currentPage.value),
        limit: Number(params.limit || PAGE_SIZE),
        ...(params.category && params.category !== 'todos' ? { category: params.category } : {}),
        ...(params.search ? { search: params.search } : {}),
        ...(params.fulfillment_type ? { fulfillment_type: params.fulfillment_type } : {}),
      })

      products.value = response.data || []
      totalProducts.value = response.count || 0
      totalPages.value = Math.ceil(totalProducts.value / PAGE_SIZE)
      currentPage.value = response.page || 1

      productsCache = products.value
      cacheTimestamp = Date.now()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch products'
    } finally {
      loading.value = false
    }
  }

  async function fetchCategories(): Promise<void> {
    if (isDemo) {
      categories.value = mockCategories as Category[]
      return
    }

    try {
      const response = await edgeApi.categories.list()
      categories.value = response.data as Category[]
      categoriesCache = categories.value
    } catch (e: unknown) {
      console.error('Failed to fetch categories:', e)
    }
  }

  async function fetchProduct(id: number): Promise<void> {
    loading.value = true
    try {
      const response = await edgeApi.products.get(id)
      selectedProduct.value = response.data
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch product'
    } finally {
      loading.value = false
    }
  }

  async function createProduct(
    product: Partial<Product>,
    variants?: Array<Record<string, unknown>>
  ): Promise<Product> {
    loading.value = true
    error.value = null

    try {
      const response = await edgeApi.products.create(product, variants)
      clearCache()
      await fetchProducts()
      return response.data
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to create product'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateProduct(
    id: number,
    product: Partial<Product>,
    variants?: Array<Record<string, unknown>>
  ): Promise<Product> {
    loading.value = true
    error.value = null

    try {
      const response = await edgeApi.products.update(id, product, variants)
      clearCache()
      await fetchProducts()
      return response.data
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to update product'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function archiveProduct(id: number): Promise<void> {
    loading.value = true
    error.value = null

    try {
      await edgeApi.products.archive(id)
      clearCache()
      await fetchProducts()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to archive product'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function bulkProducts(
    action: 'archive' | 'activate' | 'deactivate' | 'update',
    ids: number[],
    data?: Record<string, unknown>
  ): Promise<void> {
    loading.value = true
    error.value = null

    try {
      await edgeApi.products.bulk(action, ids, data)
      clearCache()
      await fetchProducts()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Bulk operation failed'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function uploadImages(
    productId: number,
    files: File[]
  ): Promise<Array<{ cdnUrl: string; path: string }>> {
    loading.value = true
    error.value = null

    try {
      const results: Array<{ cdnUrl: string; path: string }> = []
      for (const file of files) {
        const path = `products/${productId}/${file.name}`
        const result = await edgeApi.cdn.uploadImage(file, path)
        results.push({ cdnUrl: result.cdnUrl, path: result.path })
      }
      return results
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to upload images'
      throw e
    } finally {
      loading.value = false
    }
  }

  function setFilters(filters: {
    category?: string
    search?: string
    fulfillment?: string
    priceRange?: { min: number | null; max: number | null }
  }): void {
    if (filters.category !== undefined) selectedCategory.value = filters.category
    if (filters.search !== undefined) searchQuery.value = filters.search
    if (filters.fulfillment !== undefined) fulfillmentFilter.value = filters.fulfillment
    if (filters.priceRange !== undefined) priceRange.value = filters.priceRange
  }

  function clearFilters(): void {
    selectedCategory.value = 'todos'
    searchQuery.value = ''
    fulfillmentFilter.value = ''
    priceRange.value = { min: null, max: null }
  }

  return {
    products,
    categories,
    selectedProduct,
    loading,
    error,
    currentPage,
    totalPages,
    totalProducts,
    selectedCategory,
    searchQuery,
    fulfillmentFilter,
    priceRange,
    filteredProducts,
    featuredProducts,
    lowStockProducts,
    fetchProducts,
    fetchCategories,
    fetchProduct,
    createProduct,
    updateProduct,
    archiveProduct,
    bulkProducts,
    uploadImages,
    setFilters,
    clearFilters,
  }
})

// Compatibility alias for ProductsView.vue
export const useProductStore = useProductsStore
