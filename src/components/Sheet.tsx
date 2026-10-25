import { useEffect, type ReactNode } from 'react'

/**
 * The bottom sheet used by the Tesla Climate and Charging panels and the
 * vacuum tools: slides up over the dashboard, a Done button closes it, so
 * does tapping outside it or pressing Escape.
 */
export function Sheet({ title, subtitle, onClose, children, wide = true }:
  { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <div className="sheet-backdrop fixed inset-0 z-40 flex items-end justify-center bg-black/55" onClick={onClose}>
      <div role="dialog" aria-modal aria-label={title}
        className={`sheet-up flex max-h-[94vh] w-full flex-col gap-5 overflow-y-auto rounded-t-3xl border border-b-0 border-edge bg-surface-raised px-5 pb-8 pt-3.5 shadow-[0_-16px_40px_rgba(0,0,0,0.5)] md:px-10 ${wide ? 'max-w-4xl' : 'max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}>
        <div className="h-1 w-11 shrink-0 self-center rounded-full bg-[#3a4652]" />
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 className="font-display text-[26px] font-semibold leading-tight">{title}</h2>
            {subtitle && <span className="text-[15px] text-ink-dim">{subtitle}</span>}
          </div>
          <button onClick={onClose} className="ml-auto flex h-11 shrink-0 items-center rounded-full bg-[#252e38] px-5 text-[15px] font-medium text-ink hover:bg-[#2c3640]">Done</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** On/off switch matching the mockups (green when on unless told otherwise) */
export function Switch({ on, onChange, label, color = '#4fd18b', disabled }:
  { on: boolean; onChange: (v: boolean) => void; label: string; color?: string; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className="flex h-8 w-[52px] shrink-0 rounded-full p-1 transition-colors disabled:opacity-40"
      style={{ background: on ? color : '#3a4652', justifyContent: on ? 'flex-end' : 'flex-start' }}>
      <span className="h-6 w-6 rounded-full bg-ink" />
    </button>
  )
}
