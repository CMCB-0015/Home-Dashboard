import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { Camera as CameraIcon, Loader2, RotateCcw, X } from 'lucide-react'
import { useLiveStream } from './useLiveStream'
import { categories } from '../../lib/categories'
import { Segmented } from '../Buttons'
import { BatteryTag } from '../tiles/CamerasCard'
import type { Camera } from '../../types'
import { IDLE_EVENT } from '../IdleOverlay'

const cfg = categories.cameras

/**
 * Live view pop-up. Same frame as the Twilight / The Brief pop-up: slides up
 * over the dashboard, closes with the X, a swipe down on the top bar, the
 * dimmed edge or Escape. The camera only streams while this is open — closing
 * it ends the stream (battery camera). Switching cameras ends one stream and
 * starts the other. If the screen goes to the background the stream ends and
 * the pop-up closes.
 */
export function CameraSheet({ cameras, startId, onClose }:
  { cameras: Camera[]; startId: string; onClose: () => void }) {
  const [id, setId] = useState(startId)
  const [attempt, setAttempt] = useState(0)
  const { videoRef, phase, error } = useLiveStream(id, attempt)
  // One quiet retry before showing an error (a waking camera sometimes misses the first try)
  const retried = useRef(false)
  useEffect(() => { retried.current = false }, [id])
  const showError = phase === 'error' && retried.current
  useEffect(() => {
    if (phase === 'error' && !retried.current) { retried.current = true; setAttempt((n) => n + 1) }
  }, [phase])
  const [secs, setSecs] = useState(0)
  const [drag, setDrag] = useState(0)
  const startY = useRef<number | null>(null)
  const cam = cameras.find((c) => c.id === id) ?? cameras[0]

  useEffect(() => {
    setSecs(0)
    if (phase !== 'live') return
    const t = setInterval(() => setSecs((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [phase, id, attempt])
  // Battery: leaving the screen (tablet asleep, other app) ends live view
  useEffect(() => {
    const hide = () => { if (document.hidden) onClose() }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener(IDLE_EVENT, onClose) // the idle screensaver came on
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener(IDLE_EVENT, onClose) }
  }, [onClose])
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return
    startY.current = e.clientY
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => { if (startY.current !== null) setDrag(Math.max(0, e.clientY - startY.current)) }
  const up = () => {
    if (startY.current === null) return
    startY.current = null
    if (drag > 90) onClose()
    else setDrag(0)
  }
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`

  return (
    <div className="sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:px-6 md:pt-5" onClick={onClose}>
      <div role="dialog" aria-modal aria-label={`${cam.name} live view`}
        className="sheet-up flex h-full w-full max-w-[1400px] flex-col overflow-hidden border-edge bg-surface shadow-[0_-16px_40px_rgba(0,0,0,0.5)] md:rounded-t-3xl md:border md:border-b-0"
        style={{ transform: drag ? `translateY(${drag}px)` : undefined, transition: drag ? 'none' : 'transform 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}>
        <span className="h-[3px] shrink-0" style={{ background: cfg.color }} aria-hidden />
        <div className="flex shrink-0 cursor-grab touch-none flex-col border-b border-edge" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div className="mt-2 h-1 w-11 self-center rounded-full bg-[#3a4652]" aria-hidden />
          <div className="flex items-center gap-3 py-1.5 pl-5 pr-3">
            <CameraIcon size={16} style={{ color: cfg.color }} aria-hidden />
            <h2 className="font-display text-[17px] font-semibold">{cam.name}</h2>
            {phase === 'live'
              ? <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink"><span className="h-2 w-2 animate-pulse rounded-full bg-[#e2584a]" />Live <span className="font-mono text-ink-dim">{clock}</span></span>
              : <span className="text-[13px] text-ink-dim">{phase === 'connecting' ? 'Waking the camera…' : phase === 'ended' ? 'Live view ended' : 'Not connected'}</span>}
            <span className="ml-auto" />
            <BatteryTag pct={cam.battery} solar={cam.solar} />
            <button onClick={onClose} aria-label="Close live view"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-edge bg-surface-raised text-ink hover:bg-[#252e38]">
              <X size={19} aria-hidden />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black p-3 md:p-5">
          <div className="relative aspect-video max-h-full w-full max-w-full overflow-hidden rounded-xl" style={{ maxWidth: 'calc((100vh - 190px) * 16 / 9)' }}>
            {cam.snapshotUrl && phase !== 'live' && (
              <img src={cam.snapshotUrl} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ filter: 'blur(6px) brightness(.45)' }} />
            )}
            <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full bg-black object-contain"
              style={{ opacity: phase === 'live' ? 1 : 0, transition: 'opacity .3s' }} />
            {(phase === 'connecting' || (phase === 'error' && !showError)) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-ink">
                <Loader2 size={26} className="animate-spin" style={{ color: cfg.color }} aria-hidden />
                <span className="font-medium">Starting live view</span>
                <span className="text-xs text-ink-dim">Battery cameras take a few seconds to wake</span>
              </div>
            )}
            {(showError || phase === 'ended') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-ink">
                <span className="max-w-[46ch]">{error ?? 'Live view ended to save the camera’s battery.'}</span>
                <button onClick={() => { retried.current = false; setAttempt((n) => n + 1) }}
                  className="flex h-10 items-center gap-2 rounded-full border border-edge bg-surface-raised px-4 text-sm font-medium hover:bg-[#252e38]">
                  <RotateCcw size={15} aria-hidden /> {phase === 'ended' ? 'Watch again' : 'Try again'}
                </button>
              </div>
            )}
            {phase === 'live' && (
              <>
                <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-[#e2584a] px-2 py-0.5 text-[11px] font-bold tracking-wider text-white">LIVE</span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-edge px-5 py-3">
          <Segmented label="Camera" value={cam.id} onChange={setId} color={cfg.color} dim={cfg.dim}
            options={cameras.map((c) => ({ value: c.id, label: c.name }))} />
          <span className="ml-auto text-[12px] text-ink-faint">Live video stops when you close this · saves battery</span>
        </div>
      </div>
    </div>
  )
}
