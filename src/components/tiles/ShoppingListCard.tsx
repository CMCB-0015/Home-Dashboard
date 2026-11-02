import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Plus, Check, ChevronDown, ShoppingCart, WifiOff, X } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { useLongPress } from '../../lib/useLongPress'
import { categories } from '../../lib/categories'
import { Card } from '../Card'
import type { HomeState, ShoppingItem, ShoppingListInfo } from '../../types'

// Shopping list — Bring!, through Home Assistant.
//
// Tap an item to check it off: it's struck through, fades, and moves to the
// Recent chips (Bring!'s "Recently" items). Tap it again while it's fading to
// undo. Tap a Recent chip to put it back on the list. Press and hold an item
// for its panel (details like "2 lbs", remove). The list picker shows every
// Bring! list in Home Assistant, by its Bring! name; the pick is remembered per
// screen. The footer sends Bring!'s own "Going shopping" / "Done shopping"
// notice to everyone on the list.

const cfg = categories.list
const LIST_KEY = 'panel-shopping-list'
const FADE_MS = 1400
const GONE_MS = 1900
const RECENT_MAX = 8
const QUICK = ['2', '3', '4', '1 lb', '2 lbs', 'Organic']
const strip = 'flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-medium transition-colors duration-150 active:scale-[0.97] disabled:opacity-40'

type Leaving = Record<string, 'checked' | 'fading'>

export function ShoppingListCard() {
  const { data, update, send } = useHome()
  const [text, setText] = useState('')
  const [picked, setPicked] = useState<string | null>(() => { try { return localStorage.getItem(LIST_KEY) } catch { return null } })
  const [leaving, setLeaving] = useState<Leaving>({})
  const [hold, setHold] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>[]>())
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastOrder = useRef<string[]>([])

  useEffect(() => () => {
    for (const ts of timers.current.values()) ts.forEach(clearTimeout)
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  if (!data) return null
  const lists = data.shopping?.lists ?? []
  const list: ShoppingListInfo | null = lists.find((l) => l.id === picked) ?? lists[0] ?? null
  const all = list ? data.shopping?.items[list.id] ?? [] : []

  // Rows keep their place while you work the list (a checked item doesn't jump
  // to the bottom before it fades); new items go at the end.
  const shown = all.filter((i) => !i.done || leaving[i.id])
  const pos = new Map(lastOrder.current.map((id, k) => [id, k]))
  const rows = shown
    .map((i, k) => ({ i, k }))
    .sort((a, b) => (pos.get(a.i.id) ?? 1e6 + a.k) - (pos.get(b.i.id) ?? 1e6 + b.k))
    .map((x) => x.i)
  lastOrder.current = rows.map((i) => i.id)
  const recent = all.filter((i) => i.done && !leaving[i.id]).slice(0, RECENT_MAX)
  const open = all.filter((i) => !i.done).length
  const holdItem = hold ? all.find((i) => i.id === hold) ?? null : null

  const patch = (fn: (items: ShoppingItem[]) => ShoppingItem[]) => {
    if (!list) return
    update((s: HomeState) => s.shopping
      ? { ...s, shopping: { ...s.shopping, items: { ...s.shopping.items, [list.id]: fn(s.shopping.items[list.id] ?? []) } } }
      : s)
  }
  const cmd = (body: Record<string, unknown>) => list ? send('shopping/command', { list: list.id, ...body }) : Promise.resolve(false)
  const clearTimers = (id: string) => { timers.current.get(id)?.forEach(clearTimeout); timers.current.delete(id) }
  const dropLeaving = (id: string) => setLeaving((l) => { const n = { ...l }; delete n[id]; return n })

  const add = (e: FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value || !list) return
    setText('')
    const same = all.find((i) => i.text.toLowerCase() === value.toLowerCase())
    if (same && !same.done) return
    if (same) patch((xs) => xs.map((i) => (i.id === same.id ? { ...i, done: false } : i)))
    else patch((xs) => [...xs, { id: `local-${Date.now()}`, text: value, spec: '', done: false }])
    void cmd({ action: 'add', text: value })
  }

  const check = (it: ShoppingItem) => {
    if (leaving[it.id]) {
      // Tapped again while fading: undo
      clearTimers(it.id); dropLeaving(it.id)
      patch((xs) => xs.map((i) => (i.id === it.id ? { ...i, done: false } : i)))
      void cmd({ action: 'check', id: it.id, done: false })
      return
    }
    if (it.id.startsWith('local-')) return // still being added
    setLeaving((l) => ({ ...l, [it.id]: 'checked' }))
    patch((xs) => xs.map((i) => (i.id === it.id ? { ...i, done: true } : i)))
    void cmd({ action: 'check', id: it.id, done: true })
    timers.current.set(it.id, [
      setTimeout(() => setLeaving((l) => (l[it.id] ? { ...l, [it.id]: 'fading' } : l)), FADE_MS),
      setTimeout(() => { timers.current.delete(it.id); dropLeaving(it.id) }, GONE_MS),
    ])
  }

  const readd = (it: ShoppingItem) => {
    patch((xs) => xs.map((i) => (i.id === it.id ? { ...i, done: false } : i)))
    void cmd({ action: 'check', id: it.id, done: false })
  }

  const saveSpec = (it: ShoppingItem, spec: string) => {
    const v = spec.trim()
    if (v === it.spec) return
    patch((xs) => xs.map((i) => (i.id === it.id ? { ...i, spec: v } : i)))
    void cmd({ action: 'spec', id: it.id, spec: v })
  }

  const remove = (it: ShoppingItem) => {
    setHold(null)
    patch((xs) => xs.filter((i) => i.id !== it.id))
    void cmd({ action: 'remove', id: it.id })
  }

  const notify = async (kind: 'going' | 'done') => {
    if (!(await cmd({ action: 'notify', kind }))) return
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(`Sent “${kind === 'going' ? 'Going shopping' : 'Done shopping'}” to the list`)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

  const pick = (id: string) => {
    setPicked(id); setPicker(false); setHold(null)
    try { localStorage.setItem(LIST_KEY, id) } catch { /* private mode */ }
  }

  const down = !!list && !list.available
  const headerRight = list ? (
    lists.length > 1 ? (
      <button onClick={() => setPicker(true)} aria-label={`List: ${list.name}. Switch list`} aria-haspopup="dialog"
        className="flex h-[34px] items-center gap-1 rounded-full border border-white/10 bg-white/5 pl-3 pr-2.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-white/10">
        {list.name}<ChevronDown size={14} aria-hidden />
      </button>
    ) : (
      <span className="flex h-[34px] items-center rounded-full border border-white/10 px-3 text-[12.5px] font-semibold text-ink-dim">{list.name}</span>
    )
  ) : undefined

  const actions = (
    <div className="grid w-full grid-cols-2 gap-2">
      <button onClick={() => void notify('going')} disabled={down} className={strip} style={{ background: cfg.dim, color: cfg.color }}>
        <ShoppingCart size={13} aria-hidden />Going shopping
      </button>
      <button onClick={() => void notify('done')} disabled={down} className={strip} style={{ background: 'var(--color-surface-raised)', color: 'var(--color-ink)' }}>
        <Check size={13} aria-hidden />Done shopping
      </button>
    </div>
  )

  const overlay = (
    <>
      {holdItem && <ItemPanel key={holdItem.id} item={holdItem} onSave={(v) => saveSpec(holdItem, v)} onRemove={() => remove(holdItem)} onClose={() => setHold(null)} />}
      {picker && <ListPicker lists={lists} current={list?.id ?? null} onPick={pick} onClose={() => setPicker(false)} />}
      {toast && (
        <div role="status" className="pointer-events-none absolute inset-x-0 bottom-[60px] z-[3] flex justify-center">
          <span className="rounded-full border border-[#33404c] bg-[#222c36] px-3.5 py-2 text-[12.5px] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">{toast}</span>
        </div>
      )}
    </>
  )

  const subtitle = !list ? 'Bring!' : down ? 'Bring! · not responding' : `${open} item${open === 1 ? '' : 's'} · Bring!`

  return (
    <Card accent={cfg.color} title="Shopping list" category="list" subtitle={subtitle} headerRight={headerRight}
      className="min-h-[136px] flex-1" bodyClassName="flex min-h-0 flex-col" actions={actions} overlay={overlay}>
      {down ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-6 text-center">
          <WifiOff size={28} className="text-ink-dim" aria-hidden />
          <p className="text-sm font-semibold">List unavailable</p>
          <p className="max-w-xs text-[12.5px] leading-snug text-ink-dim">Bring! isn’t responding right now. The Bring! app still works — the list comes back here on its own.</p>
        </div>
      ) : (
        <>
          <form onSubmit={add} className="flex items-center gap-2 rounded-xl border border-edge bg-surface-raised py-1.5 pl-4 pr-1.5">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an item…" aria-label="New item" enterKeyHint="done"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint" />
            <button type="submit" aria-label="Add item" className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: cfg.dim, color: cfg.color }}>
              <Plus size={16} />
            </button>
          </form>

          {recent.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Recent</span>
              {recent.map((r) => (
                <button key={r.id} onClick={() => readd(r)} aria-label={`Add ${r.text} back`}
                  className="flex h-[30px] items-center gap-1 rounded-full border pl-2 pr-2.5 text-xs transition-colors active:scale-[0.97]"
                  style={{ background: 'rgba(127,209,185,0.08)', borderColor: 'rgba(127,209,185,0.22)', color: '#c9eee2' }}>
                  <Plus size={12} strokeWidth={2.6} style={{ color: cfg.color }} aria-hidden />{r.text}
                </button>
              ))}
            </div>
          )}

          <ul className="mt-1.5 min-h-0 flex-1 overflow-y-auto pr-1">
            {rows.map((it) => <Row key={it.id} item={it} state={leaving[it.id]} onTap={() => check(it)} onHold={() => !it.id.startsWith('local-') && setHold(it.id)} />)}
            {rows.length === 0 && <li className="py-6 text-center text-[13px] text-ink-faint">Nothing on the list</li>}
          </ul>
        </>
      )}
    </Card>
  )
}

function Row({ item, state, onTap, onHold }: { item: ShoppingItem; state?: 'checked' | 'fading'; onTap: () => void; onHold: () => void }) {
  const press = useLongPress(onTap, onHold)
  const done = !!state || item.done
  return (
    <li className="transition-opacity duration-500" style={{ opacity: state === 'fading' ? 0 : 1 }}>
      <button {...press} aria-pressed={done} aria-label={`${item.text}${item.spec ? `, ${item.spec}` : ''}`}
        className="flex min-h-[46px] w-full select-none items-center gap-3 border-b border-edge-soft text-left [touch-action:manipulation]">
        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150"
          style={done ? { background: cfg.color, borderColor: cfg.color } : { borderColor: '#3a4652' }}>
          {done && <Check size={12} strokeWidth={3.4} className="text-bg" />}
        </span>
        <span className={`min-w-0 flex-1 truncate text-sm ${done ? 'text-ink-faint line-through' : 'text-ink'}`}>{item.text}</span>
        {item.spec && <span className="shrink-0 font-mono text-xs text-ink-dim">{item.spec}</span>}
      </button>
    </li>
  )
}

// ── Slide-up panels inside the card ───────────────────────────────────────
function Panel({ title, right, onClose, children, label }: { title: string; right?: ReactNode; onClose: () => void; children: ReactNode; label: string }) {
  return (
    <>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 z-[3] bg-black/45" />
      <div role="dialog" aria-label={label}
        className="sheet-up absolute inset-x-0 bottom-0 z-[3] flex max-h-[92%] flex-col gap-3 overflow-y-auto rounded-t-2xl border-t border-edge bg-surface-raised px-4 pb-4 pt-3 shadow-[0_-12px_24px_rgba(0,0,0,0.35)]">
        <div className="h-1 w-9 shrink-0 self-center rounded-full bg-edge" />
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{title}</p>
          {right}
        </div>
        {children}
      </div>
    </>
  )
}

function ItemPanel({ item, onSave, onRemove, onClose }: { item: ShoppingItem; onSave: (spec: string) => void; onRemove: () => void; onClose: () => void }) {
  const [spec, setSpec] = useState(item.spec)
  const close = () => { onSave(spec); onClose() }
  return (
    <Panel title={item.text} label={`${item.text} details`} onClose={close}
      right={<button onClick={close} className="flex h-9 items-center rounded-full px-4 text-[13px] font-bold text-bg" style={{ background: cfg.color }}>Done</button>}>
      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Details</span>
        <input value={spec} onChange={(e) => setSpec(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') close() }}
          placeholder="Amount or note — 2 lbs, organic…" enterKeyHint="done"
          className="h-11 rounded-xl border border-edge bg-surface px-3.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-[#3a4652]" />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button key={q} onClick={() => setSpec(q)} aria-pressed={spec === q}
            className="h-8 rounded-full border px-3 text-[12.5px] transition-colors"
            style={spec === q ? { borderColor: cfg.color, color: cfg.color, background: cfg.dim } : { borderColor: 'rgba(255,255,255,0.1)', color: '#c5ced6', background: 'rgba(255,255,255,0.05)' }}>
            {q}
          </button>
        ))}
        {spec && (
          <button onClick={() => setSpec('')} aria-label="Clear details" className="flex h-8 items-center rounded-full px-2.5 text-ink-dim hover:text-ink"><X size={15} /></button>
        )}
      </div>
      <button onClick={onRemove} className="h-11 rounded-xl border text-[13.5px] font-semibold"
        style={{ borderColor: 'rgba(255,107,94,0.35)', background: 'rgba(255,107,94,0.08)', color: '#ff9b91' }}>
        Remove from list
      </button>
    </Panel>
  )
}

function ListPicker({ lists, current, onPick, onClose }: { lists: ShoppingListInfo[]; current: string | null; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <Panel title="Lists" label="Pick a list" onClose={onClose}
      right={<button onClick={onClose} aria-label="Close" className="-mr-2 flex h-8 w-11 items-center justify-center text-ink-dim hover:text-ink"><X size={18} /></button>}>
      <ul className="flex flex-col">
        {lists.map((l) => (
          <li key={l.id}>
            <button onClick={() => onPick(l.id)} aria-current={l.id === current || undefined}
              className="flex min-h-[46px] w-full items-center gap-3 border-b border-edge-soft text-left">
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: l.id === current ? cfg.color : undefined }}>{l.name}</span>
              <span className="font-mono text-xs text-ink-dim">{l.available ? `${l.open} item${l.open === 1 ? '' : 's'}` : 'not responding'}</span>
              <span className="flex w-5 justify-center">{l.id === current && <Check size={16} style={{ color: cfg.color }} />}</span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
