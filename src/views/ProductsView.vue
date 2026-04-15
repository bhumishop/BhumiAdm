<template>
  <div class="products-page">
    <div class="page-header">
      <div>
        <span class="page-label">PRODUCTS</span>
        <h1 class="page-title">{{ filteredProducts.length }} PRODUTOS</h1>
      </div>
    </div>

    <div class="filters">
      <button
        v-for="cat in categories"
        :key="cat.id"
        :class="['filter-btn', { active: activeCategory === cat.id }]"
        @click="activeCategory = cat.id"
      >
        {{ cat.name.toUpperCase() }}
      </button>
    </div>

    <div v-if="filteredProducts.length === 0" class="empty-state">
      <p>NENHUM PRODUTO ENCONTRADO</p>
    </div>

    <div v-else class="products-grid">
      <router-link
        v-for="product in filteredProducts"
        :key="product.id"
        :to="`/produtos/${product.id}`"
        class="product-card"
      >
        <div class="product-image">
          <img
            v-if="hasValidImage(product.image)"
            :src="product.image"
            :alt="product.name"
            class="product-img"
            @error="handleImageError"
          >
          <div v-else class="placeholder-image">{{ getCategoryInitial(product.category) }}</div>
          <span class="product-badge">{{ getCategoryName(product.category) }}</span>
        </div>
        <div class="product-info">
          <h3 class="product-name">{{ product.name }}</h3>
          <p class="product-description">{{ product.description }}</p>
          <div class="product-footer">
            <span class="product-price">R$ {{ product.price.toFixed(2).replace('.', ',') }}</span>
            <span class="product-stock" :class="product.stock">
              {{ product.stock === 'print-on-demand' ? 'ON DEMAND' : 'IN STOCK' }}
            </span>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useProductStore } from '../stores/products'

const route = useRoute()
const productStore = useProductStore()

const activeCategory = ref('todos')
const categories = computed(() => productStore.categories)

const filteredProducts = computed(() => {
  return productStore.getProductsByCategory(activeCategory.value)
})

function hasValidImage(image) {
  return image && (image.startsWith('data:') || image.startsWith('http'))
}

function getCategoryInitial(categoryId) {
  if (!categoryId) return 'P'
  const cat = categories.value.find(c => c.id === categoryId)
  return cat ? cat.name.charAt(0).toUpperCase() : categoryId.toString().charAt(0).toUpperCase()
}

function getCategoryName(categoryId) {
  const cat = categories.value.find(c => c.id === categoryId)
  return cat ? cat.name.toUpperCase() : categoryId
}

function handleImageError(event) {
  event.target.style.display = 'none'
  if (event.target.nextElementSibling) {
    event.target.nextElementSibling.style.display = 'flex'
  }
}

watch(() => route.query.categoria, (newCategory) => {
  if (newCategory) {
    activeCategory.value = newCategory
  }
}, { immediate: true })
</script>

<style scoped>
.products-page {
  padding: var(--space-6);
  min-height: 100vh;
}

.page-header {
  margin-bottom: var(--space-6);
}

.page-label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
  letter-spacing: 2px;
  text-transform: uppercase;
  display: block;
  margin-bottom: var(--space-1);
}

.page-title {
  font-family: var(--font-display);
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -1px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-8);
}

.filter-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 0;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-btn:hover {
  border-color: var(--purple);
  color: var(--purple);
}

.filter-btn.active {
  background: var(--purple);
  border-color: var(--purple);
  color: white;
}

.empty-state {
  text-align: center;
  padding: var(--space-16);
  border: 1px dashed var(--border-color);
}

.empty-state p {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--text-muted);
  letter-spacing: 2px;
  margin: 0;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-4);
}

.product-card {
  text-decoration: none;
  color: inherit;
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  transition: all 0.15s ease;
  display: block;
}

.product-card:hover {
  border-color: var(--purple);
  background: var(--bg-elevated);
  transform: translateY(-2px);
}

.product-card:hover .product-name {
  color: var(--purple);
}

.product-image {
  height: 240px;
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid var(--border-color);
}

.product-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder-image {
  font-family: var(--font-mono);
  font-size: 4rem;
  font-weight: 700;
  color: var(--text-muted);
  opacity: 0.3;
}

.product-badge {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  background: var(--purple);
  color: white;
  padding: var(--space-1) var(--space-2);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 1px;
  border-radius: 0;
}

.product-info {
  padding: var(--space-4);
}

.product-name {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: var(--space-2);
  color: var(--text-primary);
  transition: color 0.15s ease;
}

.product-description {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: var(--space-4);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}

.product-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-color);
}

.product-price {
  font-family: var(--font-mono);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--green);
}

.product-stock {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 1px;
}

.product-stock.print-on-demand {
  color: var(--purple);
}

.product-stock.estoque {
  color: var(--green);
}

/* Responsive */
@media (max-width: 768px) {
  .products-page {
    padding: var(--space-4);
  }

  .page-title {
    font-size: 1.75rem;
  }

  .products-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: var(--space-3);
  }

  .product-image {
    height: 200px;
  }
}
</style>
