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
// 404.html stores full URL like '/BhumiAdm/admin/produtos'
nextTick(() => {
  const fullPath = sessionStorage.getItem('spa-redirect')
  if (fullPath) {
    sessionStorage.removeItem('spa-redirect')
    // Extract the path after /BhumiAdm/ for router
    const BASE_URL = '/BhumiAdm/'
    const routerPath = fullPath.replace(new RegExp('^' + BASE_URL), '/')
    if (routerPath && routerPath !== '/') {
      // Use history API directly to avoid router base URL issues
      window.history.replaceState(null, '', fullPath)
      // Let Vue Router handle it by matching current location
    }
  }
})
