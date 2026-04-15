<template>
  <div class="shipping-view">
    <div class="tabs">
      <button :class="['tab', { active: activeTab === 'zones' }]" @click="activeTab = 'zones'">Zonas de Envio</button>
      <button :class="['tab', { active: activeTab === 'delivery' }]" @click="activeTab = 'delivery'">Tipos de Entrega</button>
    </div>

    <!-- Zones Tab -->
    <div v-if="activeTab === 'zones'">
      <div class="page-header">
        <h2>Zonas de Envio</h2>
        <button class="btn-primary" @click="showZoneModal = true">+ Nova Zona</button>
      </div>

      <div v-if="store.loading" class="loading">Carregando...</div>

      <div class="zones-grid">
        <div v-for="zone in store.zones" :key="zone.id" class="zone-card">
          <h3>{{ zone.name }}</h3>
          <div class="zone-states">
            <span v-for="state in zone.states" :key="state" class="state-badge">{{ state }}</span>
          </div>
          <div class="zone-pricing">
            <div class="price-item">
              <span class="label">Custo Base:</span>
              <span class="value">R$ {{ zone.base_cost?.toFixed(2) }}</span>
            </div>
            <div class="price-item">
              <span class="label">Por KG:</span>
              <span class="value">R$ {{ zone.per_kg_cost?.toFixed(2) }}</span>
            </div>
            <div class="price-item">
              <span class="label">Frete Gr&aacute;tis acima de:</span>
              <span class="value">R$ {{ zone.free_shipping_above?.toFixed(2) || '-' }}</span>
            </div>
          </div>
          <div class="zone-actions">
            <button class="btn-icon" @click="editZone(zone)">✏️</button>
            <button class="btn-icon danger" @click="deleteZone(zone.id)">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delivery Types Tab -->
    <div v-if="activeTab === 'delivery'">
      <div class="page-header">
        <h2>Tipos de Entrega</h2>
      </div>

      <div class="delivery-list">
        <div v-for="type in store.deliveryTypes" :key="type.id" class="delivery-card">
          <div class="delivery-info">
            <h3>{{ type.name }}</h3>
            <p>{{ type.description }}</p>
            <div class="delivery-details">
              <span>Dias: {{ type.estimated_days_min }} - {{ type.estimated_days_max }}</span>
              <span :class="['status-badge', type.is_active ? 'active' : 'inactive']">
                {{ type.is_active ? 'Ativo' : 'Inativo' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Zone Modal -->
    <div v-if="showZoneModal || editingZone" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <h3>{{ editingZone ? 'Editar Zona' : 'Nova Zona de Envio' }}</h3>
        <form @submit.prevent="saveZone">
          <div class="form-group">
            <label>Nome *</label>
            <input v-model="form.name" required>
          </div>
          <div class="form-group">
            <label>Estados (selecione m&uacute;ltiplos)</label>
            <select v-model="form.states" multiple size="8">
              <option v-for="state in store.brazilianStates" :key="state" :value="state">
                {{ state }} - {{ store.getStateName(state) }}
              </option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Custo Base (R$)</label>
              <input v-model.number="form.base_cost" type="number" step="0.01" min="0">
            </div>
            <div class="form-group">
              <label>Custo por KG (R$)</label>
              <input v-model.number="form.per_kg_cost" type="number" step="0.01" min="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Dias Min</label>
              <input v-model.number="form.estimated_days_min" type="number" min="0">
            </div>
            <div class="form-group">
              <label>Dias Max</label>
              <input v-model.number="form.estimated_days_max" type="number" min="0">
            </div>
          </div>
          <div class="form-group">
            <label>Frete Gr&aacute;tis acima de (R$)</label>
            <input v-model.number="form.free_shipping_above" type="number" step="0.01" min="0">
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="closeModal">Cancelar</button>
            <button type="submit" class="btn-primary">{{ editingZone ? 'Salvar' : 'Criar' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useShippingStore } from '../stores/shipping'

const store = useShippingStore()
const activeTab = ref('zones')
const showZoneModal = ref(false)
const editingZone = ref(null)

const defaultForm = {
  name: '',
  states: [],
  base_cost: 0,
  per_kg_cost: 0,
  estimated_days_min: 3,
  estimated_days_max: 10,
  free_shipping_above: 200,
  is_active: true
}

const form = ref({ ...defaultForm })

function editZone(zone) {
  editingZone.value = zone
  form.value = {
    name: zone.name,
    states: zone.states || [],
    base_cost: zone.base_cost || 0,
    per_kg_cost: zone.per_kg_cost || 0,
    estimated_days_min: zone.estimated_days_min || 3,
    estimated_days_max: zone.estimated_days_max || 10,
    free_shipping_above: zone.free_shipping_above || 200,
    is_active: zone.is_active !== false
  }
  showZoneModal.value = true
}

function closeModal() {
  showZoneModal.value = false
  editingZone.value = null
  form.value = { ...defaultForm }
}

async function saveZone() {
  try {
    if (editingZone.value) {
      await store.updateZone(editingZone.value.id, form.value)
    } else {
      await store.addZone(form.value)
    }
    closeModal()
  } catch (err) {
    alert('Erro: ' + err.message)
  }
}

async function deleteZone(id) {
  if (confirm('Tem certeza?')) {
    try { await store.deleteZone(id) } catch (err) { alert('Erro: ' + err.message) }
  }
}

onMounted(async () => {
  await store.fetchZones()
  await store.fetchDeliveryTypes()
})
</script>

<style scoped>
.shipping-view { padding: 1rem; }
.tabs { display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid #2a2a4a; padding-bottom: 1rem; }
.tab { background: transparent; color: #00FF41; padding: 0.75rem 1.5rem; border: 1px solid transparent; border-radius: 4px; cursor: pointer; }
.tab.active { background: #7B2CBF; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.page-header h2 { margin: 0; color: #00FF41; }
.zones-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
.zone-card { background: #16051c; border: 1px solid #2a2a4a; border-radius: 12px; padding: 1.5rem; }
.zone-card h3 { margin: 0 0 1rem 0; color: #00FF41; }
.zone-states { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
.state-badge { background: rgba(123, 44, 191, 0.2); color: #9D4EDD; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600; }
.zone-pricing { margin-bottom: 1rem; }
.price-item { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
.price-item .label { color: #00CC33; }
.price-item .value { color: #00FF41; font-weight: 600; }
.zone-actions { display: flex; gap: 0.5rem; }
.btn-icon { background: #100314; border: 1px solid #2a2a4a; padding: 0.5rem; border-radius: 4px; cursor: pointer; }
.btn-icon.danger:hover { border-color: #ff4444; }
.delivery-list { display: grid; gap: 1rem; }
.delivery-card { background: #16051c; border: 1px solid #2a2a4a; border-radius: 12px; padding: 1.5rem; }
.delivery-info h3 { margin: 0 0 0.5rem 0; color: #00FF41; }
.delivery-info p { color: #00CC33; margin: 0 0 1rem 0; }
.delivery-details { display: flex; gap: 1rem; align-items: center; }
.status-badge { padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
.status-badge.active { background: rgba(0, 255, 65, 0.2); color: #00FF41; }
.status-badge.inactive { background: rgba(255, 68, 68, 0.2); color: #ff4444; }
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #16051c; border: 1px solid #2a2a4a; border-radius: 12px; padding: 2rem; width: 90%; max-width: 500px; }
.modal h3 { margin-top: 0; color: #00FF41; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.5rem; color: #00FF41; font-weight: 600; }
.form-group input, .form-group select { width: 100%; padding: 0.75rem; background: #100314; border: 1px solid #2a2a4a; color: #00FF41; border-radius: 4px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.modal-actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem; }
.loading { text-align: center; padding: 3rem; color: #00CC33; }
.btn-primary { background: #7B2CBF; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 600; }
.btn-secondary { background: #100314; color: #00FF41; border: 1px solid #2a2a4a; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 600; }
</style>
