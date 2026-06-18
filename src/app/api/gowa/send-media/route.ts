import { NextRequest, NextResponse } from 'next/server'
import { normalizeBaseUrl, buildHeaders, describeError } from '../_helpers'

// Map jenis media -> path endpoint gowa & nama field file yang diharapkan
const ENDPOINT: Record<string, { path: string; field: string }> = {
  image: { path: '/send/image', field: 'image' },
  video: { path: '/send/video', field: 'video' },
  file: { path: '/send/file', field: 'file' },
}

export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Form tidak valid: ' + describeError(err) }, { status: 200 })
  }

  const base = normalizeBaseUrl(String(form.get('gowaUrl') ?? ''))
  const type = String(form.get('type') ?? '')
  const phone = String(form.get('phone') ?? '')
  const caption = String(form.get('caption') ?? '')
  const file = form.get('file')

  if (!base) {
    return NextResponse.json({ success: false, message: 'Gowa URL belum diatur' }, { status: 400 })
  }
  const target = ENDPOINT[type]
  if (!target) {
    return NextResponse.json({ success: false, message: `Jenis media tidak dikenal: ${type}` }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: 'File tidak ditemukan' }, { status: 400 })
  }

  // Rakit FormData bersih sesuai ekspektasi gowa
  const out = new FormData()
  out.append('phone', phone)
  if (caption) out.append('caption', caption)
  out.append(target.field, file, file.name)

  try {
    const res = await fetch(base + target.path, {
      method: 'POST',
      headers: buildHeaders({
        deviceId: String(form.get('deviceId') ?? ''),
        basicAuth: String(form.get('basicAuth') ?? ''),
      }), // tanpa Content-Type — fetch set boundary multipart otomatis
      body: out,
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      const msg =
        res.status === 401
          ? 'HTTP 401 — Basic Auth salah/kosong'
          : (data?.message as string) ?? `HTTP ${res.status}`
      return NextResponse.json({ success: false, message: msg }, { status: 200 })
    }

    return NextResponse.json({ success: true, message: (data?.message as string) ?? 'Terkirim' })
  } catch (err) {
    return NextResponse.json({ success: false, message: describeError(err) }, { status: 200 })
  }
}
