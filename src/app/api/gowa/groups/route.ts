import { NextRequest, NextResponse } from 'next/server'
import { normalizeBaseUrl, buildHeaders, describeError } from '../_helpers'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const base = normalizeBaseUrl(body.gowaUrl)

  if (!base) {
    return NextResponse.json({ ok: false, message: 'Gowa URL kosong', groups: [] }, { status: 400 })
  }

  try {
    const res = await fetch(base + '/user/my/groups', {
      method: 'GET',
      headers: buildHeaders(body),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      const msg =
        res.status === 401
          ? 'HTTP 401 — Basic Auth salah/kosong'
          : (data?.message as string) ?? `HTTP ${res.status}`
      return NextResponse.json({ ok: false, message: msg, groups: [] }, { status: 200 })
    }

    // Teruskan results mentah; parsing defensif dilakukan di client
    return NextResponse.json({ ok: true, results: data?.results ?? data })
  } catch (err) {
    return NextResponse.json({ ok: false, message: describeError(err), groups: [] }, { status: 200 })
  }
}
