import { createRouter, createWebHistory } from 'vue-router'
import { useAdminAuthStore } from '../stores/adminAuth'
import type { RouteRecordRaw } from 'vue-router'

const AdminView = () => import('../views/AdminView.vue')
const LoginView = () => import('../views/LoginView.vue')
const OrdersView = () => import('../views/OrdersView.vue')
const ProductsView = () => import('../views/ProductsView.vue')
const CollectionsView = () => import('../views/CollectionsView.vue')
const SubcollectionsView = () => import('../views/SubcollectionsView.vue')
const VariantsView = () => import('../views/VariantsView.vue')
const ShippingView = () => import('../views/ShippingView.vue')
const MetricsView = () => import('../views/MetricsView.vue')
const PaymentsView = () => import('../views/PaymentsView.vue')
const IntegrationsView = () => import('../views/IntegrationsView.vue')
const UserRolesView = () => import('../views/UserRolesView.vue')
const LiveDashboard = () => import('../views/LiveDashboard.vue')
const NetworkGraph = () => import('../views/NetworkGraph.vue')
const NotFoundView = () => import('../views/NotFoundView.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'admin',
    component: AdminView,
    meta: { requiresAuth: true, title: 'BhumiAdm - Dashboard' }
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { guest: true, title: 'BhumiAdm - Login' }
  },
  {
    path: '/pedidos',
    name: 'orders',
    component: OrdersView,
    meta: { requiresAuth: true, title: 'BhumiAdm - Orders' }
  },
  {
    path: '/produtos',
    name: 'products',
    component: ProductsView,
    meta: { requiresAuth: true, title: 'BhumiAdm - Products' }
  },
  {
    path: '/colecoes',
    name: 'collections',
    component: CollectionsView,
    meta: { requiresAuth: true, title: 'BhumiAdm - Collections' }
  },
  {
    path: '/subcolecoes',
    name: 'subcollections',
    component: SubcollectionsView,
    meta: { requiresAuth: true, title: 'BhumiAdm - Subcollections' }
  },
  {
    path: '/variantes',
    name: 'variants',
    component: VariantsView,
    meta: { requiresAuth: true, title: 'BhumiAdm - Variants' }
  },
  {
    path: '/pagamentos',
    name: 'payments',
    component: PaymentsView,
    meta: { requiresAuth: true, title: 'BhumiAdm - Payments' }
  },
  {
    path: '/integracoes',
    name: 'integrations',
    component: IntegrationsView,
    meta: { requiresAuth: true, title: 'BhumiAdm - Integrations' }
  },
  {
    path: '/usuarios',
    name: 'userRoles',
    component: UserRolesView,
    meta: { requiresAuth: true, title: 'BhumiAdm - User Roles' }
  },
  {
    path: '/envio',
    name: 'shipping',
    component: ShippingView,
    meta: { requiresAuth: true, title: 'BhumiAdm - Shipping' }
  },
  {
    path: '/metricas',
    name: 'metrics',
    component: MetricsView,
    meta: { requiresAuth: true, title: 'BhumiAdm - Metrics' }
  },
  {
    path: '/dashboard',
    name: 'liveDashboard',
    component: LiveDashboard,
    meta: { requiresAuth: true, title: 'BhumiAdm - Live Dashboard' }
  },
  {
    path: '/rede',
    name: 'networkGraph',
    component: NetworkGraph,
    meta: { requiresAuth: true, title: 'BhumiAdm - Network Graph' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
    meta: { title: 'BhumiAdm - Page Not Found' }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    }
    return { top: 0 }
  }
})

router.beforeEach(async (to) => {
  const adminStore = useAdminAuthStore()

  if (!adminStore.admin) {
    await adminStore.initialize()
  }

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const isGuest = to.matched.some(record => record.meta.guest)

  if (requiresAuth && !adminStore.admin) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (isGuest && adminStore.admin) {
    return { name: 'admin' }
  }
})

router.afterEach((to) => {
  if (to.meta.title) {
    document.title = to.meta.title as string
  }
})

export default router
