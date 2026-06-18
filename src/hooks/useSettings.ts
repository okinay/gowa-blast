'use client'

import { useState, useEffect } from 'react'

export interface GowaSettings {
  gowaUrl: string
  deviceId: string
  basicAuth: string // format: "user:pass", kosong = tanpa auth
  // Anti-spam / anti-ban — jadi patokan awal, jeda sebenarnya diacak dalam rentang ini
  minDelaySec: number // jeda minimum antar pesan (detik)
  maxDelaySec: number // jeda maksimum antar pesan (detik)
  restEvery: number // setelah sekian pesan, istirahat lebih lama (0 = nonaktif)
  restCooldownSec: number // durasi istirahat (detik)
}

const DEFAULT_SETTINGS: GowaSettings = {
  gowaUrl: '',
  deviceId: '',
  basicAuth: '',
  minDelaySec: 5,
  maxDelaySec: 15,
  restEvery: 20,
  restCooldownSec: 60,
}

export function useSettings() {
  const [settings, setSettings] = useState<GowaSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  // Load sekali saat mount dari localStorage (tak tersedia di server) — pola sinkronisasi
  // dengan sistem eksternal yang sah; gate `loaded` mencegah hydration mismatch.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const stored = localStorage.getItem('gowa-settings')
      if (stored) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) })
    } catch {}
    setLoaded(true)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  function saveSettings(s: GowaSettings) {
    setSettings(s)
    localStorage.setItem('gowa-settings', JSON.stringify(s))
  }

  return { settings, saveSettings, loaded }
}
