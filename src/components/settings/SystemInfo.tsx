import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useHome } from '../../lib/useHome'

// The System window, opened from the version in the Settings menu's footer:
// how Panel is put together, plus live values from the Lenovo (GET /api/system,
// refreshed every 5 s while open). Fixed reference lines are just text here.

interface Sys {
  memory: { totalGb: number; usedGb: number }
  disk: { totalGb: number; freeGb: number } | null
  cpuPercent: number
  cores: number
  upSince: string
  panelUpSince: string
  node: string
  haCore: string | null
  haOs: string | null
  haStatus: string
  haConnectedSince: string | null
}

const gb = (n: number) => `${n >= 10 ? Math.round(n) : n.toFixed(1)} GB`

function since(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000))
  const ago = mins < 60 ? `${mins} min` : mins < 48 * 60 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} days`
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · ${ago}`
}

export function SystemInfo({ onClose }: { onClose: () => void }) {
  const { data } = useHome()
  const [sys, setSys] = useState<Sys | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let stop = false
    const load = async () => {
      try {
        const res = await fetch('/api/system')
        if (!res.ok) throw new Error()
        const j = (await res.json()) as Sys
        if (!stop) { setSys(j); setProblem(null) }
      } catch { if (!stop) setProblem('Live values unavailable — the dashboard server isn’t answering') }
    }
    void load()
    const t = setInterval(load, 5_000)
    return () => { stop = true; clearInterval(t) }
  }, [])

  const live = (v: string | null | undefined) => v ?? '—'
  const hardware: [string, string][] = [
    ['Model', 'Lenovo ThinkCentre M720q Tiny (refurb)'],
    ['Processor', `Intel Core i3-8100T · ${sys?.cores ?? 4} cores · 3.1 GHz · 35 W`],
    ['Memory', sys ? `${gb(sys.memory.totalGb)} · ${gb(sys.memory.usedGb)} used` : '16 GB · —'],
    ['Storage', sys?.disk ? `${gb(sys.disk.totalGb)} SSD · ${gb(sys.disk.freeGb)} free` : '512 GB SSD · —'],
    ['Processor load', sys ? `${sys.cpuPercent}%` : '—'],
    ['Up since', since(sys?.upSince)],
    ['Where', 'Closet, wired to the router'],
  ]
  const software: [string, string][] = [
    ['Panel', `${__PANEL_VERSION__} · build ${data?.build ?? '—'}`],
    ['Panel running since', since(sys?.panelUpSince)],
    ['Home Assistant', `Core ${live(sys?.haCore)} · OS ${live(sys?.haOs)}`],
    ['Server', `Node ${sys?.node?.replace(/^v/, '') ?? '22'} (runs in HA)`],
    ['Screens', 'React 19 · Vite · Tailwind'],
    ['Code', 'GitHub CMCB-0015/Home-Dashboard'],
    ['Panel data', 'Kept in /data on the Lenovo'],
    ['Connected to HA', sys ? (sys.haStatus === 'connected' ? since(sys.haConnectedSince) : sys.haStatus.replace('-', ' ')) : '—'],
  ]
  const network: [string, string][] = [
    ['Router', 'Google Nest Wifi (2nd gen) mesh'],
    ['Modem', 'Arris SURFboard'],
    ['Lenovo address', '192.168.86.207 (reserved)'],
    ['Panel', 'http://192.168.86.207:8099'],
    ['Remote access', 'None — home network only'],
  ]
  const safety: [string, string][] = [
    ['Update Panel', 'HA → Apps → Panel → Update'],
    ['Backups', 'HA automatic backups'],
    ['Screensaver off switch', 'idle_dim (HA Configuration)'],
    ['Screensaver baseline', '1.17.0 · branch baseline-pre-idle-dim'],
    ['Setup check', ':8099/api/setup-check'],
  ]

  return (
    <>
      <div className="fixed inset-0 z-50 bg-[rgba(4,6,9,0.7)]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal aria-label="System info"
        className="fixed inset-x-3 inset-y-3 z-50 flex flex-col overflow-hidden rounded-[20px] border border-edge bg-[#12181e] md:inset-x-[60px] md:inset-y-10">
        <div className="flex items-center justify-between border-b border-[#222b34] px-6 py-5">
          <div>
            <h2 className="font-display text-[22px] font-semibold">System</h2>
            <p className="mt-0.5 text-xs text-ink-dim">{problem ?? 'How Panel is put together · live values refresh while open'}</p>
          </div>
          <button onClick={onClose} aria-label="Close system info"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1b232b] text-ink hover:bg-[#232c35]">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-6 pb-6 pt-5">
          <div>
            <Heading>Architecture</Heading>
            <div className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-[1fr_24px_1.25fr_24px_1.6fr] md:gap-0">
              <Box label="Screens">Pixel Slate (wall)<br />Phone<br /><span className="text-ink-dim">Home Wi-Fi only</span></Box>
              <Arrow />
              <Box label="Panel · Home Assistant app" accent>
                Lenovo M720q<br /><span className="font-mono text-xs">192.168.86.207:8099</span><br /><span className="text-ink-dim">Node 22 server + React screens</span>
              </Box>
              <Arrow />
              <div className="flex flex-col gap-2">
                <Box label="Through Home Assistant" tight>Hue · VeSync (landscape outlets) · Sonos · Nest · Eufy (eufy-sdk bridge) · Roborock · Tesla (Teslemetry) · Bring! · Google Calendar (read) · LG / Frame TVs</Box>
                <Box label="Panel talks to directly" tight>Rachio · Google Calendar (add/edit) · Google Maps · Open-Meteo (weather) · National Weather Service (backup weather, radar) · NOAA tides · The Brief · Twilight</Box>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-dim">Local only: nothing on the internet can reach into the house. Panel only calls out.</p>
          </div>

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Table title="Home server" rows={hardware} />
            <Table title="Software" rows={software} />
            <Table title="Network" rows={network} />
            <Table title="Updates & safety net" rows={safety} />
          </div>
        </div>
      </div>
    </>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return <div className="mb-2.5 text-xs uppercase tracking-[0.08em] text-ink-dim">{children}</div>
}

function Arrow() {
  return <div className="hidden items-center justify-center text-ink-faint md:flex">→</div>
}

function Box({ label, children, accent, tight }: { label: string; children: ReactNode; accent?: boolean; tight?: boolean }) {
  return (
    <div className={`rounded-xl border ${tight ? 'px-3.5 py-2.5' : 'px-3.5 py-3'}`}
      style={{ background: accent ? '#16282b' : '#161d24', borderColor: accent ? '#1c3438' : '#222b34' }}>
      <div className="text-[11px]" style={{ color: accent ? '#9fe3ec' : 'var(--color-ink-dim)' }}>{label}</div>
      <div className={`${tight ? 'mt-1 leading-normal' : 'mt-1.5 leading-relaxed'} text-[13px]`}>{children}</div>
    </div>
  )
}

function Table({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-[14px] border border-[#222b34] bg-surface px-4 py-3.5">
      <Heading>{title}</Heading>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-[#1d252d] py-[7px] text-[13px] last:border-b-0">
          <span className="text-ink-dim">{k}</span><span className="text-right">{v}</span>
        </div>
      ))}
    </div>
  )
}
