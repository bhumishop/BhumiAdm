import { defineStore } from 'pinia'
import { ref, computed, watch, onMounted } from 'vue'

export type ThemeMode = 'dark' | 'light' | 'system'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ThemeMode>('dark')
  const systemPrefersDark = ref(false)

  const isDark = computed(() => {
    if (theme.value === 'system') {
      return systemPrefersDark.value
    }
    return theme.value === 'dark'
  })

  function detectSystemPreference() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    systemPrefersDark.value = mediaQuery.matches

    // Listen for changes
    mediaQuery.addEventListener('change', (e) => {
      systemPrefersDark.value = e.matches
    })
  }

  function setTheme(newTheme: ThemeMode) {
    theme.value = newTheme
    applyTheme()

    try {
      localStorage.setItem('admin_theme', newTheme)
    } catch {
      // Storage not available
    }
  }

  function toggleTheme() {
    setTheme(isDark.value ? 'light' : 'dark')
  }

  function applyTheme() {
    const root = document.documentElement

    if (isDark.value) {
      root.classList.add('theme-dark')
      root.classList.remove('theme-light')
    } else {
      root.classList.add('theme-light')
      root.classList.remove('theme-dark')
    }
  }

  function loadSavedTheme() {
    try {
      const saved = localStorage.getItem('admin_theme')
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        theme.value = saved
      }
    } catch {
      // Storage not available
    }
  }

  // Watch for theme changes
  watch([isDark], () => {
    applyTheme()
  })

  // Initialize on mount
  onMounted(() => {
    detectSystemPreference()
    loadSavedTheme()
    applyTheme()
  })

  return {
    theme,
    isDark,
    systemPrefersDark,
    setTheme,
    toggleTheme,
    applyTheme,
  }
})
