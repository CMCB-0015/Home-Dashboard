import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, CloudSun, Moon, X } from 'lucide-react'
import { RoborockSection } from './RoborockSection'
import { useHome } from '../../lib/useHome'
import { SCREENSAVER_PREVIEW_EVENT } from '../IdleOverlay'
import { SystemInfo } from './SystemInfo'

// Panel's Settings menu (1.27.0): slides out from the right, opened by the gear
// in the page header. Everything here is saved on the Lenovo the moment it
// changes (POST /api/settings), so no rebuild or app restart is needed.
// Each section is an expandable header; new sections stack below Screensaver.

const WAITS = [1, 2, 5, 10, 15]

export function SettingsMenu({ onClose }: { onClose: () => void }) {
  const [systemOpen, setSystemOpen] = useState(false)

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') (systemOpen ? setSystemOpen(false) : onClose()) }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose, systemOpen])

  return createPortal(
    <>
      <div className="sheet-backdrop fixed inset-0 z-40 bg-[rgba(4,6,9,0.55)]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal aria-label="Settings"
        className="settings-in fixed inset-y-0 right-0 z-40 flex w-[min(480px,100vw)] flex-col border-l border-edge bg-[#12181e] shadow-[-16px_0_40px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between px-6 pb-4 pt-6">
          <h2 className="font-display text-[22px] font-semibold">Settings</h2>
          <button onClick={onClose} aria-label="Close settings"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1b232b] text-ink hover:bg-[#232c35]">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-6 pb-4">
          <ScreensaverSection />
          <WeatherSection />
          <RoborockSection />
        </div>

        <div className="border-t border-[#222b34] px-6 pb-4 pt-3">
          <button onClick={() => setSystemOpen(true)}
            className="flex min-h-12 w-full items-center justify-between rounded-xl px-1 text-[13px] text-ink-dim hover:text-ink">
            <span>Panel <span className="font-mono text-ink">{__PANEL_VERSION__}</span> · saved on the Lenovo</span>
            <span className="flex items-center gap-1.5">System info <ChevronRight size={16} /></span>
          </button>
        </div>
      </div>
      {systemOpen && <SystemInfo onClose={() => setSystemOpen(false)} />}
    </>,
    document.body,
  )
}

/** An expandable section: icon, title, one-line summary, chevron */
export function Section({ icon, title, summary, open, onToggle, children }:
  { icon: ReactNode; title: string; summary: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="shrink-0 overflow-hidden rounded-[14px] border border-[#222b34] bg-surface">
      <button onClick={onToggle} aria-expanded={open}
        className="flex min-h-16 w-full items-center gap-3.5 px-4 py-3 text-left">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-[#1b232b] text-[#a7b4c2]">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-medium">{title}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-dim">{summary}</span>
        </span>
        <ChevronDown size={18} className="flex-none text-ink-dim transition-transform duration-200" style={{ transform: `rotate(${open ? 180 : 0}deg)` }} />
      </button>
      {open && <div className="flex flex-col gap-3.5 border-t border-[#222b34] px-4 pb-4 pt-3.5">{children}</div>}
    </div>
  )
}

function ScreensaverSection() {
  const { data, update, send } = useHome()
  const cfg = data?.idle
  const [open, setOpen] = useState(true)
  // What was just changed here wins over the live data until it's saved, so a
  // live update arriving mid-drag can't snap a slider back
  const [local, setLocal] = useState<{ on?: boolean; minutes?: number; text?: number; chips?: number }>({})
  const master = cfg?.master ?? true
  const on = local.on ?? cfg?.on ?? cfg?.enabled ?? true
  const minutes = local.minutes ?? cfg?.minutes ?? 2
  const text = local.text ?? cfg?.brightness ?? 32
  const chips = local.chips ?? cfg?.chips ?? 40

  // Change the screen right away; save after the finger settles (sliders send many values)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<Record<string, unknown>>({})
  const change = useCallback((patch: { on?: boolean; minutes?: number; text?: number; chips?: number }, delay = 0) => {
    setLocal((l) => ({ ...l, ...patch }))
    update((s) => {
      const i = s.idle ?? { enabled: true, minutes: 2, brightness: 32 }
      const nextOn = patch.on ?? i.on ?? i.enabled
      return { ...s, idle: { ...i, on: nextOn, enabled: nextOn && (i.master ?? true),
        minutes: patch.minutes ?? i.minutes, brightness: patch.text ?? i.brightness, chips: patch.chips ?? i.chips ?? 40 } }
    })
    pending.current = { ...pending.current, ...patch }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const screensaver = pending.current
      pending.current = {}
      void send('settings', { screensaver }).then(() => {
        // Saved (or put back): the live data is right again, unless more changed meanwhile
        if (!Object.keys(pending.current).length) setTimeout(() => { if (!Object.keys(pending.current).length) setLocal({}) }, 1500)
      })
    }, delay)
  }, [update, send])
  useEffect(() => () => { // closing the menu mid-drag still saves
    if (timer.current && Object.keys(pending.current).length) {
      clearTimeout(timer.current)
      void send('settings', { screensaver: pending.current })
    }
  }, [send])

  const summary = !master ? 'Off in the app’s Configuration (idle_dim)'
    : on ? `On · after ${minutes} min · text ${text}% · chips ${chips}%` : 'Off'
  const t = text / 100, c = chips / 100
  const ink = (a: number) => `rgba(232, 237, 242, ${a})`

  return (
    <Section icon={<Moon size={18} strokeWidth={1.7} />} title="Screensaver" summary={summary} open={open} onToggle={() => setOpen(!open)}>
      {/* live preview */}
      <div className="relative flex h-[178px] flex-col items-center justify-center gap-1.5 rounded-xl border border-[#1b232b] bg-[#020304]"
        style={{ opacity: on && master ? 1 : 0.35 }}>
        <span className="font-display text-[52px] font-medium leading-none tracking-[-0.02em]" style={{ color: ink(t) }}>{previewTime()}</span>
        <span className="text-[11px]" style={{ color: ink(t * 0.8) }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        {chips > 0 && (
          <span className="mt-1.5 flex gap-1.5">
            <PreviewChip dot={`rgba(242, 193, 78, ${c})`} border={`rgba(242, 193, 78, ${c * 0.6})`} color={ink(c * 0.8)}>Clean water tank is empty</PreviewChip>
            <PreviewChip star={`rgba(207, 218, 255, ${c})`} border={`rgba(70, 92, 160, ${c * 0.6})`} color={ink(c * 0.8)}>Falcon 9 · Thu 6:42 PM</PreviewChip>
          </span>
        )}
        <span className="absolute left-[11px] top-[9px] text-[10px] text-ink-faint">Preview</span>
      </div>

      {!master && (
        <p className="rounded-xl bg-[#1b232b] px-3 py-2.5 text-xs text-ink-dim">
          The screensaver is switched off in Home Assistant → Apps → Panel → Configuration (<span className="font-mono">idle_dim</span>). That switch wins; turn it back on there to use these.
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[15px] font-medium">On</div>
          <div className="mt-0.5 text-xs text-ink-dim">Dims Panel when no one’s using it</div>
        </div>
        <button role="switch" aria-checked={on} aria-label="Screensaver on or off" disabled={!master} onClick={() => change({ on: !on })}
          className="flex h-8 w-14 shrink-0 rounded-full p-[3px] transition-colors disabled:opacity-40"
          style={{ background: on ? '#35c2d6' : '#29333d', justifyContent: on ? 'flex-end' : 'flex-start' }}>
          <span className="h-[26px] w-[26px] rounded-full bg-ink" />
        </button>
      </div>

      <div>
        <div className="mb-2 text-[15px] font-medium">Dim after</div>
        <div className="grid grid-cols-5 gap-1.5">
          {WAITS.map((m) => (
            <button key={m} onClick={() => change({ minutes: m })} aria-pressed={minutes === m}
              className="h-11 rounded-[10px] border text-[13px] font-medium text-ink"
              style={{ background: minutes === m ? '#1c3438' : 'transparent', borderColor: minutes === m ? '#35c2d6' : '#29333d' }}>
              {m} min
            </button>
          ))}
        </div>
      </div>

      <Slider label="Clock & text" value={text} min={10} max={60} step={1} onChange={(v) => change({ text: v }, 350)} />
      <div>
        <Slider label="Notification chips" value={chips} min={0} max={100} step={5} onChange={(v) => change({ chips: v }, 350)} />
        <div className="text-xs text-ink-dim">0% hides the chips. Separate from the clock.</div>
      </div>

      <button onClick={() => window.dispatchEvent(new Event(SCREENSAVER_PREVIEW_EVENT))}
        className="h-12 rounded-xl border border-edge bg-[#1b232b] text-sm font-medium text-ink hover:bg-[#232c35]">
        Preview now
      </button>
    </Section>
  )
}

function previewTime() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/, '')
}

function PreviewChip({ children, dot, star, border, color }: { children: ReactNode; dot?: string; star?: string; border: string; color: string }) {
  return (
    <span className="flex h-5 items-center gap-[5px] rounded-full px-[9px] text-[9px]" style={{ border: `1px solid ${border}`, color }}>
      {star ? <span style={{ color: star }}>✦</span> : <span className="h-[5px] w-[5px] rounded-full" style={{ background: dot }} />}
      {children}
    </span>
  )
}

function Slider({ label, value, min, max, step, onChange }:
  { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-[15px] font-medium">
        <span>{label}</span><span className="font-mono text-ink-dim">{value}%</span>
      </div>
      <input type="range" className="panel-range" min={min} max={max} step={step} value={value} aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

const ago = (iso: string | null, now: number) => {
  if (!iso) return null
  const m = Math.round((now - Date.parse(iso)) / 60_000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`
}
const at = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—')

/** Where the forecast comes from (1.27.2): main source, backup, and how each is doing */
function WeatherSection() {
  const { data } = useHome()
  const st = data?.weatherStatus
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t) }, [])
  const using = st?.sources.find((s) => s.name === st.sourceName) ?? null
  const main = st?.sources.find((s) => s.role === 'main') ?? null
  const updated = ago(st?.updatedAt ?? null, now)
  const summary = !st ? 'Waiting for the first forecast' : using ? `${using.name}${using.role === 'backup' ? ' (backup)' : ''} · updated ${updated}` : 'Unavailable · retrying every 10 min'
  const dot = !using ? '#e5484d' : using.role === 'main' ? '#4fd18b' : '#f2c14e'

  return (
    <Section icon={<CloudSun size={18} />} title="Weather" summary={summary} open={open} onToggle={() => setOpen((o) => !o)}>
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: dot }} aria-hidden />
        <div className="min-w-0">
          <div className="text-xs text-ink-dim">Pulling from</div>
          <div className="text-[17px] font-medium">{using ? using.name : 'Nothing right now'}</div>
        </div>
      </div>
      <p className="m-0 text-xs leading-relaxed text-ink-dim">
        {!using
          ? 'Neither source answered. Panel keeps the last forecast for up to 3 hours and tries both again every 10 minutes.'
          : using.role === 'backup'
            ? `${main?.name ?? 'The main source'} isn't answering, so Panel is using the backup. It tries ${main?.name ?? 'the main source'} again every 10 minutes and switches back on its own. The backup has no UV index or air quality, so those chips are hidden for now.`
            : 'The main source is working. If it stops answering, Panel switches to the backup automatically.'}
      </p>
      <div className="flex flex-col divide-y divide-[#222b34] rounded-xl border border-[#222b34]">
        {(st?.sources ?? []).map((s) => (
          <div key={s.name} className="flex flex-col gap-0.5 px-3.5 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{s.name} <span className="text-xs font-normal text-ink-dim">· {s.role}</span></span>
              <span className="text-xs" style={{ color: s.ok === null ? '#8493a1' : s.ok ? '#4fd18b' : '#f2c14e' }}>
                {s.ok === null ? 'Not needed yet' : s.ok ? 'Working' : 'Not answering'}
              </span>
            </div>
            <span className="text-xs text-ink-dim">
              {s.ok === null ? 'Only tried when the main source fails' : s.ok ? `Last loaded ${at(s.lastOk)}` : `Last tried ${at(s.lastTry)}${s.lastOk ? ` · last worked ${at(s.lastOk)}` : ''}`}
            </span>
            {s.ok === false && s.error && <span className="break-words font-mono text-[11px] text-[#a3b0bc]">{s.error}</span>}
          </div>
        ))}
      </div>
      <div className="text-xs text-ink-dim">Location: {data?.weather?.location ?? 'San Clemente'} · refreshes every 10 minutes</div>
    </Section>
  )
}
