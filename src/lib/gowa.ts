import type { GowaSettings } from '@/hooks/useSettings'

export interface SendResult {
  phone: string
  success: boolean
  message?: string
}

export type MediaType = 'image' | 'video' | 'file'

export interface GroupInfo {
  jid: string
  name: string
  size: number
}

export function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, '')
  if (p.startsWith('0')) p = '62' + p.slice(1)
  return p
}

export function isGroupJid(target: string): boolean {
  return target.trim().endsWith('@g.us')
}

/** Ubah target jadi JID WhatsApp. Group JID (xxx@g.us) atau JID apa pun diteruskan apa adanya. */
function toWaJid(target: string): string {
  const t = target.trim()
  if (t.includes('@')) return t
  return `${normalizePhone(t)}@s.whatsapp.net`
}

/** ID untuk ditampilkan di log: group pakai JID utuh, nomor dinormalisasi */
export function targetId(target: string): string {
  return isGroupJid(target) ? target.trim() : normalizePhone(target)
}

/** Tentukan jenis media berdasarkan MIME type file */
export function detectMediaType(file: File): MediaType {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  return 'file'
}

/** Delay acak (ms) di antara min & max — inti dari anti-spam */
export function randomDelayMs(minSec: number, maxSec: number): number {
  const lo = Math.max(0, Math.min(minSec, maxSec)) * 1000
  const hi = Math.max(minSec, maxSec) * 1000
  return Math.round(lo + Math.random() * (hi - lo))
}

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

/** Kirim pesan teks via proxy /api/gowa/send */
export async function sendMessage(
  settings: GowaSettings,
  phone: string,
  message: string
): Promise<SendResult> {
  const id = targetId(phone)

  if (!settings.gowaUrl) {
    return { phone: id, success: false, message: 'Gowa URL belum diatur di Settings' }
  }

  try {
    const res = await fetch('/api/gowa/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gowaUrl: settings.gowaUrl,
        deviceId: settings.deviceId,
        basicAuth: settings.basicAuth,
        phone: toWaJid(phone),
        message,
      }),
    })

    const data = await res.json().catch(() => ({}))
    return { phone: id, success: data.success ?? false, message: data.message }
  } catch (err) {
    return { phone: id, success: false, message: String(err) }
  }
}

/** Kirim media (image/video/file) via proxy /api/gowa/send-media, caption = message */
export async function sendMedia(
  settings: GowaSettings,
  phone: string,
  caption: string,
  file: File
): Promise<SendResult> {
  const id = targetId(phone)

  if (!settings.gowaUrl) {
    return { phone: id, success: false, message: 'Gowa URL belum diatur di Settings' }
  }

  try {
    const fd = new FormData()
    fd.append('gowaUrl', settings.gowaUrl)
    fd.append('deviceId', settings.deviceId)
    fd.append('basicAuth', settings.basicAuth)
    fd.append('type', detectMediaType(file))
    fd.append('phone', toWaJid(phone))
    fd.append('caption', caption)
    fd.append('file', file, file.name)

    const res = await fetch('/api/gowa/send-media', { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    return { phone: id, success: data.success ?? false, message: data.message }
  } catch (err) {
    return { phone: id, success: false, message: String(err) }
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function jidToString(j: any): string {
  if (!j) return ''
  if (typeof j === 'string') return j
  if (j.User && j.Server) return `${j.User}@${j.Server}`
  return ''
}

/** Parsing defensif — toleran terhadap berbagai bentuk respons gowa */
function parseGroups(results: any): GroupInfo[] {
  const arr: any[] = Array.isArray(results)
    ? results
    : Array.isArray(results?.data)
      ? results.data
      : Array.isArray(results?.Data)
        ? results.Data
        : Array.isArray(results?.groups)
          ? results.groups
          : []

  return arr
    .map((g: any): GroupInfo => {
      const jid =
        jidToString(g.JID ?? g.jid ?? g.id ?? g.Id ?? g.GroupJID ?? g.group_jid) || ''
      const name =
        g.name ?? g.Name ?? g.subject ?? g.Subject ?? g.GroupName?.Name ?? g.groupName ?? ''
      const participants = g.Participants ?? g.participants
      const size = Array.isArray(participants)
        ? participants.length
        : Number(g.size ?? g.Size ?? g.participant_count ?? 0) || 0
      return { jid, name: String(name) || '(tanpa nama)', size }
    })
    .filter(g => g.jid.endsWith('@g.us'))
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchGroups(
  settings: GowaSettings
): Promise<{ ok: boolean; groups: GroupInfo[]; message?: string }> {
  if (!settings.gowaUrl) return { ok: false, groups: [], message: 'Gowa URL belum diatur' }

  try {
    const res = await fetch('/api/gowa/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gowaUrl: settings.gowaUrl,
        deviceId: settings.deviceId,
        basicAuth: settings.basicAuth,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!data.ok) return { ok: false, groups: [], message: data.message }
    return { ok: true, groups: parseGroups(data.results) }
  } catch (err) {
    return { ok: false, groups: [], message: String(err) }
  }
}

export async function testConnection(
  settings: GowaSettings
): Promise<{ ok: boolean; message: string }> {
  if (!settings.gowaUrl) return { ok: false, message: 'Gowa URL kosong' }

  try {
    const res = await fetch('/api/gowa/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gowaUrl: settings.gowaUrl,
        deviceId: settings.deviceId,
        basicAuth: settings.basicAuth,
      }),
    })

    return await res.json()
  } catch (err) {
    return { ok: false, message: String(err) }
  }
}
