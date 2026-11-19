import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { HOME } from '../../config/home'
import { runKey } from '../../lib/vacuum'
import { useHome } from '../../lib/useHome'

// Settings → Roborock → Run times (1.28.0): every learned run / room time (the
// last 5 of each), with its date, and a Remove for anomalies. Remove takes it
// out straight away (no confirm); the row stays greyed with an Undo until the
// pop-up closes. Averages here and the card's "Done ~" use what's left.

export type CleanMode = 'vacmop' | 'vac' | 'mop'
export interface TimingGroup { mode: CleanMode; key: string; avg: number; samples: { s: number; at: string | null }[] }
export interface TimingList { runs: TimingGroup[]; rooms: TimingGroup[] }
type Kind = 'runs' | 'rooms'

export const MODE_LABEL: Record<CleanMode, string> = { vacmop: 'vacuum + mop', vac: 'vacuum', mop: 'mop' }

const ROOM_NAME = Object.fromEntries(HOME.vacuum.rooms.map((r) => [r.id, r.name]))
const FULL = runKey(HOME.vacuum.fullOrder, 1)

/** "Kitchen", "Full clean", "Hallway + Guest bedroom · 2 passes" */
export function runName(kind: Kind, mode: CleanMode, key: string): string {
  if (kind === 'rooms') return ROOM_NAME[key] ?? key
  const [rooms, reps] = key.split('×')
  const passes = reps ? ` · ${reps} passes` : ''
  const preset = HOME.vacuum.presets.find((p) => runKey(p.rooms, 1) === rooms && (p.vacuum && p.mop ? 'vacmop' : p.vacuum ? 'vac' : 'mop') === mode)
    ?? HOME.vacuum.presets.find((p) => runKey(p.rooms, 1) === rooms)
  if (preset) return preset.name + passes
  if (rooms === FULL) return 'Full clean' + passes
  return rooms.split('+').map((id) => ROOM_NAME[id] ?? id).join(' + ') + passes
}

const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y), n = a.length
  return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : 0
}
/** More than a third off the median of the others in its group (needs 2+ others) */
export function unusual(xs: number[], i: number): boolean {
  const others = xs.filter((_, j) => j !== i)
  if (others.length < 2) return false
  const m = median(others)
  return Math.abs(xs[i] - m) > m / 3
}

export const mins = (s: number) => `${Math.max(1, Math.round(s / 60))} min`

function when(at: string | null): string {
  if (!at) return 'Earlier'
  const d = new Date(at)
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

/** Learned times from the Lenovo; reload() after a change */
export function useTimingList() {
  const [list, setList] = useState<TimingList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/vacuum/timing')
      if (!res.ok) throw new Error()
      setList(await res.json()); setError(null)
    } catch { setError('Couldn’t load run times from the Lenovo') }
  }, [])
  useEffect(() => { void reload() }, [reload])
  return { list, error, reload }
}

interface Ghost { kind: Kind; mode: CleanMode; key: string; index: number; sample: { s: number; at: string | null } }

export function RunTimes({ onClose }: { onClose: () => void }) {
  const { send } = useHome()
  const { list, error, reload } = useTimingList()
  const [kind, setKind] = useState<Kind>('runs')
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  const remove = async (g: TimingGroup, index: number) => {
    if (busy) return
    setBusy(true)
    const sample = g.samples[index]
    const ok = await send('vacuum/timing', { action: 'remove', kind, cleanMode: g.mode, key: g.key, index, sampleAt: sample.at }, { refresh: false })
    if (ok) setGhosts((gs) => [...gs, { kind, mode: g.mode, key: g.key, index, sample }])
    await reload(); setBusy(false)
  }
  const undo = async (gh: Ghost) => {
    if (busy) return
    setBusy(true)
    const ok = await send('vacuum/timing', { action: 'restore', kind: gh.kind, cleanMode: gh.mode, key: gh.key, index: gh.index, sample: gh.sample }, { refresh: false })
    if (ok) setGhosts((gs) => gs.filter((x) => x !== gh))
    await reload(); setBusy(false)
  }

  // Groups: what's on the Lenovo, plus any group whose last time was just removed
  const groups: TimingGroup[] = [...(list?.[kind] ?? [])]
  for (const gh of ghosts.filter((g) => g.kind === kind)) {
    if (!groups.some((g) => g.mode === gh.mode && g.key === gh.key)) groups.push({ mode: gh.mode, key: gh.key, avg: 0, samples: [] })
  }
  groups.sort((a, b) => runName(kind, a.mode, a.key).localeCompare(runName(kind, b.mode, b.key)) || a.mode.localeCompare(b.mode))

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-[rgba(4,6,9,0.7)]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal aria-label="Run times"
        className="fixed inset-x-3 inset-y-3 z-50 flex flex-col overflow-hidden rounded-[20px] border border-edge bg-[#12181e] md:inset-x-[120px] md:inset-y-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222b34] px-6 py-5">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] font-semibold">Run times</h2>
            <p className="mt-0.5 text-xs text-ink-dim">{error ?? 'Each average is the last 5 finished runs. Remove one and the average and the “Done ~” estimate update.'}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl bg-[#1b232b] p-[3px]" role="tablist" aria-label="Run times">
              {(['runs', 'rooms'] as const).map((k) => (
                <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
                  className="h-[38px] rounded-[9px] px-4 text-[13px] font-medium text-ink" style={{ background: kind === k ? '#29333d' : 'transparent' }}>
                  {k === 'runs' ? 'Whole runs' : 'Rooms'}
                </button>
              ))}
            </div>
            <button onClick={onClose} aria-label="Close run times"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1b232b] text-ink hover:bg-[#232c35]">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 content-start gap-3.5 overflow-y-auto px-6 pb-6 pt-4 md:grid-cols-2">
          {list && !groups.length && <p className="text-sm text-ink-dim">Nothing learned yet. Times appear after the robot finishes a run.</p>}
          {groups.map((g) => {
            const xs = g.samples.map((x) => x.s)
            const gGhosts = ghosts.filter((gh) => gh.kind === kind && gh.mode === g.mode && gh.key === g.key)
            // Rows: the kept times, with removed ones slotted back where they were
            type Row = { sample: { s: number; at: string | null }; index: number; ghost?: Ghost }
            const rows: Row[] = g.samples.map((sample, index) => ({ sample, index }))
            for (const gh of [...gGhosts].sort((a, b) => a.index - b.index)) rows.splice(Math.min(gh.index, rows.length), 0, { sample: gh.sample, index: gh.index, ghost: gh })
            const max = Math.max(1, ...rows.map((r) => r.sample.s))
            return (
              <div key={g.mode + g.key} className="rounded-[14px] border border-[#222b34] bg-surface px-4 pb-2 pt-3">
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-medium">{runName(kind, g.mode, g.key)} <span className="text-xs font-normal text-ink-dim">· {MODE_LABEL[g.mode]}</span></span>
                  <span className="font-mono text-[15px]">{xs.length ? mins(g.avg) : '—'}</span>
                </div>
                {rows.map((r, i) => {
                  const odd = !r.ghost && unusual(xs, r.index)
                  return (
                    <div key={i} className="flex min-h-11 items-center gap-2.5 border-t border-[#1d252d] text-[13px]" style={{ opacity: r.ghost ? 0.55 : 1 }}>
                      <span className="w-[164px] flex-none whitespace-nowrap" style={{ color: r.sample.at ? '#a7b4c2' : '#56636f' }}>{when(r.sample.at)}</span>
                      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#1d252d]">
                        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.round((r.sample.s / max) * 100)}%`, background: r.ghost ? '#29333d' : odd ? '#f2c14e' : '#35c2d6' }} />
                      </span>
                      <span className="w-[54px] text-right font-mono" style={{ textDecoration: r.ghost ? 'line-through' : 'none' }}>{mins(r.sample.s)}</span>
                      <span className="w-[62px] text-[11px] text-[#f2c14e]">{r.ghost ? 'Removed' : odd ? 'Unusual' : ''}</span>
                      {r.ghost
                        ? <button onClick={() => undo(r.ghost!)} disabled={busy} className="h-9 w-[72px] rounded-[10px] border border-edge text-xs font-medium text-[#9fe3ec] disabled:opacity-50">Undo</button>
                        : <button onClick={() => remove(g, r.index)} disabled={busy} aria-label={`Remove the ${mins(r.sample.s)} run from ${when(r.sample.at)}`}
                            className="h-9 w-[72px] rounded-[10px] bg-[#1b232b] text-xs font-medium text-[#a7b4c2] hover:text-ink disabled:opacity-50">Remove</button>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div className="border-t border-[#222b34] px-6 pb-3.5 pt-2.5 text-xs text-ink-dim">
          “Unusual” = more than a third off the others in its group. Runs cut short (Send to dock / Stop) are never counted. Times learned before 1.28.0 have no date and show as “Earlier”.
        </div>
      </div>
    </>,
    document.body,
  )
}
