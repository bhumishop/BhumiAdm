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
            v-if="hasValidImage(product)"
            :src="product.image"
            :alt="product.name"
            class="product-img"
            @error="handleImageError($event, product.image)"
          >
          <div v-else class="placeholder-image">
            <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
          </div>
          <span class="product-badge">{{ getCategoryName(product.category) }}</span>
        </div>
        <div class="product-info">
          <h3 class="product-name">{{ product.name }}</h3>
          <p class="product-description">{{ product.description }}</p>
          <div class="product-footer">
            <span class="product-price">R$ {{ product.price.toFixed(2).replace('.', ',') }}</span>
            <span class="product-stock" :class="product.stock">
              <svg v-if="product.stock === 'print-on-demand'" class="stock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8" rx="1"/>
              </svg>
              <svg v-else class="stock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12l2 2 4-4"/>
                <circle cx="12" cy="12" r="10"/>
              </svg>
              {{ product.stock === 'print-on-demand' ? 'ON DEMAND' : 'IN STOCK' }}
            </span>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useProductStore } from '../stores/products'
import { isLikelyBrokenCdnUrl } from '../utils/githubCdn'

const route = useRoute()
const productStore = useProductStore()

const activeCategory = ref('todos')
const categories = computed(() => productStore.categories)
const brokenImages = ref(new Set())

onMounted(async () => {
  if (productStore.products.length === 0) {
    await Promise.all([
      productStore.fetchProducts(),
      productStore.fetchCategories()
    ])
  }
})

const filteredProducts = computed(() => {
  if (activeCategory.value === 'todos') return productStore.filteredProducts
  return productStore.filteredProducts.filter(p =>
    p.category ? p.category.toLowerCase() === activeCategory.value.toLowerCase() : false
  )
})

function hasValidImage(product) {
  const image = product.image
  if (!image || !image.startsWith('http')) return false
  // Check if URL looks broken
  if (isLikelyBrokenCdnUrl(image)) return false
  // Check if this image URL is known to be broken
  if (brokenImages.value.has(image)) return false
  return true
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

function handleImageError(event, imageUrl) {
  // Mark this URL as broken
  if (imageUrl) {
    brokenImages.value.add(imageUrl)
  }
  const img = event.target
  img.style.display = 'none'
  const placeholder = img.nextElementSibling
  if (placeholder) {
    placeholder.style.display = 'flex'
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
  background: var(--bg-base);
}

.page-header {
  margin-bottom: var(--space-6);
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
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-btn:hover {
  border-color: var(--gold);
  color: var(--gold);
  background: var(--gold-bg);
}

.filter-btn.active {
  background: var(--gold);
  border-color: var(--gold);
  color: #000;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: var(--space-16);
  border: 1px dashed var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.empty-state p {
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 2px;
  text-transform: uppercase;
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
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  overflow: hidden;
  transition: all var(--transition-base);
  display: block;
}

.product-card:hover {
  border-color: var(--gold-border);
  background: var(--bg-elevated);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(212, 175, 55, 0.08);
}

.product-card:hover .product-name {
  color: var(--gold);
}

.product-image {
  height: 240px;
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid var(--border);
}

.product-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow);
}

.product-card:hover .product-img {
  transform: scale(1.03);
}

.placeholder-image {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.placeholder-icon {
  width: 64px;
  height: 64px;
  color: var(--text-muted);
  opacity: 0.2;
}

.product-badge {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  background: var(--gold);
  color: #000;
  padding: var(--space-1) var(--space-2);
  font-family: var(--font-sans);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border-radius: var(--radius-sm);
}

.product-info {
  padding: var(--space-4);
}

.product-name {
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: var(--space-2);
  color: var(--text-primary);
  transition: color var(--transition-fast);
  line-height: 1.3;
}

.product-description {
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 400;
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
  border-top: 1px solid var(--border-light);
}

.product-price {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--success);
  letter-spacing: -0.3px;
}

.product-stock {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-family: var(--font-sans);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.stock-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.product-stock.print-on-demand {
  color: var(--gold);
}

.product-stock.estoque {
  color: var(--success);
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
