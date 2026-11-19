import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { Section } from './SettingsMenu'
import { MODE_LABEL, RunTimes, mins, runName, unusual, useTimingList } from './RunTimes'

// Settings → Roborock (1.28.0): the dock's dust bin, and the run times the
// "Done ~" estimates are learned from.
//
// Auto-empty on/off goes to the robot as its own command (Home Assistant has no
// entity for it), so the switch shows what Panel last set. Empty mode is the
// dock's own Home Assistant select. Empty now = the robot's empty command.

function RobotIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 3v3" />
    </svg>
  )
}

const label = (o: string) => o.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

export function RoborockSection() {
  const { data, send } = useHome()
  const v = data?.vacuum ?? null
  const dust = v?.dust
  const [open, setOpen] = useState(false)
  const [runsOpen, setRunsOpen] = useState(false)
  const [pending, setPending] = useState<{ auto?: boolean; mode?: string }>({})
  const [emptying, setEmptying] = useState(false)
  const { list, error, reload } = useTimingList()

  // The pop-up may have removed runs: refresh the averages when it closes
  useEffect(() => { if (!runsOpen) void reload() }, [runsOpen, reload])

  const auto = pending.auto ?? dust?.autoEmpty ?? true
  const mode = pending.mode ?? dust?.emptyMode ?? null
  const modes = dust?.emptyModeOptions ?? []
  const docked = v?.state === 'docked'

  const setAuto = async (on: boolean) => {
    setPending((p) => ({ ...p, auto: on }))
    await send('vacuum/command', { action: 'auto-empty', on })
    setPending((p) => ({ ...p, auto: undefined }))
  }
  const setMode = async (m: string) => {
    setPending((p) => ({ ...p, mode: m }))
    await send('vacuum/command', { action: 'empty-mode', mode: m })
    setTimeout(() => setPending((p) => ({ ...p, mode: undefined })), 2500) // until HA reports the new option
  }
  const emptyNow = async () => {
    setEmptying(true)
    await send('vacuum/command', { action: 'empty-now' })
    setTimeout(() => setEmptying(false), 15_000)
  }

  const runs = list?.runs ?? []
  const summary = !v ? 'Vacuum not in Home Assistant'
    : `Auto-empty ${auto ? 'on' : 'off'}${auto && mode ? ` · ${label(mode)}` : ''} · ${runs.length} run type${runs.length === 1 ? '' : 's'} timed`

  return (
    <Section icon={<RobotIcon />} title="Roborock" summary={summary} open={open} onToggle={() => setOpen((o) => !o)}>
      {/* Dust bin */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[15px] font-medium">Auto-empty dust bin</div>
          <div className="mt-0.5 text-xs text-ink-dim">
            {dust?.autoEmpty == null ? 'Not set from Panel yet (the robot’s default is on)' : 'Shows what Panel last set — the robot can’t report it'}
          </div>
        </div>
        <button role="switch" aria-checked={auto} aria-label="Auto-empty dust bin" disabled={!v} onClick={() => setAuto(!auto)}
          className="flex h-8 w-14 shrink-0 rounded-full p-[3px] transition-colors disabled:opacity-40"
          style={{ background: auto ? '#35c2d6' : '#29333d', justifyContent: auto ? 'flex-end' : 'flex-start' }}>
          <span className="h-[26px] w-[26px] rounded-full bg-ink" />
        </button>
      </div>

      {modes.length > 0 && (
        <div style={{ opacity: auto ? 1 : 0.4 }}>
          <div className="mb-1.5 text-[13px] text-ink-dim">Empty mode</div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}>
            {modes.map((m) => (
              <button key={m} onClick={() => setMode(m)} disabled={!auto} aria-pressed={mode === m}
                className="h-10 rounded-[10px] border text-[13px] font-medium text-ink"
                style={{ background: mode === m ? '#1c3438' : 'transparent', borderColor: mode === m ? '#35c2d6' : '#29333d' }}>
                {label(m)}
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={emptyNow} disabled={!docked || emptying}
        className="h-11 rounded-xl border border-edge bg-[#1b232b] text-sm font-medium text-ink hover:bg-[#232c35] disabled:opacity-45">
        {emptying ? 'Emptying…' : docked ? 'Empty dust bin now' : 'Empty dust bin now · robot must be docked'}
      </button>

      <div className="h-px bg-[#222b34]" />

      {/* Run time averages */}
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-medium">Run times</span>
        <span className="text-xs text-ink-dim">average of the last 5</span>
      </div>
      <div className="flex flex-col">
        {error && <span className="text-xs text-ink-dim">{error}</span>}
        {list && !runs.length && <span className="text-xs text-ink-dim">Nothing learned yet — times appear after a finished run.</span>}
        {runs.map((g) => {
          const xs = g.samples.map((x) => x.s)
          const odd = xs.some((_, i) => unusual(xs, i))
          return (
            <div key={g.mode + g.key} className="flex justify-between gap-3 border-b border-[#1d252d] py-2 text-[13px] last:border-b-0">
              <span className="min-w-0 truncate">{runName('runs', g.mode, g.key)}<span className="text-ink-dim"> · {MODE_LABEL[g.mode]}</span></span>
              <span className="flex-none">
                <span className="font-mono">{mins(g.avg)}</span>
                <span className="text-ink-dim"> · {xs.length} run{xs.length === 1 ? '' : 's'}</span>
                {odd && <span className="text-[#f2c14e]"> · unusual run</span>}
              </span>
            </div>
          )
        })}
      </div>
      <button onClick={() => setRunsOpen(true)}
        className="flex h-12 items-center justify-center gap-2 rounded-xl border border-edge bg-[#1b232b] text-sm font-medium text-ink hover:bg-[#232c35]">
        See and edit run times <ChevronRight size={16} />
      </button>
      {runsOpen && <RunTimes onClose={() => setRunsOpen(false)} />}
    </Section>
  )
}
