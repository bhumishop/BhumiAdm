import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { edgeApi } from '../api/edgeApi'
import type { ShippingZone, ShippingCalculationRequest, ShippingCalculationResult } from '../types'

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

const STATE_NAMES: Record<string, string> = {
  'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia',
  'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás',
  'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais',
  'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí',
  'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul',
  'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo',
  'SE': 'Sergipe', 'TO': 'Tocantins'
}

interface DeliveryType {
  id: string
  name: string
  description: string | null
  estimated_days_min: number | null
  estimated_days_max: number | null
  is_active: boolean
}

export const useShippingStore = defineStore('shipping', () => {
  const zones = ref<ShippingZone[]>([])
  const deliveryTypes = ref<DeliveryType[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeZones = computed(() => zones.value.filter(z => z.is_active !== false))
  const activeDeliveryTypes = computed(() => deliveryTypes.value.filter(d => d.is_active !== false))
  const brazilianStates = computed(() => BRAZILIAN_STATES)

  function getStateName(state: string): string {
    return STATE_NAMES[state] || state
  }

  async function calculateShipping(request: ShippingCalculationRequest): Promise<ShippingCalculationResult | null> {
    try {
      const result = await edgeApi.shipping.calculate(request)
      return result.data || null
    } catch (err: unknown) {
      console.error('calculateShipping error:', err)
      return null
    }
  }

  async function fetchZones() {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.shipping.getZones()
      zones.value = result.data || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar zonas de frete'
      console.error('fetchZones error:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchDeliveryTypes() {
    try {
      const result = await edgeApi.shipping.getDeliveryTypes()
      deliveryTypes.value = (result.data as unknown as DeliveryType[]) || []
    } catch (err: unknown) {
      console.error('fetchDeliveryTypes error:', err)
      deliveryTypes.value = []
    }
  }

  async function addZone(zone: Partial<ShippingZone>) {
    error.value = null
    try {
      const result = await edgeApi.shipping.createZone(zone)
      if (result.data) {
        zones.value.push(result.data as ShippingZone)
      }
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao adicionar zona'
      throw err
    }
  }

  async function updateZone(id: string, updates: Partial<ShippingZone>) {
    error.value = null
    try {
      const result = await edgeApi.shipping.updateZone(id, updates)
      if (result.data) {
        const index = zones.value.findIndex(z => z.id === id)
        if (index !== -1) {
          zones.value[index] = { ...zones.value[index], ...result.data }
        }
      }
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao atualizar zona'
      throw err
    }
  }

  async function deleteZone(id: string) {
    error.value = null
    try {
      await edgeApi.shipping.deleteZone(id)
      zones.value = zones.value.filter(z => z.id !== id)
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao excluir zona'
      throw err
    }
  }

  async function addDeliveryType(type: Partial<DeliveryType>) {
    error.value = null
    try {
      const result = await edgeApi.shipping.createDeliveryType(type)
      if (result.data) {
        deliveryTypes.value.push(result.data as unknown as DeliveryType)
      }
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao adicionar tipo de entrega'
      throw err
    }
  }

  async function updateDeliveryType(id: string, updates: Partial<DeliveryType>) {
    error.value = null
    try {
      const result = await edgeApi.shipping.updateDeliveryType(id, updates)
      if (result.data) {
        const index = deliveryTypes.value.findIndex(d => d.id === id)
        if (index !== -1) {
          deliveryTypes.value[index] = { ...deliveryTypes.value[index], ...result.data }
        }
      }
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao atualizar tipo de entrega'
      throw err
    }
  }

  return {
    zones,
    deliveryTypes,
    loading,
    error,
    activeZones,
    activeDeliveryTypes,
    brazilianStates,
    getStateName,
    calculateShipping,
    fetchZones,
    fetchDeliveryTypes,
    addZone,
    updateZone,
    deleteZone,
    addDeliveryType,
    updateDeliveryType
  }
})
