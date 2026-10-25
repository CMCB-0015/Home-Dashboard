import { useEffect, useState, type ReactNode } from 'react'
import { Play } from 'lucide-react'
import type { QuickRun } from '../types'

// One tap and it happens — the dashboard is built to be fast. A short flash
// confirms the tap went through.
export function ConfirmButton({ label, detail, icon, disabled, title, onConfirm, color, dim }: {
  label: string; detail?: string; icon?: ReactNode; disabled?: boolean; title?: string
  onConfirm: () => void; color: string; dim: string
}) {
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(false), 600)
    return () => clearTimeout(t)
  }, [flash])

  return (
    <button
      disabled={disabled}
      onClick={() => { setFlash(true); onConfirm() }}
      title={title}
      aria-label={`${label}${detail ? `, ${detail}` : ''}`}
      className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-medium transition-colors duration-150 active:scale-[0.98] disabled:opacity-40"
      style={flash ? { background: color, color: 'var(--color-bg)' } : { background: dim, color }}
    >
      <span className="shrink-0">{icon ?? <Play size={12} fill="currentColor" />}</span>
      <span className="flex-1 truncate">{label}</span>
      {detail && <span className="shrink-0 font-mono text-[11px] opacity-80">{detail}</span>}
    </button>
  )
}

export function QuickRunButton({ run, onStart, color, dim }: { run: QuickRun; onStart: () => void; color: string; dim: string }) {
  return (
    <ConfirmButton label={run.label} detail={run.detail} disabled={!run.available}
      title={run.available ? undefined : run.reason} onConfirm={onStart} color={color} dim={dim} />
  )
}
