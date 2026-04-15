<template>
  <div class="admin-layout">
    <!-- Mobile Overlay -->
    <div v-if="mobileSidebarOpen" class="mobile-overlay" @click="mobileSidebarOpen = false"></div>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed, 'mobile-open': mobileSidebarOpen }">
      <!-- Logo -->
      <div class="sidebar-header">
        <router-link to="/" class="logo">
          <span class="logo-icon">&#x262F;</span>
          <div v-if="!sidebarCollapsed" class="logo-text">
            <span class="logo-name">BHUMI<span class="text-purple">ADMIN</span></span>
          </div>
        </router-link>
        <button @click="sidebarCollapsed = !sidebarCollapsed" class="collapse-btn">
          <span v-if="sidebarCollapsed">&rarr;</span>
          <span v-else>&larr;</span>
        </button>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">
        <!-- Principal -->
        <div v-if="!sidebarCollapsed" class="nav-section">
          <span class="nav-section-label">// PRINCIPAL</span>
        </div>

        <router-link to="/dashboard" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F4CA;</span>
          <span v-if="!sidebarCollapsed">DASHBOARD AO VIVO</span>
          <span v-if="!sidebarCollapsed" class="nav-badge badge-green">LIVE</span>
        </router-link>

        <router-link to="/rede" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F310;</span>
          <span v-if="!sidebarCollapsed">REDE VISUAL</span>
        </router-link>

        <router-link to="/metricas" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F4C8;</span>
          <span v-if="!sidebarCollapsed">M&Eacute;TRICAS</span>
        </router-link>

        <!-- Cat&aacute;logo -->
        <div v-if="!sidebarCollapsed" class="nav-section">
          <span class="nav-section-label">// CAT&Aacute;LOGO</span>
        </div>

        <router-link to="/produtos" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F4E6;</span>
          <span v-if="!sidebarCollapsed">PRODUTOS</span>
        </router-link>

        <router-link to="/colecoes" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F4DA;</span>
          <span v-if="!sidebarCollapsed">COLE&Ccedil;&Otilde;ES</span>
        </router-link>

        <router-link to="/subcolecoes" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F4C2;</span>
          <span v-if="!sidebarCollapsed">SUBCOLE&Ccedil;&Otilde;ES</span>
        </router-link>

        <router-link to="/variantes" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F3A8;</span>
          <span v-if="!sidebarCollapsed">VARIANTES</span>
        </router-link>

        <!-- Vendas -->
        <div v-if="!sidebarCollapsed" class="nav-section">
          <span class="nav-section-label">// VENDAS</span>
        </div>

        <router-link to="/pedidos" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F6D2;</span>
          <span v-if="!sidebarCollapsed">PEDIDOS</span>
        </router-link>

        <router-link to="/pagamentos" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F4B3;</span>
          <span v-if="!sidebarCollapsed">PAGAMENTOS</span>
        </router-link>

        <router-link to="/vendas" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F4CA;</span>
          <span v-if="!sidebarCollapsed">VENDAS</span>
          <span v-if="!sidebarCollapsed" class="nav-badge badge-green">NEW</span>
        </router-link>

        <router-link to="/estoque" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F4CB;</span>
          <span v-if="!sidebarCollapsed">ESTOQUE</span>
        </router-link>

        <!-- Sistema -->
        <div v-if="!sidebarCollapsed" class="nav-section">
          <span class="nav-section-label">// SISTEMA</span>
        </div>

        <router-link to="/integracoes" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F517;</span>
          <span v-if="!sidebarCollapsed">INTEGRA&Ccedil;&Otilde;ES</span>
        </router-link>

        <router-link to="/envio" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F69A;</span>
          <span v-if="!sidebarCollapsed">ENVIO</span>
        </router-link>

        <router-link to="/usuarios" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F465;</span>
          <span v-if="!sidebarCollapsed">USU&Aacute;RIOS</span>
        </router-link>

        <router-link to="/configurador" class="nav-item" active-class="active">
          <span class="nav-icon">&#x2699;</span>
          <span v-if="!sidebarCollapsed">CONFIGURADOR</span>
          <span v-if="!sidebarCollapsed" class="nav-badge badge-green">NEW</span>
        </router-link>

        <router-link to="/orchestrator" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F310;</span>
          <span v-if="!sidebarCollapsed">ORCHESTRATOR</span>
          <span v-if="!sidebarCollapsed" class="nav-badge badge-green">NEW</span>
        </router-link>

        <router-link to="/configuracoes" class="nav-item" active-class="active">
          <span class="nav-icon">&#x1F527;</span>
          <span v-if="!sidebarCollapsed">CONFIGURA&Ccedil;&Otilde;ES</span>
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
            <span class="user-role">[ADMIN]</span>
          </div>
        </div>
        <button @click="logout" class="logout-btn">
          <span class="logout-icon">&times;</span>
          <span v-if="!sidebarCollapsed">SAIR</span>
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Top Bar -->
      <header class="top-bar">
        <div class="top-bar-left">
          <button @click="mobileSidebarOpen = true" class="mobile-menu-btn">&#x2630;</button>
          <h2 class="page-title">&gt; {{ currentRouteName }}</h2>
        </div>
        <div class="top-bar-right">
          <!-- Live Indicator -->
          <div v-if="networkStore?.isConnected" class="live-indicator">
            <span class="live-dot"></span>
            <span>LIVE</span>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAdminStore } from '../stores/adminAuth'
import { useNetworkStore } from '../stores/network'

const adminStore = useAdminStore()
const route = useRoute()
const networkStore = useNetworkStore()

const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)

const routeNames = {
  admin: 'DASHBOARD',
  liveDashboard: 'DASHBOARD AO VIVO',
  networkGraph: 'REDE VISUAL',
  orders: 'PEDIDOS',
  products: 'PRODUTOS',
  collections: 'COLE&Ccedil;&Otilde;ES',
  subcollections: 'SUBCOLE&Ccedil;&Otilde;ES',
  variants: 'VARIANTES',
  payments: 'PAGAMENTOS',
  salesDashboard: 'VENDAS',
  shopConfigurator: 'CONFIGURADOR',
  visualOrchestrator: 'ORCHESTRATOR',
  config: 'CONFIGURA&Ccedil;&Otilde;ES',
  inventory: 'ESTOQUE',
  integrations: 'INTEGRA&Ccedil;&Otilde;ES',
  userRoles: 'USU&Aacute;RIOS',
  shipping: 'ENVIO',
  metrics: 'M&Eacute;TRICAS'
}

const currentRouteName = computed(() => {
  return routeNames[route.name] || 'DASHBOARD'
})

function logout() {
  sessionStorage.removeItem('admin-session')
  window.location.href = '/login'
}

onMounted(async () => {
  const isAuth = sessionStorage.getItem('admin-session')
  if (!isAuth) {
    window.location.href = '/login'
    return
  }
  await adminStore.initialize()

  try {
    await networkStore.buildGraph()
    networkStore.subscribeToRealtime()
  } catch (e) {
    console.log('Network store init skipped')
  }
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
  background: rgba(0, 0, 0, 0.8);
  z-index: 99;
  animation: fadeIn 0.15s ease-out;
}

/* Sidebar */
.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-surface);
  border-right: var(--border);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
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
  min-height: 56px;
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  text-decoration: none;
  flex: 1;
  min-width: 0;
}

.logo-icon {
  font-size: 24px;
  color: var(--green);
  flex-shrink: 0;
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.logo-name {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 1px;
}

.collapse-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border: var(--border);
  color: var(--text-secondary);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition);
  font-size: 14px;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: var(--purple-bg);
  border-color: var(--purple);
  color: var(--purple);
}

/* Navigation */
.sidebar-nav {
  flex: 1;
  padding: var(--space-4) var(--space-3);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.nav-section {
  padding: var(--space-4) var(--space-3) var(--space-2);
}

.nav-section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-muted);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius);
  transition: all var(--transition);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  position: relative;
  border: 2px solid transparent;
}

.nav-item:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--purple-bg);
  color: var(--purple);
  border-color: var(--purple);
}

.nav-item.active::before {
  content: '>';
  position: absolute;
  left: var(--space-2);
  color: var(--purple);
  font-weight: 700;
}

.nav-icon {
  font-size: 16px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.nav-badge {
  margin-left: auto;
  padding: 2px 6px;
  font-size: 9px;
}

/* Footer */
.sidebar-footer {
  padding: var(--space-4);
  border-top: var(--border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.user-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: var(--border);
}

.user-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--purple);
  color: white;
  font-size: 12px;
  font-weight: 700;
  border-radius: var(--radius);
  flex-shrink: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 9px;
  color: var(--purple);
  font-weight: 700;
  letter-spacing: 0.5px;
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3);
  background: transparent;
  border: var(--border);
  color: var(--text-secondary);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.logout-btn:hover {
  border-color: var(--red);
  color: var(--red);
  background: var(--red-bg);
}

/* Main Content */
.main-content {
  flex: 1;
  margin-left: var(--sidebar-width);
  transition: margin-left 0.2s ease;
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
  background: var(--bg-surface);
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
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: var(--border);
  color: var(--text-primary);
  cursor: pointer;
  border-radius: var(--radius);
  font-size: 18px;
}

.mobile-menu-btn:hover {
  background: var(--purple-bg);
  border-color: var(--purple);
}

.page-title {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  color: var(--green);
  letter-spacing: 1px;
  margin: 0;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--green-bg);
  border: 1px solid var(--green);
  border-radius: var(--radius);
}

.live-dot {
  width: 6px;
  height: 6px;
  background: var(--green);
  border-radius: var(--radius);
  animation: pulse 2s infinite;
}

.live-indicator span:last-child {
  font-size: 10px;
  font-weight: 700;
  color: var(--green);
  letter-spacing: 1px;
}

.user-avatar-sm {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--purple);
  color: white;
  font-size: 12px;
  font-weight: 700;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition);
  border: 2px solid transparent;
}

.user-avatar-sm:hover {
  border-color: var(--purple-light);
}

/* Content Area */
.content-area {
  flex: 1;
  padding: var(--space-6);
  background: var(--bg-base);
}

/* Responsive */
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
    font-size: 12px;
  }

  .content-area {
    padding: var(--space-4);
  }

  .live-indicator {
    display: none;
  }
}
</style>
