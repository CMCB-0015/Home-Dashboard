import { useEffect, useState, type ReactNode } from 'react'
import { Play } from 'lucide-react'
import type { QuickRun } from '../types'

// Tap once to arm, tap again within 3 seconds to confirm — so a bump on the
// wall tablet doesn't change the sprinklers.
export function ConfirmButton({ label, detail, icon, disabled, title, onConfirm, color, dim }: {
  label: string; detail?: string; icon?: ReactNode; disabled?: boolean; title?: string
  onConfirm: () => void; color: string; dim: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <button
      disabled={disabled}
      onClick={() => { if (armed) { setArmed(false); onConfirm() } else setArmed(true) }}
      title={title}
      aria-label={armed ? `Confirm: ${label}` : `${label}${detail ? `, ${detail}` : ''}`}
      className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-medium transition-colors disabled:opacity-40"
      style={armed ? { background: color, color: 'var(--color-bg)' } : { background: dim, color }}
    >
      <span className="shrink-0">{icon ?? <Play size={12} fill="currentColor" />}</span>
      {armed ? (
        <span className="flex-1">Tap again to confirm</span>
      ) : (
        <>
          <span className="flex-1 truncate">{label}</span>
          {detail && <span className="shrink-0 font-mono text-[11px] opacity-80">{detail}</span>}
        </>
      )}
    </button>
  )
}

export function QuickRunButton({ run, onStart, color, dim }: { run: QuickRun; onStart: () => void; color: string; dim: string }) {
  return (
    <ConfirmButton label={run.label} detail={run.detail} disabled={!run.available}
      title={run.available ? undefined : run.reason} onConfirm={onStart} color={color} dim={dim} />
  )
}
