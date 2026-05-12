import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.config.errorHandler = (err, _instance, _info) => {
  console.error('[BhumiAdm Error]', err)
}

app.mount('#app')

// Handle SPA redirect from 404.html (GitHub Pages fallback)
// 404.html stores full URL path like '/BhumiAdm/admin/produtos'
const BASE_URL = '/BhumiAdm/'
nextTick(() => {
  const fullPath = sessionStorage.getItem('spa-redirect')
  if (fullPath) {
    sessionStorage.removeItem('spa-redirect')
    const routerPath = fullPath.replace(new RegExp('^' + BASE_URL), '/')
    if (routerPath && routerPath !== '/') {
      // Pass path to router directly - router prepends BASE_URL internally
      router.replace(routerPath).catch(() => {})
    }
  }
})
