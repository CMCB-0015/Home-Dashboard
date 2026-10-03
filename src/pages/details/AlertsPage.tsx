import { useState } from 'react'
import { Info, AlertTriangle, AlertOctagon } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { relativeTime } from '../../lib/format'
import { DetailLayout } from '../../components/DetailLayout'
import { Card } from '../../components/Card'
import type { Category, Severity } from '../../types'

const icon: Record<Severity, { I: typeof Info; color: string }> = {
  info: { I: Info, color: 'var(--color-ink-dim)' },
  warning: { I: AlertTriangle, color: 'var(--color-weather)' },
  critical: { I: AlertOctagon, color: 'var(--color-critical)' },
}

export function AlertsPage() {
  const { data } = useHome()
  const [filter, setFilter] = useState<Category | 'all'>('all')
  if (!data) return null
  const sorted = [...data.alerts].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const shown = filter === 'all' ? sorted : sorted.filter((a) => a.category === filter)
  const used = [...new Set(sorted.map((a) => a.category))]
  return (
    <DetailLayout title="Alerts" subtitle="Everything that happened, in one feed." color="var(--color-ink-faint)">
      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', ...used] as const).map((k) => {
          const active = filter === k
          const c = k === 'all' ? null : categories[k]
          return (
            <button key={k} onClick={() => setFilter(k)} className="rounded-full px-3 py-1.5 text-xs font-medium"
              style={active ? { background: c?.dim ?? 'var(--color-surface-raised)', color: c?.color ?? 'var(--color-ink)' } : { color: 'var(--color-ink-dim)' }}>
              {c?.label ?? 'All'}
            </button>
          )
        })}
      </div>
      <Card accent="var(--color-ink-faint)">
        <div className="divide-y divide-edge-soft">
          {shown.map((a) => {
            const { I, color } = icon[a.severity]
            return (
              <div key={a.id} className="flex items-start gap-3 py-3">
                <I size={16} style={{ color }} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm"><span className="font-medium">{a.deviceName}</span><span className="text-ink-dim"> · {a.message}</span></p>
                  <p className="mt-0.5 text-xs text-ink-faint">{categories[a.category].label} · {relativeTime(a.timestamp)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </DetailLayout>
  )
}
