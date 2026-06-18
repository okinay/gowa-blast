export interface GowaProxyInput {
  gowaUrl?: string
  deviceId?: string
  basicAuth?: string
}

/** Bersihkan & normalisasi base URL: trim, buang trailing slash, auto https:// */
export function normalizeBaseUrl(raw: string): string {
  let url = (raw ?? '').trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  return url.replace(/\/+$/, '')
}

export function buildHeaders(input: GowaProxyInput, json = false): Record<string, string> {
  const headers: Record<string, string> = {}
  if (json) headers['Content-Type'] = 'application/json'
  if (input.deviceId?.trim()) headers['X-Device-Id'] = input.deviceId.trim()
  if (input.basicAuth?.trim()) {
    headers['Authorization'] = 'Basic ' + Buffer.from(input.basicAuth.trim()).toString('base64')
  }
  return headers
}

/** Ubah error fetch Node jadi pesan yang berguna (sertakan cause asli) */
export function describeError(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: { message?: string; code?: string } }).cause
    if (cause?.code || cause?.message) {
      return `${err.message} (${cause.code ?? ''}${cause.code && cause.message ? ': ' : ''}${cause.message ?? ''})`
    }
    return err.message
  }
  return String(err)
}
