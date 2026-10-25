import { useEffect, useState } from 'react'
import { Check, Pencil, Play, Shuffle, Trash2, X } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { PINK } from './SonosParts'
import type { SonosFavorite, SonosPreset, SonosSpeaker } from '../../types'

/** POST to the dashboard server and return the error message, if any */
async function post(path: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(`/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) return null
    const err = await res.json().catch(() => ({}))
    return err.error ?? 'That didn’t go through'
  } catch {
    return 'Demo mode — the dashboard isn’t connected, so nothing was saved'
  }
}

type SheetMode =
  | { kind: 'new'; speakers: SonosSpeaker[]; shuffle: boolean; favoriteId: string | null }
  | { kind: 'rename'; preset: SonosPreset }

/**
 * "Save as quick-play button": turns the checked speakers (at their current
 * volumes) + a Sonos Favorite + shuffle into a new button on the card's Quick
 * play list. Also renames saved buttons.
 */
export function PresetSheet({ mode, favorites, onClose }: { mode: SheetMode; favorites: SonosFavorite[]; onClose: () => void }) {
  const isNew = mode.kind === 'new'
  const [favId, setFavId] = useState<string | null>(isNew ? mode.favoriteId : null)
  const fav = favorites.find((f) => f.id === favId)
  const [name, setName] = useState(isNew ? '' : mode.preset.name)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const shownName = name.trim() || (isNew ? fav?.name ?? '' : '')

  const save = async () => {
    setBusy(true); setError(null)
    const err = isNew
      ? await post('sonos/preset-save', {
          name: shownName, favoriteId: favId, shuffle: mode.shuffle,
          speakers: mode.speakers.map((s) => ({ id: s.id, volume: s.volumePct })),
        })
      : await post('sonos/preset-rename', { id: mode.preset.id, name: shownName })
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  const ready = !!shownName && (!isNew || (!!favId && mode.speakers.length > 0))

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sheet-backdrop" onClick={onClose}>
      <div role="dialog" aria-modal aria-label={isNew ? 'New quick-play button' : 'Rename quick-play button'}
        className="sheet-up max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-edge bg-surface px-5 pb-8 pt-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-edge" />
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'var(--color-sonos-dim)', color: PINK }}>
            {isNew ? <Play size={20} fill="currentColor" /> : <Pencil size={18} />}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold">{isNew ? 'New quick-play button' : 'Rename quick-play button'}</h2>
            <p className="truncate text-xs text-ink-faint">
              {isNew ? 'Shows up in Quick play on the Sonos card' : `${mode.preset.where} · ${mode.preset.volume}`}
            </p>
          </div>
        </div>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-xs font-medium text-ink-dim">Name</span>
          <input value={name} onChange={(e) => { setName(e.target.value); setError(null) }} maxLength={30} autoFocus
            placeholder={isNew ? fav?.name ?? 'For example: Dinner' : ''}
            onKeyDown={(e) => { if (e.key === 'Enter' && ready && !busy) void save() }}
            className="h-11 w-full rounded-xl border border-edge bg-surface-raised px-3.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-[var(--color-sonos)]" />
        </label>

        {isNew && (
          <>
            <p className="mb-1.5 mt-5 text-xs font-medium text-ink-dim">Plays</p>
            <div className="flex flex-wrap gap-2">
              {favorites.map((f) => {
                const on = f.id === favId
                return (
                  <button key={f.id} onClick={() => { setFavId(f.id); setError(null) }} aria-pressed={on}
                    className="flex h-10 items-center gap-1.5 rounded-full border px-4 text-xs font-medium"
                    style={{ background: on ? 'rgba(224,161,200,0.14)' : 'var(--color-surface-raised)', borderColor: on ? PINK : 'var(--color-edge)' }}>
                    {on && <Check size={13} style={{ color: PINK }} />}{f.name}
                  </button>
                )
              })}
              {!favorites.length && <p className="text-xs text-ink-faint">No Sonos Favorites found yet.</p>}
            </div>

            <p className="mb-1.5 mt-5 text-xs font-medium text-ink-dim">On</p>
            <div className="rounded-xl border border-edge bg-surface-raised px-3.5 py-2.5 text-sm">
              {mode.speakers.length
                ? mode.speakers.map((s) => (
                    <p key={s.id} className="flex justify-between py-0.5"><span>{s.name}</span><span className="font-mono text-xs text-ink-dim">Vol {s.volumePct}</span></p>
                  ))
                : <p className="text-ink-faint">No speakers checked — pick some on the Sonos page first.</p>}
              <p className="mt-1.5 flex items-center gap-1.5 border-t border-edge pt-2 text-xs text-ink-faint">
                <Shuffle size={12} /> Shuffle {mode.shuffle ? 'on' : 'off'}
              </p>
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">Uses each speaker's volume right now. To change it, close this, move the sliders, then save.</p>
          </>
        )}

        {error && <p className="mt-4 rounded-lg border px-3 py-2.5 text-xs" style={{ borderColor: 'var(--color-weather)', color: 'var(--color-ink)' }}>{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface-raised px-5 text-sm font-semibold text-ink hover:bg-edge">
            <X size={15} /> Cancel
          </button>
          <button onClick={() => void save()} disabled={!ready || busy}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-6 text-sm font-semibold text-bg disabled:opacity-40" style={{ background: PINK }}>
            <Check size={15} /> {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Every quick-play button, with rename and delete for the ones saved here */
export function PresetList({ presets, onRename }: { presets: SonosPreset[]; onRename: (p: SonosPreset) => void }) {
  const { send } = useHome()
  return (
    <div className="flex flex-col gap-2">
      {presets.map((pr) => (
        <div key={pr.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-edge bg-surface-raised py-2 pl-3 pr-2 sm:flex-nowrap">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface" style={{ color: PINK }}>
            {pr.shuffle ? <Shuffle size={14} /> : <Play size={12} fill="currentColor" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{pr.name}</span>
            <span className="block truncate text-[11px] text-ink-faint">
              {pr.available ? [pr.favorite, pr.where, pr.volume].filter(Boolean).join(' · ') : pr.reason}
            </span>
          </span>
          {pr.saved ? (
            <span className="flex shrink-0 items-center gap-2">
              <button onClick={() => onRename(pr)} className="flex h-9 items-center gap-1.5 rounded-lg border border-edge px-3 text-xs text-ink-dim hover:text-ink">
                <Pencil size={12} /> Rename
              </button>
              <DeleteButton onConfirm={() => void send('sonos/preset-delete', { id: pr.id })} />
            </span>
          ) : (
            <span className="shrink-0 text-[11px] text-ink-faint">Set in the settings file</span>
          )}
        </div>
      ))}
      {!presets.length && <p className="text-sm text-ink-faint">No quick-play buttons yet.</p>}
    </div>
  )
}

/** Delete, tap twice to confirm (same rule as the other risky buttons) */
function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button onClick={() => { if (armed) { setArmed(false); onConfirm() } else setArmed(true) }}
      aria-label={armed ? 'Confirm: delete' : 'Delete'}
      className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors"
      style={armed ? { background: 'var(--color-critical)', color: 'var(--color-bg)' } : { background: 'var(--color-critical-dim)', color: 'var(--color-critical)' }}>
      <Trash2 size={12} /> {armed ? 'Tap again' : 'Delete'}
    </button>
  )
}
