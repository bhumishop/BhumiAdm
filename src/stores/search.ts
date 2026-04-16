import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface SearchResult {
  type: 'product' | 'order' | 'collection' | 'user' | 'page'
  id: string | number
  title: string
  subtitle?: string
  icon?: string
  url: string
  score?: number
}

export const useSearchStore = defineStore('search', () => {
  const query = ref('')
  const isOpen = ref(false)
  const recentSearches = ref<string[]>([])
  const results = ref<SearchResult[]>([])
  const selectedIndex = ref(0)
  const isSearching = ref(false)

  const hasResults = computed(() => results.value.length > 0)
  const selectedResult = computed(() => results.value[selectedIndex.value] || null)

  const maxRecentSearches = 10

  function open() {
    isOpen.value = true
    query.value = ''
    selectedIndex.value = 0
    results.value = []
  }

  function close() {
    isOpen.value = false
    query.value = ''
    results.value = []
  }

  function toggle() {
    if (isOpen.value) {
      close()
    } else {
      open()
    }
  }

  function addRecentSearch(term: string) {
    // Remove if already exists
    const index = recentSearches.value.indexOf(term)
    if (index !== -1) {
      recentSearches.value.splice(index, 1)
    }

    // Add to beginning
    recentSearches.value.unshift(term)

    // Limit to max
    if (recentSearches.value.length > maxRecentSearches) {
      recentSearches.value = recentSearches.value.slice(0, maxRecentSearches)
    }

    // Save to localStorage
    try {
      localStorage.setItem('admin_recent_searches', JSON.stringify(recentSearches.value))
    } catch {
      // Storage not available
    }
  }

  function clearRecentSearches() {
    recentSearches.value = []
    try {
      localStorage.removeItem('admin_recent_searches')
    } catch {
      // Storage not available
    }
  }

  function loadRecentSearches() {
    try {
      const stored = localStorage.getItem('admin_recent_searches')
      if (stored) {
        recentSearches.value = JSON.parse(stored)
      }
    } catch {
      // Storage not available
    }
  }

  // Fuzzy matching algorithm
  function fuzzyMatch(text: string, pattern: string): number {
    if (!pattern) return 0
    if (!text) return 0

    const textLower = text.toLowerCase()
    const patternLower = pattern.toLowerCase()

    // Exact match
    if (textLower === patternLower) return 100

    // Starts with
    if (textLower.startsWith(patternLower)) return 90

    // Contains
    if (textLower.includes(patternLower)) return 80

    // Fuzzy match
    let patternIdx = 0
    let consecutiveMatches = 0
    let maxConsecutive = 0
    let score = 0

    for (let i = 0; i < textLower.length && patternIdx < patternLower.length; i++) {
      if (textLower[i] === patternLower[patternIdx]) {
        score += 10
        consecutiveMatches++
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches)
        patternIdx++
      } else {
        consecutiveMatches = 0
      }
    }

    if (patternIdx === patternLower.length) {
      score += maxConsecutive * 5
      return Math.min(score, 75)
    }

    return 0
  }

  // Search across all data sources
  async function search(searchQuery: string) {
    query.value = searchQuery
    isSearching.value = true
    selectedIndex.value = 0

    if (!searchQuery || searchQuery.length < 2) {
      results.value = []
      isSearching.value = false
      return
    }

    const allResults: SearchResult[] = []

    // Search products
    try {
      const { useProductsStore } = await import('../stores/products')
      const productStore = useProductsStore()

      for (const product of productStore.products) {
        const titleScore = fuzzyMatch(product.name, searchQuery)
        const descScore = product.description ? fuzzyMatch(product.description, searchQuery) : 0
        const categoryScore = product.category ? fuzzyMatch(product.category, searchQuery) : 0
        const score = Math.max(titleScore, descScore, categoryScore)

        if (score > 20) {
          allResults.push({
            type: 'product',
            id: product.id,
            title: product.name,
            subtitle: `${product.category || 'Sem categoria'} - R$ ${product.price.toFixed(2)}`,
            icon: '📦',
            url: `/products`,
            score,
          })
        }
      }
    } catch {
      // Products store not available
    }

    // Search orders
    try {
      const { useOrdersStore } = await import('../stores/orders')
      const ordersStore = useOrdersStore()

      for (const order of ordersStore.orders) {
        const orderNumScore = fuzzyMatch(order.order_number, searchQuery)
        const customerScore = fuzzyMatch(order.customer_name, searchQuery)
        const emailScore = fuzzyMatch(order.customer_email, searchQuery)
        const score = Math.max(orderNumScore, customerScore, emailScore)

        if (score > 20) {
          allResults.push({
            type: 'order',
            id: order.id,
            title: `#${order.order_number}`,
            subtitle: `${order.customer_name} - R$ ${order.total.toFixed(2)}`,
            icon: '🛒',
            url: `/orders`,
            score,
          })
        }
      }
    } catch {
      // Orders store not available
    }

    // Search collections
    try {
      const { useCollectionsStore } = await import('../stores/collections')
      const collectionsStore = useCollectionsStore()

      for (const collection of collectionsStore.collections) {
        const nameScore = fuzzyMatch(collection.name, searchQuery)
        const descScore = collection.description ? fuzzyMatch(collection.description, searchQuery) : 0
        const score = Math.max(nameScore, descScore)

        if (score > 20) {
          allResults.push({
            type: 'collection',
            id: collection.id,
            title: collection.name,
            subtitle: collection.description || 'Coleção',
            icon: '📁',
            url: `/collections`,
            score,
          })
        }
      }
    } catch {
      // Collections store not available
    }

    // Search pages/routes
    const pages: SearchResult[] = [
      { type: 'page', id: 'dashboard', title: 'Dashboard', subtitle: 'Visão geral', icon: '📊', url: '/', score: fuzzyMatch('dashboard', searchQuery) },
      { type: 'page', id: 'products', title: 'Produtos', subtitle: 'Gerenciar produtos', icon: '📦', url: '/products', score: fuzzyMatch('produtos', searchQuery) },
      { type: 'page', id: 'orders', title: 'Pedidos', subtitle: 'Gerenciar pedidos', icon: '🛒', url: '/orders', score: fuzzyMatch('pedidos', searchQuery) },
      { type: 'page', id: 'collections', title: 'Coleções', subtitle: 'Gerenciar coleções', icon: '📁', url: '/collections', score: fuzzyMatch('coleções', searchQuery) },
      { type: 'page', id: 'sales', title: 'Vendas', subtitle: 'Dashboard de vendas', icon: '💰', url: '/sales', score: fuzzyMatch('vendas', searchQuery) },
      { type: 'page', id: 'payments', title: 'Pagamentos', subtitle: 'Gerenciar pagamentos', icon: '💳', url: '/payments', score: fuzzyMatch('pagamentos', searchQuery) },
      { type: 'page', id: 'integrations', title: 'Integrações', subtitle: 'Webhooks e integrações', icon: '🔗', url: '/integrations', score: fuzzyMatch('integrações', searchQuery) },
      { type: 'page', id: 'shipping', title: 'Envio', subtitle: 'Zonas de envio', icon: '🚚', url: '/shipping', score: fuzzyMatch('envio', searchQuery) },
      { type: 'page', id: 'variants', title: 'Variantes', subtitle: 'Estoque e variantes', icon: '🏷️', url: '/variants', score: fuzzyMatch('variantes', searchQuery) },
      { type: 'page', id: 'visual-orchestrator', title: 'Visual Orchestrator', subtitle: 'Infrastructure graph', icon: '🔮', url: '/visual-orchestrator', score: fuzzyMatch('orchestrator', searchQuery) },
      { type: 'page', id: 'user-roles', title: 'User Roles', subtitle: 'Gerenciar permissões', icon: '👥', url: '/user-roles', score: fuzzyMatch('user roles', searchQuery) },
    ]

    for (const page of pages) {
      if (page.score && page.score > 20) {
        allResults.push(page)
      }
    }

    // Sort by score
    results.value = allResults
      .filter(r => r.score && r.score > 20)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 50)

    isSearching.value = false
  }

  function selectNext() {
    if (selectedIndex.value < results.value.length - 1) {
      selectedIndex.value++
    }
  }

  function selectPrevious() {
    if (selectedIndex.value > 0) {
      selectedIndex.value--
    }
  }

  function executeSearch() {
    if (selectedResult.value) {
      addRecentSearch(query.value)
      close()
      // Navigate to result
      window.location.hash = selectedResult.value.url
    }
  }

  return {
    query,
    isOpen,
    recentSearches,
    results,
    selectedIndex,
    selectedResult,
    isSearching,
    hasResults,
    open,
    close,
    toggle,
    search,
    selectNext,
    selectPrevious,
    executeSearch,
    loadRecentSearches,
    clearRecentSearches,
  }
})
