<template>
  <div class="subcollections-view">
    <div class="page-header">
      <h2>Sub-Cole&ccedil;&otilde;es</h2>
      <button class="btn-primary" @click="showAddModal = true">+ Nova Sub-Cole&ccedil;&atilde;o</button>
    </div>

    <div class="filters">
      <select v-model="filterCollection" class="filter-select">
        <option value="">Todas as cole&ccedil;&otilde;es</option>
        <option v-for="col in collectionStore.collections" :key="col.id" :value="col.id">
          {{ col.name }}
        </option>
      </select>
    </div>

    <div v-if="store.loading" class="loading">Carregando...</div>

    <div v-else class="subcollections-list">
      <div v-for="sub in filteredSubcollections" :key="sub.id" class="subcollection-card">
        <div class="sub-header">
          <span class="sub-icon">{{ sub.icon || '📦' }}</span>
          <div class="sub-info">
            <h3>{{ sub.name }}</h3>
            <span class="sub-slug">{{ sub.slug }}</span>
            <span class="collection-name">
              {{ getCollectionName(sub.collection_id) }}
            </span>
          </div>
        </div>
        <div class="sub-details">
          <div class="detail-item">
            <span class="label">Tipo:</span>
            <span class="value">{{ sub.fulfillment_type }}</span>
          </div>
          <div v-if="sub.third_party_store_url" class="detail-item">
            <span class="label">Store URL:</span>
            <span class="value">{{ sub.third_party_store_url }}</span>
          </div>
        </div>
        <div class="sub-footer">
          <span :class="['status-badge', sub.is_active ? 'active' : 'inactive']">
            {{ sub.is_active ? 'Ativo' : 'Inativo' }}
          </span>
          <div class="actions">
            <button class="btn-icon" @click="editSubcollection(sub)">✏️</button>
            <button class="btn-icon danger" @click="deleteSubcollection(sub.id)">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showAddModal || editingSubcollection" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <h3>{{ editingSubcollection ? 'Editar Sub-Cole&ccedil;&atilde;o' : 'Nova Sub-Cole&ccedil;&atilde;o' }}</h3>
        <form @submit.prevent="saveSubcollection">
          <div class="form-group">
            <label>Nome *</label>
            <input v-model="form.name" required>
          </div>
          <div class="form-group">
            <label>Cole&ccedil;&atilde;o *</label>
            <select v-model="form.collection_id" required>
              <option value="">Selecione...</option>
              <option v-for="col in collectionStore.collections" :key="col.id" :value="col.id">
                {{ col.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Tipo de Fulfillment *</label>
            <select v-model="form.fulfillment_type" required>
              <option v-for="type in store.fulfillmentTypes" :key="type" :value="type">
                {{ type }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Descri&ccedil;&atilde;o</label>
            <textarea v-model="form.description" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label>&Iacute;cone</label>
            <input v-model="form.icon" placeholder="📦">
          </div>
          <div class="form-group">
            <label>URL da Loja Third-Party</label>
            <input v-model="form.third_party_store_url" placeholder="https://...">
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="form.is_active"> Ativo
            </label>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="closeModal">Cancelar</button>
            <button type="submit" class="btn-primary">{{ editingSubcollection ? 'Salvar' : 'Criar' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSubcollectionStore } from '../stores/subcollections'
import { useCollectionStore } from '../stores/collections'

const store = useSubcollectionStore()
const collectionStore = useCollectionStore()
const showAddModal = ref(false)
const editingSubcollection = ref(null)
const filterCollection = ref('')

const defaultForm = {
  name: '',
  collection_id: '',
  description: '',
  icon: '📦',
  fulfillment_type: 'own-stock',
  third_party_store_url: '',
  is_active: true,
  sort_order: 0
}

const form = ref({ ...defaultForm })

const filteredSubcollections = computed(() => {
  if (!filterCollection.value) return store.subcollections
  return store.subcollections.filter(s => s.collection_id === filterCollection.value)
})

function getCollectionName(collectionId) {
  const col = collectionStore.collections.find(c => c.id === collectionId)
  return col ? col.name : collectionId
}

function editSubcollection(sub) {
  editingSubcollection.value = sub
  form.value = {
    name: sub.name,
    collection_id: sub.collection_id,
    description: sub.description || '',
    icon: sub.icon || '📦',
    fulfillment_type: sub.fulfillment_type,
    third_party_store_url: sub.third_party_store_url || '',
    is_active: sub.is_active !== false,
    sort_order: sub.sort_order || 0
  }
  showAddModal.value = true
}

function closeModal() {
  showAddModal.value = false
  editingSubcollection.value = null
  form.value = { ...defaultForm }
}

async function saveSubcollection() {
  try {
    if (editingSubcollection.value) {
      await store.updateSubcollection(editingSubcollection.value.id, form.value)
    } else {
      await store.addSubcollection(form.value)
    }
    closeModal()
  } catch (err) {
    alert('Erro: ' + err.message)
  }
}

async function deleteSubcollection(id) {
  if (confirm('Tem certeza?')) {
    try {
      await store.deleteSubcollection(id)
    } catch (err) {
      alert('Erro: ' + err.message)
    }
  }
}

onMounted(async () => {
  await Promise.all([
    collectionStore.fetchCollections(),
    store.fetchSubcollections()
  ])
})
</script>

<style scoped>
.subcollections-view { padding: 1rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
.page-header h2 { margin: 0; color: #00FF41; }
.filters { margin-bottom: 1.5rem; }
.filter-select { padding: 0.75rem; background: #100314; border: 1px solid #2a2a4a; color: #00FF41; border-radius: 8px; }
.subcollections-list { display: grid; gap: 1rem; }
.subcollection-card { background: #16051c; border: 1px solid #2a2a4a; border-radius: 12px; padding: 1.5rem; }
.sub-header { display: flex; gap: 1rem; margin-bottom: 1rem; }
.sub-icon { font-size: 2rem; }
.sub-info h3 { margin: 0 0 0.25rem 0; color: #00FF41; }
.sub-slug { font-size: 0.85rem; color: #00CC33; display: block; }
.collection-name { font-size: 0.8rem; color: #9D4EDD; }
.sub-details { margin-bottom: 1rem; }
.detail-item { margin-bottom: 0.5rem; }
.label { color: #00CC33; margin-right: 0.5rem; }
.value { color: #00FF41; }
.sub-footer { display: flex; justify-content: space-between; align-items: center; }
.status-badge { padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
.status-badge.active { background: rgba(0, 255, 65, 0.2); color: #00FF41; }
.status-badge.inactive { background: rgba(255, 68, 68, 0.2); color: #ff4444; }
.actions { display: flex; gap: 0.5rem; }
.btn-icon { background: #100314; border: 1px solid #2a2a4a; padding: 0.5rem; border-radius: 4px; cursor: pointer; }
.btn-icon.danger:hover { border-color: #ff4444; }
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #16051c; border: 1px solid #2a2a4a; border-radius: 12px; padding: 2rem; width: 90%; max-width: 500px; }
.modal h3 { margin-top: 0; color: #00FF41; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.5rem; color: #00FF41; font-weight: 600; }
.form-group input, .form-group textarea, .form-group select { width: 100%; padding: 0.75rem; background: #100314; border: 1px solid #2a2a4a; color: #00FF41; border-radius: 4px; }
.form-group input[type="checkbox"] { width: auto; margin-right: 0.5rem; }
.modal-actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem; }
.loading { text-align: center; padding: 3rem; color: #00CC33; }
.btn-primary { background: #7B2CBF; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 600; }
.btn-secondary { background: #100314; color: #00FF41; border: 1px solid #2a2a4a; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 600; }
</style>
