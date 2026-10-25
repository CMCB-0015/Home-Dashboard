// Sonos, through Home Assistant.
//
// Music plays from Sonos Favorites (Tidal playlists saved as Favorites in the
// Sonos app). A quick-play preset = a Favorite + speakers + a volume for each +
// shuffle. Starting one groups those speakers (pulling them out of any other
// group), sets the volumes, starts the Favorite and sets shuffle.

import type { QueueItem, SonosFavorite, SonosPreset, SonosSpeaker, SonosState } from '../src/types.ts'
import { HOME, matchName } from '../src/config/home.ts'
import { ha, type BrowseItem, type HAState } from './ha.ts'
import { cacheGet, cacheSet } from './cache.ts'

// ── Speakers ─────────────────────────────────────────────────────────────

function sonosPlayers(): HAState[] {
  return ha.all('media_player').filter((p) => ha.platform(p.entity_id) === 'sonos')
}

const available = (p: HAState) => p.state !== 'unavailable' && p.state !== 'unknown'

function groupOf(p: HAState): string[] {
  const g = p.attributes.group_members
  return Array.isArray(g) && g.length ? g : [p.entity_id]
}

function speakers(): SonosSpeaker[] {
  return sonosPlayers()
    .map((p) => ({
      id: p.entity_id,
      name: ha.name(p),
      room: ha.area(p.entity_id),
      available: available(p),
      volumePct: Math.round((Number(p.attributes.volume_level) || 0) * 100),
      state: p.state,
      group: groupOf(p),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const nameOf = (id: string) => { const s = ha.states.get(id); return s ? ha.name(s) : id }
const joinNames = (ids: string[]) => ids.map(nameOf).join(' + ')

// ── Favorites ────────────────────────────────────────────────────────────

let favorites: SonosFavorite[] = []
let favoritesError: string | null = null

/** Album art from Home Assistant goes through the dashboard, so the tablet doesn't need its own Home Assistant login */
export function imageUrl(pic: unknown): string | null {
  if (typeof pic !== 'string' || !pic) return null
  if (pic.startsWith('/')) return `/api/ha-image?p=${encodeURIComponent(pic)}`
  return pic.startsWith('https://') ? pic : null
}

const KIND: Record<string, string> = { playlist: 'Playlist', album: 'Album', track: 'Track', artist: 'Artist', radio: 'Radio', podcast: 'Podcast' }

/** Read the Sonos Favorites from Home Assistant's media browser (or the Sonos favorites sensor). */
export async function refreshFavorites(): Promise<void> {
  if (ha.status !== 'connected') return
  const player = sonosPlayers().find(available)
  if (!player) return
  const found: SonosFavorite[] = []
  const queue: { item: BrowseItem; depth: number; folder: string }[] = []
  const walk = (item: BrowseItem, depth: number, folder: string) => {
    for (const c of item.children ?? []) {
      if (c.media_content_type === 'favorite_item_id' || (c.can_play && !c.can_expand && depth > 0)) {
        if (!found.some((f) => f.id === c.media_content_id)) {
          found.push({ id: c.media_content_id, name: c.title, kind: KIND[c.media_class ?? ''] ?? folder, art: imageUrl(c.thumbnail) })
        }
      } else if (c.can_expand && depth < 2) {
        queue.push({ item: c, depth: depth + 1, folder: c.title })
      }
    }
  }
  try {
    walk(await ha.browse(player.entity_id, 'favorites', ''), 0, 'Favorite')
    while (queue.length) {
      const next = queue.shift()!
      walk(await ha.browse(player.entity_id, next.item.media_content_type, next.item.media_content_id), next.depth, next.folder)
    }
    favoritesError = null
  } catch (e) {
    favoritesError = e instanceof Error ? e.message : String(e)
  }
  // Fallback: the "Sonos favorites" sensor (turned off by default in Home Assistant)
  if (!found.length) {
    const sensor = ha.all('sensor').find((s) => ha.platform(s.entity_id) === 'sonos' && s.attributes.items && typeof s.attributes.items === 'object')
    for (const [id, name] of Object.entries((sensor?.attributes.items ?? {}) as Record<string, string>)) {
      found.push({ id, name: String(name), kind: 'Favorite', art: null })
    }
  }
  if (found.length || !favoritesError) favorites = found.sort((a, b) => a.name.localeCompare(b.name))
  if (favoritesError) console.warn('[sonos] could not read Sonos Favorites:', favoritesError)
}

// ── Presets ──────────────────────────────────────────────────────────────

interface ResolvedPreset {
  preset: SonosPreset
  favorite?: SonosFavorite
  speakers: { id: string; volume: number }[]
  problems: string[]
}

// Quick-play buttons saved from the Sonos page. Kept in the app's /data
// folder, so they survive restarts and updates. They store exact speaker and
// Favorite ids (no name matching), with the Favorite's name as a fallback.
export interface SavedPreset {
  id: string; name: string
  favoriteId: string; favoriteName: string
  speakers: { id: string; volume: number }[]
  shuffle: boolean
}
const SAVED_KEY = 'sonos-saved-presets'
const MAX_SAVED = 20
let saved: SavedPreset[] = []
void cacheGet<SavedPreset[]>(SAVED_KEY).then((s) => { saved = Array.isArray(s) ? s : [] })

function resolveSaved(all: SonosSpeaker[]): ResolvedPreset[] {
  return saved.map((p) => {
    const problems: string[] = []
    const fav = favorites.find((f) => f.id === p.favoriteId) ?? favorites.find((f) => f.name.toLowerCase() === p.favoriteName.toLowerCase())
    if (!fav) problems.push(favorites.length ? `The Sonos Favorite "${p.favoriteName}" is gone` : 'No Sonos Favorites found yet')
    const spk = p.speakers.filter((s) => {
      const found = all.some((x) => x.id === s.id)
      if (!found) problems.push(`A speaker in this button is no longer in Home Assistant (${s.id})`)
      return found
    })
    const vols = [...new Set(p.speakers.map((s) => s.volume))]
    return {
      favorite: fav,
      speakers: spk,
      problems,
      preset: {
        id: p.id,
        name: p.name,
        where: p.speakers.map((s) => nameOf(s.id)).join(' + ') + (p.shuffle ? ' · Shuffle' : ''),
        volume: `Vol ${vols.join('/')}`,
        shuffle: p.shuffle,
        available: problems.length === 0,
        reason: problems[0],
        saved: true,
        favorite: fav?.name ?? p.favoriteName,
      },
    }
  })
}

function cleanName(raw: unknown): string {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!name) throw new Error('Give the button a name')
  if (name.length > 30) throw new Error('Keep the name to 30 characters or fewer')
  return name
}

function nameTaken(name: string, exceptId?: string) {
  const lower = name.toLowerCase()
  return [...HOME.sonos.presets.map((p) => ({ id: p.id, name: p.name })), ...saved].some((p) => p.id !== exceptId && p.name.toLowerCase() === lower)
}

/** Save the picked speakers + Favorite + volumes + shuffle as a new quick-play button. */
export async function savePreset(body: { name?: unknown; favoriteId?: unknown; speakers?: unknown; shuffle?: unknown }) {
  const name = cleanName(body.name)
  if (nameTaken(name)) throw new Error(`There's already a quick-play button called "${name}"`)
  if (saved.length >= MAX_SAVED) throw new Error(`That's ${MAX_SAVED} saved buttons — delete one first`)
  const fav = favorites.find((f) => f.id === String(body.favoriteId))
  if (!fav) throw new Error('Pick a Sonos Favorite to play')
  const all = speakers()
  const list = Array.isArray(body.speakers) ? body.speakers : []
  const spk = list.map((s: any) => ({ id: String(s?.id), volume: Math.round(Number(s?.volume)) }))
  if (!spk.length) throw new Error('Pick at least one speaker first')
  for (const s of spk) {
    if (!all.some((x) => x.id === s.id)) throw new Error('One of those speakers isn\u2019t a Sonos speaker')
    if (!Number.isFinite(s.volume) || s.volume < 0 || s.volume > 100) throw new Error('Volume must be 0–100')
  }
  if (new Set(spk.map((s) => s.id)).size !== spk.length) throw new Error('A speaker is listed twice')
  const preset: SavedPreset = { id: `saved-${Date.now().toString(36)}`, name, favoriteId: fav.id, favoriteName: fav.name, speakers: spk, shuffle: body.shuffle === true }
  saved = [...saved, preset]
  await cacheSet(SAVED_KEY, saved)
}

export async function renamePreset(body: { id?: unknown; name?: unknown }) {
  const id = String(body.id)
  const p = saved.find((x) => x.id === id)
  if (!p) throw new Error('Only buttons saved from the dashboard can be renamed')
  const name = cleanName(body.name)
  if (nameTaken(name, id)) throw new Error(`There's already a quick-play button called "${name}"`)
  saved = saved.map((x) => (x.id === id ? { ...x, name } : x))
  if (started?.name === p.name) { started = { ...started, name }; await cacheSet(STARTED_KEY, started) }
  await cacheSet(SAVED_KEY, saved)
}

export async function deletePreset(body: { id?: unknown }) {
  const id = String(body.id)
  if (!saved.some((x) => x.id === id)) throw new Error('Only buttons saved from the dashboard can be deleted')
  saved = saved.filter((x) => x.id !== id)
  await cacheSet(SAVED_KEY, saved)
}

function resolvePresets(all: SonosSpeaker[]): ResolvedPreset[] {
  return [...resolveConfigPresets(all), ...resolveSaved(all)]
}

function resolveConfigPresets(all: SonosSpeaker[]): ResolvedPreset[] {
  return HOME.sonos.presets.map((p) => {
    const problems: string[] = []
    const fav = matchName(p.favorite, favorites)
    if (!fav.item) problems.push(favorites.length ? `Sonos Favorite: ${fav.reason}` : 'No Sonos Favorites found yet')
    const spk = p.speakers.map((s) => {
      const m = matchName(s.name, all)
      if (!m.item) problems.push(`Speaker: ${m.reason}`)
      return m.item ? { id: m.item.id, volume: s.volume as number } : null
    }).filter((s): s is { id: string; volume: number } => !!s)
    const vols = [...new Set(p.speakers.map((s) => s.volume))]
    return {
      favorite: fav.item,
      speakers: spk,
      problems,
      preset: {
        id: p.id,
        name: p.name,
        where: p.speakers.map((s) => s.name).join(' + ') + (p.shuffle ? ' · Shuffle' : ''),
        volume: `Vol ${vols.join('/')}`,
        shuffle: p.shuffle,
        available: problems.length === 0,
        reason: problems[0],
        favorite: fav.item?.name ?? p.favorite,
      },
    }
  })
}

// ── What's playing ───────────────────────────────────────────────────────

interface Started { leaderId: string; name: string; at: number }
const STARTED_KEY = 'sonos-started'
let started: Started | null = null
void cacheGet<Started>(STARTED_KEY).then((s) => { started = s })

/** The group to show on the card: the one the dashboard last started, else whatever's playing. */
function leader(): HAState | null {
  const players = sonosPlayers().filter(available)
  if (!players.length) return null
  const lead = (p: HAState) => groupOf(p)[0] === p.entity_id
  const last = started ? ha.states.get(started.leaderId) : undefined
  if (last && available(last) && lead(last) && last.state !== 'idle') return last
  return players.find((p) => p.state === 'playing' && lead(p))
    ?? players.find((p) => p.state === 'paused' && lead(p))
    ?? (last && available(last) ? last : null)
    ?? players.find(lead) ?? players[0]
}

export function sonosState(): SonosState | null {
  const all = speakers()
  if (!all.length) return null
  const p = leader()
  const a = p?.attributes ?? {}
  const playing = p?.state === 'playing'
  const updated = typeof a.media_position_updated_at === 'string' ? Date.parse(a.media_position_updated_at) : Date.now()
  const position = (Number(a.media_position) || 0) + (playing ? Math.max(0, (Date.now() - updated) / 1000) : 0)
  const members = p ? groupOf(p) : []
  const groupVolume = members.length
    ? Math.round(members.reduce((t, id) => t + (Number(ha.states.get(id)?.attributes.volume_level) || 0), 0) / members.length * 100)
    : 0
  const idle = !p || p.state === 'idle' || (!a.media_title && !playing)
  return {
    id: p?.entity_id,
    room: p ? joinNames(members) : 'Sonos',
    groupSize: members.length,
    playing,
    title: idle ? 'Nothing playing' : String(a.media_title ?? ''),
    subtitle: idle ? '' : String(a.media_artist ?? a.media_album_name ?? a.source ?? ''),
    artUrl: idle ? null : imageUrl(a.entity_picture),
    positionSec: Math.round(position),
    durationSec: Math.max(1, Math.round(Number(a.media_duration) || 1)),
    volumePct: groupVolume,
    shuffle: !!a.shuffle,
    from: started && p && started.leaderId === p.entity_id && !idle ? started.name : null,
    speakers: all,
    favorites,
    presets: resolvePresets(all).map((r) => r.preset),
    groupChips: HOME.sonos.groupChips.map((c) => ({
      label: c.label,
      speakerIds: (c.speakers as readonly string[]).includes('*') ? all.map((s) => s.id) : c.speakers.map((n) => matchName(n, all).item?.id).filter((x): x is string => !!x),
    })),
  }
}

/** Names in the settings that didn't match, for the setup check */
export function sonosNotes(): string[] {
  const all = speakers()
  const notes = resolvePresets(all).flatMap((r) => r.problems.map((p) => `Quick play "${r.preset.name}": ${p}`))
  if (favoritesError) notes.push(`Couldn't read Sonos Favorites: ${favoritesError}`)
  return notes
}

// ── Commands ─────────────────────────────────────────────────────────────

function needReachable(ids: string[]) {
  for (const id of ids) {
    const s = ha.states.get(id)
    if (!s) throw new Error('That speaker isn’t in Home Assistant')
    if (!available(s)) throw new Error(`${ha.name(s)} isn’t reachable — it may be asleep, in Bluetooth mode or off Wi-Fi`)
  }
}

/** Group exactly these speakers (first one leads), set volumes, play the Favorite, set shuffle. */
export async function playOn(favoriteId: string, speakerIds: string[], opts: { volumes?: Record<string, number>; shuffle?: boolean; name?: string } = {}) {
  const fav = favorites.find((f) => f.id === favoriteId)
  if (!fav) throw new Error('That Sonos Favorite isn’t there anymore — check the Sonos app')
  const ids = [...new Set(speakerIds)].filter((id) => typeof id === 'string')
  if (!ids.length) throw new Error('Pick at least one speaker first')
  needReachable(ids)
  const [lead, ...rest] = ids

  // Group them, unless they're already grouped exactly like this
  const current = groupOf(ha.states.get(lead)!)
  const same = current[0] === lead && current.length === ids.length && ids.every((id) => current.includes(id))
  if (!same) {
    for (const id of ids) if (groupOf(ha.states.get(id)!).length > 1) await ha.callService('media_player', 'unjoin', {}, [id]).catch(() => {})
    if (rest.length) await ha.callService('media_player', 'join', { group_members: rest }, [lead])
  }
  for (const [id, v] of Object.entries(opts.volumes ?? {})) {
    if (ids.includes(id)) await ha.callService('media_player', 'volume_set', { volume_level: Math.max(0, Math.min(100, v)) / 100 }, [id])
  }
  try {
    await ha.callService('media_player', 'play_media', { media_content_type: 'favorite_item_id', media_content_id: fav.id, enqueue: 'replace' }, [lead])
  } catch (e) {
    throw new Error(`Sonos couldn’t play "${fav.name}" — if it’s a Tidal playlist, check that Tidal is still signed in in the Sonos app (${e instanceof Error ? e.message : e})`)
  }
  if (typeof opts.shuffle === 'boolean') await ha.callService('media_player', 'shuffle_set', { shuffle: opts.shuffle }, [lead]).catch(() => {})
  started = { leaderId: lead, name: opts.name ?? fav.name, at: Date.now() }
  await cacheSet(STARTED_KEY, started)
}

export async function playPreset(id: string) {
  const r = resolvePresets(speakers()).find((x) => x.preset.id === id)
  if (!r) throw new Error('Unknown quick-play button')
  if (!r.favorite || r.problems.length) throw new Error(r.preset.reason ?? 'That quick-play button isn’t set up')
  await playOn(r.favorite.id, r.speakers.map((s) => s.id), {
    volumes: Object.fromEntries(r.speakers.map((s) => [s.id, s.volume])),
    shuffle: r.preset.shuffle,
    name: r.preset.name,
  })
}

export async function sonosCommand(body: { command?: string; value?: unknown; speakerId?: string }) {
  // Volume for one speaker (Sonos page)
  if (body.command === 'speaker-volume') {
    if (!body.speakerId) throw new Error('Which speaker?')
    needReachable([body.speakerId])
    return ha.callService('media_player', 'volume_set', { volume_level: Math.max(0, Math.min(100, Number(body.value) || 0)) / 100 }, [body.speakerId])
  }
  const p = leader()
  if (!p) throw new Error('No Sonos speaker is reachable right now')
  const id = [p.entity_id]
  switch (body.command) {
    case 'play': return ha.callService('media_player', 'media_play', {}, id)
    case 'pause': return ha.callService('media_player', 'media_pause', {}, id)
    case 'next': return ha.callService('media_player', 'media_next_track', {}, id)
    case 'previous': return ha.callService('media_player', 'media_previous_track', {}, id)
    case 'shuffle': return ha.callService('media_player', 'shuffle_set', { shuffle: !!body.value }, id)
    case 'volume': {
      // Group volume: move every speaker by the same amount, so their balance stays the same
      const members = groupOf(p).filter((m) => ha.states.get(m) && available(ha.states.get(m)!))
      const vols = members.map((m) => Math.round((Number(ha.states.get(m)!.attributes.volume_level) || 0) * 100))
      const avg = vols.reduce((t, v) => t + v, 0) / Math.max(1, vols.length)
      const delta = Math.max(0, Math.min(100, Number(body.value) || 0)) - avg
      await Promise.all(members.map((m, i) =>
        ha.callService('media_player', 'volume_set', { volume_level: Math.max(0, Math.min(100, Math.round(vols[i] + delta))) / 100 }, [m])))
      return
    }
    default: throw new Error('Unknown Sonos command')
  }
}

/** What's coming up in the queue of the group that's playing */
export async function getQueue(): Promise<{ from: string | null; items: QueueItem[] }> {
  const p = leader()
  if (!p) throw new Error('No Sonos speaker is reachable right now')
  const res = await ha.callServiceForResponse<Record<string, any[]>>('sonos', 'get_queue', {}, [p.entity_id])
  const list = (res?.[p.entity_id] ?? Object.values(res ?? {})[0] ?? []) as any[]
  const title = p.attributes.media_title, artist = p.attributes.media_artist
  let current = typeof p.attributes.queue_position === 'number' ? p.attributes.queue_position : -1
  if (current < 0 || current >= list.length) current = list.findIndex((t) => t.media_title === title && (!artist || t.media_artist === artist))
  const items: QueueItem[] = list.map((t, i) => ({ position: i, title: String(t.media_title ?? ''), artist: String(t.media_artist ?? ''), current: i === current }))
  const upcoming = current >= 0 ? items.slice(current, current + 26) : items.slice(0, 25)
  return { from: started && started.leaderId === p.entity_id ? started.name : null, items: upcoming }
}

export async function jumpToQueue(position: number) {
  const p = leader()
  if (!p) throw new Error('No Sonos speaker is reachable right now')
  if (!Number.isInteger(position) || position < 0) throw new Error('That song isn’t in the queue')
  await ha.callService('sonos', 'play_queue', { queue_position: position }, [p.entity_id])
}
