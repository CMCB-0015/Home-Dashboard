import { useEffect, useState } from 'react'
import { ExternalLink, Link2, X } from 'lucide-react'
import type { CalendarWrite } from '../../types'

/**
 * One-time step so Panel can add, edit and delete events: open Google's
 * sign-in, allow Calendar, then paste back the address Google ends on.
 * (Reading events keeps coming from Home Assistant.)
 */
export function LinkGoogleSheet({ status, onLinked, onClose }: { status: CalendarWrite; onLinked: () => void; onClose: () => void }) {
  const [opened, setOpened] = useState(false)
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  async function call(path: string, body?: unknown) {
    const res = await fetch(`/api/gcal/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error ?? 'That didn’t work')
    return json
  }

  async function open() {
    setError(null)
    // Open the tab first (tablets block tabs opened after a wait), then point it at Google
    const tab = window.open('', '_blank')
    try {
      const { url } = await call('link-start')
      if (tab) tab.location.href = url
      else window.location.assign(url)
      setOpened(true)
    } catch (e) {
      tab?.close()
      setError(e instanceof Error ? e.message : 'Couldn’t start the Google sign-in')
    }
  }

  async function finish() {
    setBusy(true); setError(null)
    try { await call('link-finish', { pasted }); onLinked() } catch (e) { setError(e instanceof Error ? e.message : 'That didn’t work') } finally { setBusy(false) }
  }

  const step = 'grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 text-[15px] leading-relaxed'
  const num = 'flex h-[26px] w-[26px] items-center justify-center rounded-full bg-calendar-dim text-[13px] font-semibold text-calendar'

  return (
    <div className="sheet-backdrop fixed inset-0 z-40 flex items-end justify-center bg-black/55" onClick={onClose}>
      <div role="dialog" aria-modal aria-label="Link Google Calendar"
        className="sheet-up flex max-h-[94vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-3xl border border-b-0 border-edge bg-surface-raised px-5 pb-7 pt-3 shadow-[0_-16px_40px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="h-1 w-11 shrink-0 self-center rounded-full bg-[#3a4652]" />
        <div className="-ml-3 flex items-center gap-2">
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-dim hover:bg-surface hover:text-ink"><X size={20} /></button>
          <h2 className="font-display text-base font-semibold">Link Google Calendar</h2>
        </div>
        <p className="text-sm leading-relaxed text-[#c5ced6]">One-time step so Panel can add, edit and delete events. Reading events still comes from Home Assistant, as now.</p>
        {status.problem && <p className="rounded-xl border border-[#f0b24a] bg-[#2a2418] px-3.5 py-2.5 text-sm">{status.problem}</p>}

        {!status.configured ? (
          <div className="flex flex-col gap-3 rounded-xl border border-edge bg-surface p-4 text-sm leading-relaxed">
            <p className="font-semibold">First, a Google sign-in key for Panel (once):</p>
            <div className={step}><span className={num}>1</span><span>In Google Cloud Console, open the <b>Home Assistant Dashboard</b> project → APIs &amp; Services → Credentials.</span></div>
            <div className={step}><span className={num}>2</span><span>Create credentials → OAuth client ID → type <b>Desktop app</b>, name it “Panel”.</span></div>
            <div className={step}><span className={num}>3</span><span>In Home Assistant: Settings → Apps → Panel → Configuration, paste the <b>Client ID</b> and <b>Client secret</b> into google_client_id and google_client_secret, Save, then restart Panel.</span></div>
          </div>
        ) : (
          <>
            <div className={step}>
              <span className={num}>1</span>
              <span className="flex flex-col gap-2.5">
                <span>Open Google’s sign-in, pick your account and allow Calendar.</span>
                <button type="button" onClick={open} className="flex h-11 w-fit items-center gap-2 rounded-full bg-calendar px-5 text-sm font-semibold text-bg hover:opacity-90">
                  <ExternalLink size={16} /> {opened ? 'Open it again' : 'Open Google sign-in'}
                </button>
              </span>
            </div>
            <div className={step}>
              <span className={num}>2</span>
              <span className="flex flex-col gap-2.5">
                <span>Google finishes on a page that <b>won’t load</b> (it starts with 127.0.0.1). That’s expected — copy that page’s whole address and paste it here.</span>
                <input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="http://127.0.0.1:8099/google-linked?…" aria-label="Address from Google"
                  className="h-11 w-full rounded-[10px] border border-[#33404c] bg-surface px-3 font-mono text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-calendar" />
                <button type="button" onClick={finish} disabled={busy || !pasted.trim()} className="flex h-11 w-fit items-center gap-2 rounded-full bg-calendar px-5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-40">
                  <Link2 size={16} /> {busy ? 'Linking…' : 'Link'}
                </button>
              </span>
            </div>
          </>
        )}
        {error && <p role="alert" className="rounded-xl border border-[#f0b24a] bg-[#2a2418] px-3.5 py-2.5 text-sm">{error}</p>}
      </div>
    </div>
  )
}
