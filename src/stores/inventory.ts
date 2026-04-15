import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { edgeApi } from '../api/edgeApi'
import type { InventoryMovement, StockStatus, MovementType, Product } from '../types'

interface ProductWithVariants extends Partial<Product> {
  product_variants?: Array<{
    id?: number
    sku?: string
    size?: string
    color?: string
    stock_quantity?: number
    price_override?: number
  }>
}

export const useInventoryStore = defineStore('inventory', () => {
  const movements = ref<InventoryMovement[]>([])
  const products = ref<ProductWithVariants[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const movementTypes: MovementType[] = [
    'inbound_purchase',
    'inbound_return',
    'inbound_adjustment',
    'outbound_sale',
    'outbound_damage',
    'outbound_adjustment',
    'outbound_fulfillment'
  ]

  const movementTypeLabels: Record<MovementType, string> = {
    inbound_purchase: 'Compra de Estoque',
    inbound_return: 'Devolução',
    inbound_adjustment: 'Ajuste de Entrada',
    outbound_sale: 'Venda',
    outbound_damage: 'Produto Danificado',
    outbound_adjustment: 'Ajuste de Saída',
    outbound_fulfillment: 'Realização de Pedido'
  }

  const inventoryStats = computed(() => {
    const totalProducts = products.value.length
    const lowStock = products.value.filter(p =>
      p.stock_type === 'in-stock' &&
      (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 5)
    ).length
    const outOfStock = products.value.filter(p =>
      p.stock_type === 'in-stock' &&
      p.stock_quantity === 0
    ).length
    const printOnDemand = products.value.filter(p =>
      p.stock_type === 'print-on-demand'
    ).length
    const totalValue = products.value.reduce((sum, p) =>
      sum + ((p.cost_price ?? p.price ?? 0) * (p.stock_quantity ?? 0)), 0
    )

    return {
      totalProducts,
      lowStock,
      outOfStock,
      printOnDemand,
      totalValue
    }
  })

  async function fetchInventoryMovements(limit: number = 50) {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.inventory.getMovements({ limit })
      movements.value = (result.data as InventoryMovement[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar movimentações de estoque'
      console.error('fetchInventoryMovements error:', err)
      movements.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchProducts() {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.inventory.getProducts()
      products.value = (result.data as ProductWithVariants[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar produtos'
      console.error('fetchProducts error:', err)
      products.value = []
    } finally {
      loading.value = false
    }
  }

  async function recordMovement(movement: {
    product_id: number
    variant_id?: number | null
    movement_type: MovementType
    quantity: number
    reason?: string
    notes?: string
    reference_id?: string | null
    performed_by?: string | null
  }) {
    error.value = null

    try {
      const result = await edgeApi.inventory.recordMovement(movement)
      await fetchInventoryMovements()
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao registrar movimentação'
      console.error('recordMovement error:', err)
      throw err
    }
  }

  async function updateProductStock(productId: number, variantId: number | null, quantityChange: number) {
    error.value = null

    try {
      const result = await edgeApi.inventory.updateStock(productId, variantId, quantityChange)
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao atualizar estoque do produto'
      console.error('updateProductStock error:', err)
      throw err
    }
  }

  async function getLowStockProducts(threshold: number = 5): Promise<StockStatus[]> {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.inventory.getLowStock({ threshold })
      return (result.data as StockStatus[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar produtos com estoque baixo'
      console.error('getLowStockProducts error:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  function getMovementTypeLabel(type: MovementType | string): string {
    return movementTypeLabels[type as MovementType] || type
  }

  function getMovementTypeColor(type: MovementType | string): string {
    if (type.startsWith('inbound')) return 'success'
    if (type.startsWith('outbound')) return 'error'
    return 'neutral'
  }

  return {
    movements,
    products,
    loading,
    error,
    movementTypes,
    inventoryStats,
    fetchInventoryMovements,
    fetchProducts,
    recordMovement,
    updateProductStock,
    getLowStockProducts,
    getMovementTypeLabel,
    getMovementTypeColor
  }
})
