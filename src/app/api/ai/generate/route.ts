import { NextRequest, NextResponse } from 'next/server'
import { normalizeBase, describeError, apiErrorMessage } from '../_helpers'

export async function POST(req: NextRequest) {
  const { baseUrl, apiKey, model, persona, brief, image } = await req.json()
  const base = normalizeBase(baseUrl)
  const hasImage = typeof image === 'string' && image.startsWith('data:')

  if (!base) return NextResponse.json({ ok: false, message: 'Base URL AI belum diatur' }, { status: 400 })
  if (!model) return NextResponse.json({ ok: false, message: 'Model belum dipilih' }, { status: 400 })
  if (!brief?.trim() && !hasImage) {
    return NextResponse.json({ ok: false, message: 'Tulis dulu poin/draft atau lampirkan gambar' }, { status: 400 })
  }

  const systemPrompt = [
    'Kamu adalah asisten penulis pesan WhatsApp berbahasa Indonesia.',
    hasImage
      ? 'Tugasmu: buat satu pesan WhatsApp yang rapi berdasarkan gambar yang diberikan. Bila ada konteks tambahan dari pengguna, gunakan sebagai panduan utama.'
      : 'Tugasmu: ubah poin/draft kasar dari pengguna menjadi satu pesan WhatsApp yang rapi, jelas, dan enak dibaca.',
    persona?.trim()
      ? `Tulis dengan persona/gaya berikut: ${persona.trim()}`
      : 'Gunakan gaya yang ramah, sopan, dan profesional.',
    'Aturan format: gunakan format WhatsApp bila perlu — *tebal*, _miring_, ~coret~. Boleh pakai emoji secukupnya bila cocok dengan persona.',
    'Jangan menambah penjelasan, catatan, atau tanda kutip pembungkus. Keluarkan HANYA isi pesan final.',
  ].join('\n')

  // Susun pesan user — multimodal bila ada gambar
  let userContent: unknown
  if (hasImage) {
    const contextText = brief?.trim()
      ? `Konteks tambahan: ${brief.trim()}`
      : 'Buat pesan WhatsApp yang menarik berdasarkan gambar ini.'
    userContent = [
      { type: 'text', text: contextText },
      { type: 'image_url', image_url: { url: image } },
    ]
  } else {
    userContent = brief
  }

  try {
    const res = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.8,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json({ ok: false, message: apiErrorMessage(res.status, data) }, { status: 200 })
    }

    const text: string =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      ''

    if (!text.trim()) {
      return NextResponse.json({ ok: false, message: 'AI tidak mengembalikan teks' }, { status: 200 })
    }

    return NextResponse.json({ ok: true, text: text.trim() })
  } catch (err) {
    return NextResponse.json({ ok: false, message: describeError(err) }, { status: 200 })
  }
}
