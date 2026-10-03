import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface CardProps {
  accent: string
  children: ReactNode
  /** Tapping the body of the card opens this page */
  to?: string
  /** Buttons shown in a row along the bottom */
  actions?: ReactNode
  /** Extra content in the header row, right side (e.g. a toggle) */
  headerRight?: ReactNode
  title?: string
  subtitle?: string
  className?: string
  padded?: boolean
  /** Extra classes for the body (e.g. to make it scroll) */
  bodyClassName?: string
}

export function Card({ accent, children, to, actions, headerRight, title, subtitle, className = '', padded = true, bodyClassName = '' }: CardProps) {
  const header = title ? (
    <div className="flex items-center justify-between gap-3 px-5 pt-4">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <span className="truncate text-[11px] text-ink-faint">{subtitle}</span>}
      </div>
      {headerRight}
    </div>
  ) : null

  const pad = `${padded ? 'px-5 pb-4 pt-3' : ''} ${bodyClassName}`
  const body = to ? (
    <Link to={to} className={`block flex-1 transition-colors hover:bg-surface-raised/30 ${pad}`}>{children}</Link>
  ) : (
    <div className={`min-h-0 flex-1 ${pad}`}>{children}</div>
  )

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-2xl border border-edge bg-surface ${className}`}>
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accent }} aria-hidden />
      {header}
      {body}
      {actions && <div className="flex min-h-[48px] items-center gap-2 border-t border-edge-soft px-5 py-2.5">{actions}</div>}
    </div>
  )
}
