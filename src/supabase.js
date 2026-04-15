import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

export const isDemo = !supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')
if (isDemo) {
  // Silently fall back to demo mode
}

const TIMEOUT_MS = 60000

const withTimeout = (promise) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout (60s)'))
    }, TIMEOUT_MS)
    promise
      .then((result) => {
        clearTimeout(timeout)
        resolve(result)
      })
      .catch((err) => {
        clearTimeout(timeout)
        reject(err)
      })
  })
}

const noOp = () => ({ data: null, error: { message: 'Demo mode' } })
const noOpAuth = {
  getSession: noOp,
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  signUp: noOp,
  signInWithPassword: noOp,
  signInWithOAuth: noOp,
  signInWithOtp: noOp,
  signOut: noOp,
  resetPasswordForEmail: noOp,
  updateUser: noOp,
  getUser: noOp
}
const noOpFrom = () => ({
  select: () => ({
    eq: () => ({ then: () => ({ data: [] }) }),
    order: () => ({ then: () => ({ data: [] }) }),
    insert: noOp,
    update: () => ({ eq: noOp }),
    delete: noOp
  }),
  insert: () => ({ select: () => ({ then: () => ({ data: [] }) }) })
})
const noOpClient = { auth: noOpAuth, from: noOpFrom, rpc: noOp }

export const supabase = !isDemo && supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      global: {
        fetch: (url, options) => withTimeout(fetch(url, {
          ...options,
          headers: {
            ...options?.headers,
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }))
      }
    })
  : noOpClient
