<template>
  <div class="variants-view">
    <div class="page-header">
      <h2>Variantes de Produtos</h2>
      <button class="btn-primary" @click="showAddModal = true">+ Nova Variante</button>
    </div>

    <div class="filters">
      <select v-model="filterProduct" class="filter-select">
        <option value="">Todos os produtos</option>
        <option v-for="prod in productStore.products" :key="prod.id" :value="prod.id">
          {{ prod.name }}
        </option>
      </select>
    </div>

    <div v-if="store.loading" class="loading">Carregando...</div>

    <table v-else class="data-table">
      <thead>
        <tr>
          <th>Produto</th>
          <th>Tamanho</th>
          <th>Cor</th>
          <th>SKU</th>
          <th>Estoque</th>
          <th>A&ccedil;&otilde;es</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="variant in filteredVariants" :key="variant.id">
          <td>{{ getProductName(variant.product_id) }}</td>
          <td>{{ variant.size || '-' }}</td>
          <td>{{ variant.color || '-' }}</td>
          <td>{{ variant.sku || '-' }}</td>
          <td>
            <span :class="variant.stock_quantity > 10 ? 'stock-ok' : 'stock-low'">
              {{ variant.stock_quantity }}
            </span>
          </td>
          <td>
            <button class="btn-icon" @click="editVariant(variant)">✏️</button>
            <button class="btn-icon danger" @click="deleteVariant(variant.id)">🗑️</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="showAddModal || editingVariant" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <h3>{{ editingVariant ? 'Editar Variante' : 'Nova Variante' }}</h3>
        <form @submit.prevent="saveVariant">
          <div class="form-group">
            <label>Produto *</label>
            <select v-model="form.product_id" required>
              <option value="">Selecione...</option>
              <option v-for="prod in productStore.products" :key="prod.id" :value="prod.id">
                {{ prod.name }}
              </option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Tamanho</label>
              <select v-model="form.size">
                <option value="">N/A</option>
                <option v-for="opt in store.getOptionValuesByType('size')" :key="opt.id" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Cor</label>
              <select v-model="form.color">
                <option value="">N/A</option>
                <option v-for="opt in store.getOptionValuesByType('color')" :key="opt.id" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>SKU</label>
              <input v-model="form.sku" placeholder="SKU-001">
            </div>
            <div class="form-group">
              <label>Estoque</label>
              <input v-model.number="form.stock_quantity" type="number" min="0">
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="closeModal">Cancelar</button>
            <button type="submit" class="btn-primary">{{ editingVariant ? 'Salvar' : 'Criar' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useVariantStore } from '../stores/variants'
import { useProductStore } from '../stores/products'

const store = useVariantStore()
const productStore = useProductStore()
const showAddModal = ref(false)
const editingVariant = ref(null)
const filterProduct = ref('')

const defaultForm = { product_id: '', size: '', color: '', sku: '', stock_quantity: 0 }
const form = ref({ ...defaultForm })

const filteredVariants = computed(() => {
  if (!filterProduct.value) return store.variants
  return store.variants.filter(v => v.product_id === parseInt(filterProduct.value))
})

function getProductName(productId) {
  const prod = productStore.products.find(p => p.id === productId)
  return prod ? prod.name : productId
}

function editVariant(variant) {
  editingVariant.value = variant
  form.value = {
    product_id: variant.product_id,
    size: variant.size || '',
    color: variant.color || '',
    sku: variant.sku || '',
    stock_quantity: variant.stock_quantity || 0
  }
  showAddModal.value = true
}

function closeModal() {
  showAddModal.value = false
  editingVariant.value = null
  form.value = { ...defaultForm }
}

async function saveVariant() {
  try {
    if (editingVariant.value) {
      await store.updateVariant(editingVariant.value.id, form.value)
    } else {
      await store.addVariant(form.value)
    }
    closeModal()
  } catch (err) {
    alert('Erro: ' + err.message)
  }
}

async function deleteVariant(id) {
  if (confirm('Tem certeza?')) {
    try { await store.deleteVariant(id) } catch (err) { alert('Erro: ' + err.message) }
  }
}

onMounted(async () => {
  await Promise.all([
    productStore.fetchProducts(),
    store.fetchVariants(),
    store.fetchOptionValues()
  ])
})
</script>

<style scoped>
.variants-view { padding: 1rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
.page-header h2 { margin: 0; color: #00FF41; }
.filters { margin-bottom: 1.5rem; }
.filter-select { padding: 0.75rem; background: #100314; border: 1px solid #2a2a4a; color: #00FF41; border-radius: 8px; }
.data-table { width: 100%; border-collapse: collapse; background: #16051c; border-radius: 12px; overflow: hidden; }
.data-table th, .data-table td { padding: 1rem; text-align: left; border-bottom: 1px solid #2a2a4a; }
.data-table th { background: #100314; color: #9D4EDD; font-weight: 600; text-transform: uppercase; font-size: 0.85rem; }
.stock-ok { color: #00FF41; }
.stock-low { color: #ff4444; font-weight: 600; }
.btn-icon { background: #100314; border: 1px solid #2a2a4a; padding: 0.5rem; border-radius: 4px; cursor: pointer; margin: 0 0.25rem; }
.btn-icon.danger:hover { border-color: #ff4444; }
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
