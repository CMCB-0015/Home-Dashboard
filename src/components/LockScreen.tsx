import { useState, type FormEvent } from 'react'
import { Lock } from 'lucide-react'
import { useHome } from '../lib/useHome'

export function LockScreen() {
  const { lock, unlock } = useHome()
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'wrong'>('idle')
  const setup = lock === 'setup'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setStatus('checking')
    const result = await unlock(code)
    if (result !== 'ok') { setStatus('wrong'); setCode('') }
  }

  return (
    <main className="flex min-h-full items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-8 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised">
          <Lock size={20} className="text-ink-dim" />
        </div>
        <h1 className="font-display text-xl font-semibold">Panel</h1>
        {setup ? (
          <p className="mt-3 text-sm text-ink-dim">
            No passcode is set yet. Add <span className="font-mono text-ink">PANEL_PASSCODE</span> in Netlify under
            Site configuration → Environment variables, then redeploy.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5">
            <label htmlFor="passcode" className="text-sm text-ink-dim">Enter the passcode to continue</label>
            <input
              id="passcode"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              autoFocus
              value={code}
              onChange={(e) => { setCode(e.target.value); setStatus('idle') }}
              className="mt-3 w-full rounded-xl border border-edge bg-surface-raised px-4 py-3 text-center font-mono text-lg tracking-[0.3em] text-ink outline-none focus:border-ink-faint"
            />
            <p className="mt-2 h-5 text-xs text-critical" role="alert">{status === 'wrong' ? "That's not it — try again." : ''}</p>
            <button type="submit" disabled={status === 'checking'}
              className="mt-2 w-full rounded-xl bg-climate-dim py-3 text-sm font-semibold text-climate disabled:opacity-50">
              {status === 'checking' ? 'Checking…' : 'Unlock'}
            </button>
            <p className="mt-4 text-[11px] text-ink-faint">This device stays signed in for a year.</p>
          </form>
        )}
      </div>
    </main>
  )
}
