import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Loader2, Play, Shuffle, Volume2 } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { rgba } from '../../lib/lightColor'
import { useArtColor } from '../../lib/artColor'
import { Card } from '../Card'
import { Art, Transport, UpNext, useSonos } from './SonosParts'
import { useThrottle } from '../../lib/useLightActions'
import type { SonosPreset } from '../../types'

/** Sonos pink as a hex value, for the color math (same as --color-sonos) */
export const SONOS_HEX = '#e0a1c8'

/**
 * The Sonos card (Option B, "Quick play expander") with the album glow:
 * like the Lights card, it takes on the color of what's playing — the most
 * vivid color in the album art. Full strength while playing, half when
 * paused, plain when idle.
 */
export function SonosCard() {
  const { data } = useHome()
  const s = useSonos()
  const [expanded, setExpanded] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const vol = useThrottle((v: number) => void s.volume(v), 300)
  const p = data?.sonos ?? null
  const artColor = useArtColor(p?.artUrl ?? null)
  if (!p) return null
  const presets = p.presets ?? []
  const idle = p.title === 'Nothing playing'

  const start = async (pr: SonosPreset) => {
    setStarting(pr.id)
    await s.preset(pr.id)
    setStarting(null)
    setExpanded(false)
  }

  const status = idle ? 'Idle' : p.playing ? `Playing on ${p.room}` : 'Paused'
  const shownVol = drag ?? p.volumePct

  // The glow: same wash as the Lights card, in the album's color
  const c = artColor ?? SONOS_HEX
  const k = idle ? 0 : p.playing ? 1 : 0.5
  const wash = k ? { backgroundImage: `linear-gradient(180deg, ${rgba(c, 0.2 * k)} 0%, ${rgba(c, 0.06 * k)} 45%, transparent 80%)` } : undefined

  return (
    <Card className="h-full" accent={idle ? 'var(--color-sonos)' : c} title="Sonos" category="sonos" subtitle={status}
      style={wash} bodyClassName="relative flex flex-col gap-3">
      {/* Now playing */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="shrink-0 rounded-lg transition-shadow duration-500" style={k ? { boxShadow: `0 0 22px -6px ${rgba(c, 0.85 * k)}` } : undefined}>
          <Art url={p.artUrl} size={56} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{idle ? 'Nothing playing' : p.title}</p>
          {!idle && <p className="truncate text-[11px] text-ink">{p.subtitle}</p>}
          <p className="truncate text-[11px] text-ink-faint">
            {idle ? 'Open Quick play to start music' : [p.from, p.room].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <Transport p={p} size="sm" color={c} queueOpen={queueOpen} onQueue={() => setQueueOpen(!queueOpen)} />

      <label className="flex items-center gap-2">
        <Volume2 size={15} className="shrink-0" style={{ color: k ? c : 'var(--color-ink-faint)' }} />
        <input type="range" min={0} max={100} value={shownVol} aria-label="Volume"
          onChange={(e) => { const v = Number(e.target.value); setDrag(v); vol.push(v) }}
          onPointerUp={() => { vol.flush(); setTimeout(() => setDrag(null), 800) }}
          className="h-1 min-w-0 flex-1 cursor-pointer" style={{ color: c, accentColor: c }} />
        <span className="w-6 text-right font-mono text-[11px]">{shownVol}</span>
      </label>

      {/* Quick play (folded until tapped) */}
      <div className="overflow-hidden rounded-xl border transition-colors"
        style={{ background: k ? rgba(c, 0.07) : 'var(--color-surface-raised)', borderColor: expanded ? c : k ? rgba(c, 0.3) : 'var(--color-edge)' }}>
        <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}
          className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left">
          <Play size={13} fill={c} style={{ color: c }} />
          <span className="text-[13px] font-semibold">Quick play</span>
          <span className="truncate text-[11px] text-ink-faint">{presets.length} saved</span>
          <ChevronDown size={16} className="ml-auto shrink-0 text-ink-faint transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
        </button>
        {expanded && (
          <div className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto border-t border-edge px-2 pb-2 pt-1.5">
            {presets.map((pr) => {
              const active = p.from === pr.name && !idle
              const busy = starting === pr.id
              return (
                <button key={pr.id} onClick={() => void start(pr)} disabled={!pr.available || !!starting}
                  title={pr.available ? undefined : pr.reason} aria-pressed={active}
                  className="flex min-h-[50px] w-full shrink-0 items-center gap-2.5 rounded-lg border px-2 text-left transition-colors disabled:opacity-50"
                  style={{ background: active ? rgba(c, 0.14) : 'var(--color-surface)', borderColor: active ? c : 'var(--color-edge)' }}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: active ? c : 'var(--color-surface-raised)', color: active ? 'var(--color-bg)' : c }}>
                    {busy ? <Loader2 size={14} className="animate-spin" /> : pr.shuffle ? <Shuffle size={14} /> : <Play size={12} fill="currentColor" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{pr.name}</span>
                    <span className="block truncate text-[10px] text-ink-faint">{busy ? 'Starting…' : pr.available ? `${pr.where} · ${pr.volume}` : pr.reason}</span>
                  </span>
                </button>
              )
            })}
            {!presets.length && <p className="px-1 py-2 text-[11px] text-ink-faint">No quick-play buttons yet — save one from Speakers &amp; music</p>}
          </div>
        )}
      </div>

      <Link to="/sonos" className="flex min-h-[40px] items-center justify-between rounded-xl border border-edge bg-surface-raised px-3 text-[13px] font-medium hover:border-ink-faint">
        Speakers &amp; music <ChevronRight size={16} className="text-ink-faint" />
      </Link>

      {queueOpen && <UpNext onClose={() => setQueueOpen(false)} className="absolute inset-x-0 bottom-0 top-[64px] z-10" />}
    </Card>
  )
}
