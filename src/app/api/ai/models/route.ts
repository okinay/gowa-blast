import { NextRequest, NextResponse } from 'next/server'
import { normalizeBase, describeError, apiErrorMessage } from '../_helpers'

export async function POST(req: NextRequest) {
  const { baseUrl, apiKey } = await req.json()
  const base = normalizeBase(baseUrl)

  if (!base) return NextResponse.json({ ok: false, message: 'Base URL kosong', models: [] }, { status: 400 })

  try {
    const res = await fetch(base + '/models', {
      method: 'GET',
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json({ ok: false, message: apiErrorMessage(res.status, data), models: [] }, { status: 200 })
    }

    // OpenAI-compatible: { data: [{ id }, ...] }. Fallback ke bentuk lain.
    const list: unknown[] = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
        ? data.models
        : Array.isArray(data)
          ? data
          : []

    const models = list
      .map((m: unknown) => {
        if (typeof m === 'string') return m
        const obj = m as Record<string, unknown>
        return (obj?.id as string) ?? (obj?.name as string) ?? ''
      })
      .filter((id: string) => !!id)
      .sort()

    return NextResponse.json({ ok: true, models })
  } catch (err) {
    return NextResponse.json({ ok: false, message: describeError(err), models: [] }, { status: 200 })
  }
}
