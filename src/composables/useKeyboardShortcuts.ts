import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '../stores/notifications'

export interface Shortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  handler: () => void
  description: string
  category?: string
}

const shortcuts = ref<Shortcut[]>([])
const shortcutsVisible = ref(false)

export function useKeyboardShortcuts() {
  const router = useRouter()
  const notifications = useNotificationStore()

  function register(shortcut: Omit<Shortcut, 'key' | 'handler'> & { key: string, handler: () => void }) {
    shortcuts.value.push(shortcut as Shortcut)
  }

  function unregister(key: string) {
    shortcuts.value = shortcuts.value.filter(s => s.key !== key)
  }

  function showShortcuts() {
    shortcutsVisible.value = true
  }

  function hideShortcuts() {
    shortcutsVisible.value = false
  }

  function handleKeydown(event: KeyboardEvent) {
    // Ignore if typing in input/textarea
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }

    for (const shortcut of shortcuts.value) {
      const matches =
        event.key.toLowerCase() === shortcut.key.toLowerCase() &&
        (shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey) &&
        (shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey) &&
        (shortcut.altKey === undefined || event.altKey === shortcut.altKey) &&
        (shortcut.metaKey === undefined || event.metaKey === shortcut.metaKey)

      if (matches) {
        event.preventDefault()
        shortcut.handler()
        break
      }
    }
  }

  // Register default shortcuts
  onMounted(() => {
    register({
      key: 'g',
      handler: () => router.push('/'),
      description: 'Go to Dashboard',
      category: 'Navigation',
    })

    register({
      key: 'p',
      handler: () => router.push('/products'),
      description: 'Go to Products',
      category: 'Navigation',
    })

    register({
      key: 'o',
      handler: () => router.push('/orders'),
      description: 'Go to Orders',
      category: 'Navigation',
    })

    register({
      key: 'c',
      handler: () => router.push('/collections'),
      description: 'Go to Collections',
      category: 'Navigation',
    })

    register({
      key: 's',
      handler: () => router.push('/sales'),
      description: 'Go to Sales',
      category: 'Navigation',
    })

    register({
      key: 'i',
      handler: () => router.push('/integrations'),
      description: 'Go to Integrations',
      category: 'Navigation',
    })

    register({
      key: 'v',
      handler: () => router.push('/visual-orchestrator'),
      description: 'Go to Visual Orchestrator',
      category: 'Navigation',
    })

    register({
      key: 'k',
      ctrlKey: true,
      handler: () => {
        // Open search modal (will be implemented)
        notifications.info('Search', 'Press Ctrl+K to search')
      },
      description: 'Open Search',
      category: 'General',
    })

    register({
      key: '?',
      shiftKey: true,
      handler: showShortcuts,
      description: 'Show Keyboard Shortcuts',
      category: 'General',
    })

    register({
      key: 'Escape',
      handler: hideShortcuts,
      description: 'Close Modals',
      category: 'General',
    })

    register({
      key: 'r',
      ctrlKey: true,
      handler: () => {
        window.location.reload()
      },
      description: 'Refresh Page',
      category: 'General',
    })

    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })

  return {
    shortcuts,
    shortcutsVisible,
    register,
    unregister,
    showShortcuts,
    hideShortcuts,
  }
}
