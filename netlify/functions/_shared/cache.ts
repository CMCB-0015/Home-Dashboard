// A small cache that survives between backend calls, stored in Netlify Blobs
// (built into every Netlify site — nothing to set up). Used to stay well under
// each service's daily request limit. Falls back to memory if Blobs isn't
// available (e.g. when testing outside Netlify).

import { getStore } from '@netlify/blobs'

const memory = new Map<string, unknown>()

function store() {
  try { return getStore('panel-cache') } catch { return null }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const s = store()
    if (s) return ((await s.get(key, { type: 'json' })) as T | null) ?? null
  } catch { /* fall through */ }
  return (memory.get(key) as T | undefined) ?? null
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  memory.set(key, value)
  try { await store()?.setJSON(key, value) } catch { /* memory copy is enough */ }
}

export async function cacheDelete(key: string): Promise<void> {
  memory.delete(key)
  try { await store()?.delete(key) } catch { /* ignore */ }
}

/** Return the cached value if it's younger than maxAgeMs; otherwise load fresh and cache it. */
export async function cached<T>(key: string, maxAgeMs: number, load: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<{ at: number; value: T }>(key)
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.value
  const value = await load()
  await cacheSet(key, { at: Date.now(), value })
  return value
}
