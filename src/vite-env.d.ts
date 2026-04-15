/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module './supabase' {
  export const supabase: Record<string, unknown>
  export const isDemo: boolean
}

declare module './utils/githubCdn' {
  export function uploadProductImages(files: File[], path: string): Promise<Array<{ cdnUrl: string; sha: string }>>
  export function generateCdnUrl(path: string): string
}

interface Window {
  google: {
    accounts: {
      id: {
        initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void
        prompt: (callback: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void
        disableAutoSelect: () => void
      }
      oauth2: {
        initTokenClient: (config: {
          client_id: string
          scope: string
          callback: (response: { access_token: string }) => void
        }) => { requestAccessToken: () => void }
      }
    }
  }
}
