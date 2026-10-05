import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { buildMockState } from '../data/mockData'
import type { HomeState } from '../types'

// One shared copy of the home state for every page.
//
// - Loads from the backend (/api/home-state) and refreshes every minute.
// - If the backend isn't running (plain `npm run dev`), it quietly uses demo data.
// - `update` changes the screen immediately; `send` tells the backend to
//   actually do it. Until a service is connected, its backend function just
//   logs the request, so buttons are safe to press.
// - If the backend says the device isn't signed in, `lock` switches and the
//   app shows the passcode screen instead.

export type LockState = 'open' | 'locked' | 'setup'

interface HomeContextValue {
  data: HomeState | null
  live: boolean
  lock: LockState
  unlock: (passcode: string) => Promise<'ok' | 'wrong' | 'setup'>
  update: (fn: (s: HomeState) => HomeState) => void
  send: (path: string, body: unknown) => void
}

const HomeContext = createContext<HomeContextValue | null>(null)
const REFRESH_MS = 60_000

export function HomeProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<HomeState | null>(null)
  const [live, setLive] = useState(false)
  const [lock, setLock] = useState<LockState>('open')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/home-state')
        if (res.status === 401) {
          const body = await res.json().catch(() => ({}))
          if (!cancelled) { setLock(body.setup ? 'setup' : 'locked'); setData(null) }
          return
        }
        if (!res.ok) throw new Error(String(res.status))
        const state = (await res.json()) as HomeState
        if (!cancelled) { setData(state); setLive(true); setLock('open') }
      } catch {
        if (!cancelled) { setData((prev) => prev ?? buildMockState()); setLive(false) }
      }
    }
    void load()
    const timer = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(timer) }
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

  const send = useCallback((path: string, body: unknown) => {
    fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => { if (res.status === 401) setLock('locked') })
      .catch(() => { /* backend not running — fine in demo mode */ })
  }, [])

  return <HomeContext.Provider value={{ data, live, lock, unlock, update, send }}>{children}</HomeContext.Provider>
}

export function useHome(): HomeContextValue {
  const ctx = useContext(HomeContext)
  if (!ctx) throw new Error('useHome must be used inside <HomeProvider>')
  return ctx
}
