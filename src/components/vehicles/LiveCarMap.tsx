import { useEffect, useRef, useState } from 'react'
import { DARK, loadMaps, mapsAuthFailed } from '../../lib/googleMaps'
import type { Tesla } from '../../types'

// A live Google map of the Tesla: the car (blue dot with an arrow for its
// heading), home, the trail of this drive (dotted) and — while navigating
// home — Google's route home (solid blue). Used small on the Tesla card
// (no touch, keeps everything in view) and large on the Vehicles page (drag,
// zoom, and a Follow button that keeps the car in view).

/* eslint-disable @typescript-eslint/no-explicit-any */
const BLUE = '#6fa8ff'
type LL = { lat: number; lon: number }
const ll = (p: LL) => ({ lat: p.lat, lng: p.lon })

const svgUrl = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
const carIcon = (heading: number | null) => svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="-22 -22 44 44">
    <circle r="20" fill="${BLUE}" fill-opacity="0.18"/>
    <circle r="12" fill="${BLUE}" stroke="#e8edf2" stroke-width="3"/>
    ${heading === null ? '<circle r="3.5" fill="#e8edf2"/>' : `<path d="M0 -6.5 L5 5 L0 2.4 L-5 5 Z" fill="#e8edf2" transform="rotate(${heading})"/>`}
  </svg>`)
const HOME_ICON = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="-13 -13 26 26">
    <circle r="11" fill="#e8edf2" stroke="#0e1318" stroke-width="1.5"/>
    <path d="M-5.5 1 L0 -4.5 L5.5 1 M-3.8 0 V5 H3.8 V0" fill="none" stroke="#161d24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`)

export interface LiveCarMapHandle { zoom: (by: number) => void }

export function LiveCarMap({ t, mapsKey, mode, follow = true, onUserMove, onError, handle, className = '' }: {
  t: Tesla
  mapsKey: string
  /** card: small, no touch, fits the car + home + route; page: full map */
  mode: 'card' | 'page'
  /** Keep the car (and the way home) in view as it moves */
  follow?: boolean
  /** The map was dragged (the page turns Follow off) */
  onUserMove?: () => void
  /** Google refused the key or didn't load — show something else */
  onError?: (why: string) => void
  handle?: (h: LiveCarMapHandle | null) => void
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const parts = useRef<any>({})
  const lastFit = useRef<{ at: LL; route: number } | null>(null)
  const [ready, setReady] = useState(false)
  const [size, setSize] = useState(0)
  // Re-frame when the map changes size (rotation, page layout settling)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let last = ''
    const ro = new ResizeObserver(() => {
      const now = `${el.clientWidth}x${el.clientHeight}`
      if (now !== last) { last = now; lastFit.current = null; setSize((n) => n + 1) }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const cb = useRef({ onUserMove, onError })
  cb.current = { onUserMove, onError }

  // Make the map once
  useEffect(() => {
    let gone = false
    const onAuth = () => cb.current.onError?.('Google didn’t accept the Maps key')
    window.addEventListener('panel-maps-auth', onAuth)
    if (mapsAuthFailed()) onAuth()
    loadMaps(mapsKey).then((gm) => {
      if (gone || !box.current) return
      const start = t.location ?? t.home ?? { lat: 33.427, lon: -117.612 }
      const map = new gm.Map(box.current, {
        center: ll(start), zoom: 14, styles: DARK, backgroundColor: '#0d1620',
        disableDefaultUI: true, clickableIcons: false, keyboardShortcuts: false,
        gestureHandling: mode === 'card' ? 'none' : 'greedy',
      })
      const line = (o: any) => new gm.Polyline({ map, clickable: false, ...o })
      parts.current = {
        gm, map,
        trail: line({
          strokeOpacity: 0, zIndex: 1,
          icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.55, strokeColor: BLUE, scale: mode === 'card' ? 2 : 3 }, offset: '0', repeat: mode === 'card' ? '8px' : '12px' }],
        }),
        casing: line({ strokeColor: '#0e1318', strokeOpacity: 0.65, strokeWeight: mode === 'card' ? 7 : 10, zIndex: 2 }),
        route: line({ strokeColor: BLUE, strokeOpacity: 1, strokeWeight: mode === 'card' ? 4 : 6, zIndex: 3 }),
        home: new gm.Marker({ map, clickable: false, zIndex: 4, icon: { url: HOME_ICON, scaledSize: new gm.Size(26, 26), anchor: new gm.Point(13, 13) } }),
        car: new gm.Marker({ map, clickable: false, zIndex: 5, optimized: false }),
        heading: undefined as number | null | undefined,
      }
      if (mode === 'page') map.addListener('dragstart', () => cb.current.onUserMove?.())
      handle?.({ zoom: (by) => map.setZoom((map.getZoom() ?? 14) + by) })
      setReady(true)
    }).catch((e) => cb.current.onError?.(e instanceof Error ? e.message : 'Couldn’t load Google Maps'))
    return () => { gone = true; window.removeEventListener('panel-maps-auth', onAuth); handle?.(null); parts.current = {} }
  }, [mapsKey, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the drawing up to date
  const loc = t.location
  useEffect(() => {
    const p = parts.current
    if (!ready || !p.map) return
    const { gm, map } = p
    const route = t.routeAhead ?? null
    const trail = t.trail ?? null
    p.route.setPath(route ? route.map(ll) : [])
    p.casing.setPath(route ? route.map(ll) : [])
    p.trail.setPath(trail ? trail.map(ll) : [])
    p.home.setPosition(t.home ? ll(t.home) : null)
    p.home.setVisible(!!t.home)
    p.car.setVisible(!!loc)
    if (loc) {
      p.car.setPosition(ll(loc))
      const h = t.heading ?? null
      if (p.heading !== h) {
        p.car.setIcon({ url: carIcon(h), scaledSize: new gm.Size(44, 44), anchor: new gm.Point(22, 22) })
        p.heading = h
      }
    }
    if (!follow || !loc) { lastFit.current = null; return }

    // Navigating home: keep the car, home and the route in view. Otherwise follow the car.
    const showHome = !!t.enRouteHome && !!t.home
    if (showHome) {
      const moved = !lastFit.current || dist(lastFit.current.at, loc) > 150 || lastFit.current.route !== (route?.length ?? 0)
      if (!moved) return
      const b = new gm.LatLngBounds()
      b.extend(ll(loc)); b.extend(ll(t.home!))
      for (const pt of route ?? []) b.extend(ll(pt))
      // Leave room for the overlays: the minutes chip (card) or the ETA box and buttons (page)
      map.fitBounds(b, mode === 'card' ? { top: 30, right: 18, bottom: 14, left: 18 } : { top: 140, right: 76, bottom: 40, left: 40 })
      lastFit.current = { at: loc, route: route?.length ?? 0 }
    } else {
      lastFit.current = null
      map.panTo(ll(loc))
      if (mode === 'card' && (map.getZoom() ?? 0) < 13) map.setZoom(14)
    }
  }, [ready, loc?.lat, loc?.lon, t.heading, t.routeAhead, t.trail, t.home, t.enRouteHome, follow, mode, size]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} className={className} aria-hidden={mode === 'card' || undefined} />
}

function dist(a: LL, b: LL) {
  const rad = Math.PI / 180, R = 6371000
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
