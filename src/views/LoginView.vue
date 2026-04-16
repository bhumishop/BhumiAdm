<template>
  <div class="login-page">
    <!-- Background -->
    <div class="login-bg">
      <div class="bg-orb orb-top"></div>
      <div class="bg-orb orb-bottom"></div>
      <div class="bg-grain"></div>
    </div>

    <!-- Login Card -->
    <div class="login-container">
      <div class="login-card">
        <!-- Logo -->
        <div class="login-header">
          <div class="login-logo">
            <span class="logo-mark"></span>
          </div>
          <h1>Bhumi<span class="logo-accent">Adm</span></h1>
          <p class="login-subtitle">Painel de Administra&ccedil;&atilde;o</p>
        </div>

        <!-- Divider -->
        <hr class="login-divider">

        <!-- Form -->
        <div class="login-form">
          <p class="form-prompt">Fa&ccedil;a login para continuar</p>

          <div id="google-signin-button" class="google-button"></div>

          <div v-if="adminStore.error" class="error-box">
            <span class="error-mark"></span>
            <span>{{ adminStore.error }}</span>
          </div>

          <div v-if="!googleLoaded" class="loading-placeholder">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
          </div>
        </div>

        <!-- Features -->
        <div class="login-features">
          <div class="feature">
            <span class="feature-indicator"></span>
            <span>Dashboard em tempo real</span>
          </div>
          <div class="feature">
            <span class="feature-indicator gold"></span>
            <span>Gest&atilde;o de vendas</span>
          </div>
          <div class="feature">
            <span class="feature-indicator rose"></span>
            <span>Cat&aacute;logo integrado</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <p class="login-footer">&copy; 2026 Bhumisparsha School</p>
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
const GOOGLE_BUTTON_MAX_RETRIES = 20

async function handleSignIn() {
  try {
    await adminStore.signInWithGoogle()
    const redirect = route.query.redirect || '/admin'
    if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
      router.push(redirect)
    } else {
      router.push('/admin')
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
      if (response.credential) {
        try {
          await adminStore.loginWithGoogle(response.credential)
          const redirect = route.query.redirect || '/admin'
          if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
            router.push(redirect)
          } else {
            router.push('/admin')
          }
        } catch (e) {
          console.error('Login error:', e)
        }
      }
    },
    auto_select: false,
  })

  google.accounts.id.renderButton(
    document.getElementById('google-signin-button'),
    {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
    }
  )

  googleLoaded.value = true
}

onMounted(async () => {
  await adminStore.initialize()
  if (adminStore.isAdmin) {
    router.push('/admin')
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

/* ===== BACKGROUND ===== */
.login-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: var(--bg-base);
}

.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.08;
}

.orb-top {
  width: 600px;
  height: 600px;
  top: -20%;
  right: -10%;
  background: radial-gradient(circle, var(--gold) 0%, transparent 70%);
  animation: breathe 12s ease-in-out infinite;
}

.orb-bottom {
  width: 500px;
  height: 500px;
  bottom: -15%;
  left: -10%;
  background: radial-gradient(circle, var(--rose) 0%, transparent 70%);
  animation: breathe 14s ease-in-out infinite 3s;
}

.bg-grain {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  opacity: 0.3;
}

/* ===== CONTAINER ===== */
.login-container {
  width: 100%;
  max-width: 400px;
  animation: fadeInUp 0.6s ease-out;
}

/* ===== CARD ===== */
.login-card {
  background: var(--bg-surface);
  border: var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-10);
  position: relative;
  overflow: hidden;
}

.login-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold-border), transparent);
}

/* ===== HEADER ===== */
.login-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

.login-logo {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-6);
}

.logo-mark {
  width: 48px;
  height: 48px;
  border: 2px solid var(--gold);
  border-radius: 50%;
  display: block;
  position: relative;
  animation: breathe 4s ease-in-out infinite;
}

.logo-mark::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: var(--gold);
  border-radius: 50%;
}

.login-header h1 {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 500;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  margin-bottom: var(--space-2);
  font-variation-settings: "SOFT" 50, "WONK" 0;
}

.logo-accent {
  color: var(--gold);
  font-variation-settings: "SOFT" 50, "WONK" 1;
}

.login-subtitle {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-tertiary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* ===== DIVIDER ===== */
.login-divider {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--border), transparent);
  margin-bottom: var(--space-8);
}

/* ===== FORM ===== */
.login-form {
  margin-bottom: var(--space-8);
}

.form-prompt {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: var(--space-6);
}

.google-button {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-4);
}

:deep(.nsm7Bb-HzV7m-LgbsSe) {
  border-radius: var(--radius-md) !important;
  font-family: var(--font-sans) !important;
}

.error-box {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--danger);
  margin-bottom: var(--space-4);
}

.error-mark {
  width: 6px;
  height: 6px;
  background: var(--danger);
  border-radius: 50%;
  flex-shrink: 0;
}

.loading-placeholder {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-4);
}

.loading-dot {
  width: 6px;
  height: 6px;
  background: var(--gold);
  border-radius: 50%;
  animation: pulse-soft 1.2s ease-in-out infinite;
}

.loading-dot:nth-child(2) { animation-delay: 0.2s; }
.loading-dot:nth-child(3) { animation-delay: 0.4s; }

/* ===== FEATURES ===== */
.login-features {
  padding: var(--space-5);
  background: var(--bg-elevated);
  border: var(--border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.feature {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: 12px;
  font-weight: 400;
  color: var(--text-tertiary);
  letter-spacing: 0.02em;
}

.feature-indicator {
  width: 6px;
  height: 6px;
  background: var(--success);
  border-radius: 50%;
  flex-shrink: 0;
}

.feature-indicator.gold { background: var(--gold); }
.feature-indicator.rose { background: var(--rose); }

/* ===== FOOTER ===== */
.login-footer {
  text-align: center;
  margin-top: var(--space-6);
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 480px) {
  .login-card {
    padding: var(--space-8);
  }

  .login-header h1 {
    font-size: 24px;
  }

  .logo-mark {
    width: 40px;
    height: 40px;
  }

  .logo-mark::after {
    width: 10px;
    height: 10px;
  }
}
</style>
