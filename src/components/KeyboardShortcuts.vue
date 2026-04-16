<template>
  <div v-if="visible" class="shortcut-modal-overlay" @click.self="close">
    <div class="shortcut-modal">
      <div class="modal-header">
        <h2>⌨️ Keyboard Shortcuts</h2>
        <button class="modal-close" @click="close">×</button>
      </div>

      <div class="modal-content">
        <div v-for="category in categories" :key="category" class="shortcut-category">
          <h3>{{ category }}</h3>
          <div class="shortcut-list">
            <div v-for="shortcut in getShortcutsByCategory(category)" :key="shortcut.key" class="shortcut-item">
              <div class="shortcut-keys">
                <kbd v-if="shortcut.ctrlKey" class="kbd">Ctrl</kbd>
                <kbd v-if="shortcut.altKey" class="kbd">Alt</kbd>
                <kbd v-if="shortcut.shiftKey" class="kbd">Shift</kbd>
                <kbd class="kbd">{{ shortcut.key.toUpperCase() }}</kbd>
              </div>
              <span class="shortcut-desc">{{ shortcut.description }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <p>Press <kbd class="kbd">?</kbd> to open this dialog</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { shortcuts } = useKeyboardShortcuts()

const categories = computed(() => {
  const cats = new Set<string>()
  shortcuts.value.forEach(s => {
    if (s.category) cats.add(s.category)
  })
  return Array.from(cats)
})

function getShortcutsByCategory(category: string) {
  return shortcuts.value.filter(s => s.category === category)
}

function close() {
  emit('close')
}
</script>

<style scoped>
.shortcut-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.shortcut-modal {
  background: var(--bg-surface);
  border: var(--border);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  border-bottom: var(--border);
}

.modal-header h2 {
  font-size: 1.2rem;
  margin: 0;
}

.modal-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.5rem;
  cursor: pointer;
  padding: var(--space-1);
  transition: all 0.15s ease;
}

.modal-close:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.modal-content {
  padding: var(--space-4);
}

.shortcut-category {
  margin-bottom: var(--space-4);
}

.shortcut-category h3 {
  font-size: 0.85rem;
  color: var(--purple);
  margin: 0 0 var(--space-2) 0;
  padding-bottom: var(--space-1);
  border-bottom: 1px solid var(--border-color);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2);
  background: var(--bg-elevated);
  border: var(--border);
}

.shortcut-keys {
  display: flex;
  gap: var(--space-1);
  align-items: center;
}

.kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1) var(--space-2);
  background: var(--bg-base);
  border: var(--border);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 24px;
  box-shadow: 0 2px 0 var(--border-color);
}

.shortcut-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.modal-footer {
  padding: var(--space-3) var(--space-4);
  border-top: var(--border);
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.modal-footer .kbd {
  margin: 0 var(--space-1);
}
</style>
