import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { edgeApi } from '../api/edgeApi'
import type { Collection } from '../types'

export const useCollectionStore = defineStore('collections', () => {
  const collections = ref<Collection[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeCollections = computed(() =>
    collections.value
      .filter(c => c.is_active !== false)
      .sort((a, b) => a.sort_order - b.sort_order)
  )

  async function fetchCollections() {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.collections.list()
      collections.value = result.data || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar coleções'
      console.error('fetchCollections error:', err)
    } finally {
      loading.value = false
    }
  }

  async function addCollection(collection: Partial<Collection>) {
    error.value = null
    try {
      const result = await edgeApi.collections.create(collection)
      if (result.data) {
        collections.value.push(result.data as unknown as Collection)
      }
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao adicionar coleção'
      throw err
    }
  }

  async function updateCollection(id: string, updates: Partial<Collection>) {
    error.value = null
    try {
      const result = await edgeApi.collections.update(id, updates)
      if (result.data) {
        const index = collections.value.findIndex(c => c.id === id)
        if (index !== -1) {
          collections.value[index] = { ...collections.value[index], ...result.data }
        }
      }
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao atualizar coleção'
      throw err
    }
  }

  async function deleteCollection(id: string) {
    error.value = null
    try {
      await edgeApi.collections.delete(id)
      collections.value = collections.value.filter(c => c.id !== id)
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao excluir coleção'
      throw err
    }
  }

  return {
    collections,
    loading,
    error,
    activeCollections,
    fetchCollections,
    addCollection,
    updateCollection,
    deleteCollection
  }
})
