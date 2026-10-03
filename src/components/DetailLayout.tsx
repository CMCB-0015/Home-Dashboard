import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export function DetailLayout({ title, subtitle, color, children, action }:
  { title: string; subtitle?: string; color: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto min-h-full max-w-5xl px-5 py-6 md:px-8">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-dim hover:text-ink">
        <ChevronLeft size={16} /> Home
      </Link>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 h-[3px] w-10 rounded-full" style={{ background: color }} />
          <h1 className="font-display text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-dim">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
