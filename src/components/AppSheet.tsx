import { useEffect, useRef, useState, type ReactNode } from 'react'
import type React from 'react'
import { ExternalLink, Loader2, X } from 'lucide-react'

/**
 * Another of Connor's apps (Twilight, The Brief) shown in a pop-up over the
 * dashboard, so the tablet never leaves full screen for a browser tab.
 * Close with the X, by swiping the top bar down, by tapping the dimmed edge
 * or with Escape; the Home page is right where it was underneath.
 *
 * The apps allow being shown inside Panel (their Content-Security-Policy
 * frame-ancestors lists http://192.168.86.207:8099). If one ever refuses, the
 * small open-in-browser button is the way out.
 */
export function AppSheet({ url, title, subtitle, icon, background = 'var(--color-bg)', onClose }:
  { url: string; title: string; subtitle?: string; icon?: ReactNode; background?: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const [drag, setDrag] = useState(0)
  const startY = useRef<number | null>(null)

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

  return (
    <div className="sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:px-6 md:pt-5" onClick={onClose}>
      <div role="dialog" aria-modal aria-label={title}
        className="sheet-up flex h-full w-full max-w-[1400px] flex-col overflow-hidden border-edge bg-surface shadow-[0_-16px_40px_rgba(0,0,0,0.5)] md:rounded-t-3xl md:border md:border-b-0"
        style={{ transform: drag ? `translateY(${drag}px)` : undefined, transition: drag ? 'none' : 'transform 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 cursor-grab touch-none flex-col border-b border-edge" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div className="h-1 w-11 self-center rounded-full bg-[#3a4652] mt-2" aria-hidden />
          <div className="flex items-center gap-3 py-1.5 pl-5 pr-3">
            {icon}
            <h2 className="font-display text-[17px] font-semibold">{title}</h2>
            {subtitle && <span className="truncate text-[13px] text-ink-dim">{subtitle}</span>}
            <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${title} in the browser`}
              className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-surface-raised hover:text-ink">
              <ExternalLink size={17} aria-hidden />
            </a>
            <button onClick={onClose} aria-label={`Close ${title}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-edge bg-surface-raised text-ink hover:bg-[#252e38]">
              <X size={19} aria-hidden />
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1" style={{ background }}>
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-ink-dim">
              <Loader2 size={18} className="animate-spin" aria-hidden />Loading {title}…
            </div>
          )}
          <iframe src={url} title={title} onLoad={() => setLoaded(true)}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
            className="absolute inset-0 h-full w-full border-0" style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }} />
        </div>
      </div>
    </div>
  )
}
