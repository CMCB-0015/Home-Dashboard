import { useEffect, useState } from 'react'
import { ListMusic, Music, Pause, Play, Shuffle, SkipBack, SkipForward, X } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import type { QueueItem, SonosState } from '../../types'

export const PINK = 'var(--color-sonos)'
export const PINK_DIM = 'var(--color-sonos-dim)'

/** Sonos commands, with the screen updated right away. */
export function useSonos() {
  const { update, send } = useHome()
  const patch = (fn: (s: SonosState) => SonosState) => update((st) => (st.sonos ? { ...st, sonos: fn(st.sonos) } : st))
  return {
    togglePlay: (p: SonosState) => { patch((s) => ({ ...s, playing: !s.playing })); return send('sonos/command', { command: p.playing ? 'pause' : 'play' }) },
    next: () => send('sonos/command', { command: 'next' }),
    previous: () => send('sonos/command', { command: 'previous' }),
    shuffle: (on: boolean) => { patch((s) => ({ ...s, shuffle: on })); return send('sonos/command', { command: 'shuffle', value: on }) },
    volume: (v: number) => { patch((s) => ({ ...s, volumePct: v })); return send('sonos/command', { command: 'volume', value: v }, { quiet: false }) },
    speakerVolume: (id: string, v: number) => {
      patch((s) => ({ ...s, speakers: s.speakers?.map((x) => (x.id === id ? { ...x, volumePct: v } : x)) }))
      return send('sonos/command', { command: 'speaker-volume', speakerId: id, value: v })
    },
    preset: (id: string) => send('sonos/preset', { id }),
    play: (favoriteId: string, speakerIds: string[], shuffle?: boolean) => send('sonos/play', { favoriteId, speakerIds, shuffle }),
  }
}

/** Shuffle · previous · play/pause · next · up next */
export function Transport({ p, onQueue, queueOpen, size = 'md', color = '#e0a1c8' }: { p: SonosState; onQueue: () => void; queueOpen: boolean; size?: 'sm' | 'md'; color?: string }) {
  const s = useSonos()
  const small = size === 'sm' ? 34 : 44
  const big = size === 'sm' ? 44 : 52
  const round = (active: boolean) => ({
    width: small, height: small,
    background: active ? `color-mix(in srgb, ${color} 16%, transparent)` : 'var(--color-surface-raised)',
    borderColor: active ? color : 'var(--color-edge)',
    color: active ? color : 'var(--color-ink-dim)',
  })
  const plain = { width: small, height: small, background: 'var(--color-surface-raised)', borderColor: 'var(--color-edge)', color: 'var(--color-ink)' }
  const btn = 'flex shrink-0 items-center justify-center rounded-full border transition-colors'
  const icon = size === 'sm' ? 15 : 17
  return (
    <div className="flex w-full items-center justify-between gap-1">
      <button className={btn} style={round(!!p.shuffle)} aria-pressed={!!p.shuffle} aria-label="Shuffle" onClick={() => void s.shuffle(!p.shuffle)}><Shuffle size={icon} /></button>
      <button className={btn} style={plain} aria-label="Previous track" onClick={() => void s.previous()}><SkipBack size={icon} /></button>
      <button className={btn + ' border-0'} style={{ width: big, height: big, background: color, color: 'var(--color-bg)', boxShadow: `0 0 18px -4px color-mix(in srgb, ${color} 70%, transparent)` }} aria-label={p.playing ? 'Pause' : 'Play'} onClick={() => void s.togglePlay(p)}>
        {p.playing ? <Pause size={icon + 2} fill="currentColor" /> : <Play size={icon + 2} fill="currentColor" />}
      </button>
      <button className={btn} style={plain} aria-label="Next track" onClick={() => void s.next()}><SkipForward size={icon} /></button>
      <button className={btn} style={round(queueOpen)} aria-pressed={queueOpen} aria-label="Up next" onClick={onQueue}><ListMusic size={icon} /></button>
    </div>
  )
}

/** The queue of what's playing. Tapping a song jumps to it. */
export function UpNext({ onClose, className = '' }: { onClose: () => void; className?: string }) {
  const { send, data } = useHome()
  const [q, setQ] = useState<{ from: string | null; items: QueueItem[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const key = `${data?.sonos?.id}-${data?.sonos?.title}`
  useEffect(() => {
    let cancelled = false
    fetch('/api/sonos/queue')
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error ?? 'Couldn’t read the queue'); return b })
      .then((b) => { if (!cancelled) { setQ(b); setError(null) } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error && !/fetch/i.test(e.message) ? e.message : 'Demo mode — the queue shows when the dashboard is connected') })
    return () => { cancelled = true }
  }, [key])
  const shuffle = data?.sonos?.shuffle
  return (
    <div role="dialog" aria-label="Up next" className={`flex flex-col rounded-t-2xl border-t border-edge bg-surface-raised shadow-[0_-12px_30px_rgba(0,0,0,0.45)] ${className}`}>
      <div className="flex items-center gap-2 px-4 pb-1 pt-3">
        <span className="shrink-0 whitespace-nowrap font-display text-[15px] font-semibold">Up next</span>
        <span className="min-w-0 truncate text-[11px] text-ink-faint">{q?.from ? `From ${q.from}` : ''}{shuffle ? ' · Shuffle on' : ' · In order'}</span>
        <button onClick={onClose} aria-label="Close up next" className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-edge bg-surface text-ink"><X size={15} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {error && <p className="px-1 py-3 text-xs text-ink-faint">{error}</p>}
        {!error && !q && <p className="px-1 py-3 text-xs text-ink-faint">Loading…</p>}
        {q && !q.items.length && <p className="px-1 py-3 text-xs text-ink-faint">The queue is empty.</p>}
        {q?.items.map((t) => (
          <button key={t.position} disabled={t.current}
            onClick={() => { void send('sonos/queue-jump', { position: t.position }); onClose() }}
            className="flex min-h-[46px] w-full items-center gap-3 border-b border-edge px-1 text-left disabled:cursor-default">
            <span className="w-5 shrink-0 font-mono text-[11px] text-ink-faint">{t.current ? '▶' : t.position + 1}</span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium" style={t.current ? { color: PINK } : undefined}>{t.title || 'Untitled'}</span>
              <span className="block truncate text-[11px] text-ink-faint">{t.artist}</span>
            </span>
          </button>
        ))}
        {q && q.items.length > 0 && <p className="px-1 pt-2 text-[11px] text-ink-faint">Tap a song to jump to it</p>}
      </div>
    </div>
  )
}

export function Art({ url, size }: { url: string | null; size: number }) {
  return url
    ? <img src={url} alt="" className="shrink-0 rounded-lg object-cover" style={{ width: size, height: size }} />
    : (
      <div className="flex shrink-0 items-center justify-center rounded-lg border border-edge bg-surface-raised" style={{ width: size, height: size }}>
        <Music size={size * 0.4} style={{ color: PINK }} />
      </div>
    )
}
