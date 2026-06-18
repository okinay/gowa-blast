import { NextRequest, NextResponse } from 'next/server'
import { normalizeBaseUrl, buildHeaders, describeError } from '../_helpers'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const base = normalizeBaseUrl(body.gowaUrl)

  if (!base) {
    return NextResponse.json({ success: false, message: 'Gowa URL belum diatur' }, { status: 400 })
  }

  try {
    const res = await fetch(base + '/send/message', {
      method: 'POST',
      headers: buildHeaders(body, true),
      body: JSON.stringify({ phone: body.phone, message: body.message }),
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
