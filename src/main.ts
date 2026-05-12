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
// 404.html passes original path via __redirect query param
nextTick(() => {
  const params = new URLSearchParams(window.location.search)
  const redirectPath = params.get('__redirect')
  if (redirectPath) {
    // Clean URL without reloading
    const cleanUrl = window.location.pathname + window.location.hash
    window.history.replaceState(null, '', cleanUrl)
    // Navigate to the original path (strip /BhumiAdm prefix for router)
    const routerPath = redirectPath.replace(/^\/BhumiAdm\//, '/')
    if (routerPath && routerPath !== '/') {
      router.push(routerPath).catch(() => {})
    }
  }
})
