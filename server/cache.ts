// A small cache that survives restarts, saved as one JSON file on the Lenovo.
// Used to stay well under each service's daily request limit and to remember
// a few settings (like the bedroom cans' last shared color).

import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { DATA_DIR } from './env.ts'

const FILE = join(DATA_DIR, 'panel-cache.json')
let store: Record<string, unknown> | null = null
let saveTimer: NodeJS.Timeout | null = null

function data(): Record<string, unknown> {
  if (store) return store
  try { store = JSON.parse(readFileSync(FILE, 'utf8')) } catch { store = {} }
  return store!
}

function save() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      mkdirSync(DATA_DIR, { recursive: true })
      writeFileSync(FILE + '.tmp', JSON.stringify(store))
      renameSync(FILE + '.tmp', FILE)
    } catch (e) { console.warn('[cache] could not save:', e) }
  }, 500)
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  return (data()[key] as T | undefined) ?? null
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  data()[key] = value
  save()
}

export async function cacheDelete(key: string): Promise<void> {
  delete data()[key]
  save()
}

/** Return the cached value if it's younger than maxAgeMs; otherwise load fresh and cache it. */
export async function cached<T>(key: string, maxAgeMs: number, load: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<{ at: number; value: T }>(key)
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.value
  const value = await load()
  await cacheSet(key, { at: Date.now(), value })
  return value
}
