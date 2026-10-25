import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { HomePage } from './HomePage'
import { PlannerPage } from './PlannerPage'

// The two swipeable pages. Uses native horizontal scrolling with snap, so a
// finger swipe on a tablet or phone just works. The dots, arrow keys, and
// the weather chip also switch pages.
export function Pager() {
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const [page, setPage] = useState<0 | 1>(location.hash === '#plan' ? 1 : 0)

  const goTo = useCallback((p: 0 | 1, smooth = true) => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ left: p * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // Start on the right page when coming back from a detail screen
  useEffect(() => { goTo(page, false) }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const p = (Math.round(el.scrollLeft / el.clientWidth) === 1 ? 1 : 0) as 0 | 1
      setPage((prev) => {
        if (prev !== p) navigate({ hash: p === 1 ? 'plan' : '' }, { replace: true })
        return p
      })
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'ArrowRight') goTo(1)
      if (e.key === 'ArrowLeft') goTo(0)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => { el.removeEventListener('scroll', onScroll); window.removeEventListener('keydown', onKey) }
  }, [goTo, navigate])

  return (
    <div ref={ref} className="pager h-full">
      <section aria-label="Home" inert={page !== 0}>
        <PageHeader title="Home" subtitle="Everything, at a glance." page={page} onPageChange={goTo} showWeather />
        <HomePage onOpenPlanner={() => goTo(1)} />
      </section>
      <section aria-label="Calendar, weather and list" inert={page !== 1} className="flex flex-col">
        <PageHeader title="Today & this week" subtitle="Calendar, weather and shopping list." page={page} onPageChange={goTo} />
        <PlannerPage />
      </section>
    </div>
  )
}
