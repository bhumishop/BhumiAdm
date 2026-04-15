import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { edgeApi } from '../api/edgeApi'
import type { Subcollection, SubcollectionFulfillmentType } from '../types'

const FULFILLMENT_TYPES: SubcollectionFulfillmentType[] = [
  'dropshipping',
  'handcrafted',
  'revenda',
  'print-on-demand',
  'digital',
  'own-stock'
]

export const useSubcollectionStore = defineStore('subcollections', () => {
  const subcollections = ref<Subcollection[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fulfillmentTypes = computed(() => FULFILLMENT_TYPES)

  function getByCollection(collectionId: string): Subcollection[] {
    return subcollections.value
      .filter(s => s.collection_id === collectionId)
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  function getByFulfillmentType(type: SubcollectionFulfillmentType): Subcollection[] {
    return subcollections.value.filter(s => s.fulfillment_type === type)
  }

  async function fetchSubcollections() {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.subcollections.list()
      subcollections.value = result.data || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar subcoleções'
      console.error('fetchSubcollections error:', err)
    } finally {
      loading.value = false
    }
  }

  async function addSubcollection(subcollection: Partial<Subcollection>) {
    error.value = null
    try {
      const result = await edgeApi.subcollections.create(subcollection)
      if (result.data) {
        subcollections.value.push(result.data as unknown as Subcollection)
      }
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao adicionar subcoleção'
      throw err
    }
  }

  async function updateSubcollection(id: string, updates: Partial<Subcollection>) {
    error.value = null
    try {
      const result = await edgeApi.subcollections.update(id, updates)
      if (result.data) {
        const index = subcollections.value.findIndex(s => s.id === id)
        if (index !== -1) {
          subcollections.value[index] = { ...subcollections.value[index], ...result.data }
        }
      }
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao atualizar subcoleção'
      throw err
    }
  }

  async function deleteSubcollection(id: string) {
    error.value = null
    try {
      await edgeApi.subcollections.delete(id)
      subcollections.value = subcollections.value.filter(s => s.id !== id)
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao excluir subcoleção'
      throw err
    }
  }

  return {
    subcollections,
    loading,
    error,
    fulfillmentTypes,
    getByCollection,
    getByFulfillmentType,
    fetchSubcollections,
    addSubcollection,
    updateSubcollection,
    deleteSubcollection
  }
})
