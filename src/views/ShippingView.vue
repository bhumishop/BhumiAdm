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
              <span class="label">Frete Grátis acima de:</span>
              <span class="value">R$ {{ zone.free_shipping_above?.toFixed(2) || '-' }}</span>
            </div>
          </div>
          <div class="zone-actions">
            <button class="btn-icon" @click="editZone(zone)">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
</button>
            <button class="btn-icon danger" @click="deleteZone(zone.id)">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
</button>
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
            <label>Estados (selecione múltiplos)</label>
            <select v-model="form.states" multiple size="8">
              <option v-for="state in store.brazilianStates" :key="state" :value="state">
                {{ state }} - {{ store.getStateName(state) }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="form.is_international">
              Zona Internacional (R$ 150-250)
            </label>
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
            <label>Frete Grátis acima de (R$)</label>
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
  is_active: true,
  is_international: false
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
    is_active: zone.is_active !== false,
    is_international: zone.is_international || false
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
.tabs { display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: var(--border); padding-bottom: 1rem; }
.tab { background: transparent; color: var(--success); padding: 0.75rem 1.5rem; border: 1px solid transparent; border-radius: 4px; cursor: pointer; }
.tab.active { background: var(--gold); color: var(--bg-base); }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.page-header h2 { margin: 0; color: var(--success); }
.zones-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
.zone-card { background: var(--bg-surface); border: var(--border); border-radius: 12px; padding: 1.5rem; }
.zone-card h3 { margin: 0 0 1rem 0; color: var(--success); }
.zone-states { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
.state-badge { background: var(--gold-bg); color: var(--gold); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600; }
.zone-pricing { margin-bottom: 1rem; }
.price-item { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
.price-item .label { color: var(--success); }
.price-item .value { color: var(--success); font-weight: 600; }
.zone-actions { display: flex; gap: 0.5rem; }
.btn-icon { background: var(--bg-elevated); border: var(--border); padding: 0.5rem; border-radius: 4px; cursor: pointer; }
.btn-icon.danger:hover { border-color: var(--danger); }
.delivery-list { display: grid; gap: 1rem; }
.delivery-card { background: var(--bg-surface); border: var(--border); border-radius: 12px; padding: 1.5rem; }
.delivery-info h3 { margin: 0 0 0.5rem 0; color: var(--success); }
.delivery-info p { color: var(--success); margin: 0 0 1rem 0; }
.delivery-details { display: flex; gap: 1rem; align-items: center; }
.status-badge { padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
.status-badge.active { background: var(--success-bg); color: var(--success); }
.status-badge.inactive { background: var(--danger-bg); color: var(--danger); }
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: var(--bg-surface); border: var(--border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 500px; }
.modal h3 { margin-top: 0; color: var(--success); }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.5rem; color: var(--success); font-weight: 600; }
.form-group input, .form-group select { width: 100%; padding: 0.75rem; background: var(--bg-elevated); border: var(--border); color: var(--text-primary); border-radius: 4px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.modal-actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem; }
.loading { text-align: center; padding: 3rem; color: var(--success); }
.btn-primary { background: var(--gold); color: var(--bg-base); border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 600; }
.btn-secondary { background: var(--bg-elevated); color: var(--success); border: var(--border); padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 600; }
</style>
