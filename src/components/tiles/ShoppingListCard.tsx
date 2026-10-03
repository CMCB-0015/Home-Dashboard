import { useState, type FormEvent } from 'react'
import { Plus, Check } from 'lucide-react'
import { useHome } from '../../lib/useHome'
import { categories } from '../../lib/categories'
import { Card } from '../Card'
import type { ShoppingItem } from '../../types'

const cfg = categories.list

export function ShoppingListCard() {
  const { data, update, send } = useHome()
  const [text, setText] = useState('')
  if (!data) return null
  const items = data.shoppingList
  const open = items.filter((i) => !i.done)
  const done = items.filter((i) => i.done)
  const sections = [...new Set(open.map((i) => i.section))]

  const add = (e: FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    const item: ShoppingItem = { id: `local-${Date.now()}`, text: value, section: 'Grocery', done: false }
    update((s) => ({ ...s, shoppingList: [item, ...s.shoppingList] }))
    send('todoist/add', { text: value })
    setText('')
  }
  const toggle = (item: ShoppingItem) => {
    update((s) => ({ ...s, shoppingList: s.shoppingList.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)) }))
    send('todoist/toggle', { id: item.id, done: !item.done })
  }

  const Row = ({ item }: { item: ShoppingItem }) => (
    <li>
      <button onClick={() => toggle(item)} className="flex w-full items-center gap-3 border-b border-edge-soft py-2.5 text-left" aria-pressed={item.done}>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2"
          style={item.done ? { background: cfg.color, borderColor: cfg.color } : { borderColor: 'var(--color-ink-dim)' }}>
          {item.done && <Check size={13} strokeWidth={3} className="text-bg" />}
        </span>
        <span className={`text-sm ${item.done ? 'text-ink-faint line-through' : 'text-ink'}`}>{item.text}</span>
      </button>
    </li>
  )

  return (
    <Card accent={cfg.color} title="Shopping list" subtitle={`${open.length} item${open.length === 1 ? '' : 's'} · Todoist`} className="min-h-0 flex-1" bodyClassName="flex flex-col">
      <form onSubmit={add} className="flex items-center gap-2 rounded-xl border border-edge bg-surface-raised py-1.5 pl-4 pr-1.5">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an item…" aria-label="New item"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint" />
        <button type="submit" aria-label="Add item" className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: cfg.dim, color: cfg.color }}>
          <Plus size={16} />
        </button>
      </form>
      <div className="mt-2 max-h-[400px] min-h-0 flex-1 overflow-y-auto pr-1 lg:max-h-none">
        {sections.map((sec) => (
          <div key={sec} className="mt-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{sec}</h3>
            <ul>{open.filter((i) => i.section === sec).map((i) => <Row key={i.id} item={i} />)}</ul>
          </div>
        ))}
        {done.length > 0 && (
          <div className="mt-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Done</h3>
            <ul>{done.map((i) => <Row key={i.id} item={i} />)}</ul>
          </div>
        )}
      </div>
    </Card>
  )
}
