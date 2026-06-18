import { NextRequest, NextResponse } from 'next/server'
import { normalizeBaseUrl, buildHeaders, describeError } from '../_helpers'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const base = normalizeBaseUrl(body.gowaUrl)

  if (!base) {
    return NextResponse.json({ ok: false, message: 'Gowa URL kosong' }, { status: 400 })
  }

  try {
    const res = await fetch(base + '/app/status', {
      method: 'GET',
      headers: buildHeaders(body),
    })

    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      const status = (data?.results as Record<string, unknown>)?.status ?? data?.message ?? 'Connected'
      return NextResponse.json({ ok: true, message: `Terhubung — status: ${status}` })
    }

    if (res.status === 401) {
      return NextResponse.json({ ok: false, message: 'HTTP 401 — Basic Auth salah/kosong. Isi field Basic Auth.' })
    }

    return NextResponse.json({
      ok: false,
      message: `HTTP ${res.status}: ${(data?.message as string) ?? 'Error'}`,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, message: describeError(err) })
  }
}
