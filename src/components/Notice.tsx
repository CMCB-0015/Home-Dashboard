import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useHome } from '../lib/useHome'

/** A short message at the bottom of the screen when a button press didn't go through. */
export function Notice() {
  const { notice, clearNotice } = useHome()
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(clearNotice, 6000)
    return () => clearTimeout(t)
  }, [notice, clearNotice])
  if (!notice) return null
  return (
    <div role="status" className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <div className="flex max-w-md items-start gap-3 rounded-xl border border-edge bg-surface-raised px-4 py-3 text-sm text-ink shadow-2xl shadow-black/50">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-critical" />
        <span className="flex-1">{notice}</span>
        <button onClick={clearNotice} aria-label="Dismiss" className="text-ink-faint hover:text-ink"><X size={16} /></button>
      </div>
    </div>
  )
}
