<template>
  <div class="collections-view">
    <div class="page-header">
      <h2>Cole&ccedil;&otilde;es</h2>
      <button class="btn-primary" @click="showAddModal = true">+ Nova Cole&ccedil;&atilde;o</button>
    </div>

    <div v-if="store.loading" class="loading">Carregando...</div>

    <div v-else class="collections-grid">
      <div v-for="collection in store.collections" :key="collection.id" class="collection-card">
        <div class="card-header">
          <span class="collection-icon">{{ collection.icon || '📦' }}</span>
          <div class="collection-info">
            <h3>{{ collection.name }}</h3>
            <span class="collection-slug">{{ collection.slug }}</span>
          </div>
        </div>
        <p v-if="collection.description" class="description">{{ collection.description }}</p>
        <div class="card-footer">
          <span :class="['status-badge', collection.is_active ? 'active' : 'inactive']">
            {{ collection.is_active ? 'Ativo' : 'Inativo' }}
          </span>
          <div class="actions">
            <button class="btn-icon" @click="editCollection(collection)" title="Editar">✏️</button>
            <button class="btn-icon danger" @click="deleteCollection(collection.id)" title="Excluir">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showAddModal || editingCollection" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <h3>{{ editingCollection ? 'Editar Cole&ccedil;&atilde;o' : 'Nova Cole&ccedil;&atilde;o' }}</h3>
        <form @submit.prevent="saveCollection">
          <div class="form-group">
            <label>Nome *</label>
            <input v-model="form.name" required placeholder="Nome da coleção">
          </div>
          <div class="form-group">
            <label>Descri&ccedil;&atilde;o</label>
            <textarea v-model="form.description" rows="2" placeholder="Descrição"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>&Iacute;cone (emoji)</label>
              <input v-model="form.icon" placeholder="📦">
            </div>
            <div class="form-group">
              <label>Ordem</label>
              <input v-model.number="form.sort_order" type="number" min="0">
            </div>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="form.is_active"> Cole&ccedil;&atilde;o Ativa
            </label>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="closeModal">Cancelar</button>
            <button type="submit" class="btn-primary">{{ editingCollection ? 'Salvar' : 'Criar' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useCollectionStore } from '../stores/collections'

const store = useCollectionStore()
const showAddModal = ref(false)
const editingCollection = ref(null)

const defaultForm = {
  name: '',
  description: '',
  icon: '📦',
  sort_order: 0,
  is_active: true
}

const form = ref({ ...defaultForm })

function editCollection(collection) {
  editingCollection.value = collection
  form.value = {
    name: collection.name,
    description: collection.description || '',
    icon: collection.icon || '📦',
    sort_order: collection.sort_order || 0,
    is_active: collection.is_active !== false
  }
  showAddModal.value = true
}

function closeModal() {
  showAddModal.value = false
  editingCollection.value = null
  form.value = { ...defaultForm }
}

async function saveCollection() {
  try {
    if (editingCollection.value) {
      await store.updateCollection(editingCollection.value.id, form.value)
    } else {
      await store.addCollection(form.value)
    }
    closeModal()
  } catch (err) {
    alert('Erro: ' + err.message)
  }
}

async function deleteCollection(id) {
  if (confirm('Tem certeza? Esta ação não pode ser desfeita.')) {
    try {
      await store.deleteCollection(id)
    } catch (err) {
      alert('Erro ao excluir: ' + err.message)
    }
  }
}

onMounted(async () => {
  await store.fetchCollections()
})
</script>

<style scoped>
.collections-view {
  padding: 1rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-header h2 {
  margin: 0;
  color: #00FF41;
}

.collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.collection-card {
  background: #16051c;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  padding: 1.5rem;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.collection-icon {
  font-size: 2.5rem;
}

.collection-info h3 {
  margin: 0 0 0.25rem 0;
  color: #00FF41;
}

.collection-slug {
  font-size: 0.85rem;
  color: #00CC33;
}

.description {
  color: #00CC33;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.active {
  background: rgba(0, 255, 65, 0.2);
  color: #00FF41;
}

.status-badge.inactive {
  background: rgba(255, 68, 68, 0.2);
  color: #ff4444;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  background: #100314;
  border: 1px solid #2a2a4a;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
}

.btn-icon:hover {
  border-color: #7B2CBF;
}

.btn-icon.danger:hover {
  border-color: #ff4444;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #16051c;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  padding: 2rem;
  width: 90%;
  max-width: 500px;
}

.modal h3 {
  margin-top: 0;
  color: #00FF41;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #00FF41;
  font-weight: 600;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  background: #100314;
  border: 1px solid #2a2a4a;
  color: #00FF41;
  border-radius: 4px;
}

.form-group input[type="checkbox"] {
  width: auto;
  margin-right: 0.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #00CC33;
}

.btn-primary {
  background: #7B2CBF;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.btn-primary:hover {
  background: #9D4EDD;
}

.btn-secondary {
  background: #100314;
  color: #00FF41;
  border: 1px solid #2a2a4a;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
</style>
