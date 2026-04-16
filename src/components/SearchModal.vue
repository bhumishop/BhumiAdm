<template>
  <Teleport to="body">
    <Transition name="search">
      <div v-if="store.isOpen" class="search-modal-overlay" @click.self="store.close">
        <div class="search-modal">
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="text"
              placeholder="Search products, orders, collections, pages..."
              class="search-input"
              @input="handleSearch"
              @keydown.down.prevent="store.selectNext()"
              @keydown.up.prevent="store.selectPrevious()"
              @keydown.enter.prevent="store.executeSearch()"
              @keydown.escape="store.close()"
            >
            <button v-if="store.query" class="search-clear" @click="clearSearch">×</button>
            <div class="search-shortcut-hint">
              <kbd class="kbd">ESC</kbd> to close
            </div>
          </div>

          <div class="search-results">
            <div v-if="store.isSearching" class="search-loading">
              <div class="spinner"></div>
              <span>Searching...</span>
            </div>

            <div v-else-if="!store.query && store.recentSearches.length > 0" class="recent-searches">
              <div class="recent-header">
                <span>Recent Searches</span>
                <button class="clear-btn" @click="store.clearRecentSearches()">Clear</button>
              </div>
              <div class="recent-list">
                <div
                  v-for="term in store.recentSearches"
                  :key="term"
                  class="recent-item"
                  @click="searchFor(term)"
                >
                  <span class="recent-icon">🕒</span>
                  <span class="recent-term">{{ term }}</span>
                </div>
              </div>
            </div>

            <div v-else-if="store.hasResults" class="results-list">
              <div
                v-for="(result, index) in store.results"
                :key="`${result.type}-${result.id}`"
                :class="[
                  'result-item',
                  { 'result-selected': index === store.selectedIndex }
                ]"
                @click="navigateTo(result)"
                @mouseenter="store.selectedIndex = index"
              >
                <span class="result-icon">{{ result.icon || '📄' }}</span>
                <div class="result-content">
                  <div class="result-title">{{ result.title }}</div>
                  <div v-if="result.subtitle" class="result-subtitle">{{ result.subtitle }}</div>
                </div>
                <span class="result-type">{{ result.type }}</span>
              </div>
            </div>

            <div v-else-if="store.query" class="no-results">
              <span class="no-results-icon">🔍</span>
              <div class="no-results-text">
                No results found for "{{ store.query }}"
              </div>
              <div class="no-results-hint">
                Try searching with different keywords
              </div>
            </div>
          </div>

          <div class="search-footer">
            <div class="footer-item">
              <kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd>
              <span>navigate</span>
            </div>
            <div class="footer-item">
              <kbd class="kbd">↵</kbd>
              <span>open</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useSearchStore, type SearchResult } from '../stores/search'

const store = useSearchStore()
const router = useRouter()
const searchInput = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')

let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(() => store.isOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    searchInput.value?.focus()
  }
})

function handleSearch() {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = setTimeout(() => {
    store.search(searchQuery.value)
  }, 150)
}

function clearSearch() {
  searchQuery.value = ''
  store.results = []
  searchInput.value?.focus()
}

function searchFor(term: string) {
  searchQuery.value = term
  store.search(term)
}

function navigateTo(result: SearchResult) {
  store.addRecentSearch(store.query)
  store.close()
  router.push(result.url)
}
</script>

<style scoped>
.search-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
  z-index: 1000;
}

.search-modal {
  background: var(--bg-surface);
  border: var(--border);
  width: 90%;
  max-width: 640px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.search-input-wrapper {
  position: relative;
  padding: var(--space-4);
  border-bottom: var(--border);
}

.search-icon {
  position: absolute;
  left: calc(var(--space-4) + 4px);
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.2rem;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: var(--space-3) var(--space-8);
  background: var(--bg-elevated);
  border: var(--border);
  color: var(--text-primary);
  font-size: 1rem;
  outline: none;
  transition: all 0.15s ease;
}

.search-input:focus {
  border-color: var(--purple);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.search-clear {
  position: absolute;
  right: calc(var(--space-4) + 60px);
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.5rem;
  cursor: pointer;
  padding: var(--space-1);
  transition: all 0.15s ease;
}

.search-clear:hover {
  color: var(--text-primary);
}

.search-shortcut-hint {
  position: absolute;
  right: calc(var(--space-4) + 8px);
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.65rem;
  color: var(--text-muted);
}

.kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1) var(--space-2);
  background: var(--bg-base);
  border: var(--border);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  min-width: 20px;
  margin: 0 2px;
  box-shadow: 0 2px 0 var(--border-color);
}

.search-results {
  flex: 1;
  overflow-y: auto;
  max-height: 400px;
}

.search-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-6);
  color: var(--text-muted);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-top-color: var(--purple);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.recent-searches, .results-list {
  padding: var(--space-2);
}

.recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
}

.clear-btn {
  background: transparent;
  border: none;
  color: var(--purple);
  font-size: 0.7rem;
  cursor: pointer;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.recent-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  transition: all 0.15s ease;
}

.recent-item:hover {
  background: var(--bg-elevated);
}

.recent-icon {
  font-size: 1rem;
}

.recent-term {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.result-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  cursor: pointer;
  transition: all 0.15s ease;
  border: var(--border);
  margin-bottom: var(--space-1);
}

.result-item:hover, .result-item.result-selected {
  background: var(--bg-elevated);
  border-color: var(--purple);
}

.result-icon {
  font-size: 1.3rem;
  flex-shrink: 0;
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.result-subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-type {
  font-size: 0.65rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  flex-shrink: 0;
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.no-results-icon {
  font-size: 3rem;
  margin-bottom: var(--space-3);
  opacity: 0.5;
}

.no-results-text {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.no-results-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.search-footer {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-top: var(--border);
  background: var(--bg-elevated);
}

.footer-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.7rem;
  color: var(--text-muted);
}

/* Transitions */
.search-enter-active,
.search-leave-active {
  transition: all 0.2s ease;
}

.search-enter-from,
.search-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

@media (max-width: 768px) {
  .search-modal-overlay {
    padding-top: 0;
    align-items: stretch;
  }

  .search-modal {
    width: 100%;
    max-height: 100vh;
  }

  .search-results {
    max-height: none;
    flex: 1;
  }
}
</style>
