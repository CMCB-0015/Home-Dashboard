import type { ReactNode } from 'react'

interface PillProps {
  children: ReactNode
  color: string
  dim: string
  onClick?: () => void
  disabled?: boolean
  label?: string
}

export function Pill({ children, color, dim, onClick, disabled, label }: PillProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-opacity hover:opacity-85 disabled:opacity-40"
      style={{ background: dim, color }}
    >
      {children}
    </button>
  )
}

export function RoundButton({ children, color, dim, onClick, label, size = 32 }: PillProps & { size?: number }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="inline-flex shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-85"
      style={{ background: dim, color, width: size, height: size }}
    >
      {children}
    </button>
  )
}

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  color: string
  dim: string
  label: string
}

export function Segmented<T extends string>({ options, value, onChange, color, dim, label }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full border border-edge bg-surface-raised p-[3px]">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className="h-7 min-w-[64px] rounded-full px-3 text-xs font-semibold transition-colors"
            style={active ? { background: dim, color } : { color: 'var(--color-ink-dim)' }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function StatusPill({ label, color, dim, pulse }: { label: string; color: string; dim: string; pulse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: dim, color }}>
      <span className="relative flex h-1.5 w-1.5">
        {pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: color }} />}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      </span>
      {label}
    </span>
  )
}
