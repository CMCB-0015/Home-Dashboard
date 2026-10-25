// Settings. On the Lenovo they come from the app's Configuration tab in Home
// Assistant (saved by Home Assistant in /data/options.json). In the Codespace
// they come from your .env file.

import { readFileSync, existsSync } from 'node:fs'

const OPTIONS_FILE = '/data/options.json'

// App option name → setting name used in the code
const OPTION_NAMES: Record<string, string> = {
  passcode: 'PANEL_PASSCODE',
  rachio_api_key: 'RACHIO_API_KEY',
  brief_feed_key: 'BRIEF_FEED_KEY',
  weather_lat: 'WEATHER_LAT',
  weather_lon: 'WEATHER_LON',
  weather_location_name: 'WEATHER_LOCATION_NAME',
}

let loaded = false

function load() {
  loaded = true
  if (existsSync(OPTIONS_FILE)) {
    try {
      const opts = JSON.parse(readFileSync(OPTIONS_FILE, 'utf8')) as Record<string, unknown>
      for (const [opt, name] of Object.entries(OPTION_NAMES)) {
        const v = opts[opt]
        if (v !== undefined && v !== null && String(v) !== '') process.env[name] = String(v)
      }
    } catch (e) {
      console.error('[settings] could not read the app options:', e)
    }
  } else if (existsSync('.env')) {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

/** Read a setting; empty counts as not set. */
export function env(name: string): string | undefined {
  if (!loaded) load()
  return process.env[name] || undefined
}

/** Where the dashboard saves its small files (Rachio cache, bedroom-can settings) */
export const DATA_DIR = existsSync('/data') ? '/data' : '.data'
