export function normalizeBase(raw: string): string {
  let url = (raw ?? '').trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  return url.replace(/\/+$/, '')
}

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

export function apiErrorMessage(status: number, data: Record<string, unknown>): string {
  if (status === 401) return 'HTTP 401 — API key salah/kosong'
  const err = data?.error as Record<string, unknown> | undefined
  return (err?.message as string) ?? (data?.message as string) ?? `HTTP ${status}`
}
