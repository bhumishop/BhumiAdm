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
// 404.html stores full URL path and redirects to index.html
// We reload to ensure Vue Router processes the correct path
const BASE_URL = '/BhumiAdm/'
nextTick(() => {
  const fullPath = sessionStorage.getItem('spa-redirect')
  if (fullPath) {
    sessionStorage.removeItem('spa-redirect')
    // Reload with the stored path so Vue Router can match the route
    window.location.href = fullPath
  }
})
