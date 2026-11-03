import { useEffect, useState } from 'react'

/** Same test as the "fit" variant in index.css: the tablet layout with no scrolling */
export const FIT_QUERY = '(min-width: 1024px) and (min-height: 680px)'

/**
 * On the fit layout, how wide a picture can be so it fits the height of the
 * element `ref` points at (aspect = width ÷ height). Undefined elsewhere, so
 * phones keep the normal size.
 */
export function useFitWidth<T extends HTMLElement>(aspect: number, pad = 16) {
  // A callback ref, so it still works when the element appears after the first render
  const [el, ref] = useState<T | null>(null)
  const [w, setW] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return
    const mq = window.matchMedia(FIT_QUERY)
    const measure = () => setW(mq.matches ? Math.max(120, (el.clientHeight - pad) * aspect) : undefined)
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    mq.addEventListener('change', measure)
    measure()
    return () => { ro.disconnect(); mq.removeEventListener('change', measure) }
  }, [el, aspect, pad])
  return [ref, w] as const
}
