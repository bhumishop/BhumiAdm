// TypeScript declaration for modules without types
declare module '../supabase' {
  export const supabase: Record<string, unknown>
  export const isDemo: boolean
}

declare module '../utils/githubCdn' {
  export function uploadProductImages(files: File[], path: string): Promise<Array<{ cdnUrl: string; sha: string }>>
  export function generateCdnUrl(path: string): string
}
