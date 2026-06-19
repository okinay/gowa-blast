import type { GowaSettings } from '@/hooks/useSettings'

export async function fetchModels(
  baseUrl: string,
  apiKey: string
): Promise<{ ok: boolean; models: string[]; message?: string }> {
  if (!baseUrl) return { ok: false, models: [], message: 'Base URL AI belum diatur' }
  try {
    const res = await fetch('/api/ai/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl, apiKey }),
    })
    return await res.json()
  } catch (err) {
    return { ok: false, models: [], message: String(err) }
  }
}

export async function generateMessage(
  settings: GowaSettings,
  brief: string,
  imageDataUrl?: string
): Promise<{ ok: boolean; text?: string; message?: string }> {
  if (!settings.aiBaseUrl) return { ok: false, message: 'AI belum diatur di Settings' }
  if (!settings.aiModel) return { ok: false, message: 'Model AI belum dipilih di Settings' }
  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: settings.aiBaseUrl,
        apiKey: settings.aiApiKey,
        model: settings.aiModel,
        persona: settings.aiPersona,
        brief,
        image: imageDataUrl ?? '',
      }),
    })
    return await res.json()
  } catch (err) {
    return { ok: false, message: String(err) }
  }
}

/**
 * Baca file gambar, kecilkan ke sisi maksimum `maxDim`, kembalikan data URL JPEG.
 * Mengurangi ukuran payload agar tidak melebihi batas body & lebih cepat.
 */
export function imageFileToDataUrl(file: File, maxDim = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas tidak didukung'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Gagal membaca gambar'))
    }
    img.src = url
  })
}
