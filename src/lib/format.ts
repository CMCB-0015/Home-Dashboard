export function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.round(hr / 24)}d ago`
}

export function untilTime(iso: string | null): string {
  if (!iso) return '—'
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
  if (min <= 0) return 'now'
  if (min < 60) return `in ${min}m`
  const hr = Math.round(min / 60)
  if (hr < 24) return `in ${hr}h`
  return `in ${Math.round(hr / 24)}d`
}

export function clockTime(iso: string, short = false): string {
  const d = new Date(iso)
  let h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  if (short) return `${h}${m ? ':' + String(m).padStart(2, '0') : ''}${ampm === 'AM' ? 'a' : 'p'}`
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`
}

export function hourLabel(iso: string): string {
  const h = new Date(iso).getHours()
  return `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`
}

export function dayLabel(iso: string, index: number): string {
  if (index === 0) return 'Today'
  return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', { weekday: 'short' })
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}
