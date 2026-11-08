import { useEffect, useState } from 'react'
import { loadMaps } from '../../lib/googleMaps'
import type { Tesla } from '../../types'

/*
 * The road the car is on while driving ("PCH · Dana Point"), like the Tesla
 * app. Asked of Google's Geocoding service through the Maps script the
 * browser already loads (so a website-restricted key works) — at most once a
 * minute, and only after the car has moved 150 m. Needs the Geocoding API
 * turned on for the same google_maps_key; without it the road is just left
 * out. Never asked while parked, so the card never names where the car is
 * parked away from home.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const EVERY_MS = 60_000
const MOVE_M = 150
const WAIT_AFTER_ERROR_MS = 5 * 60_000

interface Spot { lat: number; lon: number }
let last: { at: number; at2: Spot; text: string | null } | null = null
let busy = false
let errorAt = 0
const listeners = new Set<(t: string | null) => void>()

function meters(a: Spot, b: Spot) {
  const rad = Math.PI / 180, R = 6371000
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** "PCH · Dana Point" from a Google geocoding result */
export function roadName(results: any[]): string | null {
  const list = Array.isArray(results) ? results : []
  const all = list.flatMap((r) => (Array.isArray(r?.address_components) ? r.address_components : []))
  const pick = (type: string) => all.find((c: any) => Array.isArray(c?.types) && c.types.includes(type))
  const road = pick('route')?.short_name ?? null
  const town = (pick('locality') ?? pick('postal_town') ?? pick('sublocality') ?? pick('administrative_area_level_3'))?.long_name ?? null
  const parts = [road, town].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

async function lookUp(key: string, here: Spot) {
  busy = true
  try {
    const maps = await loadMaps(key)
    const geocoder = new maps.Geocoder()
    const res = await geocoder.geocode({ location: { lat: here.lat, lng: here.lon } })
    last = { at: Date.now(), at2: here, text: roadName(res?.results) }
    listeners.forEach((fn) => fn(last!.text))
  } catch (e: any) {
    errorAt = Date.now()
    // Usually REQUEST_DENIED: the Geocoding API isn't turned on for the key
    console.warn('[tesla road] Google wouldn’t name the road — is the Geocoding API turned on for the Maps key?', e?.code ?? e?.message ?? e)
  } finally {
    busy = false
  }
}

export function useRoadName(t: Tesla | null | undefined, mapsKey: string | null): string | null {
  const [text, setText] = useState<string | null>(last?.text ?? null)
  const driving = !!t?.driving
  const lat = t?.location?.lat, lon = t?.location?.lon

  useEffect(() => {
    listeners.add(setText)
    return () => { listeners.delete(setText) }
  }, [])

  useEffect(() => {
    if (!driving || !mapsKey || lat === undefined || lon === undefined) return
    const here = { lat, lon }
    const now = Date.now()
    const due = !last || (now - last.at > EVERY_MS && meters(last.at2, here) > MOVE_M)
    if (due && !busy && now - errorAt > WAIT_AFTER_ERROR_MS) void lookUp(mapsKey, here)
  }, [driving, mapsKey, lat, lon])

  return driving ? text : null
}
