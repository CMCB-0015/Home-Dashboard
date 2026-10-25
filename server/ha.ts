// The connection to Home Assistant.
//
// Keeps one open connection (Home Assistant's WebSocket API), holds a live copy
// of every device's state, and tells the rest of the server whenever something
// changes. Commands ("turn on this light") go out over the same connection.
//
// On the Lenovo, the dashboard runs as a Home Assistant app, and Home
// Assistant hands it a token automatically (SUPERVISOR_TOKEN) — nothing to set
// up. For testing elsewhere you can set HA_URL and HA_TOKEN instead; without
// them the dashboard shows demo data for the Home Assistant tiles.

import { env } from './env.ts'

export interface HAState {
  entity_id: string
  state: string
  attributes: Record<string, any>
  last_changed: string
  last_updated: string
}

export interface BrowseItem {
  title: string
  media_content_id: string
  media_content_type: string
  media_class?: string
  can_play?: boolean
  can_expand?: boolean
  thumbnail?: string | null
  children?: BrowseItem[]
}

interface EntityEntry { entity_id: string; platform: string; area_id: string | null; device_id: string | null; disabled_by: string | null }
interface DeviceEntry { id: string; area_id: string | null }
interface AreaEntry { area_id: string; name: string }

type Status = 'connected' | 'connecting' | 'not-configured'

function connection(): { ws: string; rest: string; token: string } | null {
  const supervisor = env('SUPERVISOR_TOKEN')
  if (supervisor) return { ws: 'ws://supervisor/core/websocket', rest: 'http://supervisor/core', token: supervisor }
  const url = env('HA_URL'), token = env('HA_TOKEN')
  if (url && token) {
    const base = url.replace(/\/+$/, '')
    return { ws: base.replace(/^http/, 'ws') + '/api/websocket', rest: base, token }
  }
  return null
}

class HomeAssistant {
  states = new Map<string, HAState>()
  status: Status = 'not-configured'
  private entities = new Map<string, EntityEntry>()
  private devices = new Map<string, DeviceEntry>()
  private areas = new Map<string, string>()
  private ws: WebSocket | null = null
  private nextId = 1
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()
  private listeners = new Set<() => void>()
  private retryMs = 2000
  private pingTimer: NodeJS.Timeout | null = null

  configured() { return connection() !== null }

  /** Call `fn` whenever anything in Home Assistant changes. */
  onChange(fn: () => void) { this.listeners.add(fn) }
  private changed() { for (const fn of this.listeners) fn() }
  /** Tell open screens something changed that Home Assistant didn't announce */
  notify() { this.changed() }

  start() {
    const conn = connection()
    if (!conn) { console.log('[home assistant] not configured — Home Assistant tiles show demo data'); return }
    if (typeof WebSocket === 'undefined') { console.error('[home assistant] this Node version has no WebSocket; use Node 22 or newer'); return }
    this.status = 'connecting'
    const ws = new WebSocket(conn.ws)
    this.ws = ws
    // Node fires only 'error' (no 'close') when it can't connect at all, so
    // either one starts the retry, exactly once per connection attempt.
    let ended = false
    const end = () => {
      if (ended) return
      ended = true
      clearTimeout(timeout)
      try { ws.close() } catch { /* already closed */ }
      this.onClose()
    }
    // A connection attempt that hangs counts as failed
    const timeout = setTimeout(() => { if (ws.readyState !== WebSocket.OPEN) end() }, 20_000)
    ws.addEventListener('open', () => clearTimeout(timeout))
    ws.addEventListener('message', (ev) => this.onMessage(String(ev.data), conn.token))
    ws.addEventListener('close', end)
    ws.addEventListener('error', end)
  }

  private onClose() {
    if (this.pingTimer) clearInterval(this.pingTimer)
    this.pingTimer = null
    for (const p of this.pending.values()) p.reject(new Error('Lost the connection to Home Assistant'))
    this.pending.clear()
    if (this.status === 'connected') console.warn('[home assistant] connection lost — reconnecting')
    this.status = 'connecting'
    this.ws = null
    this.changed()
    setTimeout(() => this.start(), this.retryMs)
    this.retryMs = Math.min(this.retryMs * 2, 30_000)
  }

  private async onMessage(raw: string, token: string) {
    let msg: any
    try { msg = JSON.parse(raw) } catch { return }
    if (msg.type === 'auth_required') {
      this.ws?.send(JSON.stringify({ type: 'auth', access_token: token }))
    } else if (msg.type === 'auth_invalid') {
      console.error('[home assistant] the token was rejected:', msg.message)
      this.retryMs = 60_000
      this.ws?.close()
    } else if (msg.type === 'auth_ok') {
      this.retryMs = 2000
      try {
        await this.loadEverything()
        await this.command({ type: 'subscribe_events', event_type: 'state_changed' })
        for (const t of ['entity_registry_updated', 'device_registry_updated', 'area_registry_updated']) {
          await this.command({ type: 'subscribe_events', event_type: t }).catch(() => {})
        }
        this.status = 'connected'
        console.log(`[home assistant] connected · ${this.states.size} entities`)
        this.pingTimer = setInterval(() => { this.command({ type: 'ping' }).catch(() => this.ws?.close()) }, 30_000)
        this.changed()
      } catch (e) {
        console.error('[home assistant] setup failed:', e)
        this.ws?.close()
      }
    } else if (msg.type === 'result' || msg.type === 'pong') {
      const p = this.pending.get(msg.id)
      if (!p) return
      this.pending.delete(msg.id)
      if (msg.type === 'pong' || msg.success) p.resolve(msg.result)
      else p.reject(new Error(msg.error?.message ?? 'Home Assistant refused the request'))
    } else if (msg.type === 'event') {
      const e = msg.event
      if (e?.event_type === 'state_changed') {
        const { entity_id, new_state } = e.data
        if (new_state) this.states.set(entity_id, new_state)
        else this.states.delete(entity_id)
        this.changed()
      } else if (typeof e?.event_type === 'string' && e.event_type.endsWith('_registry_updated')) {
        await this.loadRegistries().catch(() => {})
        this.changed()
      }
    }
  }

  private async loadEverything() {
    const states = await this.command<HAState[]>({ type: 'get_states' })
    this.states = new Map(states.map((s) => [s.entity_id, s]))
    await this.loadRegistries()
  }

  private async loadRegistries() {
    try {
      const [ents, devs, areas] = await Promise.all([
        this.command<EntityEntry[]>({ type: 'config/entity_registry/list' }),
        this.command<DeviceEntry[]>({ type: 'config/device_registry/list' }),
        this.command<AreaEntry[]>({ type: 'config/area_registry/list' }),
      ])
      this.entities = new Map(ents.map((e) => [e.entity_id, e]))
      this.devices = new Map(devs.map((d) => [d.id, d]))
      this.areas = new Map(areas.map((a) => [a.area_id, a.name]))
    } catch (e) {
      console.warn('[home assistant] could not read rooms and device list:', e instanceof Error ? e.message : e)
    }
  }

  /** Send one WebSocket command and wait for its answer. */
  command<T = any>(msg: Record<string, unknown>): Promise<T> {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error("The dashboard can't reach Home Assistant right now"))
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error('Home Assistant took too long to answer')) }, 15_000)
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timeout); resolve(v) },
        reject: (e) => { clearTimeout(timeout); reject(e) },
      })
      ws.send(JSON.stringify({ ...msg, id }))
    })
  }

  /** Run a Home Assistant action, e.g. callService('light', 'turn_on', { brightness_pct: 50 }, ['light.lamp']) */
  callService(domain: string, service: string, data: Record<string, unknown> = {}, entityIds?: string[]) {
    return this.command({
      type: 'call_service', domain, service, service_data: data,
      ...(entityIds ? { target: { entity_id: entityIds } } : {}),
    })
  }

  /** Run an action that sends back an answer (like sonos.get_queue) and return that answer. */
  async callServiceForResponse<T = any>(domain: string, service: string, data: Record<string, unknown>, entityIds: string[]): Promise<T> {
    const result = await this.command<{ response?: T }>({
      type: 'call_service', domain, service, service_data: data,
      target: { entity_id: entityIds }, return_response: true,
    })
    return result?.response as T
  }

  /** Browse media (Sonos Favorites live here) */
  browse(entityId: string, contentType = '', contentId = '') {
    return this.command<BrowseItem>({
      type: 'media_player/browse_media', entity_id: entityId,
      ...(contentType ? { media_content_type: contentType } : {}),
      ...(contentId || contentType ? { media_content_id: contentId } : {}),
    })
  }

  /** Home Assistant's regular (REST) API, for things the WebSocket API doesn't offer. */
  async rest(path: string, init?: RequestInit): Promise<Response> {
    const conn = connection()
    if (!conn) throw new Error('Home Assistant is not configured')
    return fetch(conn.rest + path, {
      ...init,
      headers: { Authorization: `Bearer ${conn.token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(15_000),
    })
  }

  // ── Lookups ────────────────────────────────────────────────────────────
  all(domain: string): HAState[] {
    return [...this.states.values()].filter((s) => s.entity_id.startsWith(domain + '.') && !this.entities.get(s.entity_id)?.disabled_by)
  }
  platform(entityId: string): string | null { return this.entities.get(entityId)?.platform ?? null }
  area(entityId: string): string | null {
    const e = this.entities.get(entityId)
    const areaId = e?.area_id ?? (e?.device_id ? this.devices.get(e.device_id)?.area_id : null)
    return areaId ? this.areas.get(areaId) ?? null : null
  }
  name(s: HAState): string { return String(s.attributes.friendly_name ?? s.entity_id) }
  /** The device an entity belongs to */
  deviceOf(entityId: string): string | null { return this.entities.get(entityId)?.device_id ?? null }
  /** Every enabled entity from one integration (e.g. 'teslemetry'), optionally on one device */
  entitiesOf(platform: string | string[], deviceId?: string | null): HAState[] {
    const platforms = Array.isArray(platform) ? platform : [platform]
    return [...this.states.values()].filter((s) => {
      const e = this.entities.get(s.entity_id)
      return !!e && platforms.includes(e.platform) && !e.disabled_by && (!deviceId || e.device_id === deviceId)
    })
  }
  /** Every enabled entity on one device */
  entitiesOnDevice(deviceId: string): HAState[] {
    return [...this.states.values()].filter((s) => { const e = this.entities.get(s.entity_id); return !!e && e.device_id === deviceId && !e.disabled_by })
  }
}

export const ha = new HomeAssistant()
