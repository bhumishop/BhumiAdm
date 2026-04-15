import { defineStore } from 'pinia'
import { ref } from 'vue'
import { edgeApi } from '../api/edgeApi'
import type { ProductVariant } from '../types'

export const useVariantStore = defineStore('variants', () => {
  const variants = ref<ProductVariant[]>([])
  const optionValues = ref<Record<string, unknown>[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  function getByProduct(productId: number): ProductVariant[] {
    return variants.value
      .filter(v => v.product_id === productId && v.is_active !== false)
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  function getOptionValuesByType(type: string): Record<string, unknown>[] {
    return optionValues.value
      .filter(o => o['option_type'] === type)
      .sort((a, b) => (a['sort_order'] as number) - (b['sort_order'] as number))
  }

  async function fetchVariants(productId?: number) {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.variants.list(productId ? { product_id: productId } : undefined)
      variants.value = (result.data as unknown as ProductVariant[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar variantes'
      console.error('fetchVariants error:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchOptionValues() {
    try {
      const result = await edgeApi.variants.getOptions()
      optionValues.value = result.data || []
    } catch (err: unknown) {
      console.error('fetchOptionValues error:', err)
      optionValues.value = []
    }
  }

  async function addVariant(variant: Partial<ProductVariant>) {
    error.value = null
    try {
      const result = await edgeApi.variants.create(variant)
      if (result.data) {
        variants.value.push(result.data as unknown as ProductVariant)
      }
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao adicionar variante'
      throw err
    }
  }

  async function addVariantsBulk(variantList: Partial<ProductVariant>[]) {
    error.value = null
    try {
      const result = await edgeApi.variants.bulkCreate(variantList)
      if (result.data) {
        variants.value.push(...(result.data as unknown as ProductVariant[]))
      }
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao adicionar variantes'
      throw err
    }
  }

  async function updateVariant(id: number, updates: Partial<ProductVariant>) {
    error.value = null
    try {
      const result = await edgeApi.variants.update(id, updates)
      if (result.data) {
        const index = variants.value.findIndex(v => v.id === id)
        if (index !== -1) {
          variants.value[index] = { ...variants.value[index], ...result.data }
        }
      }
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao atualizar variante'
      throw err
    }
  }

  async function deleteVariant(id: number) {
    error.value = null
    try {
      await edgeApi.variants.delete(id)
      variants.value = variants.value.filter(v => v.id !== id)
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao excluir variante'
      throw err
    }
  }

  async function updateStock(sku: string, quantity: number, movementType: string = 'inbound_adjustment') {
    error.value = null
    try {
      const result = await edgeApi.variants.updateStock(sku, quantity, movementType)
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao atualizar estoque'
      throw err
    }
  }

  return {
    variants,
    optionValues,
    loading,
    error,
    getByProduct,
    getOptionValuesByType,
    fetchVariants,
    fetchOptionValues,
    addVariant,
    addVariantsBulk,
    updateVariant,
    deleteVariant,
    updateStock
  }
})
