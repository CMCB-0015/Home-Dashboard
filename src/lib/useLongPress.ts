import { useRef } from 'react'

/** Tap does one thing, press-and-hold does another (opens the light panel). */
export function useLongPress(onTap: () => void, onHold: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
  return {
    onPointerDown: () => {
      held.current = false
      clear()
      timer.current = setTimeout(() => { held.current = true; timer.current = null; navigator.vibrate?.(12); onHold() }, ms)
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: () => { if (!held.current) onTap(); held.current = false },
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    // Keyboard: Enter/Space taps; Shift+Enter opens the panel
    onKeyDown: (e: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
      if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); onHold() }
    },
  }
}
