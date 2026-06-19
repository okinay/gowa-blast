'use client'

import { useState, useEffect } from 'react'
import { useSettings, type GowaSettings } from '@/hooks/useSettings'
import { testConnection } from '@/lib/gowa'
import { fetchModels } from '@/lib/ai'
import Link from 'next/link'
import { ArrowLeft, Plug, Loader, CheckCircle, XCircle, Timer, Moon, Refresh, Sparkles } from '@/components/icons'

export default function SettingsPage() {
  const { settings, saveSettings, loaded } = useSettings()
  const [form, setForm] = useState<GowaSettings>(settings)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  // AI models
  const [models, setModels] = useState<string[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (loaded) setForm(settings)
  }, [loaded, settings])

  function update<K extends keyof GowaSettings>(key: K, value: GowaSettings[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setSaved(false)
    if (key === 'gowaUrl' || key === 'deviceId' || key === 'basicAuth') setTestResult(null)
  }

  function handleSave() {
    const clean: GowaSettings = {
      ...form,
      minDelaySec: Math.max(1, Math.min(form.minDelaySec, form.maxDelaySec)),
      maxDelaySec: Math.max(form.minDelaySec, form.maxDelaySec, 1),
      restEvery: Math.max(0, Math.floor(form.restEvery)),
      restCooldownSec: Math.max(0, Math.floor(form.restCooldownSec)),
    }
    saveSettings(clean)
    setForm(clean)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    setTestResult(await testConnection(form))
    setTesting(false)
  }

  async function handleFetchModels() {
    setModelsLoading(true)
    setModelsError('')
    const res = await fetchModels(form.aiBaseUrl, form.aiApiKey)
    if (res.ok) {
      setModels(res.models)
      if (res.models.length === 0) setModelsError('Tidak ada model ditemukan.')
      else if (!res.models.includes(form.aiModel)) update('aiModel', res.models[0])
    } else {
      setModelsError(res.message ?? 'Gagal mengambil model')
    }
    setModelsLoading(false)
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-400 gap-2 text-sm">
        <Loader width={16} height={16} /> Memuat…
      </div>
    )
  }

  const delayLo = Math.min(form.minDelaySec, form.maxDelaySec)
  const delayHi = Math.max(form.minDelaySec, form.maxDelaySec)

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:text-ink hover:bg-zinc-50 transition-colors"
        >
          <ArrowLeft width={17} height={17} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-ink">Settings</h1>
          <p className="text-sm text-zinc-500">Koneksi server & perilaku pengiriman.</p>
        </div>
      </div>

      {/* Koneksi */}
      <section className="surface p-5 space-y-5">
        <h2 className="eyebrow">Koneksi gowa server</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">Gowa URL</label>
          <input
            type="url"
            value={form.gowaUrl}
            onChange={e => update('gowaUrl', e.target.value)}
            placeholder="https://gowa.example.com"
            className="field"
          />
          <p className="text-xs text-zinc-400">Base URL server gowa (tanpa trailing slash).</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">
            Device ID <span className="text-zinc-400 font-normal">· opsional</span>
          </label>
          <input
            type="text"
            value={form.deviceId}
            onChange={e => update('deviceId', e.target.value)}
            placeholder="device-1"
            className="field"
          />
          <p className="text-xs text-zinc-400">
            Dikirim via header <code className="bg-zinc-100 px-1 py-0.5 rounded">X-Device-Id</code>.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">
            Basic Auth <span className="text-zinc-400 font-normal">· opsional</span>
          </label>
          <input
            type="text"
            value={form.basicAuth}
            onChange={e => update('basicAuth', e.target.value)}
            placeholder="user:password"
            className="field font-mono"
          />
          <p className="text-xs text-zinc-400">
            Format <code className="bg-zinc-100 px-1 py-0.5 rounded">user:password</code>. Kosongkan bila tanpa auth.
          </p>
        </div>

        {testResult && (
          <div
            className={`flex items-center gap-2 text-sm px-3.5 py-2.5 rounded-xl border ${
              testResult.ok
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {testResult.ok ? <CheckCircle width={16} height={16} /> : <XCircle width={16} height={16} />}
            {testResult.message}
          </div>
        )}

        <button onClick={handleTest} disabled={testing || !form.gowaUrl} className="btn-ghost">
          {testing ? <Loader width={16} height={16} /> : <Plug width={16} height={16} />} Test koneksi
        </button>
      </section>

      {/* Anti-spam */}
      <section className="surface p-5 space-y-5">
        <div>
          <h2 className="eyebrow">Anti-spam &amp; anti-ban</h2>
          <p className="text-xs text-zinc-400 mt-1.5">
            Jeda antar pesan diacak dalam rentang ini agar pola pengiriman tidak terlihat seperti bot.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Jeda minimum (detik)</label>
            <input
              type="number"
              min={1}
              value={form.minDelaySec}
              onChange={e => update('minDelaySec', Number(e.target.value))}
              className="field"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Jeda maksimum (detik)</label>
            <input
              type="number"
              min={1}
              value={form.maxDelaySec}
              onChange={e => update('maxDelaySec', Number(e.target.value))}
              className="field"
            />
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-zinc-500 -mt-2">
          <Timer width={14} height={14} className="text-zinc-400" />
          Tiap pesan menunggu acak <strong className="text-zinc-700">{delayLo}–{delayHi} detik</strong>.
        </p>

        <div className="border-t border-zinc-100 pt-5 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Istirahat tiap … pesan</label>
            <input
              type="number"
              min={0}
              value={form.restEvery}
              onChange={e => update('restEvery', Number(e.target.value))}
              className="field"
            />
            <p className="text-xs text-zinc-400">0 = nonaktif</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Durasi istirahat (detik)</label>
            <input
              type="number"
              min={0}
              value={form.restCooldownSec}
              onChange={e => update('restCooldownSec', Number(e.target.value))}
              className="field"
            />
          </div>
        </div>
        {form.restEvery > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-zinc-500 -mt-2">
            <Moon width={14} height={14} className="text-zinc-400" />
            Setelah <strong className="text-zinc-700">{form.restEvery}</strong> pesan, jeda lebih lama{' '}
            <strong className="text-zinc-700">{form.restCooldownSec} detik</strong>.
          </p>
        )}
      </section>

      {/* AI */}
      <section className="surface p-5 space-y-5">
        <div>
          <h2 className="eyebrow flex items-center gap-1.5">
            <Sparkles width={13} height={13} className="text-brand" /> Bantuan AI
          </h2>
          <p className="text-xs text-zinc-400 mt-1.5">
            Endpoint OpenAI-compatible untuk membantu menulis pesan dari draft-mu.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">Base URL</label>
          <input
            type="url"
            value={form.aiBaseUrl}
            onChange={e => {
              update('aiBaseUrl', e.target.value)
              setModels([])
              setModelsError('')
            }}
            placeholder="https://api.openai.com/v1"
            className="field"
          />
          <p className="text-xs text-zinc-400">Termasuk path versi, mis. diakhiri dengan /v1.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">
            API Key <span className="text-zinc-400 font-normal">· opsional</span>
          </label>
          <input
            type="password"
            value={form.aiApiKey}
            onChange={e => {
              update('aiApiKey', e.target.value)
              setModels([])
              setModelsError('')
            }}
            placeholder="sk-…"
            className="field font-mono"
            autoComplete="off"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">Model</label>
          <div className="flex items-center gap-2">
            <select
              value={form.aiModel}
              onChange={e => update('aiModel', e.target.value)}
              disabled={models.length === 0}
              className="field appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {models.length === 0 ? (
                <option value="">{form.aiModel || 'Ambil model dulu'}</option>
              ) : (
                models.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={handleFetchModels}
              disabled={modelsLoading || !form.aiBaseUrl}
              className="btn-ghost shrink-0"
            >
              {modelsLoading ? <Loader width={16} height={16} /> : <Refresh width={16} height={16} />}
              Ambil model
            </button>
          </div>
          {modelsError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <XCircle width={13} height={13} /> {modelsError}
            </p>
          )}
          {models.length > 0 && !modelsError && (
            <p className="text-xs text-zinc-400">{models.length} model tersedia.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">Persona / gaya penulisan</label>
          <textarea
            value={form.aiPersona}
            onChange={e => update('aiPersona', e.target.value)}
            placeholder="Contoh: Admin toko yang ramah dan santai, suka pakai sapaan 'Kak', sedikit emoji, tetap sopan."
            className="field h-24 resize-none leading-relaxed"
          />
          <p className="text-xs text-zinc-400">
            Dipakai sebagai pedoman gaya saat AI menulis pesan.
          </p>
        </div>
      </section>

      <button onClick={handleSave} className="btn-primary w-full py-3">
        {saved ? (
          <>
            <CheckCircle width={17} height={17} /> Tersimpan
          </>
        ) : (
          'Simpan semua pengaturan'
        )}
      </button>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 text-sm text-zinc-600 space-y-2">
        <p className="font-medium text-zinc-700">Cara setup</p>
        <ol className="list-decimal ml-4 space-y-1 text-xs text-zinc-500 marker:text-zinc-400">
          <li>
            Jalankan <code className="bg-white border border-zinc-200 px-1 py-0.5 rounded">go-whatsapp-web-multidevice</code> & scan QR.
          </li>
          <li>Isi Gowa URL + Basic Auth, lalu klik Test koneksi.</li>
          <li>Atur jeda anti-spam sesuai kebutuhan.</li>
          <li>Simpan, lalu mulai blast dari halaman utama.</li>
        </ol>
      </div>
    </div>
  )
}
