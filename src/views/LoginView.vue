<template>
  <div class="login-page">
    <!-- Grid Background -->
    <div class="login-bg">
      <div class="bg-grid"></div>
      <div class="bg-line top"></div>
      <div class="bg-line right"></div>
      <div class="bg-line bottom"></div>
      <div class="bg-line left"></div>
    </div>

    <!-- Login Box -->
    <div class="login-box animate-slideUp">
      <!-- Header -->
      <div class="login-header">
        <div class="logo-icon">&#x262F;</div>
        <h1>BHUMI<span class="text-purple">SHOP</span></h1>
        <p class="login-subtitle">PAINEL DE ADMINISTRA&Ccedil;&Atilde;O</p>
        <div class="header-line"></div>
      </div>

      <!-- Form -->
      <div class="login-form">
        <p class="form-label">&gt; FA&Ccedil;A LOGIN PARA CONTINUAR</p>

        <div id="google-signin-button" class="google-button"></div>

        <div v-if="adminStore.error" class="error-box animate-fadeIn">
          <span class="error-icon">[!]</span>
          <span>{{ adminStore.error }}</span>
        </div>

        <button v-if="!googleLoaded" class="btn btn-primary btn-lg btn-block" disabled>
          <span class="animate-pulse">CARREGANDO...</span>
        </button>
      </div>

      <!-- Features -->
      <div class="features-box">
        <div class="feature-item">
          <span class="feature-dot green"></span>
          <span>DASHBOARD EM TEMPO REAL</span>
        </div>
        <div class="feature-item">
          <span class="feature-dot purple"></span>
          <span>GEST&Atilde;O DE VENDAS</span>
        </div>
        <div class="feature-item">
          <span class="feature-dot red"></span>
          <span>CAT&Aacute;LOGO INTEGRADO</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="login-footer">
        <p>&copy; 2026 BHUMISHOP // TODOS OS DIREITOS RESERVADOS</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAdminAuthStore } from '../stores/adminAuth'

const router = useRouter()
const route = useRoute()
const adminStore = useAdminAuthStore()

const googleLoaded = ref(false)
let googleButtonRetries = 0
const GOOGLE_BUTTON_MAX_RETRIES = 20 // 10 seconds max

async function handleSignIn() {
  try {
    await adminStore.signInWithGoogle()
    const redirect = route.query.redirect || '/'
    // Prevent open redirect attacks - only allow relative paths
    if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
      router.push(redirect)
    } else {
      router.push('/')
    }
  } catch (e) {
    console.error('Login error:', e)
  }
}

function renderGoogleButton() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const isConfigured = clientId && !clientId.includes('YOUR_') && !clientId.includes('your-')

  if (!isConfigured) {
    console.error('[BhumiAdm] Google OAuth not configured. Set VITE_GOOGLE_CLIENT_ID in .env.')
    return
  }

  if (typeof google === 'undefined' || !google.accounts?.id) {
    if (++googleButtonRetries > GOOGLE_BUTTON_MAX_RETRIES) {
      console.error('Google Identity Services failed to load')
      return
    }
    setTimeout(renderGoogleButton, 500)
    return
  }

  google.accounts.id.initialize({
    client_id: clientId,
    callback: async (response) => {
      try {
        await handleSignIn()
      } catch (e) {
        console.error('Login error:', e)
      }
    },
    auto_select: false,
  })

  google.accounts.id.renderButton(
    document.getElementById('google-signin-button'),
    {
      theme: 'outline',
      size: 'large',
      width: '100%',
      text: 'signin_with',
      shape: 'rectangular',
    }
  )

  googleLoaded.value = true
}

onMounted(async () => {
  await adminStore.initialize()
  if (adminStore.isAdmin) {
    router.push('/')
    return
  }
  renderGoogleButton()
})
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  position: relative;
  overflow: hidden;
}

/* Background */
.login-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: var(--bg-base);
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(#1A1A25 1px, transparent 1px),
    linear-gradient(90deg, #1A1A25 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.3;
}

.bg-line {
  position: absolute;
  background: var(--purple);
  opacity: 0.2;
}

.bg-line.top {
  top: 0;
  left: 20%;
  width: 2px;
  height: 100vh;
}

.bg-line.right {
  top: 30%;
  right: 0;
  width: 100vw;
  height: 2px;
}

.bg-line.bottom {
  bottom: 0;
  right: 25%;
  width: 2px;
  height: 100vh;
}

.bg-line.left {
  bottom: 25%;
  left: 0;
  width: 100vw;
  height: 2px;
}

/* Login Box */
.login-box {
  width: 100%;
  max-width: 420px;
  background: var(--bg-surface);
  border: var(--border);
  padding: var(--space-8);
  position: relative;
}

.login-box::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  height: 2px;
  background: var(--purple);
}

.login-box::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: -2px;
  width: 60px;
  height: 2px;
  background: var(--green);
}

/* Header */
.login-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

.logo-icon {
  font-size: 48px;
  color: var(--green);
  margin-bottom: var(--space-4);
  display: block;
}

.login-header h1 {
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 2px;
  margin-bottom: var(--space-2);
}

.login-subtitle {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--text-muted);
}

.header-line {
  width: 80px;
  height: 2px;
  background: var(--purple);
  margin: var(--space-6) auto 0;
}

/* Form */
.login-form {
  margin-bottom: var(--space-6);
}

.form-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--green);
  margin-bottom: var(--space-6);
  text-align: center;
}

.google-button {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-4);
}

:deep(.nsm7Bb-HzV7m-LgbsSe) {
  border-radius: var(--radius) !important;
  font-family: var(--font-mono) !important;
}

.error-box {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--red-bg);
  border: var(--border-red);
  font-size: 11px;
  font-weight: 600;
  color: var(--red);
  letter-spacing: 0.5px;
}

.error-icon {
  font-family: var(--font-mono);
  font-weight: 700;
}

.btn-block {
  width: 100%;
}

/* Features */
.features-box {
  padding: var(--space-4);
  background: var(--bg-elevated);
  border: var(--border);
  margin-bottom: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.feature-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-secondary);
}

.feature-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius);
  flex-shrink: 0;
}

.feature-dot.green { background: var(--green); }
.feature-dot.purple { background: var(--purple); }
.feature-dot.red { background: var(--red); }

/* Footer */
.login-footer {
  text-align: center;
}

.login-footer p {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--text-muted);
}

/* Responsive */
@media (max-width: 480px) {
  .login-box {
    padding: var(--space-6);
  }

  .logo-icon {
    font-size: 36px;
  }

  .login-header h1 {
    font-size: 24px;
  }
}
</style>
