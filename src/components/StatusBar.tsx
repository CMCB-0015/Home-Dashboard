import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { Link } from 'react-router-dom'
import { useHome } from '../lib/useHome'
import { categories } from '../lib/categories'
import { statusItems, type StatusItem } from '../lib/statusItems'
import { HOME } from '../config/home'

const AMBER = 'var(--color-weather)'
const DOT: Record<StatusItem['kind'], string> = { alert: AMBER, calendar: 'var(--color-calendar)', sports: 'var(--color-ink)' }

// Device pages that exist; other alert categories open the full alert list
const PAGES = new Set(['climate', 'lights', 'cameras', 'vacuum', 'irrigation', 'vehicles', 'sonos'])

/** Re-check the time every minute, so finished events drop off on their own */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}

/**
 * The status bar (Option B, swipeable chips) under the header on the Home
 * page: device alerts, Family calendar items and games from The Brief. Slides
 * sideways when there are more chips than fit. Replaces the old activity strip.
 */
export function StatusBar({ onOpenPlanner }: { onOpenPlanner: () => void }) {
  const { data } = useHome()
  const now = useNow()
  const items = useMemo(() => (data ? statusItems(data, now) : []), [data, now])
  if (!data) return null

  return (
    <div className="status-bar -mx-5 flex scroll-px-5 gap-2 overflow-x-auto px-5 pb-1 md:-mx-8 md:scroll-px-8 md:px-8" role="list" aria-label="Today and upcoming">
      {items.map((it) => <Chip key={it.id} item={it} onOpenPlanner={onOpenPlanner} />)}
      {!items.length && (
        <span role="listitem" className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-edge bg-surface px-4 text-xs text-ink-faint">
          Nothing else on today
        </span>
      )}
    </div>
  )
}

function Chip({ item, onOpenPlanner }: { item: StatusItem; onOpenPlanner: () => void }) {
  const alert = item.kind === 'alert'
  const cls = 'flex h-10 max-w-[80vw] shrink-0 snap-start items-center gap-2 rounded-full border bg-surface px-4 text-xs transition-colors hover:bg-surface-raised'
  const style: React.CSSProperties = { borderColor: alert ? AMBER : 'var(--color-edge)' }
  const body = (
    <>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DOT[item.kind], boxShadow: alert ? `0 0 6px ${AMBER}` : undefined }} />
      {item.label && <span className="shrink-0 font-semibold text-ink">{item.label}</span>}
      <span className="truncate font-medium text-ink">{item.text}</span>
      {item.detail && <span className="shrink-0 text-ink-faint">{item.detail}</span>}
    </>
  )

  if (item.kind === 'calendar') {
    return <button role="listitem" onClick={onOpenPlanner} className={cls} style={style}>{body}</button>
  }
  if (item.kind === 'sports') {
    const href = item.href ?? HOME.statusBar.briefUrl
    return href
      ? <a role="listitem" href={href} target="_blank" rel="noreferrer" className={cls} style={style}>{body}</a>
      : <span role="listitem" className={cls} style={style}>{body}</span>
  }
  const to = item.category && PAGES.has(item.category) ? categories[item.category].path : '/alerts'
  return <Link role="listitem" to={to} className={cls} style={style}>{body}</Link>
}
