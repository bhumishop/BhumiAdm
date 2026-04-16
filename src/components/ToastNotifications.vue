<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="notification in store.recentNotifications.slice(0, 5)"
        :key="notification.id"
        class="toast-item"
        :class="[
          `toast-${notification.type}`,
          { 'toast-unread': !notification.read }
        ]"
        @click="store.markAsRead(notification.id)"
      >
        <div class="toast-icon">
          <span v-if="notification.type === 'success'">✓</span>
          <span v-else-if="notification.type === 'error'">✕</span>
          <span v-else-if="notification.type === 'warning'">⚠</span>
          <span v-else-if="notification.type === 'info'">ℹ</span>
          <span v-else-if="notification.type === 'realtime'">●</span>
        </div>

        <div class="toast-content">
          <div class="toast-title">{{ notification.title }}</div>
          <div v-if="notification.message" class="toast-message">{{ notification.message }}</div>
          <div class="toast-time">{{ formatTime(notification.timestamp) }}</div>
        </div>

        <div v-if="notification.action" class="toast-action">
          <button @click.stop="notification.action.handler">{{ notification.action.label }}</button>
        </div>

        <button class="toast-close" @click.stop="store.removeNotification(notification.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useNotificationStore } from '../stores/notifications'

const store = useNotificationStore()

function formatTime(timestamp: number) {
  const diff = Math.floor((Date.now() - timestamp) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h`
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 400px;
  pointer-events: none;
}

.toast-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-surface);
  border: var(--border);
  border-left: 3px solid var(--purple);
  cursor: pointer;
  pointer-events: all;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.toast-item:hover {
  transform: translateX(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.toast-item.toast-success {
  border-left-color: var(--green);
}

.toast-item.toast-error {
  border-left-color: var(--red);
}

.toast-item.toast-warning {
  border-left-color: var(--yellow);
}

.toast-item.toast-info {
  border-left-color: var(--cyan);
}

.toast-item.toast-realtime {
  border-left-color: var(--purple);
  animation: pulse-border 2s infinite;
}

.toast-item.toast-unread {
  background: var(--bg-elevated);
}

.toast-icon {
  font-size: 1.2rem;
  line-height: 1;
  flex-shrink: 0;
}

.toast-success .toast-icon { color: var(--green); }
.toast-error .toast-icon { color: var(--red); }
.toast-warning .toast-icon { color: var(--yellow); }
.toast-info .toast-icon { color: var(--cyan); }
.toast-realtime .toast-icon { color: var(--purple); animation: pulse 2s infinite; }

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.toast-message {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
  line-height: 1.4;
}

.toast-time {
  font-size: 0.65rem;
  color: var(--text-muted);
}

.toast-action {
  flex-shrink: 0;
}

.toast-action button {
  padding: var(--space-1) var(--space-3);
  background: var(--purple);
  border: none;
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.toast-action button:hover {
  background: var(--purple-light);
}

.toast-close {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.toast-close:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

/* Transitions */
.toast-enter-active {
  transition: all 0.3s ease;
}

.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100px);
}

.toast-move {
  transition: transform 0.3s ease;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes pulse-border {
  0%, 100% { border-left-width: 3px; }
  50% { border-left-width: 6px; }
}

@media (max-width: 768px) {
  .toast-container {
    top: auto;
    bottom: var(--space-4);
    right: var(--space-2);
    left: var(--space-2);
    max-width: none;
  }

  .toast-item {
    padding: var(--space-2) var(--space-3);
  }
}
</style>
