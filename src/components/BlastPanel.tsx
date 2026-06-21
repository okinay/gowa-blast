'use client'

import Link from 'next/link'
import type { GowaSettings } from '@/hooks/useSettings'
import type { useBlaster } from '@/hooks/useBlaster'
import { Timer, Moon, Stop, Send, CheckCircle, XCircle, Loader, Alert, X } from '@/components/icons'

interface Props {
  blaster: ReturnType<typeof useBlaster>
  settings: GowaSettings
  canBlast: boolean
  onBlast: () => void
  count: number
  noun: string
}

export default function BlastPanel({ blaster, settings, canBlast, onBlast, count, noun }: Props) {
  const { isBlasting, logs, currentIndex, total, waitInfo, deviceAlert, setDeviceAlert } = blaster
  const delayLo = Math.min(settings.minDelaySec, settings.maxDelaySec)
  const delayHi = Math.max(settings.minDelaySec, settings.maxDelaySec)

  return (
    <>
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

      {/* Kontrol */}
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
              <button onClick={blaster.stop} className="btn-danger-soft px-4 py-2.5">
                <Stop width={16} height={16} /> Stop
              </button>
            )}
            <button onClick={onBlast} disabled={!canBlast} className="btn-primary">
              {isBlasting ? (
                <>
                  <Loader width={16} height={16} />
                  {currentIndex + 1}/{total} mengirim…
                </>
              ) : (
                <>
                  <Send width={16} height={16} />
                  Blast ke {count} {noun}
                </>
              )}
            </button>
          </div>
        </div>

        {(isBlasting || logs.length > 0) && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span className="tabular-nums">
                {logs.length}/{total} diproses
                {waitInfo && <span className="ml-2 text-amber-600 font-medium">· {waitInfo}</span>}
              </span>
              <span className="flex gap-3 tabular-nums">
                <span className="text-emerald-600 inline-flex items-center gap-1">
                  <CheckCircle width={13} height={13} /> {blaster.successCount}
                </span>
                {blaster.failCount > 0 && (
                  <span className="text-red-500 inline-flex items-center gap-1">
                    <XCircle width={13} height={13} /> {blaster.failCount}
                  </span>
                )}
              </span>
            </div>
            <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${blaster.progress}%`, background: 'linear-gradient(90deg,#25d366,#178a48)' }}
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
            <button onClick={blaster.clearLogs} className="text-xs text-zinc-400 hover:text-zinc-600">
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
                <span className="font-medium truncate max-w-[45%]">{log.label}</span>
                {log.message && (
                  <span className="text-xs opacity-60 ml-auto truncate max-w-[50%]">{log.message}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
