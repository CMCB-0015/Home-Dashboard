// Shopping list: Bring!, through Home Assistant's Bring! integration.
//
// The integration makes one to-do list in Home Assistant per Bring! list, named
// as it is in Bring!. Panel finds them by the integration they come from
// (platform "bring"), so lists added, removed or renamed in Bring! show up here
// on their own; no list names are set in Panel's config.
//
// Items arrive live: Panel subscribes to each list (todo/item/subscribe) and
// Home Assistant sends the whole list whenever it changes. Bring! checks for
// changes made in its app about every 90 seconds; changes made here go to
// Bring! at once.
//
// Item ↔ Bring!: summary = the item, description = Bring!'s "specification"
// (amount or note), completed = Bring!'s "Recently" items.

import type { ShoppingItem, ShoppingListInfo, ShoppingState } from '../src/types.ts'
import { ha } from './ha.ts'

interface TodoItem { uid: string; summary: string; status: 'needs_action' | 'completed'; description?: string | null }

const items = new Map<string, ShoppingItem[]>()
/** list id → subscription id (0 while subscribing) */
const subscribed = new Map<string, number>()
let lastError: string | null = null
let onChanged: () => void = () => {}

const toItem = (t: TodoItem): ShoppingItem => ({
  id: t.uid, text: t.summary, spec: (t.description ?? '').trim(), done: t.status === 'completed',
})

/** The Bring! lists Home Assistant has, sorted by name */
function bringLists() {
  return ha.entitiesOf('bring').filter((s) => s.entity_id.startsWith('todo.')).sort((a, b) => ha.name(a).localeCompare(ha.name(b)))
}

export function shoppingState(): ShoppingState | null {
  const lists = bringLists()
  if (!lists.length) return null
  const info: ShoppingListInfo[] = lists.map((s) => {
    const its = items.get(s.entity_id)
    const available = s.state !== 'unavailable' && s.state !== 'unknown'
    // The entity's state is Home Assistant's count of items still to buy
    const open = its ? its.filter((i) => !i.done).length : Number(s.state) || 0
    return { id: s.entity_id, name: ha.name(s), open, available }
  })
  const out: Record<string, ShoppingItem[]> = {}
  for (const l of info) out[l.id] = items.get(l.id) ?? []
  return { lists: info, items: out }
}

export const shoppingError = () => lastError

/** Keep one live subscription per Bring! list; follow lists being added and removed. */
export function startShopping(changed: () => void) {
  onChanged = changed
  ha.onChange(() => {
    if (ha.status !== 'connected') { subscribed.clear(); return } // subscriptions end with the connection
    sync()
  })
}

function sync() {
  const ids = new Set(bringLists().map((s) => s.entity_id))
  for (const [id, sub] of subscribed) {
    if (!ids.has(id)) { if (sub) ha.unsubscribe(sub); subscribed.delete(id); items.delete(id); onChanged() }
  }
  for (const id of ids) if (!subscribed.has(id)) void watch(id)
}

async function watch(id: string) {
  subscribed.set(id, 0)
  try {
    const sub = await ha.subscribe({ type: 'todo/item/subscribe', entity_id: id }, (event: { items?: TodoItem[] }) => {
      if (!Array.isArray(event?.items)) return
      items.set(id, order(event.items.map(toItem)))
      lastError = null
      onChanged()
    })
    if (subscribed.get(id) === 0) subscribed.set(id, sub)
    else ha.unsubscribe(sub) // the list went away while subscribing
  } catch (e) {
    subscribed.delete(id)
    lastError = `Couldn’t read the Bring! list: ${e instanceof Error ? e.message : e}`
    console.warn('[shopping]', lastError)
    onChanged()
    // Try again shortly (the next Home Assistant change also retries)
    setTimeout(() => { if (ha.status === 'connected') sync() }, 30_000)
  }
}

/** Items to buy first (in Bring!'s order), then recently bought */
const order = (list: ShoppingItem[]) => [...list.filter((i) => !i.done), ...list.filter((i) => i.done)]

// ── Commands from the card ────────────────────────────────────────────────
type Cmd = { action?: string; list?: string; id?: string; text?: string; spec?: string; done?: boolean; kind?: string }

const MESSAGES: Record<string, string> = { going: 'going_shopping', done: 'shopping_done' }

export async function shoppingCommand(b: Cmd) {
  const list = String(b.list ?? '')
  const lists = bringLists()
  if (!lists.some((s) => s.entity_id === list)) throw new Error('That Bring! list isn’t in Home Assistant anymore')
  const target = [list]
  const known = items.get(list) ?? []
  const item = (id: unknown) => {
    const it = known.find((i) => i.id === id)
    if (!it) throw new Error('That item isn’t on the list anymore')
    return it
  }

  switch (b.action) {
    case 'add': {
      const text = String(b.text ?? '').trim().slice(0, 120)
      if (!text) throw new Error('Type an item first')
      // Already on the list (or a recent item)? Bring! keeps one of each, so
      // put that one back instead of adding a second.
      const same = known.find((i) => i.text.toLowerCase() === text.toLowerCase())
      if (same && !same.done) return
      if (same) return ha.callService('todo', 'update_item', { item: same.id, status: 'needs_action' }, target)
      return ha.callService('todo', 'add_item', { item: text }, target)
    }
    case 'check': {
      const it = item(b.id)
      return ha.callService('todo', 'update_item', { item: it.id, status: b.done === false ? 'needs_action' : 'completed' }, target)
    }
    case 'spec': {
      const it = item(b.id)
      const spec = String(b.spec ?? '').trim().slice(0, 120)
      if (spec === it.spec) return
      return ha.callService('todo', 'update_item', { item: it.id, description: spec }, target)
    }
    case 'remove': {
      const it = item(b.id)
      return ha.callService('todo', 'remove_item', { item: [it.id] }, target)
    }
    case 'notify': {
      const message = MESSAGES[String(b.kind)]
      if (!message) throw new Error('Unknown message')
      return ha.callService('bring', 'send_message', { message }, target)
    }
    default:
      throw new Error('Unknown shopping list action')
  }
}

/** For /api/setup-check */
export function shoppingNotes() {
  const lists = bringLists()
  return {
    lists: lists.map((s) => ({ id: s.entity_id, name: ha.name(s), state: s.state, items: items.get(s.entity_id)?.length ?? null })),
    problem: lastError,
    note: lists.length ? null : 'No Bring! lists found. Add the Bring! integration in Home Assistant (Settings → Devices & services → Add integration → Bring!).',
  }
}
