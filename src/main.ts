import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'

console.log('[BhumiAdm] main.ts loaded, BASE_URL:', import.meta.env.BASE_URL)

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.config.errorHandler = (err, _instance, _info) => {
  console.error('[BhumiAdm Error]', err)
}

app.mount('#app')

console.log('[BhumiAdm] App mounted, current path:', window.location.pathname)

// Handle SPA redirect from 404.html (GitHub Pages fallback)
nextTick(() => {
  const redirectPath = sessionStorage.getItem('spa-redirect')
  console.log('[BhumiAdm] nextTick, sessionStorage:', redirectPath)
  if (redirectPath) {
    sessionStorage.removeItem('spa-redirect')
    console.log('[BhumiAdm] SPA redirect:', redirectPath)
    // Remove base URL prefix for router
    const BASE_URL = '/BhumiAdm/'
    const routerPath = redirectPath.replace(new RegExp('^' + BASE_URL), '/')
    console.log('[BhumiAdm] Router path:', routerPath)
    if (routerPath && routerPath !== '/') {
      router.push(routerPath).catch(e => console.error('[BhumiAdm] Redirect error:', e))
    }
  }
})
