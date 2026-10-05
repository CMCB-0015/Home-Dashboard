import { useEffect, useState } from 'react'
import { useHome } from '../lib/useHome'
import { WeatherIcon } from './WeatherIcon'

function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

interface Props {
  title: string
  subtitle: string
  page: 0 | 1
  onPageChange: (p: 0 | 1) => void
  showWeather?: boolean
}

export function PageHeader({ title, subtitle, page, onPageChange, showWeather }: Props) {
  const now = useNow()
  const { data, live } = useHome()
  const w = data?.weather
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/, '')
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 md:px-8 md:pt-7">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        <p className="mt-1 truncate text-sm text-ink-dim">
          {subtitle}
          {!live && <span className="ml-2 text-ink-faint">· offline, showing demo data</span>}
        </p>
      </div>

      <div className="hidden pt-3 sm:flex" role="tablist" aria-label="Pages">
        {[0, 1].map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={page === p}
            aria-label={p === 0 ? 'Home page' : 'Calendar page'}
            onClick={() => onPageChange(p as 0 | 1)}
            className="flex h-6 w-7 items-center justify-center"
          >
            <span className={`block h-1.5 rounded-full transition-all ${page === p ? 'w-5 bg-ink' : 'w-1.5 bg-ink-faint'}`} />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-5">
        {showWeather && w && (
          <button onClick={() => onPageChange(1)} className="hidden items-center gap-2 text-left md:flex" aria-label="Open weather">
            <WeatherIcon kind={w.current.icon} size={40} />
            <div>
              <div className="text-[28px] font-light leading-none">{w.current.tempF}°</div>
              <div className="mt-1 text-[11px] text-ink-dim">{w.current.condition}</div>
            </div>
            <span className="ml-3 h-10 w-px bg-edge" />
          </button>
        )}
        <div className="text-right">
          <div className="font-mono text-[28px] leading-none">{time}</div>
          <div className="mt-1.5 text-xs text-ink-dim">{date}</div>
        </div>
      </div>
    </header>
  )
}
