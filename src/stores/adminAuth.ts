import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AdminUser } from '../types'
import { edgeApi } from '../api/edgeApi'
import { clearProductsCache } from './products'
import { clearOrdersCache } from './orders'

const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000 // 24 hours
const TOKEN_KEY = 'bhumi_admin_token'
const ADMIN_KEY = 'bhumi_admin'
const TIMESTAMP_KEY = 'bhumi_admin_timestamp'

// Validate Google client ID is configured
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const isGoogleConfigured = GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes('YOUR_') && !GOOGLE_CLIENT_ID.includes('your-')

if (!isGoogleConfigured) {
  console.warn('[BhumiAdm] Google OAuth not configured. Set VITE_GOOGLE_CLIENT_ID in .env to enable admin login.')
}

export const useAdminAuthStore = defineStore('adminAuth', () => {
  const admin = ref<AdminUser | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAdmin = computed(() => !!admin.value)

  function isSessionValid(): boolean {
    const timestamp = localStorage.getItem(TIMESTAMP_KEY)
    if (!timestamp) return false
    const elapsed = Date.now() - parseInt(timestamp, 10)
    return elapsed < SESSION_TIMEOUT_MS
  }

  /**
   * Verify Google ID token from button click callback
   */
  async function verifyGoogleIdToken(idToken: string): Promise<AdminUser> {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.auth.signIn(idToken)

      localStorage.setItem(TOKEN_KEY, result.token)
      localStorage.setItem(ADMIN_KEY, JSON.stringify(result.admin))
      localStorage.setItem(TIMESTAMP_KEY, Date.now().toString())

      admin.value = result.admin
      return result.admin
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao fazer login'
      error.value = message
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Sign in with Google OAuth via edge function
   * This is kept for programmatic sign-in; button click uses verifyGoogleIdToken directly
   */
  async function signInWithGoogle(): Promise<AdminUser> {
    loading.value = true
    error.value = null

    try {
      const idToken = await new Promise<string>((resolve, reject) => {
        if (!isGoogleConfigured) {
          reject(new Error('Google OAuth is not configured. Set VITE_GOOGLE_CLIENT_ID in .env.'))
          return
        }

        // Use One Tap prompt - don't re-initialize, just prompt
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback to popup flow
            window.google.accounts.oauth2
              .initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'email profile',
                callback: (resp) => {
                  if (resp.access_token) {
                    // With access token, we need to get ID token via another request
                    // For now, reject and suggest button click flow
                    reject(new Error('Use the Sign In button directly'))
                  } else {
                    reject(new Error('No access token'))
                  }
                },
              })
              .requestAccessToken()
          }
        })
      })

      const result = await edgeApi.auth.signIn(idToken)

      localStorage.setItem(TOKEN_KEY, result.token)
      localStorage.setItem(ADMIN_KEY, JSON.stringify(result.admin))
      localStorage.setItem(TIMESTAMP_KEY, Date.now().toString())

      admin.value = result.admin
      return result.admin
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao fazer login'
      error.value = message
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Verify existing session via edge function
   */
  async function verifySession(): Promise<boolean> {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return false

    try {
      const result = await edgeApi.auth.verify(token)
      if (result.valid) {
        admin.value = result.admin
        localStorage.setItem(TIMESTAMP_KEY, Date.now().toString())
        return true
      }
      return false
    } catch {
      return false
    }
  }

  /**
   * Refresh session token
   */
  async function refreshSession(): Promise<boolean> {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return false

    try {
      const result = await edgeApi.auth.refresh(token)
      if (result.token) {
        localStorage.setItem(TOKEN_KEY, result.token)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  /**
   * Sign out via edge function
   */
  function signOut(): void {
    admin.value = null
    error.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ADMIN_KEY)
    localStorage.removeItem(TIMESTAMP_KEY)

    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
  }

  /**
   * Initialize - check for existing session
   */
  async function initialize(): Promise<void> {
    const saved = localStorage.getItem(ADMIN_KEY)
    if (saved && isSessionValid()) {
      try {
        admin.value = JSON.parse(saved) as AdminUser

        const valid = await verifySession()
        if (!valid) {
          signOut()
        }
      } catch {
        signOut()
      }
    }
  }

  return {
    admin,
    loading,
    error,
    isAdmin,
    verifyGoogleIdToken,
    signInWithGoogle,
    verifySession,
    refreshSession,
    signOut,
    initialize,
  }
})

// Compatibility alias for router and other code that imports useAdminStore
export const useAdminStore = defineStore('adminCompat', () => {
  const newStore = useAdminAuthStore()

  const user = computed(() => newStore.admin)
  const initialized = computed(() => !!newStore.admin || !newStore.loading)
  const isAuthenticated = computed(() => !!newStore.admin)

  async function login(_email: string, _password: string): Promise<void> {
    throw new Error('Email/password login is no longer supported. Use Google OAuth.')
  }

  function logout(): void {
    newStore.signOut()
  }

  function isAuth(): boolean {
    return !!newStore.admin
  }

  async function checkAdminRole(): Promise<boolean> {
    return newStore.isAdmin
  }

  async function initialize(): Promise<void> {
    await newStore.initialize()
  }

  return {
    user,
    loading: computed(() => newStore.loading),
    error: computed(() => newStore.error),
    initialized,
    isAuthenticated,
    initialize,
    login,
    logout,
    isAuth,
    checkAdminRole,
  }
})
