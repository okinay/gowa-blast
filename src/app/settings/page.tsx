'use client'

import { useState, useEffect } from 'react'
import { useSettings, type GowaSettings } from '@/hooks/useSettings'
import { testConnection } from '@/lib/gowa'
import Link from 'next/link'
import { ArrowLeft, Plug, Loader, CheckCircle, XCircle, Timer, Moon } from '@/components/icons'

export default function SettingsPage() {
  const { settings, saveSettings, loaded } = useSettings()
  const [form, setForm] = useState<GowaSettings>(settings)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

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
