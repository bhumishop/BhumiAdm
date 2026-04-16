<template>
  <div class="admin-layout">
    <!-- Mobile Overlay -->
    <div v-if="mobileSidebarOpen" class="mobile-overlay" @click="mobileSidebarOpen = false"></div>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed, 'mobile-open': mobileSidebarOpen }">
      <!-- Logo -->
      <div class="sidebar-header">
        <router-link to="/admin" class="logo">
          <span class="logo-mark"></span>
          <span v-if="!sidebarCollapsed" class="logo-text">BHUMI</span>
        </router-link>
        <button v-if="!isMobile" @click="sidebarCollapsed = !sidebarCollapsed" class="collapse-btn">
          <span v-if="sidebarCollapsed">&rarr;</span>
          <span v-else>&larr;</span>
        </button>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">
        <!-- Principal -->
        <div v-if="!sidebarCollapsed" class="nav-section">
          <span class="nav-section-label">Principal</span>
        </div>

        <router-link to="/admin/dashboard" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Dashboard</span>
          <span v-if="!sidebarCollapsed" class="nav-badge badge-success">Live</span>
        </router-link>

        <router-link to="/admin/rede" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Rede Visual</span>
        </router-link>

        <router-link to="/admin/metricas" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">M&eacute;tricas</span>
        </router-link>

        <!-- Cat&aacute;logo -->
        <div v-if="!sidebarCollapsed" class="nav-section">
          <span class="nav-section-label">Cat&aacute;logo</span>
        </div>

        <router-link to="/admin/produtos" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Produtos</span>
        </router-link>

        <router-link to="/admin/colecoes" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Cole&ccedil;&otilde;es</span>
        </router-link>

        <router-link to="/admin/subcolecoes" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Subcole&ccedil;&otilde;es</span>
        </router-link>

        <router-link to="/admin/variantes" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Variantes</span>
        </router-link>

        <!-- Vendas -->
        <div v-if="!sidebarCollapsed" class="nav-section">
          <span class="nav-section-label">Vendas</span>
        </div>

        <router-link to="/admin/pedidos" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Pedidos</span>
        </router-link>

        <router-link to="/admin/pagamentos" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Pagamentos</span>
        </router-link>

        <router-link to="/admin/vendas" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Vendas</span>
        </router-link>

        <router-link to="/admin/estoque" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Estoque</span>
        </router-link>

        <!-- Sistema -->
        <div v-if="!sidebarCollapsed" class="nav-section">
          <span class="nav-section-label">Sistema</span>
        </div>

        <router-link to="/admin/integracoes" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Integra&ccedil;&otilde;es</span>
        </router-link>

        <router-link to="/admin/envio" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Envio</span>
        </router-link>

        <router-link to="/admin/usuarios" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Usu&aacute;rios</span>
        </router-link>

        <router-link to="/admin/configurador" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Configurador</span>
          <span v-if="!sidebarCollapsed" class="nav-badge badge-gold">New</span>
        </router-link>

        <router-link to="/admin/orchestrator" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Orchestrator</span>
          <span v-if="!sidebarCollapsed" class="nav-badge badge-gold">New</span>
        </router-link>

        <router-link to="/admin/configuracoes" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Configura&ccedil;&otilde;es</span>
        </router-link>

        <router-link to="/admin/mercadopago" class="nav-item" active-class="active">
          <span class="nav-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </span>
          <span v-if="!sidebarCollapsed">Mercado Pago</span>
          <span v-if="!sidebarCollapsed" class="nav-badge badge-green">PIX</span>
        </router-link>
      </nav>

      <!-- Footer -->
      <div class="sidebar-footer">
        <div v-if="!sidebarCollapsed" class="user-card">
          <div class="user-avatar">
            {{ adminStore.user?.nome?.charAt(0) || adminStore.user?.email?.charAt(0) || 'U' }}
          </div>
          <div class="user-info">
            <span class="user-name">{{ adminStore.user?.nome || adminStore.user?.email }}</span>
          </div>
        </div>
        <button @click="logout" class="logout-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span v-if="!sidebarCollapsed">Sair</span>
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Top Bar -->
      <header class="top-bar">
        <div class="top-bar-left">
          <button @click="mobileSidebarOpen = true" class="mobile-menu-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h2 class="page-title">{{ currentRouteName }}</h2>
        </div>
        <div class="top-bar-right">
          <!-- Search Button -->
          <button @click="searchStore.open" class="icon-btn" title="Search (Ctrl+K)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          
          <!-- Theme Toggle -->
          <ThemeToggle />
          
          <!-- Notifications -->
          <button @click="toggleNotifications" class="icon-btn" :class="{ 'has-unread': notificationStore.unreadCount > 0 }" title="Notifications">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span v-if="notificationStore.unreadCount > 0" class="notification-badge">{{ notificationStore.unreadCount }}</span>
          </button>
          
          <!-- Live Indicator -->
          <div v-if="networkStore?.isConnected" class="live-indicator">
            <span class="live-dot"></span>
          </div>
          <!-- User -->
          <div class="user-avatar-sm">
            {{ adminStore.user?.nome?.charAt(0) || adminStore.user?.email?.charAt(0) || 'U' }}
          </div>
        </div>
      </header>

      <!-- Content Area -->
      <div class="content-area">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>

    <!-- Global Components -->
    <SearchModal />
    <ToastNotifications />
    <KeyboardShortcuts :visible="shortcutsVisible" @close="hideShortcuts()" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminAuthStore } from '../stores/adminAuth'
import { useNetworkStore } from '../stores/network'
import { useSearchStore } from '../stores/search'
import { useNotificationStore } from '../stores/notifications'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'
import SearchModal from '../components/SearchModal.vue'
import ToastNotifications from '../components/ToastNotifications.vue'
import KeyboardShortcuts from '../components/KeyboardShortcuts.vue'
import ThemeToggle from '../components/ThemeToggle.vue'

const adminStore = useAdminAuthStore()
const route = useRoute()
const router = useRouter()
const networkStore = useNetworkStore()
const searchStore = useSearchStore()
const notificationStore = useNotificationStore()
const { shortcutsVisible, hideShortcuts } = useKeyboardShortcuts()

const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)
const isMobile = ref(false)
const showNotifications = ref(false)

const routeNames = {
  admin: 'Dashboard',
  liveDashboard: 'Dashboard',
  networkGraph: 'Rede Visual',
  orders: 'Pedidos',
  products: 'Produtos',
  'product-detail': 'Detalhe do Produto',
  collections: 'Cole&ccedil;&otilde;es',
  subcollections: 'Subcole&ccedil;&otilde;es',
  variants: 'Variantes',
  payments: 'Pagamentos',
  salesDashboard: 'Vendas',
  shopConfigurator: 'Configurador',
  visualOrchestrator: 'Orchestrator',
  config: 'Configura&ccedil;&otilde;es',
  inventory: 'Estoque',
  integrations: 'Integra&ccedil;&otilde;es',
  userRoles: 'Usu&aacute;rios',
  shipping: 'Envio',
  metrics: 'M&eacute;tricas'
}

const currentRouteName = computed(() => {
  return routeNames[route.name] || 'Dashboard'
})

function checkMobile() {
  isMobile.value = window.innerWidth <= 768
  if (isMobile.value) {
    sidebarCollapsed.value = false
  }
}

function toggleNotifications() {
  showNotifications.value = !showNotifications.value
}

function logout() {
  adminStore.signOut()
  router.push('/login')
}

onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', checkMobile)

  if (!adminStore.admin) {
    await adminStore.initialize()
  }
  
  if (!adminStore.admin) {
    router.push('/login')
    return
  }

  try {
    await networkStore.buildGraph()
    networkStore.subscribeToRealtime()
  } catch (e) {
    console.log('Network store init skipped')
  }

  // Load recent searches
  searchStore.loadRecentSearches()
})
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg-base);
}

/* Mobile Overlay */
.mobile-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 99;
  animation: fadeIn 0.2s ease-out;
  backdrop-filter: blur(4px);
}

/* ===== SIDEBAR ===== */
.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-base);
  border-right: var(--border);
  display: flex;
  flex-direction: column;
  transition: width var(--transition-base);
  position: fixed;
  height: 100vh;
  z-index: 100;
}

.sidebar.collapsed {
  width: var(--sidebar-collapsed);
}

/* Header */
.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: var(--border);
  height: 56px;
  flex-shrink: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  text-decoration: none;
  flex: 1;
  min-width: 0;
}

.logo-mark {
  width: 24px;
  height: 24px;
  border: 1.5px solid var(--gold);
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
  transition: all var(--transition-base);
}

.logo-mark::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  background: var(--gold);
  border-radius: 50%;
  transition: all var(--transition-base);
}

.logo-text {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.12em;
}

.collapse-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-base);
  font-size: 12px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
}

.collapse-btn:hover {
  background: var(--gold-bg);
  color: var(--gold);
}

/* Navigation */
.sidebar-nav {
  flex: 1;
  padding: var(--space-3) var(--space-3);
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nav-section {
  padding: var(--space-5) var(--space-3) var(--space-2);
}

.nav-section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  color: var(--text-tertiary);
  text-decoration: none;
  border-radius: var(--radius);
  transition: all var(--transition-base);
  font-size: 13px;
  font-weight: 400;
  position: relative;
  letter-spacing: 0.01em;
}

.nav-item:hover {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.nav-item.active {
  background: var(--gold-bg);
  color: var(--gold);
  font-weight: 500;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 16px;
  background: var(--gold);
  border-radius: 1px;
}

.nav-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}

.nav-icon svg {
  width: 16px;
  height: 16px;
}

.nav-badge {
  margin-left: auto;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  border-radius: var(--radius-sm);
}

.nav-badge.badge-success {
  background: #dcfce7;
  color: #166534;
}

.nav-badge.badge-gold {
  background: #fef3c7;
  color: #92400e;
}

.nav-badge.badge-green {
  background: #d1fae5;
  color: #065f46;
}

/* Footer */
.sidebar-footer {
  padding: var(--space-4);
  border-top: var(--border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  flex-shrink: 0;
}

.user-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: var(--border);
  border-radius: var(--radius);
  min-width: 0;
}

.user-avatar {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gold-bg);
  color: var(--gold);
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--radius);
  flex-shrink: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: var(--border);
  color: var(--text-tertiary);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition-base);
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font-sans);
}

.logout-btn:hover {
  border-color: var(--danger-border);
  color: var(--danger);
  background: var(--danger-bg);
}

/* ===== MAIN CONTENT ===== */
.main-content {
  flex: 1;
  margin-left: var(--sidebar-width);
  transition: margin-left var(--transition-base);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.sidebar.collapsed ~ .main-content {
  margin-left: var(--sidebar-collapsed);
}

/* Top Bar */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--space-6);
  background: var(--bg-base);
  border-bottom: var(--border);
  position: sticky;
  top: 0;
  z-index: 50;
  height: var(--topbar-height);
}

.top-bar-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.mobile-menu-btn {
  display: none;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius);
  transition: all var(--transition-base);
}

.mobile-menu-btn:hover {
  background: var(--gold-bg);
  color: var(--gold);
}

.page-title {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  letter-spacing: 0.01em;
  margin: 0;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.icon-btn {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
  border-radius: var(--radius);
}

.icon-btn:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-color: var(--purple);
}

.icon-btn.has-unread {
  color: var(--purple);
}

.notification-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--red);
  color: white;
  font-size: 9px;
  font-weight: 700;
  border-radius: 8px;
  padding: 0 4px;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
}

.live-dot {
  width: 6px;
  height: 6px;
  background: var(--success);
  border-radius: 50%;
  animation: pulse-soft 2s ease-in-out infinite;
}

.user-avatar-sm {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gold-bg);
  color: var(--gold);
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition-base);
  border: 1px solid var(--gold-border);
}

.user-avatar-sm:hover {
  border-color: var(--gold-border-strong);
}

/* Content Area */
.content-area {
  flex: 1;
  padding: var(--space-6);
  background: var(--bg-base);
}

/* ===== RESPONSIVE ===== */
@media (max-width: 1024px) {
  .content-area {
    padding: var(--space-5);
  }
}

@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
    position: fixed;
  }

  .sidebar.mobile-open {
    transform: translateX(0);
  }

  .main-content {
    margin-left: 0;
  }

  .sidebar.collapsed ~ .main-content {
    margin-left: 0;
  }

  .mobile-menu-btn {
    display: flex;
  }

  .page-title {
    font-size: 13px;
  }

  .content-area {
    padding: var(--space-4);
  }

  .live-indicator {
    display: none;
  }
}
</style>
