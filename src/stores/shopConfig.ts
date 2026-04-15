import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { edgeApi } from '../api/edgeApi'
import type {
  ShopConfig,
  PaymentGatewayConfig,
  ProductPaymentRule,
  PaymentGateway,
  PaymentProvider,
  ProductType,
  PaymentMethodType,
  CustomerLocation,
  ConfigNode,
  ConfigEdge,
} from '../types'

const DEFAULT_GATEWAYS: PaymentGatewayConfig[] = [
  {
    id: 'gw_mercadopago',
    gateway: 'mercadopago',
    provider: 'custom',
    enabled: true,
    supported_methods: ['pix', 'card', 'boleto'],
    credentials: {},
    location_restriction: 'all',
    metadata: {},
  },
  {
    id: 'gw_abacatepay',
    gateway: 'abacatepay',
    provider: 'custom',
    enabled: true,
    supported_methods: ['pix', 'card', 'boleto'],
    credentials: {},
    location_restriction: 'all',
    metadata: {},
  },
  {
    id: 'gw_pix_bricks',
    gateway: 'pix_bricks',
    provider: 'custom',
    enabled: true,
    supported_methods: ['pix'],
    credentials: {},
    location_restriction: 'brazil',
    metadata: {},
  },
  {
    id: 'gw_umapenca',
    gateway: 'umapenca_native',
    provider: 'umapenca',
    enabled: false,
    supported_methods: ['pix', 'card', 'boleto'],
    credentials: {},
    location_restriction: 'brazil',
    metadata: {},
  },
  {
    id: 'gw_paypal',
    gateway: 'paypal',
    provider: 'custom',
    enabled: false,
    supported_methods: ['card'],
    credentials: {},
    location_restriction: 'international',
    metadata: {},
  },
]

const DEFAULT_PRODUCT_RULES: ProductPaymentRule[] = [
  {
    id: 'rule_tshirt',
    product_type: 'tshirt',
    provider: 'umapenca',
    gateways: ['mercadopago', 'abacatepay', 'umapenca_native'],
    location_overrides: {
      brazil: ['mercadopago', 'abacatepay', 'umapenca_native', 'pix_bricks'],
      international: ['mercadopago', 'abacatepay'],
    },
    priority: 1,
    is_active: true,
  },
  {
    id: 'rule_mug',
    product_type: 'mug',
    provider: 'umapenca',
    gateways: ['mercadopago', 'abacatepay'],
    location_overrides: {
      brazil: ['mercadopago', 'abacatepay', 'pix_bricks'],
      international: ['mercadopago', 'abacatepay'],
    },
    priority: 2,
    is_active: true,
  },
  {
    id: 'rule_book',
    product_type: 'book',
    provider: 'uiclap',
    gateways: ['mercadopago', 'abacatepay'],
    location_overrides: {
      brazil: ['mercadopago', 'abacatepay'],
      international: ['mercadopago', 'abacatepay'],
    },
    priority: 3,
    is_active: true,
  },
]

const DEFAULT_LOCATION_RULES = {
  brazil_gateways: ['mercadopago', 'abacatepay', 'pix_bricks', 'umapenca_native'] as PaymentGateway[],
  international_gateways: ['mercadopago', 'abacatepay'] as PaymentGateway[],
}

export const useShopConfigStore = defineStore('shopConfig', () => {
  const config = ref<ShopConfig | null>(null)
  const gateways = ref<PaymentGatewayConfig[]>(DEFAULT_GATEWAYS)
  const productRules = ref<ProductPaymentRule[]>(DEFAULT_PRODUCT_RULES)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Visual graph state
  const configNodes = ref<ConfigNode[]>([])
  const configEdges = ref<ConfigEdge[]>([])
  const selectedConfigNode = ref<ConfigNode | null>(null)

  // Computed: available gateways for a given location
  function getGatewaysForLocation(location: CustomerLocation): PaymentGatewayConfig[] {
    return gateways.value.filter(gw => {
      if (!gw.enabled) return false
      if (gw.location_restriction === 'all') return true
      return gw.location_restriction === location
    })
  }

  // Computed: available gateways for a product type and location
  function getGatewaysForProduct(
    productType: ProductType,
    location: CustomerLocation
  ): PaymentGatewayConfig[] {
    const rule = productRules.value.find(
      r => r.product_type === productType && r.is_active
    )

    if (!rule) {
      return getGatewaysForLocation(location)
    }

    // Check location-specific overrides
    const locationGateways = rule.location_overrides?.[location]
    if (locationGateways && locationGateways.length > 0) {
      return gateways.value.filter(
        gw => gw.enabled && locationGateways.includes(gw.gateway)
      )
    }

    // Fall back to rule's general gateways filtered by location
    return gateways.value.filter(
      gw => gw.enabled && rule.gateways.includes(gw.gateway)
    )
  }

  // Computed: all product types
  const productTypes = computed<ProductType[]>(() => {
    return ['tshirt', 'mug', 'smug', 'book', 'accessory', 'art', 'digital']
  })

  // Computed: all providers
  const providers = computed<PaymentProvider[]>(() => {
    return ['umapenca', 'uiclap', 'custom']
  })

  // Computed: build visual graph nodes and edges
  const visualGraph = computed(() => {
    const nodes: ConfigNode[] = []
    const edges: ConfigEdge[] = []

    // Product type nodes
    for (const pt of productTypes.value) {
      const rule = productRules.value.find(r => r.product_type === pt)
      nodes.push({
        id: `pt_${pt}`,
        type: 'product_type',
        label: pt.toUpperCase(),
        data: { product_type: pt },
        enabled: rule?.is_active ?? true,
        config: rule,
      })

      // Connect to provider
      if (rule) {
        edges.push({
          from: `pt_${pt}`,
          to: `provider_${rule.provider}`,
          type: 'assigns',
          label: `uses ${rule.provider}`,
          enabled: rule.is_active,
        })

        // Connect provider to gateways
        for (const gw of rule.gateways) {
          edges.push({
            from: `provider_${rule.provider}`,
            to: `gw_${gw}`,
            type: 'enables',
            label: gw,
            enabled: true,
          })
        }
      }
    }

    // Provider nodes
    for (const provider of providers.value) {
      const hasProducts = productRules.value.some(r => r.provider === provider)
      nodes.push({
        id: `provider_${provider}`,
        type: 'provider',
        label: provider.toUpperCase(),
        data: { provider },
        enabled: hasProducts,
      })
    }

    // Gateway nodes
    for (const gw of gateways.value) {
      nodes.push({
        id: `gw_${gw.gateway}`,
        type: 'payment_gateway',
        label: gw.gateway.toUpperCase(),
        data: { gateway: gw.gateway, provider: gw.provider },
        enabled: gw.enabled,
        config: gw,
      })

      // Location restriction edges
      if (gw.location_restriction !== 'all') {
        edges.push({
          from: `gw_${gw.gateway}`,
          to: `loc_${gw.location_restriction}`,
          type: 'restricts',
          label: `only ${gw.location_restriction}`,
          condition: `location === '${gw.location_restriction}'`,
          enabled: true,
        })
      }
    }

    // Location nodes
    for (const loc of ['brazil', 'international'] as CustomerLocation[]) {
      nodes.push({
        id: `loc_${loc}`,
        type: 'location_rule',
        label: loc.toUpperCase(),
        data: { location: loc },
        enabled: true,
      })

      // Connect location to available gateways
      const availableGws = getGatewaysForLocation(loc)
      for (const gw of availableGws) {
        edges.push({
          from: `loc_${loc}`,
          to: `gw_${gw.gateway}`,
          type: 'routes',
          label: 'available',
          enabled: true,
        })
      }
    }

    // Payment method nodes per gateway
    for (const gw of gateways.value) {
      for (const method of gw.supported_methods) {
        const methodNodeId = `method_${gw.gateway}_${method}`
        if (!nodes.some(n => n.id === methodNodeId)) {
          nodes.push({
            id: methodNodeId,
            type: 'payment_method',
            label: `${gw.gateway} > ${method}`,
            data: { gateway: gw.gateway, method },
            enabled: gw.enabled,
          })
        }
        edges.push({
          from: `gw_${gw.gateway}`,
          to: methodNodeId,
          type: 'enables',
          label: method,
          enabled: gw.enabled,
        })
      }
    }

    return { nodes, edges }
  })

  // Actions
  async function fetchConfig() {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.shopConfig.get()
      if (result.data) {
        config.value = result.data as ShopConfig
        if (result.data.payment_gateways?.length) {
          gateways.value = result.data.payment_gateways
        }
        if (result.data.product_payment_rules?.length) {
          productRules.value = result.data.product_payment_rules
        }
      }
    } catch (err: unknown) {
      // Config might not exist yet, use defaults
      error.value = null
      config.value = null
    } finally {
      loading.value = false
    }
  }

  async function saveConfig(updates: Partial<ShopConfig>) {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.shopConfig.save(updates)
      if (result.data) {
        config.value = result.data as ShopConfig
      }
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao salvar configuracao'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Gateway management
  function toggleGateway(gateway: PaymentGateway) {
    const gw = gateways.value.find(g => g.gateway === gateway)
    if (gw) {
      gw.enabled = !gw.enabled
    }
  }

  function updateGatewayConfig(gateway: PaymentGateway, updates: Partial<PaymentGatewayConfig>) {
    const gw = gateways.value.find(g => g.gateway === gateway)
    if (gw) {
      Object.assign(gw, updates)
    }
  }

  // Product rule management
  function updateProductRule(productType: ProductType, updates: Partial<ProductPaymentRule>) {
    let rule = productRules.value.find(r => r.product_type === productType)
    if (!rule) {
      rule = {
        id: `rule_${productType}`,
        product_type,
        provider: 'custom',
        gateways: [],
        priority: productRules.value.length + 1,
        is_active: true,
        ...updates,
      }
      productRules.value.push(rule)
    } else {
      Object.assign(rule, updates)
    }
  }

  function removeProductRule(productType: ProductType) {
    productRules.value = productRules.value.filter(r => r.product_type !== productType)
  }

  // Auto-configure gateways based on location rules
  function applyLocationRules() {
    // Brazil: umapenca, mercadopago, abacatepay, pix_bricks
    const brazilGws: PaymentGateway[] = ['mercadopago', 'abacatepay', 'pix_bricks']

    // International: only mercadopago and abacatepay
    const intlGws: PaymentGateway[] = ['mercadopago', 'abacatepay']

    for (const gw of gateways.value) {
      if (gw.location_restriction === 'brazil') {
        gw.enabled = brazilGws.includes(gw.gateway)
      } else if (gw.location_restriction === 'international') {
        gw.enabled = intlGws.includes(gw.gateway)
      }
    }
  }

  // Node selection for visual config
  function selectNode(nodeId: string) {
    selectedConfigNode.value = configNodes.value.find(n => n.id === nodeId) || null
  }

  function clearNodeSelection() {
    selectedConfigNode.value = null
  }

  return {
    config,
    gateways,
    productRules,
    loading,
    error,
    configNodes,
    configEdges,
    selectedConfigNode,
    productTypes,
    providers,
    visualGraph,
    getGatewaysForLocation,
    getGatewaysForProduct,
    fetchConfig,
    saveConfig,
    toggleGateway,
    updateGatewayConfig,
    updateProductRule,
    removeProductRule,
    applyLocationRules,
    selectNode,
    clearNodeSelection,
  }
})
