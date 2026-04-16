<template>
  <div class="theme-toggle">
    <button
      v-for="mode in ['light', 'dark', 'system']"
      :key="mode"
      :class="['theme-btn', { active: store.theme === mode }]"
      @click="store.setTheme(mode as ThemeMode)"
      :title="`${mode} theme`"
    >
      <span v-if="mode === 'light'" class="theme-icon">☀️</span>
      <span v-else-if="mode === 'dark'" class="theme-icon">🌙</span>
      <span v-else class="theme-icon">💻</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useThemeStore, type ThemeMode } from '../stores/theme'

const store = useThemeStore()
</script>

<style scoped>
.theme-toggle {
  display: flex;
  gap: var(--space-1);
  background: var(--bg-elevated);
  padding: var(--space-1);
  border: var(--border);
}

.theme-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: var(--border);
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.theme-btn:hover {
  background: var(--bg-hover);
  border-color: var(--purple);
}

.theme-btn.active {
  background: var(--purple);
  border-color: var(--purple);
}

.theme-icon {
  font-size: 1rem;
  line-height: 1;
}

.theme-btn.active .theme-icon {
  filter: brightness(0) invert(1);
}
</style>
