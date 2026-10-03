import { Link } from 'react-router-dom'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { relativeTime } from '../../lib/format'

export function ActivityStrip() {
  const { data } = useHome()
  if (!data) return null
  const recent = [...data.alerts].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 3)
  if (!recent.length) return null
  const [first, ...rest] = recent
  return (
    <Link to="/alerts" className="flex h-11 items-center gap-3 overflow-hidden rounded-xl border border-edge bg-surface px-4 text-xs hover:border-ink-faint">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: categories[first.category].color }} />
      <span className="shrink-0 font-medium text-ink">{first.deviceName} · {first.message}</span>
      <span className="shrink-0 text-ink-faint">{relativeTime(first.timestamp)}</span>
      <span className="hidden min-w-0 flex-1 gap-6 truncate pl-3 text-ink-dim lg:flex">
        {rest.map((a) => <span key={a.id} className="truncate">{a.deviceName} {a.message.toLowerCase()} · {relativeTime(a.timestamp)}</span>)}
      </span>
      <span className="ml-auto shrink-0 text-ink-faint">All alerts →</span>
    </Link>
  )
}
