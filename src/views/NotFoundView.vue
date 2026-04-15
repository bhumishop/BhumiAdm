<template>
  <div class="not-found-page">
    <!-- Grid Background -->
    <div class="not-found-bg">
      <div class="bg-grid"></div>
      <div class="bg-line top"></div>
      <div class="bg-line right"></div>
      <div class="bg-line bottom"></div>
      <div class="bg-line left"></div>
    </div>

    <!-- Not Found Box -->
    <div class="not-found-box animate-slideUp">
      <div class="error-code">404</div>
      <h1>P&Aacute;GINA N&Atilde;O ENCONTRADA</h1>
      <p class="error-message">A p&aacute;gina que voc&ecirc; est&aacute; procurando n&atilde;o existe ou foi removida.</p>
      <div class="error-line"></div>
      <router-link to="/" class="btn btn-primary btn-lg">
        VOLTAR AO PAINEL
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAdminAuthStore } from '../stores/adminAuth'

const router = useRouter()
const adminStore = useAdminAuthStore()

// Redirect to login if not authenticated
if (!adminStore.admin) {
  router.push({ name: 'login' })
}
</script>

<style scoped>
.not-found-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6, 24px);
  position: relative;
  overflow: hidden;
}

/* Background */
.not-found-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: var(--bg-base, #0D0D14);
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
  background: var(--purple, #8B5CF6);
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

/* Not Found Box */
.not-found-box {
  width: 100%;
  max-width: 500px;
  background: var(--bg-surface, #151520);
  border: 1px solid var(--border-color, #2A2A3A);
  padding: var(--space-10, 40px);
  position: relative;
  text-align: center;
}

.not-found-box::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  height: 2px;
  background: var(--purple, #8B5CF6);
}

.not-found-box::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: -2px;
  width: 60px;
  height: 2px;
  background: var(--red, #EF4444);
}

.error-code {
  font-family: var(--font-mono, 'Courier New', monospace);
  font-size: 96px;
  font-weight: 700;
  color: var(--red, #EF4444);
  line-height: 1;
  margin-bottom: var(--space-4, 16px);
  letter-spacing: 4px;
}

h1 {
  font-family: var(--font-display, 'Courier New', monospace);
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary, #E5E5E5);
  letter-spacing: 2px;
  margin-bottom: var(--space-4, 16px);
}

.error-message {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-secondary, #A0A0B0);
  margin-bottom: var(--space-8, 32px);
  line-height: 1.6;
}

.error-line {
  width: 80px;
  height: 2px;
  background: var(--purple, #8B5CF6);
  margin: 0 auto var(--space-8, 32px);
}

.btn {
  display: inline-block;
  padding: 12px 32px;
  font-family: var(--font-mono, 'Courier New', monospace);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--purple, #8B5CF6);
  color: white;
}

.btn-primary:hover {
  background: var(--purple-hover, #7C3AED);
  transform: translateY(-1px);
}

.btn-lg {
  padding: 14px 40px;
}

/* Responsive */
@media (max-width: 480px) {
  .not-found-box {
    padding: var(--space-8, 32px);
  }

  .error-code {
    font-size: 64px;
  }

  h1 {
    font-size: 18px;
  }
}
</style>
