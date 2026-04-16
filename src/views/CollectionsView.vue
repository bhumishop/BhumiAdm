<template>
  <div class="collections-view">
    <div class="page-header">
      <div class="header-content">
        <span class="page-label">COLLECTIONS</span>
        <h2 class="page-title">Cole&ccedil;&otilde;es</h2>
      </div>
      <button class="btn-primary" @click="showAddModal = true">
        <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Nova Cole&ccedil;&atilde;o
      </button>
    </div>

    <div v-if="store.loading" class="loading">
      <svg class="loading-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      Carregando...
    </div>

    <div v-else class="collections-grid">
      <div v-for="collection in store.collections" :key="collection.id" class="collection-card">
        <div class="card-header">
          <span class="collection-icon">
            <svg v-if="!collection.icon || collection.icon === '📦'" class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
            <span v-else class="icon-emoji">{{ collection.icon }}</span>
          </span>
          <div class="collection-info">
            <h3>{{ collection.name }}</h3>
            <span class="collection-slug">{{ collection.slug }}</span>
          </div>
        </div>
        <p v-if="collection.description" class="description">{{ collection.description }}</p>
        <div class="card-footer">
          <span :class="['status-badge', collection.is_active ? 'active' : 'inactive']">
            <svg v-if="collection.is_active" class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 12l2 2 4-4"/>
              <circle cx="12" cy="12" r="10"/>
            </svg>
            <svg v-else class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M4.93 4.93l14.14 14.14"/>
            </svg>
            {{ collection.is_active ? 'Ativo' : 'Inativo' }}
          </span>
          <div class="actions">
            <button class="btn-icon" @click="editCollection(collection)" title="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-icon danger" @click="deleteCollection(collection.id)" title="Excluir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showAddModal || editingCollection" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editingCollection ? 'Editar Cole&ccedil;&atilde;o' : 'Nova Cole&ccedil;&atilde;o' }}</h3>
          <button class="modal-close" @click="closeModal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
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
          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.is_active">
              <span class="checkbox-text">Cole&ccedil;&atilde;o Ativa</span>
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
  padding: var(--space-6);
  min-height: 100vh;
  background: var(--bg-base);
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-8);
  gap: var(--space-4);
}

.header-content {
  display: flex;
  flex-direction: column;
}

.page-label {
  font-family: var(--font-sans);
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 3px;
  text-transform: uppercase;
  display: block;
  margin-bottom: var(--space-2);
}

.page-title {
  font-family: var(--font-display);
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.5px;
  line-height: 1.1;
  margin: 0;
}

/* Primary Button */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--gold);
  color: #000;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 600;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border: none;
  transition: all var(--transition-fast);
}

.btn-primary:hover {
  background: var(--gold-light);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(212, 175, 55, 0.2);
}

.btn-icon-svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* Loading State */
.loading {
  text-align: center;
  padding: var(--space-16);
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  letter-spacing: 2px;
  text-transform: uppercase;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  animation: spin 1s linear infinite;
  color: var(--gold);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Collections Grid */
.collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-4);
}

/* Collection Card */
.collection-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  transition: all var(--transition-base);
}

.collection-card:hover {
  border-color: var(--gold-border);
  background: var(--bg-elevated);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(212, 175, 55, 0.08);
}

/* Card Header */
.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.collection-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--gold-bg);
  border: 1px solid var(--gold-border);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.icon-svg {
  width: 24px;
  height: 24px;
  color: var(--gold);
}

.icon-emoji {
  font-size: 1.5rem;
  line-height: 1;
}

.collection-info h3 {
  margin: 0 0 var(--space-1) 0;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.3;
}

.collection-slug {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
  letter-spacing: 0.5px;
}

/* Description */
.description {
  color: var(--text-secondary);
  margin-bottom: var(--space-4);
  font-size: 0.875rem;
  font-family: var(--font-sans);
  line-height: 1.5;
}

/* Card Footer */
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-light);
}

/* Status Badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 600;
  font-family: var(--font-sans);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.status-badge.active {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.status-badge.inactive {
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-border);
}

.status-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* Actions */
.actions {
  display: flex;
  gap: var(--space-2);
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--text-secondary);
}

.btn-icon svg {
  width: 16px;
  height: 16px;
}

.btn-icon:hover {
  border-color: var(--gold-border);
  color: var(--gold);
  background: var(--gold-bg);
}

.btn-icon.danger:hover {
  border-color: var(--danger-border);
  color: var(--danger);
  background: var(--danger-bg);
}

/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

/* Modal */
.modal {
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}

.modal-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 600;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.modal-close:hover {
  border-color: var(--danger-border);
  color: var(--danger);
  background: var(--danger-bg);
}

.modal-close svg {
  width: 16px;
  height: 16px;
}

/* Form */
.form-group {
  margin-bottom: var(--space-4);
}

.form-group label {
  display: block;
  margin-bottom: var(--space-2);
  color: var(--text-secondary);
  font-weight: 500;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  letter-spacing: 0.3px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  transition: all var(--transition-fast);
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: var(--text-muted);
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: var(--gold);
  outline: none;
  box-shadow: 0 0 0 2px var(--gold-bg);
}

.form-group input[type="checkbox"] {
  width: auto;
  margin-right: var(--space-2);
  accent-color: var(--gold);
}

.checkbox-group label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.checkbox-text {
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 0.85rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

/* Modal Actions */
.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-light);
}

.btn-secondary {
  background: var(--bg-surface);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 500;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  transition: all var(--transition-fast);
}

.btn-secondary:hover {
  border-color: var(--gold-border);
  color: var(--gold);
  background: var(--gold-bg);
}

/* Responsive */
@media (max-width: 768px) {
  .collections-view {
    padding: var(--space-4);
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .btn-primary {
    align-self: flex-start;
  }

  .page-title {
    font-size: 1.75rem;
  }

  .collections-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .modal {
    padding: var(--space-5);
  }
}
</style>
