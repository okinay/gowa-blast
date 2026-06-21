'use client'

import { useState, useMemo, useCallback, useRef, memo } from 'react'
import Link from 'next/link'
import { useSettings } from '@/hooks/useSettings'
import { useBlaster, type BlastJob } from '@/hooks/useBlaster'
import { normalizePhone } from '@/lib/gowa'
import { parseSheetFile, parseSheetText, applyTemplate, TEMPLATE_CSV, type SheetRow } from '@/lib/sheet'
import BlastPanel from '@/components/BlastPanel'
import ModeTabs from '@/components/ModeTabs'
import {
  Upload,
  Clipboard,
  Plus,
  Download,
  Trash,
  X,
  Alert,
  Paperclip,
  FileIcon,
  Loader,
} from '@/components/icons'

interface EditRow extends SheetRow {
  id: string
}

type Field = 'phone' | 'name' | 'message' | 'file'
type RowStatus = 'ready' | 'no-phone' | 'file-missing' | 'empty'

const STATUS_INFO: Record<RowStatus, { dot: string; label: string }> = {
  ready: { dot: 'bg-emerald-400', label: 'Siap dikirim' },
  'no-phone': { dot: 'bg-red-400', label: 'Nomor tidak valid' },
  'file-missing': { dot: 'bg-amber-400', label: 'File disebut tapi belum diupload' },
  empty: { dot: 'bg-zinc-300', label: 'Pesan & file kosong' },
}

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

function emptyRow(): EditRow {
  return { id: uid(), phone: '', name: '', message: '', file: '' }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const cellCls =
  'w-full bg-transparent px-2 py-2 text-sm text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:bg-brand/5 rounded transition-colors disabled:opacity-60'

/* Baris tabel — di-memo agar mengetik di satu baris tidak me-render seluruh tabel. */
const RowEditor = memo(function RowEditor({
  row,
  index,
  status,
  onChange,
  onDelete,
  disabled,
}: {
  row: EditRow
  index: number
  status: RowStatus
  onChange: (id: string, field: Field, value: string) => void
  onDelete: (id: string) => void
  disabled: boolean
}) {
  const info = STATUS_INFO[status]
  return (
    <tr className="border-t border-zinc-100 hover:bg-zinc-50/50">
      <td className="px-2 text-center">
        <span title={info.label} className={`inline-block w-2 h-2 rounded-full ${info.dot}`} />
      </td>
      <td className="px-1 text-xs text-zinc-400 text-center tabular-nums select-none">{index + 1}</td>
      <td className="min-w-[150px]">
        <input
          value={row.phone}
          onChange={e => onChange(row.id, 'phone', e.target.value)}
          disabled={disabled}
          placeholder="628…"
          className={`${cellCls} font-mono`}
        />
      </td>
      <td className="min-w-[120px]">
        <input
          value={row.name}
          onChange={e => onChange(row.id, 'name', e.target.value)}
          disabled={disabled}
          placeholder="Nama"
          className={cellCls}
        />
      </td>
      <td className="min-w-[240px]">
        <input
          value={row.message}
          onChange={e => onChange(row.id, 'message', e.target.value)}
          disabled={disabled}
          placeholder="Pesan… (boleh pakai {nama})"
          className={cellCls}
        />
      </td>
      <td className="min-w-[130px]">
        <input
          value={row.file}
          onChange={e => onChange(row.id, 'file', e.target.value)}
          disabled={disabled}
          placeholder="opsional"
          className={`${cellCls} font-mono`}
        />
      </td>
      <td className="px-1">
        <button
          onClick={() => onDelete(row.id)}
          disabled={disabled}
          className="text-zinc-300 hover:text-red-500 transition-colors disabled:opacity-40 p-1"
          title="Hapus baris"
        >
          <X width={15} height={15} />
        </button>
      </td>
    </tr>
  )
})

export default function PersonalisasiPage() {
  const { settings, loaded } = useSettings()
  const blaster = useBlaster()
  const isBlasting = blaster.isBlasting

  const [rows, setRows] = useState<EditRow[]>([emptyRow(), emptyRow(), emptyRow()])
  const [filePool, setFilePool] = useState<File[]>([])
  const [globalAttachment, setGlobalAttachment] = useState<File | null>(null)
  const [templateText, setTemplateText] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [importError, setImportError] = useState('')

  const sheetInputRef = useRef<HTMLInputElement>(null)
  const poolInputRef = useRef<HTMLInputElement>(null)
  const globalInputRef = useRef<HTMLInputElement>(null)

  const poolByName = useMemo(() => {
    const m = new Map<string, File>()
    for (const f of filePool) m.set(f.name.trim().toLowerCase(), f)
    return m
  }, [filePool])

  const computed = useMemo(
    () =>
      rows.map(row => {
        const normalized = normalizePhone(row.phone)
        const phoneOk = normalized.length >= 9
        let resolvedFile: File | null = null
        let fileMissing = false
        const ref = row.file.trim()
        if (ref) {
          const f = poolByName.get(ref.toLowerCase())
          if (f) resolvedFile = f
          else fileMissing = true
        } else if (globalAttachment) {
          resolvedFile = globalAttachment
        }
        const finalMessage = applyTemplate(row.message, { nama: row.name, nomor: normalized })
        const hasContent = finalMessage.trim().length > 0 || !!resolvedFile
        let status: RowStatus = 'ready'
        if (!phoneOk) status = 'no-phone'
        else if (fileMissing) status = 'file-missing'
        else if (!hasContent) status = 'empty'
        return { row, status, resolvedFile, finalMessage }
      }),
    [rows, poolByName, globalAttachment]
  )

  const readyCount = computed.filter(c => c.status === 'ready').length
  const problemCount = computed.filter(c => c.row.phone.trim() || c.row.name.trim() || c.row.message.trim() || c.row.file.trim()).length - readyCount

  const missingRefs = useMemo(() => {
    const refs = new Set(rows.map(r => r.file.trim().toLowerCase()).filter(Boolean))
    return [...refs].filter(n => !poolByName.has(n))
  }, [rows, poolByName])

  const updateRow = useCallback((id: string, field: Field, value: string) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)))
  }, [])

  const deleteRow = useCallback((id: string) => {
    setRows(prev => prev.filter(r => r.id !== id))
  }, [])

  const addRow = useCallback(() => setRows(prev => [...prev, emptyRow()]), [])

  const handleSheetFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportError('')
    try {
      const parsed = await parseSheetFile(file)
      if (parsed.length === 0) {
        setImportError('Tidak ada data terbaca dari file.')
        return
      }
      setRows(prev => {
        const cleaned = prev.filter(r => r.phone.trim() || r.name.trim() || r.message.trim() || r.file.trim())
        return [...cleaned, ...parsed.map(p => ({ id: uid(), ...p }))]
      })
    } catch (err) {
      setImportError('Gagal membaca file: ' + String(err))
    }
  }, [])

  const handleApplyPaste = useCallback(() => {
    const parsed = parseSheetText(pasteText)
    if (parsed.length === 0) {
      setImportError('Tidak ada data terbaca dari teks yang ditempel.')
      return
    }
    setRows(prev => {
      const cleaned = prev.filter(r => r.phone.trim() || r.name.trim() || r.message.trim() || r.file.trim())
      return [...cleaned, ...parsed.map(p => ({ id: uid(), ...p }))]
    })
    setPasteText('')
    setPasteOpen(false)
    setImportError('')
  }, [pasteText])

  const applyTemplateToAll = useCallback(() => {
    if (!templateText.trim()) return
    setRows(prev => prev.map(r => ({ ...r, message: templateText })))
  }, [templateText])

  const downloadTemplate = useCallback(() => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-gowa-blast.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handlePoolFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setFilePool(prev => {
      const names = new Set(prev.map(f => f.name.toLowerCase()))
      const add = files.filter(f => !names.has(f.name.toLowerCase()))
      return [...prev, ...add]
    })
  }, [])

  const removePoolFile = useCallback((name: string) => {
    setFilePool(prev => prev.filter(f => f.name !== name))
  }, [])

  const handleGlobalAttachment = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) setGlobalAttachment(f)
  }, [])

  const canBlast = loaded && readyCount > 0 && !isBlasting

  const handleBlast = useCallback(() => {
    const jobs: BlastJob[] = computed
      .filter(c => c.status === 'ready')
      .map(c => ({
        target: c.row.phone,
        message: c.finalMessage,
        file: c.resolvedFile,
        label: c.row.name || normalizePhone(c.row.phone),
      }))
    if (jobs.length === 0) return
    blaster.run(jobs)
  }, [computed, blaster])

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-400 gap-2 text-sm">
        <Loader width={16} height={16} /> Memuat settings…
      </div>
    )
  }

  const noSettings = !settings.gowaUrl
  const hasData = rows.some(r => r.phone.trim() || r.name.trim() || r.message.trim() || r.file.trim())

  return (
    <div className="space-y-5">
      <ModeTabs />

      <div>
        <h1 className="text-2xl font-semibold text-ink">Personalisasi</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Kirim pesan & file berbeda per penerima dari tabel — bisa dari Excel/Sheets atau diisi langsung.
        </p>
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

      {/* Toolbar */}
      <section className="surface p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => sheetInputRef.current?.click()} disabled={isBlasting} className="btn-ghost">
            <Upload width={16} height={16} /> Import Excel / CSV
          </button>
          <input
            ref={sheetInputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            className="hidden"
            onChange={handleSheetFile}
          />
          <button onClick={() => setPasteOpen(o => !o)} disabled={isBlasting} className="btn-ghost">
            <Clipboard width={16} height={16} /> Tempel data
          </button>
          <button onClick={addRow} disabled={isBlasting} className="btn-ghost">
            <Plus width={16} height={16} /> Tambah baris
          </button>
          <button onClick={downloadTemplate} className="btn-ghost">
            <Download width={16} height={16} /> Template
          </button>
          {hasData && (
            <button onClick={() => setRows([emptyRow()])} disabled={isBlasting} className="btn-danger-soft ml-auto">
              <Trash width={15} height={15} /> Kosongkan
            </button>
          )}
        </div>

        {pasteOpen && (
          <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3">
            <p className="text-xs text-zinc-500">
              Salin baris dari Excel/Google Sheets lalu tempel di sini (urutan kolom: nomor, nama, pesan, file). Baris
              header otomatis dikenali.
            </p>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={'628123456789\tBudi\tHalo {nama}\tpromo.jpg'}
              className="field h-28 font-mono resize-none text-xs leading-relaxed"
            />
            <div className="flex items-center gap-2">
              <button onClick={handleApplyPaste} disabled={!pasteText.trim()} className="btn-primary px-4 py-2">
                Tambahkan
              </button>
              <button
                onClick={() => {
                  setPasteOpen(false)
                  setPasteText('')
                }}
                className="btn-ghost"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Template ke semua baris */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            value={templateText}
            onChange={e => setTemplateText(e.target.value)}
            disabled={isBlasting}
            placeholder="Pesan template untuk semua baris, mis. Halo {nama}, ada promo untukmu!"
            className="field flex-1"
          />
          <button
            onClick={applyTemplateToAll}
            disabled={isBlasting || !templateText.trim()}
            className="btn-ghost shrink-0"
          >
            Terapkan ke semua
          </button>
        </div>
        <p className="text-xs text-zinc-400">
          Placeholder tersedia: <code className="bg-zinc-100 px-1 py-0.5 rounded">{'{nama}'}</code> &{' '}
          <code className="bg-zinc-100 px-1 py-0.5 rounded">{'{nomor}'}</code> — diganti otomatis per baris saat kirim.
        </p>

        {importError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
            <Alert width={15} height={15} className="shrink-0" /> {importError}
          </div>
        )}
      </section>

      {/* Tabel */}
      <section className="surface p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="eyebrow">Daftar penerima</h2>
          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span className="inline-flex items-center gap-1.5 text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> {readyCount} siap
            </span>
            {problemCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-amber-600">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> {problemCount} bermasalah
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-zinc-50 text-left text-xs text-zinc-500">
                <th className="w-7 px-2 py-2.5" />
                <th className="w-8 px-1 py-2.5 text-center">#</th>
                <th className="px-2 py-2.5 font-medium">Nomor</th>
                <th className="px-2 py-2.5 font-medium">Nama</th>
                <th className="px-2 py-2.5 font-medium">Pesan</th>
                <th className="px-2 py-2.5 font-medium">File</th>
                <th className="w-9 px-1 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {computed.map((c, i) => (
                <RowEditor
                  key={c.row.id}
                  row={c.row}
                  index={i}
                  status={c.status}
                  onChange={updateRow}
                  onDelete={deleteRow}
                  disabled={isBlasting}
                />
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={addRow}
          disabled={isBlasting}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-2.5 text-sm text-zinc-500 hover:border-brand hover:text-brand transition-colors disabled:opacity-60"
        >
          <Plus width={16} height={16} /> Tambah baris
        </button>
      </section>

      {/* File untuk dilampirkan */}
      <section className="surface p-5 space-y-4">
        <div>
          <h2 className="eyebrow">File lampiran</h2>
          <p className="text-xs text-zinc-400 mt-1.5">
            Upload file yang disebut di kolom <strong>File</strong> (dicocokkan berdasarkan nama). Bila kolom File kosong,
            lampiran umum di bawah akan dipakai.
          </p>
        </div>

        {/* Pool file per-baris */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button onClick={() => poolInputRef.current?.click()} disabled={isBlasting} className="btn-ghost">
              <Upload width={16} height={16} /> Upload file (bisa banyak)
            </button>
            <input ref={poolInputRef} type="file" multiple className="hidden" onChange={handlePoolFiles} />
            {filePool.length > 0 && (
              <span className="text-xs text-zinc-400 tabular-nums">{filePool.length} file</span>
            )}
          </div>

          {missingRefs.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
              <Alert width={15} height={15} className="shrink-0 mt-0.5" />
              <span>
                {missingRefs.length} nama file di tabel belum diupload:{' '}
                <span className="font-mono">{missingRefs.slice(0, 5).join(', ')}</span>
                {missingRefs.length > 5 && '…'} — baris itu dilewati sampai filenya diupload.
              </span>
            </div>
          )}

          {filePool.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filePool.map(f => (
                <span
                  key={f.name}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white pl-2.5 pr-1.5 py-1 text-xs"
                >
                  <FileIcon width={13} height={13} className="text-zinc-400" />
                  <span className="font-mono text-zinc-700">{f.name}</span>
                  <span className="text-zinc-400">{formatBytes(f.size)}</span>
                  <button
                    onClick={() => removePoolFile(f.name)}
                    disabled={isBlasting}
                    className="text-zinc-300 hover:text-red-500 disabled:opacity-40"
                  >
                    <X width={13} height={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Lampiran umum (fallback) */}
        <div className="border-t border-zinc-100 pt-4">
          {globalAttachment ? (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500">
                <FileIcon width={18} height={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-400">Lampiran umum (baris tanpa kolom File)</p>
                <p className="text-sm font-medium text-zinc-800 truncate">{globalAttachment.name}</p>
              </div>
              <button onClick={() => setGlobalAttachment(null)} disabled={isBlasting} className="btn-danger-soft px-2.5">
                <X width={16} height={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => globalInputRef.current?.click()}
              disabled={isBlasting}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-3 text-sm text-zinc-500 hover:border-brand hover:text-brand transition-colors disabled:opacity-60"
            >
              <Paperclip width={16} height={16} /> Lampiran umum (opsional, untuk baris tanpa kolom File)
            </button>
          )}
          <input ref={globalInputRef} type="file" className="hidden" onChange={handleGlobalAttachment} />
        </div>
      </section>

      <BlastPanel
        blaster={blaster}
        settings={settings}
        canBlast={canBlast}
        onBlast={handleBlast}
        count={readyCount}
        noun="penerima"
      />
    </div>
  )
}
