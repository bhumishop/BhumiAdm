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
nextTick(() => {
  const redirectPath = sessionStorage.getItem('spa-redirect')
  if (redirectPath) {
    sessionStorage.removeItem('spa-redirect')
    const BASE_URL = '/BhumiAdm/'
    const routerPath = redirectPath.replace(new RegExp('^' + BASE_URL), '/')
    if (routerPath && routerPath !== '/') {
      router.push(routerPath).catch(() => {})
    }
  }
})
