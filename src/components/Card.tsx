import type { ReactNode } from 'react'
import type React from 'react'
import { Link } from 'react-router-dom'
import { useHome } from '../lib/useHome'
import type { Category } from '../types'

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
  /** Which service this card shows — adds a small "Demo" tag while testing, and
   *  shows the card as a placeholder when that service isn't connected yet */
  category?: Category
  /** Show as a placeholder regardless of the data source */
  placeholder?: boolean
  /** Extra styles for the outer box (the Lights card tints itself) */
  style?: React.CSSProperties
}

const HA_CATEGORIES: Category[] = ['climate', 'lights', 'sonos', 'calendar']

export function Card({ accent, children, to, actions, headerRight, title, subtitle, className = '', padded = true, bodyClassName = '', category, placeholder, style }: CardProps) {
  const { live, data } = useHome()
  const source = category ? data?.sources?.[category] : undefined
  const off = !!placeholder || (live && source === 'off')
  const demo = !off && !!category && (!live || source !== 'live')
  const offLabel = category && HA_CATEGORIES.includes(category) && data?.homeAssistant === 'connecting'
    ? 'Can\u2019t reach Home Assistant' : 'Not connected yet'
  const header = title ? (
    <div className="flex items-center justify-between gap-3 px-5 pt-4">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <span className="truncate text-[11px] text-ink-faint">{subtitle}</span>}
        {demo && <span className="shrink-0 rounded-full border border-edge px-1.5 py-px text-[9px] font-medium uppercase tracking-wider text-ink-faint" title="Placeholder data — this service isn't connected yet">Demo</span>}
      </div>
      {headerRight && <div className={off ? 'pointer-events-none opacity-30' : ''} aria-hidden={off || undefined}>{headerRight}</div>}
    </div>
  ) : null

  const pad = `${padded ? 'px-5 pb-4 pt-3' : ''} ${bodyClassName}`
  const body = off ? (
    <div className={`relative min-h-0 flex-1 ${pad}`}>
      <div className="pointer-events-none select-none opacity-20 grayscale" aria-hidden>{children}</div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <span className="rounded-full border border-edge bg-surface-raised px-3.5 py-1.5 text-xs font-medium text-ink-dim">{offLabel}</span>
      </div>
    </div>
  ) : to ? (
    <Link to={to} className={`block flex-1 transition-colors hover:bg-surface-raised/30 ${pad}`}>{children}</Link>
  ) : (
    <div className={`min-h-0 flex-1 ${pad}`}>{children}</div>
  )

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-2xl border border-edge bg-surface ${className}`} style={style}>
      <span className="absolute inset-x-0 top-0 z-[1] h-[3px] transition-colors duration-500" style={{ background: off ? 'var(--color-edge)' : accent }} aria-hidden />
      {header}
      {body}
      {actions && (
        <div className={`flex min-h-[48px] items-center gap-2 border-t border-edge-soft px-5 py-2.5 ${off ? 'pointer-events-none opacity-30' : ''}`} aria-hidden={off || undefined}>
          {actions}
        </div>
      )}
    </div>
  )
}
