import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X } from 'lucide-react'

const CYAN = 'var(--color-irrigation)'
const cyan = (a: number) => `rgba(53, 194, 214, ${a})`

/** Longest quick run per zone, in minutes (Connor: never more than an hour) */
export const MAX_MINUTES = 60
/** Where the wheel starts for a zone with no time of its own */
export const DEFAULT_MINUTES = 10
const SHORTCUTS = [2, 5, 10, 15, 30]
const ROW = 36

// ── Minute wheel ──────────────────────────────────────────────────────────
/**
 * A flick-to-pick column of minutes (1–60). Snaps to a row; tap a number to
 * pick it; arrow keys step. The middle row is the value.
 */
export function MinuteWheel({ value, onChange, rows = 3 }: { value: number; onChange: (m: number) => void; rows?: 3 | 5 }) {
  const ref = useRef<HTMLDivElement>(null)
  const pad = ((rows - 1) / 2) * ROW
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fromScroll = useRef(false)

  // Put the wheel on the value (first show, row switch, shortcut tap)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (fromScroll.current) { fromScroll.current = false; return }
    const top = (value - 1) * ROW
    if (Math.abs(el.scrollTop - top) < 2) return
    if (el.dataset.ready) el.scrollTo({ top, behavior: 'smooth' })
    else { el.scrollTop = top; el.dataset.ready = '1' }
  }, [value])
  useEffect(() => () => { if (settle.current) clearTimeout(settle.current) }, [])

  const onScroll = () => {
    if (settle.current) clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const m = Math.min(MAX_MINUTES, Math.max(1, Math.round(el.scrollTop / ROW) + 1))
      if (m !== value) { fromScroll.current = true; onChange(m) }
    }, 90)
  }

  return (
    <div className="relative select-none" style={{ height: rows * ROW }}>
      {/* Selection band */}
      <div className="pointer-events-none absolute inset-x-3 rounded-[10px] border" style={{ top: pad, height: ROW, background: cyan(0.12), borderColor: cyan(0.35) }} />
      <div ref={ref} onScroll={onScroll} tabIndex={0} role="spinbutton" aria-label="Run time in minutes"
        aria-valuemin={1} aria-valuemax={MAX_MINUTES} aria-valuenow={value} aria-valuetext={`${value} minutes`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(1, value - 1)) }
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); onChange(Math.min(MAX_MINUTES, value + 1)) }
        }}
        className="no-scrollbar relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-irrigation)]"
        style={{ paddingTop: pad, paddingBottom: pad, maskImage: 'linear-gradient(180deg, transparent, #000 30%, #000 70%, transparent)', WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 30%, #000 70%, transparent)' }}>
        {Array.from({ length: MAX_MINUTES }, (_, k) => k + 1).map((m) => (
          <button key={m} type="button" tabIndex={-1} onClick={() => onChange(m)} aria-hidden
            className="flex w-full snap-center items-center justify-center gap-2 font-mono"
            style={{ height: ROW, fontSize: m === value ? 22 : 18, color: m === value ? 'var(--color-ink)' : 'var(--color-ink-faint)' }}>
            {m}{m === value && <span className="font-sans text-xs text-ink-dim">min</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Quick run: zones + times ──────────────────────────────────────────────
export interface PickZone { id: string; name: string }
export interface RunRow { zoneId: string; minutes: number }

/**
 * Pick how long to run one zone, optionally add more zones (each with its own
 * time, run one after another), then Start. Used in the Irrigation page's
 * pop-up and the card's hold panel.
 */
export function QuickRunPicker({ zones, first, onStart, compact = false }: {
  zones: PickZone[]
  first: RunRow
  onStart: (rows: RunRow[]) => void
  compact?: boolean
}) {
  const [rows, setRows] = useState<RunRow[]>([first])
  const [sel, setSel] = useState(0)
  const [adding, setAdding] = useState(false)
  const name = (id: string) => zones.find((z) => z.id === id)?.name ?? 'Zone'
  const left = zones.filter((z) => !rows.some((r) => r.zoneId === z.id))
  const setMin = (m: number) => setRows((rs) => rs.map((r, k) => (k === sel ? { ...r, minutes: m } : r)))
  const total = rows.reduce((n, r) => n + r.minutes, 0)
  const cur = rows[sel] ?? rows[0]
  const multi = rows.length > 1

  return (
    <div className="flex flex-col gap-2.5">
      {/* The run: one row per zone; tap a row to set its time on the wheel */}
      {multi && (
        <ol className="flex flex-col gap-1" aria-label="Zones in this quick run">
          {rows.map((r, k) => (
            <li key={r.zoneId} className="flex items-center gap-1.5">
              <button type="button" onClick={() => setSel(k)} aria-pressed={k === sel}
                className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] border px-3 text-left text-[13px]"
                style={k === sel ? { background: cyan(0.12), borderColor: CYAN } : { background: 'var(--color-surface)', borderColor: 'var(--color-edge)' }}>
                <span className="font-mono text-[11px] text-ink-faint">{k + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{name(r.zoneId)}</span>
                <span className="font-mono text-xs" style={{ color: k === sel ? CYAN : 'var(--color-ink-dim)' }}>{r.minutes}m</span>
              </button>
              <button type="button" aria-label={`Remove ${name(r.zoneId)}`}
                onClick={() => { setRows((rs) => rs.filter((_, j) => j !== k)); setSel((s) => (s >= k ? Math.max(0, s - 1) : s)) }}
                className="flex h-10 w-9 shrink-0 items-center justify-center text-ink-faint hover:text-ink"><X size={16} /></button>
            </li>
          ))}
        </ol>
      )}

      {multi && <p className="-mb-1 text-xs text-ink-dim">Time for <span className="text-ink">{name(cur.zoneId)}</span></p>}
      <MinuteWheel value={cur.minutes} onChange={setMin} rows={compact ? 3 : 5} />
      <div className="grid grid-cols-5 gap-1.5">
        {SHORTCUTS.map((m) => (
          <button key={m} type="button" onClick={() => setMin(m)} aria-pressed={m === cur.minutes}
            className="flex min-h-9 items-center justify-center rounded-[10px] border font-mono text-[12.5px]"
            style={m === cur.minutes ? { background: cyan(0.18), borderColor: CYAN, color: CYAN } : { background: 'var(--color-surface)', borderColor: 'var(--color-edge)', color: 'var(--color-ink-dim)' }}>{m}</button>
        ))}
      </div>

      {/* Add another zone */}
      {adding ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-edge bg-surface p-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium text-ink-dim">Then run…</p>
            <button type="button" onClick={() => setAdding(false)} aria-label="Cancel adding a zone" className="flex h-8 w-9 items-center justify-center text-ink-faint hover:text-ink"><X size={15} /></button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {left.map((z) => (
              <button key={z.id} type="button"
                onClick={() => { setRows((rs) => [...rs, { zoneId: z.id, minutes: DEFAULT_MINUTES }]); setSel(rows.length); setAdding(false) }}
                className="flex min-h-10 items-center rounded-[10px] border border-edge bg-surface-raised px-3 text-[13px] font-medium active:scale-[0.97]">{z.name}</button>
            ))}
          </div>
        </div>
      ) : left.length > 0 && (
        <button type="button" onClick={() => setAdding(true)}
          className="flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-edge text-[13px] font-medium text-ink-dim hover:text-ink">
          <Plus size={15} />Add another zone
        </button>
      )}

      <button type="button" onClick={() => onStart(rows)} className="min-h-12 rounded-xl text-sm font-semibold text-bg active:scale-[0.98]" style={{ background: CYAN }}>
        {multi ? `Start ${rows.length} zones · ${total} min` : `Start ${compact ? '' : `${name(cur.zoneId)} `}· ${cur.minutes} min`}
      </button>
    </div>
  )
}

/** Pop-up from the bottom of the screen, over a dimmed page (tap outside, X or Escape closes) */
export function QuickRunSheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  // On top of everything (the card has its own stacking), so render at the page root
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55" />
      <div role="dialog" aria-label={`Quick run · ${title}`}
        className="sheet-up relative flex max-h-[92vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-2xl border-t border-edge bg-surface-raised px-5 pb-5 pt-3 shadow-[0_-12px_24px_rgba(0,0,0,0.35)]">
        <div className="h-1 w-9 shrink-0 self-center rounded-full bg-edge" />
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Quick run</p>
            <p className="truncate font-display text-lg font-semibold">{title}</p>
            {subtitle && <p className="text-xs text-ink-dim">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-2 flex h-10 w-11 shrink-0 items-center justify-center text-ink-dim hover:text-ink"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  , document.body)
}
