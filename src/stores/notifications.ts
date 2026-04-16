import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'realtime'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    handler: () => void
  }
  timestamp: number
  read: boolean
}

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([])
  const soundEnabled = ref(true)
  const doNotDisturb = ref(false)

  const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)
  const recentNotifications = computed(() => notifications.value.slice(0, 50))

  function playNotificationSound() {
    if (!soundEnabled.value) return
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 800
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch {
      // Audio not supported
    }
  }

  function addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
    if (doNotDisturb.value && notification.type !== 'error') return

    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      read: false,
      duration: notification.duration ?? 5000,
    }

    notifications.value.unshift(newNotification)

    if (notification.type === 'realtime' || notification.type === 'error') {
      playNotificationSound()
    }

    // Auto-remove if duration is set
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, newNotification.duration)
    }

    return id
  }

  function removeNotification(id: string) {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
    }
  }

  function markAsRead(id: string) {
    const notification = notifications.value.find(n => n.id === id)
    if (notification) {
      notification.read = true
    }
  }

  function markAllAsRead() {
    notifications.value.forEach(n => {
      n.read = true
    })
  }

  function clearAll() {
    notifications.value = []
  }

  // Convenience methods
  function success(title: string, message?: string, duration?: number) {
    return addNotification({ type: 'success', title, message, duration })
  }

  function error(title: string, message?: string, duration?: number) {
    return addNotification({ type: 'error', title, message, duration: duration ?? 10000 })
  }

  function warning(title: string, message?: string, duration?: number) {
    return addNotification({ type: 'warning', title, message, duration: duration ?? 7000 })
  }

  function info(title: string, message?: string, duration?: number) {
    return addNotification({ type: 'info', title, message, duration })
  }

  function realtime(title: string, message?: string) {
    return addNotification({ type: 'realtime', title, message, duration: 0 })
  }

  function toggleSound() {
    soundEnabled.value = !soundEnabled.value
  }

  function toggleDoNotDisturb() {
    doNotDisturb.value = !doNotDisturb.value
  }

  return {
    notifications,
    unreadCount,
    recentNotifications,
    soundEnabled,
    doNotDisturb,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    success,
    error,
    warning,
    info,
    realtime,
    toggleSound,
    toggleDoNotDisturb,
  }
})
