import { createApp } from 'vue'
import { createPinia } from 'pinia'
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
// The stored path includes /BhumiAdm/ prefix from browser URL
const redirectPath = sessionStorage.getItem('spa-redirect')
if (redirectPath) {
  sessionStorage.removeItem('spa-redirect')
  // Remove base URL prefix to get clean router path
  const baseUrl = import.meta.env.BASE_URL || '/'
  const cleanPath = baseUrl !== '/' 
    ? redirectPath.replace(baseUrl, '/')
    : redirectPath
  if (cleanPath && cleanPath !== '/') {
    router.replace(cleanPath).catch(() => {})
  }
}
