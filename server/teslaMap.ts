// The Tesla's live map extras: the trail of the current drive, and Google's
// route home (the "nav line").
//
// Trail: while the car drives, its positions are kept here (one every ~25 m)
// and cleared once it has been parked for 10 minutes. Nothing is saved to disk.
//
// Route: while the car is navigating home, Panel asks Google's Routes API for
// the driving route from the car to home — at most once a minute, plus right
// away when the destination changes. It uses Panel's google_maps_key; the key
// needs the Routes API turned on (see DOCS.md → Tesla map). If Google refuses,
// the map simply shows the trail and the reason goes to /api/setup-check.

import https from 'node:https'
import { env } from './env.ts'

export interface LatLon { lat: number; lon: number }

const R = 6371000
/** Meters between two points */
export function meters(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Compass bearing from a to b, in degrees (0 = north) */
export function bearing(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180
  const y = Math.sin((b.lon - a.lon) * rad) * Math.cos(b.lat * rad)
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lon - a.lon) * rad)
  return (Math.atan2(y, x) / rad + 360) % 360
}

let notify: () => void = () => {}
/** Called when a new route arrives, so open screens update */
export function onTeslaMapChange(fn: () => void) { notify = fn }

// ── Trail ────────────────────────────────────────────────────────────────
const TRAIL_STEP_M = 25
const TRAIL_MAX = 1500
const PARKED_RESET_MS = 10 * 60_000
let trail: LatLon[] = []
let lastDriving = 0

/** Record the car's position (call on every update) */
export function recordTrail(loc: LatLon | null, driving: boolean) {
  const now = Date.now()
  if (driving) {
    lastDriving = now
    if (loc && (!trail.length || meters(trail[trail.length - 1], loc) >= TRAIL_STEP_M)) {
      trail.push(loc)
      if (trail.length > TRAIL_MAX) trail = trail.filter((_, i) => i % 2 === 0) // thin out very long drives
    }
  } else if (trail.length && now - lastDriving > PARKED_RESET_MS) {
    trail = []
  }
}

/** This drive's trail, ending at the car (null when there isn't one) */
export function currentTrail(loc: LatLon | null): LatLon[] | null {
  if (trail.length < 2 && !(trail.length === 1 && loc)) return null
  const pts = [...trail]
  if (loc && meters(pts[pts.length - 1], loc) > 2) pts.push(loc)
  return pts
}

/** Direction of travel from the last bit of trail, when the car doesn't report a heading */
export function trailHeading(loc: LatLon | null): number | null {
  if (!loc || !trail.length) return null
  for (let i = trail.length - 1; i >= 0; i--) if (meters(trail[i], loc) > 15) return bearing(trail[i], loc)
  return null
}

// ── Route home (Google Routes API) ───────────────────────────────────────
const ROUTE_EVERY_MS = 60_000
const RETRY_AFTER_ERROR_MS = 5 * 60_000
interface Route { to: LatLon; points: LatLon[]; seconds: number | null; meters: number | null; at: number }
let route: Route | null = null
let inFlight = false
let lastTry = 0
let lastError: { text: string; at: number } | null = null

/** Google's encoded polyline → points */
export function decodePolyline(s: string): LatLon[] {
  const out: LatLon[] = []
  let i = 0, lat = 0, lon = 0
  while (i < s.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b: number
      do { b = s.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20 && i < s.length)
      const d = result & 1 ? ~(result >> 1) : result >> 1
      if (which === 0) lat += d; else lon += d
    }
    out.push({ lat: lat / 1e5, lon: lon / 1e5 })
  }
  return out
}

/** The address Panel is opened at, sent as the Referer so a website-restricted key accepts the request */
const panelUrl = () => env('PANEL_URL') ?? 'http://192.168.86.207:8099/'

function post(url: string, body: unknown, headers: Record<string, string>): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers }, timeout: 15_000 }, (res) => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { text += c })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text }))
    })
    req.on('timeout', () => req.destroy(new Error('Google didn’t answer in time')))
    req.on('error', reject)
    req.end(data)
  })
}

/** Plain-language reason for a refused request */
export function explain(status: number, text: string): string {
  let msg = ''
  try { msg = JSON.parse(text)?.error?.message ?? '' } catch { /* not JSON */ }
  if (/has not been used|is disabled|SERVICE_DISABLED/i.test(msg + text)) return 'The Routes API isn’t turned on for the Google Cloud project — turn it on in Cloud Console (APIs & Services → Library → Routes API)'
  if (/referer|referrer/i.test(msg + text)) return `Google refused the request because of the key’s website restriction — it needs to allow ${panelUrl()}*`
  if (/not authorized to use this (service or )?API|API_KEY_SERVICE_BLOCKED|blocked/i.test(msg + text)) return 'The Maps key isn’t allowed to use the Routes API — add “Routes API” to the key’s API restrictions in Cloud Console'
  if (/billing/i.test(msg + text)) return 'Google wants billing turned on for the Cloud project to use the Routes API'
  if (status === 400 || status === 403) return `Google refused the route request (${status})${msg ? `: ${msg}` : ''}`
  return `Google route request failed (${status || 'no answer'})`
}

async function fetchRoute(from: LatLon, to: LatLon) {
  const key = env('GOOGLE_MAPS_KEY')
  if (!key) return
  inFlight = true
  lastTry = Date.now()
  try {
    const res = await post('https://routes.googleapis.com/directions/v2:computeRoutes', {
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lon } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lon } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      polylineQuality: 'OVERVIEW',
    }, {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      Referer: panelUrl(),
    })
    if (res.status !== 200) {
      lastError = { text: explain(res.status, res.text), at: Date.now() }
      console.warn('[tesla route]', lastError.text)
      return
    }
    const r = JSON.parse(res.text)?.routes?.[0]
    const enc = r?.polyline?.encodedPolyline
    if (!enc) { lastError = { text: 'Google found no driving route home from here', at: Date.now() }; return }
    route = {
      to,
      points: decodePolyline(enc),
      seconds: typeof r.duration === 'string' ? Number.parseInt(r.duration, 10) : null,
      meters: typeof r.distanceMeters === 'number' ? r.distanceMeters : null,
      at: Date.now(),
    }
    lastError = null
    notify()
  } catch (e) {
    lastError = { text: e instanceof Error ? e.message : 'Google route request failed', at: Date.now() }
    console.warn('[tesla route]', lastError.text)
  } finally {
    inFlight = false
  }
}

/**
 * The route home for the map, while the car is navigating home (pass nulls
 * otherwise). Starts a refresh when it's due; returns what's known now.
 */
export function routeHome(from: LatLon | null, to: LatLon | null): LatLon[] | null {
  if (!from || !to || !env('GOOGLE_MAPS_KEY')) { route = null; return null }
  const sameDest = route && meters(route.to, to) < 200
  if (!sameDest) route = null
  const now = Date.now()
  const due = !route || now - route.at > ROUTE_EVERY_MS
  // After a refusal, wait a few minutes before asking again (it's usually a setup step)
  const waitError = !!lastError && now - lastError.at < RETRY_AFTER_ERROR_MS
  if (due && !inFlight && !waitError && now - lastTry > 10_000) void fetchRoute(from, to)
  if (!route) return null
  // Drop the part of the route already driven: start from the point nearest the car
  let best = 0, bestD = Infinity
  for (let i = 0; i < route.points.length; i++) {
    const d = meters(route.points[i], from)
    if (d < bestD) { bestD = d; best = i }
  }
  return [from, ...route.points.slice(best + 1)]
}

/** For /api/setup-check */
export function routeNotes() {
  return {
    routesApi: lastError ? `Not working: ${lastError.text}` : route ? `Working (last route ${Math.round((Date.now() - route.at) / 1000)} s ago)` : env('GOOGLE_MAPS_KEY') ? 'Not tried yet (asks Google only while the car is navigating home)' : 'No google_maps_key set',
  }
}
