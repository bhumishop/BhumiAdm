export function isFileOnCdn(cdnUrl: string): Promise<boolean>
export function uploadImageToCdn(file: File | Blob, objectPath: string): Promise<{ cdnUrl: string; sha?: string; skipped: boolean }>
export function uploadProductImages(productId: string, files: File[], prefix?: string): Promise<{ urls: string[]; skipped: number }>
export function transformToCdnUrl(url: string): string
export function generateCdnUrl(objectPath: string, prefix?: string): string
export function isLikelyBrokenCdnUrl(url: string): boolean
