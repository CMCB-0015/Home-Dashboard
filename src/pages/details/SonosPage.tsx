import { useMemo, useState } from 'react'
import { Check, Music, Plus, Shuffle, TriangleAlert } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { useThrottle } from '../../lib/useLightActions'
import { DetailLayout } from '../../components/DetailLayout'
import { Art, PINK, Transport, UpNext, useSonos } from '../../components/sonos/SonosParts'
import { PresetList, PresetSheet } from '../../components/sonos/SavedPresets'
import type { SonosPreset, SonosSpeaker } from '../../types'

const TILE_COLORS = ['#e0a1c8', '#f2c14e', '#9fe3ec', '#7fd1b9', '#6fa8ff', '#a7b4c2']

/** Speakers & music: pick speakers, then tap a Sonos Favorite to play it there. */
export function SonosPage() {
  const { data } = useHome()
  const s = useSonos()
  const p = data?.sonos ?? null
  const speakers = p?.speakers ?? []

  // Start with whatever group is playing now
  const [sel, setSel] = useState<string[] | null>(null)
  const initial = useMemo(() => speakers.find((x) => x.id === p?.id)?.group ?? [], [speakers, p?.id])
  const selected = sel ?? initial
  const [shuffle, setShuffle] = useState<boolean | null>(null)
  const shuffleOn = shuffle ?? !!p?.shuffle
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [groupDrag, setGroupDrag] = useState<number | null>(null)
  const groupVol = useThrottle((v: number) => void s.volume(v), 300)
  const [sheet, setSheet] = useState<'new' | SonosPreset | null>(null)

  if (!p) return null

  const toggle = (id: string) => { setMsg(null); setSel(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]) }
  const sameSet = (ids: string[]) => ids.length === selected.length && ids.every((id) => selected.includes(id))
  const target = selected.length ? speakers.filter((x) => selected.includes(x.id)).map((x) => x.name).join(' + ') : 'no speakers yet'
  const playingNow = (favName: string) => !!p.playing && p.from === favName

  const pick = async (id: string) => {
    if (!selected.length) { setMsg('Pick at least one speaker first.'); return }
    setMsg(null); setBusy(id)
    // Keep the speakers in the order shown, so the lead speaker is predictable
    const ordered = speakers.filter((x) => selected.includes(x.id)).map((x) => x.id)
    const ok = await s.play(id, ordered, shuffle === null ? undefined : shuffleOn)
    setBusy(null)
    if (ok) setSel(null)
  }

  const idle = p.title === 'Nothing playing'
  const shownGroupVol = groupDrag ?? p.volumePct

  return (
    <DetailLayout title="Sonos" subtitle="Music comes from your Sonos Favorites (Tidal)" color={PINK}>
      <div className="grid grid-cols-1 gap-4 pb-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* 1. Pick speakers */}
        <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-edge bg-surface p-5">
          <div className="flex items-center gap-2.5">
            <Step n={1} />
            <h2 className="font-display text-lg font-semibold">Pick speakers</h2>
            <button onClick={() => { setSel([]); setMsg(null) }} className="ml-auto h-9 rounded-lg border border-edge px-3 text-xs text-ink-dim hover:text-ink">Clear</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(p.groupChips ?? []).filter((c) => c.speakerIds.length).map((c) => {
              const on = sameSet(c.speakerIds)
              return (
                <button key={c.label} onClick={() => { setSel(c.speakerIds); setMsg(null) }}
                  className="h-10 rounded-full border px-4 text-xs font-medium"
                  style={{ background: on ? 'rgba(224,161,200,0.14)' : 'var(--color-surface-raised)', borderColor: on ? PINK : 'var(--color-edge)' }}>
                  {c.label}
                </button>
              )
            })}
          </div>
          <div className="flex flex-col gap-2">
            {speakers.map((sp) => <SpeakerRow key={sp.id} sp={sp} on={selected.includes(sp.id)} onToggle={() => toggle(sp.id)} />)}
            {!speakers.length && <p className="text-sm text-ink-faint">No Sonos speakers found in Home Assistant.</p>}
          </div>
          <p className="mt-auto border-t border-edge pt-3 text-xs text-ink-faint">Playing to: <span className="font-semibold text-ink">{target}</span></p>
        </section>

        {/* 2. Pick music */}
        <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-edge bg-surface p-5">
          <div className="flex items-center gap-2.5">
            <Step n={2} />
            <h2 className="font-display text-lg font-semibold">Pick music</h2>
            <button onClick={() => setShuffle(!shuffleOn)} aria-pressed={shuffleOn}
              className="ml-auto flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-medium"
              style={{ background: shuffleOn ? 'rgba(224,161,200,0.14)' : 'var(--color-surface-raised)', borderColor: shuffleOn ? PINK : 'var(--color-edge)' }}>
              <Shuffle size={14} /> {shuffleOn ? 'Shuffle on' : 'Shuffle off'}
            </button>
          </div>
          <p className="text-xs text-ink-faint">Tap one to play it on <span className="text-ink">{target}</span>.</p>
          {msg && <p className="rounded-lg border border-edge bg-surface-raised px-3 py-2.5 text-xs">{msg}</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(p.favorites ?? []).map((f, i) => {
              const now = playingNow(f.name)
              return (
                <button key={f.id} onClick={() => void pick(f.id)} disabled={!!busy} aria-pressed={now}
                  className="flex min-h-[120px] flex-col items-start gap-2.5 rounded-xl border p-3.5 text-left transition-colors disabled:opacity-60"
                  style={{ background: now ? 'rgba(224,161,200,0.10)' : 'var(--color-surface-raised)', borderColor: now ? PINK : 'var(--color-edge)' }}>
                  {f.art
                    ? <img src={f.art} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    : <span className="flex h-12 w-12 items-center justify-center rounded-lg text-bg" style={{ background: TILE_COLORS[i % TILE_COLORS.length] }}><Music size={20} /></span>}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{f.name}</span>
                    <span className="block text-[11px] text-ink-faint">{busy === f.id ? 'Starting…' : f.kind}</span>
                  </span>
                  {now && <span className="text-[11px] font-semibold" style={{ color: PINK }}>Playing now</span>}
                </button>
              )
            })}
          </div>
          <button onClick={() => setSheet('new')} disabled={!selected.length || !(p.favorites ?? []).length}
            title={!selected.length ? 'Pick speakers first' : undefined}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-[13px] font-medium transition-colors disabled:opacity-40"
            style={{ borderColor: PINK, color: PINK }}>
            <Plus size={15} /> Save as quick-play button
          </button>
          {!(p.favorites ?? []).length && (
            <p className="flex items-start gap-2 rounded-lg border border-edge bg-surface-raised px-3 py-2.5 text-xs text-ink-dim">
              <TriangleAlert size={14} className="mt-px shrink-0 text-weather" />
              No Sonos Favorites found. In the Sonos app, open a Tidal playlist → ⋯ → Add to Sonos Favorites, and it shows up here.
            </p>
          )}
          {(p.presets ?? []).some((pr) => !pr.available) && (
            <div className="rounded-lg border border-edge bg-surface-raised px-3 py-2.5 text-xs text-ink-dim">
              <p className="mb-1 flex items-center gap-2 font-medium text-ink"><TriangleAlert size={14} className="text-weather" /> Quick play setup check</p>
              {(p.presets ?? []).filter((pr) => !pr.available).map((pr) => <p key={pr.id}>{pr.name}: {pr.reason}</p>)}
            </div>
          )}
        </section>

        {/* 3. Quick-play buttons */}
        <section className="flex flex-col gap-3 rounded-2xl border border-edge bg-surface p-5 lg:col-span-2">
          <div className="flex items-baseline gap-2.5">
            <h2 className="font-display text-lg font-semibold">Quick-play buttons</h2>
            <span className="text-xs text-ink-faint">On the Sonos card · saved ones can be renamed or deleted</span>
          </div>
          <PresetList presets={p.presets ?? []} onRename={(pr) => setSheet(pr)} />
        </section>
      </div>

      {sheet && (
        <PresetSheet favorites={p.favorites ?? []} onClose={() => setSheet(null)}
          mode={sheet === 'new'
            ? {
                kind: 'new', shuffle: shuffleOn,
                speakers: speakers.filter((x) => selected.includes(x.id)),
                // Start with what's playing on these speakers, when it's a Favorite
                favoriteId: (p.favorites ?? []).find((f) => f.name === p.from || f.name === p.title)?.id ?? null,
              }
            : { kind: 'rename', preset: sheet }} />
      )}

      {/* Now-playing bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-edge bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 md:px-8">
          <div className="flex min-w-0 basis-full items-center gap-3 sm:max-w-xs sm:flex-1 sm:basis-auto">
            <Art url={p.artUrl} size={44} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{idle ? 'Nothing playing' : `${p.title}${p.subtitle ? ` · ${p.subtitle}` : ''}`}</p>
              <p className="truncate text-xs text-ink-faint">{idle ? 'Pick speakers, then music' : [p.from, p.room].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <div className="w-full shrink-0 sm:w-60"><Transport p={p} queueOpen={queueOpen} onQueue={() => setQueueOpen(!queueOpen)} /></div>
          <label className="flex min-w-[180px] flex-1 items-center gap-2 text-xs text-ink-faint">
            Group volume
            <input type="range" min={0} max={100} value={shownGroupVol} aria-label="Group volume"
              onChange={(e) => { const v = Number(e.target.value); setGroupDrag(v); groupVol.push(v) }}
              onPointerUp={() => { groupVol.flush(); setTimeout(() => setGroupDrag(null), 800) }}
              className="h-1 min-w-0 flex-1 cursor-pointer" style={{ color: PINK }} />
            <span className="w-6 text-right font-mono text-ink">{shownGroupVol}</span>
          </label>
        </div>
        {queueOpen && (
          <div className="absolute bottom-full right-4 h-[420px] w-[min(400px,calc(100vw-2rem))] md:right-8">
            <UpNext onClose={() => setQueueOpen(false)} className="h-full rounded-2xl border" />
          </div>
        )}
      </div>
    </DetailLayout>
  )
}

function Step({ n }: { n: number }) {
  return <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-bg" style={{ background: PINK }}>{n}</span>
}

function SpeakerRow({ sp, on, onToggle }: { sp: SonosSpeaker; on: boolean; onToggle: () => void }) {
  const s = useSonos()
  const [drag, setDrag] = useState<number | null>(null)
  const send = useThrottle((v: number) => void s.speakerVolume(sp.id, v), 300)
  const shown = drag ?? sp.volumePct
  const status = !sp.available ? 'Not reachable' : sp.state === 'playing' ? (sp.group.length > 1 ? `Playing with ${sp.group.length - 1} more` : 'Playing') : sp.state === 'paused' ? 'Paused' : 'Idle'
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border py-1.5 pl-1.5 pr-3 sm:flex-nowrap"
      style={{ background: on ? 'rgba(224,161,200,0.08)' : 'var(--color-surface-raised)', borderColor: on ? PINK : 'var(--color-edge)', opacity: sp.available ? 1 : 0.55 }}>
      <button onClick={onToggle} aria-pressed={on} disabled={!sp.available} className="flex min-h-[46px] min-w-0 flex-1 items-center gap-3 px-1 text-left">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-bg"
          style={{ background: on ? PINK : 'transparent', borderColor: on ? PINK : 'var(--color-ink-dim)' }}>
          {on && <Check size={13} strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{sp.name}</span>
          <span className="block truncate text-xs text-ink-faint">{[sp.room !== sp.name ? sp.room : null, status].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
      <div className="flex w-full items-center gap-2 pb-1.5 pl-10 sm:w-auto sm:pb-0 sm:pl-0">
        <input type="range" min={0} max={100} value={shown} disabled={!sp.available} aria-label={`${sp.name} volume`}
          onChange={(e) => { const v = Number(e.target.value); setDrag(v); send.push(v) }}
          onPointerUp={() => { send.flush(); setTimeout(() => setDrag(null), 800) }}
          className="h-1 min-w-0 flex-1 cursor-pointer disabled:opacity-40 sm:w-28 sm:flex-none" style={{ color: PINK }} />
        <span className="w-6 text-right font-mono text-xs">{shown}</span>
      </div>
    </div>
  )
}
