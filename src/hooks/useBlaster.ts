'use client'

import { useState, useRef, useCallback } from 'react'
import { useSettings } from '@/hooks/useSettings'
import { sendMessage, sendMedia, randomDelayMs, sleep } from '@/lib/gowa'

/** Satu unit pengiriman: 1 target, 1 pesan, opsional 1 file. */
export interface BlastJob {
  target: string // nomor atau JID group
  message: string
  file?: File | null
  label?: string // teks tampilan di log (mis. nama); default = target
}

export interface BlastLogEntry {
  index: number
  label: string
  success: boolean
  message?: string
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

/**
 * Mesin blast bersama: mengelola loop kirim, jeda acak, istirahat berkala,
 * penghentian (stop), deteksi device terputus, log & progress.
 */
export function useBlaster() {
  const { settings } = useSettings()
  const [isBlasting, setIsBlasting] = useState(false)
  const [logs, setLogs] = useState<BlastLogEntry[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [total, setTotal] = useState(0)
  const [waitInfo, setWaitInfo] = useState('')
  const [deviceAlert, setDeviceAlert] = useState('')
  const abortRef = useRef(false)

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

  const run = useCallback(
    async (jobs: BlastJob[]) => {
      if (jobs.length === 0 || abortRef.current) return
      abortRef.current = false
      setIsBlasting(true)
      setLogs([])
      setDeviceAlert('')
      setWaitInfo('')
      setCurrentIndex(0)
      setTotal(jobs.length)

      const collected: BlastLogEntry[] = []

      for (let i = 0; i < jobs.length; i++) {
        if (abortRef.current) break
        setCurrentIndex(i)
        const job = jobs[i]

        const result = job.file
          ? await sendMedia(settings, job.target, job.message, job.file)
          : await sendMessage(settings, job.target, job.message)

        collected.push({
          index: i,
          label: job.label || result.phone,
          success: result.success,
          message: result.message,
        })
        setLogs([...collected])

        if (!result.success && isDeviceError(result.message)) {
          setDeviceAlert(result.message ?? 'Device terputus dari gowa.')
          abortRef.current = true
          break
        }

        if (i < jobs.length - 1 && !abortRef.current) {
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
    },
    [settings, waitWithCountdown]
  )

  const stop = useCallback(() => {
    abortRef.current = true
  }, [])

  const clearLogs = useCallback(() => setLogs([]), [])

  const successCount = logs.filter(l => l.success).length
  const failCount = logs.filter(l => !l.success).length
  const progress = total > 0 ? (logs.length / total) * 100 : 0

  return {
    isBlasting,
    logs,
    currentIndex,
    total,
    waitInfo,
    deviceAlert,
    setDeviceAlert,
    successCount,
    failCount,
    progress,
    run,
    stop,
    clearLogs,
  }
}
