'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { JSONContent } from '@tiptap/react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useSettings } from '@/hooks/useSettings'
import {
  sendMessage,
  sendMedia,
  fetchGroups,
  normalizePhone,
  detectMediaType,
  randomDelayMs,
  sleep,
  type SendResult,
  type MediaType,
  type GroupInfo,
} from '@/lib/gowa'
import { tiptapToWhatsApp } from '@/lib/whatsappMarkdown'
import {
  Phone,
  Users,
  Paperclip,
  Image as ImageIcon,
  Film,
  FileIcon,
  Search,
  Refresh,
  Trash,
  X,
  Stop,
  Send,
  CheckCircle,
  XCircle,
  Loader,
  Alert,
  Timer,
  Moon,
  Upload,
} from '@/components/icons'

const WysiwygEditor = dynamic(() => import('@/components/WysiwygEditor'), {
  ssr: false,
  loading: () => <div className="border border-zinc-300 rounded-xl min-h-[200px] bg-zinc-50 animate-pulse" />,
})

interface LogEntry extends SendResult {
  index: number
}

function parsePhones(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
}

function parseCSV(text: string): string[] {
  const phones: string[] = []
  for (const line of text.split('\n')) {
    const cells = line.split(/[,;\t]/)
    for (const cell of cells) {
      const cleaned = cell.replace(/\D/g, '')
      if (cleaned.length >= 9) {
        phones.push(normalizePhone(cleaned))
        break
      }
    }
  }
  return phones
}

function isDeviceError(msg = ''): boolean {
  const lower = msg.toLowerCase()
  return (
    lower.includes('device') ||
    lower.includes('x-device-id') ||
    lower.includes('device_id') ||
    lower.includes('not found') ||
    lower.includes('disconnected') ||
    lower.includes('logged out') ||
    lower.includes('session') ||
    lower.includes('401')
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const MediaGlyph = ({ type }: { type: MediaType }) => {
  if (type === 'image') return <ImageIcon width={18} height={18} />
  if (type === 'video') return <Film width={18} height={18} />
  return <FileIcon width={18} height={18} />
}

export default function HomePage() {
  const { settings, loaded } = useSettings()
  const [mode, setMode] = useState<'phone' | 'group'>('phone')
  const [phoneText, setPhoneText] = useState('')
  const [messageJson, setMessageJson] = useState<JSONContent | null>(null)
  const [attachment, setAttachment] = useState<File | null>(null)

  // Group picker
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const [groupSearch, setGroupSearch] = useState('')
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupsError, setGroupsError] = useState('')
  const [groupsLoaded, setGroupsLoaded] = useState(false)

  const [isBlasting, setIsBlasting] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [waitInfo, setWaitInfo] = useState('')
  const [deviceAlert, setDeviceAlert] = useState('')

  const abortRef = useRef(false)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)

  const phones = parsePhones(phoneText)
  const message = messageJson ? tiptapToWhatsApp(messageJson) : ''
  const mediaType = attachment ? detectMediaType(attachment) : null

  const targets = mode === 'phone' ? phones : Array.from(selectedGroups)

  const groupNameByJid = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groups) m.set(g.jid, g.name)
    return m
  }, [groups])

  const labelFor = useCallback(
    (target: string) => groupNameByJid.get(target) ?? target,
    [groupNameByJid]
  )

  const canBlast =
    loaded && targets.length > 0 && (message.trim().length > 0 || !!attachment) && !isBlasting

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true)
    setGroupsError('')
    const res = await fetchGroups(settings)
    if (res.ok) {
      setGroups(res.groups)
      setGroupsLoaded(true)
      if (res.groups.length === 0) setGroupsError('Tidak ada group ditemukan di akun ini.')
    } else {
      setGroupsError(res.message ?? 'Gagal memuat group')
    }
    setGroupsLoading(false)
  }, [settings])

  const toggleGroup = useCallback((jid: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev)
      if (next.has(jid)) next.delete(jid)
      else next.add(jid)
      return next
    })
  }, [])

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase()
    if (!q) return groups
    return groups.filter(g => g.name.toLowerCase().includes(q))
  }, [groups, groupSearch])

  const previewUrl = useMemo(() => {
    if (attachment && (mediaType === 'image' || mediaType === 'video')) {
      return URL.createObjectURL(attachment)
    }
    return null
  }, [attachment, mediaType])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleCSV = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length > 0) {
        setPhoneText(prev => {
          const existing = parsePhones(prev)
          return [...new Set([...existing, ...parsed])].join('\n')
        })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  const handleMedia = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setAttachment(file)
    e.target.value = ''
  }, [])

  const waitWithCountdown = useCallback(async (ms: number, label: string) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (abortRef.current) break
      const remain = Math.ceil((end - Date.now()) / 1000)
      setWaitInfo(`${label} ${remain}s`)
      await sleep(Math.min(250, Math.max(0, end - Date.now())))
    }
    setWaitInfo('')
  }, [])

  const handleBlast = useCallback(async () => {
    if (!canBlast) return
    abortRef.current = false
    setIsBlasting(true)
    setLogs([])
    setDeviceAlert('')
    setWaitInfo('')
    setCurrentIndex(0)

    const collected: LogEntry[] = []

    for (let i = 0; i < targets.length; i++) {
      if (abortRef.current) break
      setCurrentIndex(i)

      const result = attachment
        ? await sendMedia(settings, targets[i], message, attachment)
        : await sendMessage(settings, targets[i], message)

      const entry: LogEntry = { ...result, index: i }
      collected.push(entry)
      setLogs([...collected])

      if (!result.success && isDeviceError(result.message)) {
        setDeviceAlert(result.message ?? 'Device terputus dari gowa.')
        abortRef.current = true
        break
      }

      if (i < targets.length - 1 && !abortRef.current) {
        const sent = i + 1
        const needRest = settings.restEvery > 0 && sent % settings.restEvery === 0
        if (needRest) {
          await waitWithCountdown(settings.restCooldownSec * 1000, 'Istirahat')
        } else {
          await waitWithCountdown(randomDelayMs(settings.minDelaySec, settings.maxDelaySec), 'Jeda')
        }
      }
    }

    setIsBlasting(false)
    setCurrentIndex(-1)
    setWaitInfo('')
  }, [canBlast, targets, message, attachment, settings, waitWithCountdown])

  const handleStop = () => {
    abortRef.current = true
  }

  const successCount = logs.filter(l => l.success).length
  const failCount = logs.filter(l => !l.success).length
  const progress = targets.length > 0 ? (logs.length / targets.length) * 100 : 0

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-400 gap-2 text-sm">
        <Loader width={16} height={16} /> Memuat settings…
      </div>
    )
  }

  const noSettings = !settings.gowaUrl
  const delayLo = Math.min(settings.minDelaySec, settings.maxDelaySec)
  const delayHi = Math.max(settings.minDelaySec, settings.maxDelaySec)
  const tabBtn = (active: boolean) =>
    `flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-colors disabled:opacity-60 ${
      active ? 'bg-white shadow-sm font-medium text-ink' : 'text-zinc-500 hover:text-zinc-700'
    }`

  return (
    <div className="space-y-5">
      {/* Page heading */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Kirim Pesan</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Sebar pesan & media ke banyak nomor atau group sekaligus.
          </p>
        </div>
      </div>

      {noSettings && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Alert width={18} height={18} className="shrink-0" />
          <span>
            Koneksi gowa belum diatur.{' '}
            <Link href="/settings" className="font-medium underline underline-offset-2">
              Buka Settings
            </Link>
          </span>
        </div>
      )}

      {deviceAlert && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="flex items-start gap-3">
            <Alert width={18} height={18} className="shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="font-semibold">Pengiriman dihentikan otomatis</p>
              <p className="text-xs opacity-80 break-words">{deviceAlert}</p>
              <p className="text-xs">
                Periksa koneksi device & Basic Auth di{' '}
                <Link href="/settings" className="font-medium underline underline-offset-2">
                  Settings
                </Link>
                .
              </p>
            </div>
            <button onClick={() => setDeviceAlert('')} className="text-red-400 hover:text-red-600">
              <X width={16} height={16} />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Tujuan */}
        <section className="surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex bg-zinc-100 rounded-xl p-1">
              <button onClick={() => setMode('phone')} disabled={isBlasting} className={tabBtn(mode === 'phone')}>
                <Phone width={16} height={16} /> Nomor
              </button>
              <button onClick={() => setMode('group')} disabled={isBlasting} className={tabBtn(mode === 'group')}>
                <Users width={16} height={16} /> Group
              </button>
            </div>
            <span className="text-xs font-medium text-zinc-500 tabular-nums">
              {mode === 'phone' ? `${phones.length} nomor` : `${selectedGroups.size} dipilih`}
            </span>
          </div>

          {/* Tab Nomor */}
          {mode === 'phone' && (
            <>
              <textarea
                value={phoneText}
                onChange={e => setPhoneText(e.target.value)}
                disabled={isBlasting}
                placeholder={'628123456789\n628987654321\n08xxxxxxxx'}
                className="field h-48 font-mono resize-none leading-relaxed disabled:opacity-60"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => csvInputRef.current?.click()} disabled={isBlasting} className="btn-ghost">
                  <Upload width={16} height={16} /> Import CSV
                </button>
                <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} />
                {phones.length > 0 && (
                  <button onClick={() => setPhoneText('')} disabled={isBlasting} className="btn-danger-soft">
                    <Trash width={15} height={15} /> Kosongkan
                  </button>
                )}
                <span className="text-xs text-zinc-400 ml-auto hidden sm:block">Satu nomor per baris</span>
              </div>
            </>
          )}

          {/* Tab Group */}
          {mode === 'group' && (
            <div className="space-y-3">
              {!groupsLoaded && !groupsLoading && (
                <button
                  onClick={loadGroups}
                  disabled={noSettings}
                  className="w-full flex flex-col items-center justify-center gap-2 h-48 rounded-xl border border-dashed border-zinc-300 text-zinc-500 hover:border-brand hover:text-brand transition-colors disabled:opacity-60"
                >
                  <Refresh width={22} height={22} />
                  <span className="text-sm font-medium">Muat daftar group</span>
                  <span className="text-xs text-zinc-400">Ambil group yang kamu ikuti</span>
                </button>
              )}

              {groupsLoading && (
                <div className="flex items-center justify-center h-48 text-zinc-400 text-sm gap-2">
                  <Loader width={16} height={16} /> Memuat group…
                </div>
              )}

              {groupsError && !groupsLoading && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  <Alert width={15} height={15} className="shrink-0" /> {groupsError}
                </div>
              )}

              {groupsLoaded && !groupsLoading && groups.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search width={16} height={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        value={groupSearch}
                        onChange={e => setGroupSearch(e.target.value)}
                        placeholder="Cari group…"
                        className="field pl-9 py-2"
                      />
                    </div>
                    <button onClick={loadGroups} disabled={isBlasting} className="btn-ghost px-2.5" title="Muat ulang">
                      <Refresh width={16} height={16} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs px-1">
                    <button
                      onClick={() => setSelectedGroups(new Set(filteredGroups.map(g => g.jid)))}
                      disabled={isBlasting}
                      className="text-brand hover:text-brand-strong font-medium disabled:opacity-60"
                    >
                      Pilih semua
                    </button>
                    <button
                      onClick={() => setSelectedGroups(new Set())}
                      disabled={isBlasting}
                      className="text-zinc-400 hover:text-zinc-600 disabled:opacity-60"
                    >
                      Bersihkan
                    </button>
                  </div>

                  <div className="h-44 overflow-y-auto rounded-xl border border-zinc-200 divide-y divide-zinc-100">
                    {filteredGroups.map(g => {
                      const checked = selectedGroups.has(g.jid)
                      return (
                        <label
                          key={g.jid}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                            checked ? 'bg-brand/5' : 'hover:bg-zinc-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleGroup(g.jid)}
                            disabled={isBlasting}
                            className="w-4 h-4 accent-brand"
                          />
                          <span className="flex-1 min-w-0 truncate text-zinc-800">{g.name}</span>
                          <span className="text-xs text-zinc-400 whitespace-nowrap tabular-nums">{g.size} anggota</span>
                        </label>
                      )
                    })}
                    {filteredGroups.length === 0 && (
                      <div className="px-3 py-8 text-center text-xs text-zinc-400">Tidak ada group cocok.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {/* Pesan */}
        <section className="surface p-5 space-y-4">
          <h2 className="eyebrow">Isi pesan</h2>

          <WysiwygEditor onChange={setMessageJson} disabled={isBlasting} />

          {message && (
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-400">Pratinjau format WhatsApp</p>
              <pre className="text-xs bg-[#eef7f0] border border-[#cfe9d6] rounded-xl p-3 whitespace-pre-wrap font-mono text-zinc-700 max-h-24 overflow-y-auto">
                {message}
              </pre>
            </div>
          )}

          {attachment ? (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
              {previewUrl && mediaType === 'image' && (
                // eslint-disable-next-line @next/next/no-img-element -- preview blob lokal, bukan untuk LCP
                <img src={previewUrl} alt="preview" className="w-14 h-14 object-cover rounded-lg border border-zinc-200" />
              )}
              {previewUrl && mediaType === 'video' && (
                <video src={previewUrl} className="w-14 h-14 object-cover rounded-lg border border-zinc-200" />
              )}
              {mediaType === 'file' && (
                <div className="w-14 h-14 flex items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500">
                  <FileIcon width={22} height={22} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-800 truncate">{attachment.name}</p>
                <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                  {mediaType && <MediaGlyph type={mediaType} />}
                  <span className="capitalize">{mediaType}</span> · {formatBytes(attachment.size)}
                </p>
              </div>
              <button onClick={() => setAttachment(null)} disabled={isBlasting} className="btn-danger-soft px-2.5">
                <X width={16} height={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => mediaInputRef.current?.click()}
              disabled={isBlasting}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-3.5 text-sm text-zinc-500 hover:border-brand hover:text-brand transition-colors disabled:opacity-60"
            >
              <Paperclip width={16} height={16} /> Lampirkan gambar, video, atau file
            </button>
          )}
          <input ref={mediaInputRef} type="file" className="hidden" onChange={handleMedia} />
          {attachment && <p className="text-xs text-zinc-400">Teks di atas akan dipakai sebagai caption media.</p>}
        </section>
      </div>

      {/* Kontrol Blast */}
      <section className="surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip">
            <Timer width={14} height={14} /> Jeda acak {delayLo}–{delayHi}s
          </span>
          {settings.restEvery > 0 && (
            <span className="chip">
              <Moon width={14} height={14} /> Istirahat {settings.restCooldownSec}s / {settings.restEvery} pesan
            </span>
          )}
          <Link href="/settings" className="text-xs text-brand hover:text-brand-strong font-medium">
            Atur
          </Link>

          <div className="ml-auto flex items-center gap-2.5">
            {isBlasting && (
              <button onClick={handleStop} className="btn-danger-soft px-4 py-2.5">
                <Stop width={16} height={16} /> Stop
              </button>
            )}
            <button onClick={handleBlast} disabled={!canBlast} className="btn-primary">
              {isBlasting ? (
                <>
                  <Loader width={16} height={16} />
                  {currentIndex + 1}/{targets.length} mengirim…
                </>
              ) : (
                <>
                  <Send width={16} height={16} />
                  Blast ke {targets.length} {mode === 'group' ? 'group' : 'nomor'}
                </>
              )}
            </button>
          </div>
        </div>

        {(isBlasting || logs.length > 0) && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span className="tabular-nums">
                {logs.length}/{targets.length} diproses
                {waitInfo && <span className="ml-2 text-amber-600 font-medium">· {waitInfo}</span>}
              </span>
              <span className="flex gap-3 tabular-nums">
                <span className="text-emerald-600 inline-flex items-center gap-1">
                  <CheckCircle width={13} height={13} /> {successCount}
                </span>
                {failCount > 0 && (
                  <span className="text-red-500 inline-flex items-center gap-1">
                    <XCircle width={13} height={13} /> {failCount}
                  </span>
                )}
              </span>
            </div>
            <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#25d366,#178a48)' }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Log */}
      {logs.length > 0 && (
        <section className="surface p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="eyebrow">Log pengiriman</h2>
            <button onClick={() => setLogs([])} className="text-xs text-zinc-400 hover:text-zinc-600">
              Bersihkan
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1 -mx-1 px-1">
            {logs.map(log => (
              <div
                key={log.index}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
                  log.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
                }`}
              >
                {log.success ? (
                  <CheckCircle width={15} height={15} className="shrink-0" />
                ) : (
                  <XCircle width={15} height={15} className="shrink-0" />
                )}
                <span className="font-medium truncate max-w-[45%]">{labelFor(log.phone)}</span>
                {log.message && (
                  <span className="text-xs opacity-60 ml-auto truncate max-w-[50%]">{log.message}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
