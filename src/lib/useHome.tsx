import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { buildMockState } from '../data/mockData'
import type { HomeState } from '../types'

// One shared copy of the home state for every page.
//
// - Loads from the dashboard server, then keeps a live connection open
//   (/api/stream): whenever anything changes in the house, the new state
//   arrives within a fraction of a second.
// - If the server isn't running (plain `npm run dev`), it uses demo data.
// - `update` changes the screen immediately; `send` tells the server to
//   actually do it. If that fails, a short message says why and the screen
//   goes back to the real state — a button never pretends to work.
// - If the server says the device isn't signed in, `lock` switches and the
//   app shows the passcode screen instead.

export type LockState = 'open' | 'locked' | 'setup'

interface HomeContextValue {
  data: HomeState | null
  /** True when connected to the real server (not demo data) */
  live: boolean
  lock: LockState
  unlock: (passcode: string) => Promise<'ok' | 'wrong' | 'setup'>
  update: (fn: (s: HomeState) => HomeState) => void
  /** Tell the server to do something. Resolves true if it worked. */
  send: (path: string, body: unknown, opts?: { refresh?: boolean; quiet?: boolean }) => Promise<boolean>
  /** A short message about a button press that didn't go through */
  notice: string | null
  clearNotice: () => void
}

const HomeContext = createContext<HomeContextValue | null>(null)
const RETRY_MS = 5_000
const DEMO_RETRY_MS = 60_000

export function HomeProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<HomeState | null>(null)
  const [live, setLive] = useState(false)
  const [lock, setLock] = useState<LockState>('open')
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const liveRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let stream: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    const retry = (ms: number) => { if (!cancelled) timer = setTimeout(load, ms) }

    function openStream() {
      stream = new EventSource('/api/stream')
      stream.onmessage = (ev) => {
        try { if (!cancelled) setData(JSON.parse(ev.data) as HomeState) } catch { /* ignore a bad message */ }
      }
      stream.onerror = () => {
        // Server restarted, Wi-Fi blip, or signed out — check and reconnect
        stream?.close(); stream = null
        retry(RETRY_MS)
      }
    }

    async function load() {
      timer = null
      try {
        const res = await fetch('/api/home-state')
        if (res.status === 401) {
          const body = await res.json().catch(() => ({}))
          if (!cancelled) { setLock(body.setup ? 'setup' : 'locked'); setData(null) }
          return
        }
        if (!res.ok) throw new Error(String(res.status))
        const state = (await res.json()) as HomeState
        if (cancelled) return
        setData(state); setLive(true); liveRef.current = true; setLock('open')
        openStream()
      } catch {
        if (cancelled) return
        if (liveRef.current) { retry(RETRY_MS); return } // server restarting: keep the last real data, try again soon
        setData((prev) => prev ?? buildMockState()); setLive(false)
        retry(DEMO_RETRY_MS)
      }
    }

    // A tablet that slept may have dropped the connection; reconnect when it wakes
    const onVisible = () => { if (document.visibilityState === 'visible' && !stream && !timer) void load() }
    document.addEventListener('visibilitychange', onVisible)
    void load()
    return () => {
      cancelled = true
      stream?.close()
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reloadKey])

  const unlock = useCallback(async (passcode: string) => {
    const res = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode }),
    })
    if (res.ok) { setReloadKey((k) => k + 1); return 'ok' as const }
    const body = await res.json().catch(() => ({}))
    return body.error === 'setup' ? 'setup' as const : 'wrong' as const
  }, [])

  const update = useCallback((fn: (s: HomeState) => HomeState) => {
    setData((prev) => (prev ? fn(prev) : prev))
  }, [])

  /** Put the screen back to the real state after a command didn't work */
  const resync = useCallback(async () => {
    try {
      const res = await fetch('/api/home-state')
      if (res.ok) setData((await res.json()) as HomeState)
    } catch { /* the live connection will catch up */ }
  }, [])

  const send = useCallback(async (path: string, body: unknown, opts?: { refresh?: boolean; quiet?: boolean }) => {
    try {
      const res = await fetch(`/api/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 401) { setLock('locked'); return false }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (!opts?.quiet) setNotice(err.error ?? 'That didn’t go through')
        void resync()
        return false
      }
      return true
    } catch {
      if (!opts?.quiet) {
        setNotice(liveRef.current
          ? 'Couldn’t reach the dashboard server — nothing changed'
          : 'Demo mode — the dashboard isn’t connected, so nothing actually happened')
      }
      return false
    }
  }, [resync])

  const clearNotice = useCallback(() => setNotice(null), [])

  return <HomeContext.Provider value={{ data, live, lock, unlock, update, send, notice, clearNotice }}>{children}</HomeContext.Provider>
}

export function useHome(): HomeContextValue {
  const ctx = useContext(HomeContext)
  if (!ctx) throw new Error('useHome must be used inside <HomeProvider>')
  return ctx
}
