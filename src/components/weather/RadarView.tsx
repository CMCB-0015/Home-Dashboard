import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Minus, Pause, Play, Plus, X } from 'lucide-react'
import { DARK, loadMaps, mapsAuthFailed } from '../../lib/googleMaps'

// Rain radar: the last hour from the National Weather Service, in 5-minute
// frames, looping over a dark Google map centered on the house.
//
// Radar pictures: Iowa State University's free tile service (Iowa Environmental
// Mesonet), NEXRAD base reflectivity — "nexrad-n0q-900913" is the latest scan,
// "-m05m" … "-m55m" the ones 5 to 55 minutes older. Fetched only while this is open.
// Map: the Google Maps JavaScript API, with the key from Panel's Configuration tab.

const IEM = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0'
const FRAMES = 12
const layerName = (i: number) => (i === FRAMES - 1 ? 'nexrad-n0q-900913' : `nexrad-n0q-900913-m${String((FRAMES - 1 - i) * 5).padStart(2, '0')}m`)
/** Each frame shows this long while playing (crossfade included) */
const STEP_MS = 420
/** Blend from one frame into the next */
const FADE_MS = 360
/** Extra steps to rest on the latest frame before looping (about 1.7 s) */
const HOLD_LAST = 4
/** Radar opacity over the map */
const OP = 0.75
/** Start playing anyway if some frames are slow to load */
const LOAD_TIMEOUT_MS = 10_000
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const ease = (t: number) => t * t * (3 - 2 * t)

const frameTime = (i: number, base: number) => {
  if (i === FRAMES - 1) return 'Now'
  return new Date(base - (FRAMES - 1 - i) * 5 * 60_000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function NoKey() {
  const step = 'grid grid-cols-[24px_minmax(0,1fr)] gap-2.5'
  const num = 'flex h-6 w-6 items-center justify-center rounded-full bg-weather-dim text-xs font-semibold text-weather'
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto rounded-xl border border-edge bg-surface p-4 text-sm leading-relaxed">
      <p className="font-semibold">Radar needs a Google Maps key (one time, free for home use)</p>
      <div className={step}><span className={num}>1</span><span>Google Cloud Console → the <b>Home Assistant Dashboard</b> project → APIs &amp; Services → Library → turn on <b>Maps JavaScript API</b>. (Google asks for a billing account on the project; the free monthly allowance covers a home dashboard.)</span></div>
      <div className={step}><span className={num}>2</span><span>Credentials → Create credentials → <b>API key</b>. Restrict it to the Maps JavaScript API, and to the website <span className="font-mono text-xs">http://192.168.86.207:8099/*</span>.</span></div>
      <div className={step}><span className={num}>3</span><span>Home Assistant → Settings → Apps → Panel → Configuration: paste it into <b>google_maps_key</b>, Save, restart Panel.</span></div>
    </div>
  )
}

/**
 * Opens over the weather card and starts playing at once. Tap the timeline to
 * stop on a frame; pinch or +/− to zoom; the corner button goes full screen.
 */
export function RadarView({ lat, lon, mapsKey, place, onClose }: { lat: number; lon: number; mapsKey: string | null; place: string; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const layers = useRef<any[]>([])
  const [full, setFull] = useState(false)
  const [frame, setFrame] = useState(FRAMES - 1)
  const [playing, setPlaying] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [base] = useState(() => Math.floor(Date.now() / 300_000) * 300_000)
  const hold = useRef(0)
  // Which frames have all their tiles loaded for the current view; the loop waits for all 12
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set())
  const [timedOut, setTimedOut] = useState(false)
  const [view, setView] = useState(0)
  const ready = loaded.size >= FRAMES || timedOut
  const shown = useRef(FRAMES - 1)

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (full) setFull(false); else onClose() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [full, onClose])

  // Load the map and the 12 radar frames (all loaded up front, shown one at a time)
  useEffect(() => {
    if (!mapsKey) return
    let gone = false
    const onAuth = () => setError('Google didn’t accept the Maps key — check google_maps_key and that the Maps JavaScript API is on for it')
    window.addEventListener('panel-maps-auth', onAuth)
    if (mapsAuthFailed()) onAuth()
    loadMaps(mapsKey).then((gm) => {
      if (gone || !box.current) return
      const m = new gm.Map(box.current, {
        center: { lat, lng: lon }, zoom: 8, minZoom: 4, maxZoom: 12, styles: DARK, backgroundColor: '#0d1620',
        disableDefaultUI: true, gestureHandling: 'greedy', clickableIcons: false, keyboardShortcuts: false,
      })
      map.current = m
      const bust = String(base)
      layers.current = Array.from({ length: FRAMES }, (_, i) => {
        const t = new gm.ImageMapType({
          name: layerName(i), tileSize: new gm.Size(256, 256), opacity: i === FRAMES - 1 ? OP : 0,
          getTileUrl: (c: { x: number; y: number }, z: number) => {
            const n = 1 << z
            if (c.y < 0 || c.y >= n) return null
            return `${IEM}/${layerName(i)}/${z}/${((c.x % n) + n) % n}/${c.y}.png?t=${bust}`
          },
        })
        t.addListener?.('tilesloaded', () => { if (!gone) setLoaded((prev) => (prev.has(i) ? prev : new Set(prev).add(i))) })
        m.overlayMapTypes.push(t)
        return t
      })
      // Zooming or moving needs new tiles: wait for them again before playing on
      m.addListener?.('zoom_changed', () => { setLoaded(new Set()); setView((v) => v + 1) })
      m.addListener?.('dragend', () => { setLoaded(new Set()); setView((v) => v + 1) })
      // The house
      new gm.Marker({ position: { lat, lng: lon }, map: m, clickable: false, icon: { path: gm.SymbolPath.CIRCLE, scale: 11, strokeColor: '#f2c14e', strokeWeight: 2.5, fillOpacity: 0 } })
      new gm.Marker({ position: { lat, lng: lon }, map: m, clickable: false, icon: { path: gm.SymbolPath.CIRCLE, scale: 4.5, fillColor: '#f2c14e', fillOpacity: 1, strokeWeight: 0 } })
    }).catch((e) => { if (!gone) setError(e instanceof Error ? e.message : 'Couldn’t load Google Maps') })
    return () => { gone = true; window.removeEventListener('panel-maps-auth', onAuth); layers.current = []; map.current = null }
  }, [mapsKey, lat, lon, base])

  // Never wait forever: if some frames are slow, play what's there after 10 s
  useEffect(() => {
    if (!mapsKey) return
    setTimedOut(false)
    const t = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [mapsKey, view])

  // Crossfade from the frame on screen into the new one: the new frame fades in
  // first and the old one fades out a little behind it, so the rain never dims mid-blend
  useEffect(() => {
    const ls = layers.current
    const from = shown.current, to = frame
    shown.current = to
    if (!ls.length) return
    const snap = () => ls.forEach((t, i) => t.setOpacity(i === to ? OP : 0))
    if (from === to || reduceMotion()) { snap(); return }
    ls.forEach((t, i) => { if (i !== from && i !== to) t.setOpacity(0) })
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / FADE_MS)
      ls[to].setOpacity(OP * ease(Math.min(1, p * 1.6)))
      ls[from].setOpacity(OP * (1 - ease(Math.max(0, (p - 0.35) / 0.65))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); snap() }
  }, [frame])

  // Play once every frame has loaded: step through the hour, rest on the latest frame, loop
  useEffect(() => {
    if (!playing || !ready) return
    const t = setInterval(() => {
      setFrame((f) => {
        if (f === FRAMES - 1 && hold.current < HOLD_LAST) { hold.current++; return f }
        hold.current = 0
        return (f + 1) % FRAMES
      })
    }, STEP_MS)
    return () => clearInterval(t)
  }, [playing, ready])

  const zoom = useCallback((d: number) => { const m = map.current; if (m) m.setZoom(m.getZoom() + d) }, [])
  const pick = (i: number) => { setPlaying(false); setFrame(i) }

  const playBtn = (
    <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-bg hover:opacity-90">
      {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
    </button>
  )
  const timeline = (
    <div className="relative h-11 min-w-0 flex-1">
      <span className="absolute left-0 top-0 font-mono text-[11px] text-ink-dim">{frameTime(0, base)}</span>
      <span className="absolute top-0 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] font-medium text-ink" style={{ left: `${((frame + 0.5) / FRAMES) * 100}%` }}>{frameTime(frame, base)}</span>
      <span className="absolute right-0 top-0 font-mono text-[11px] text-ink-dim">{frame === FRAMES - 1 ? '' : 'Now'}</span>
      <div className="absolute inset-x-0 top-[18px] grid grid-cols-12 gap-[3px]" role="group" aria-label="Radar time">
        {Array.from({ length: FRAMES }, (_, i) => (
          <button key={i} onClick={() => pick(i)} aria-label={`Show ${frameTime(i, base)}`} aria-pressed={i === frame} className="flex h-[26px] items-center">
            <span className="block h-1.5 w-full rounded-full" style={{ background: i < frame ? 'var(--color-weather)' : i === frame ? 'var(--color-ink)' : '#33404c' }} />
          </button>
        ))}
      </div>
    </div>
  )
  const legend = (
    <span className="flex shrink-0 items-center gap-2 text-[11px] text-ink-dim">Light<span className="h-1.5 w-[110px] rounded-full" style={{ background: 'linear-gradient(90deg,#3fbf5a,#f2d14e,#f08a3c,#e8483f)' }} />Heavy</span>
  )
  const zoomBtns = (
    <div className="absolute right-3 top-3 z-[1] flex flex-col overflow-hidden rounded-xl border border-[#33404c]">
      <button onClick={() => zoom(1)} aria-label="Zoom in" className="flex h-11 w-11 items-center justify-center bg-[rgba(22,29,36,.92)] text-ink hover:bg-surface-raised"><Plus size={18} /></button>
      <button onClick={() => zoom(-1)} aria-label="Zoom out" className="flex h-11 w-11 items-center justify-center border-t border-[#33404c] bg-[rgba(22,29,36,.92)] text-ink hover:bg-surface-raised"><Minus size={18} /></button>
    </div>
  )
  const mapArea = (
    <div className={`relative min-h-0 flex-1 overflow-hidden bg-[#0d1620] ${full ? '' : 'rounded-xl'}`}>
      {mapsKey ? <div ref={box} className="absolute inset-0" /> : <div className="absolute inset-0"><NoKey /></div>}
      {mapsKey && !error && zoomBtns}
      {mapsKey && !error && !ready && (
        <div role="status" className="pointer-events-none absolute left-1/2 top-3 z-[1] flex h-9 -translate-x-1/2 items-center gap-2 rounded-full border border-[#33404c] bg-[rgba(22,29,36,.92)] px-3.5 text-xs font-medium text-ink">
          <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-weather border-t-transparent" />
          Loading radar · {loaded.size} of {FRAMES}
        </div>
      )}
      {error && <div className="absolute inset-x-3 top-3 z-[1] rounded-xl border border-[#f0b24a] bg-[#2a2418] px-3.5 py-2.5 text-sm">{error}</div>}
    </div>
  )

  // The map stays in the same place in the page when going full screen, so it isn't rebuilt
  return (
    <div role="dialog" aria-label="Weather radar"
      className={full ? 'fixed inset-0 z-50 flex flex-col bg-bg' : 'sheet-up absolute inset-0 z-[3] flex flex-col overflow-hidden rounded-2xl bg-surface-raised'}>
      {!full && (
        <div className="flex items-center gap-2 py-1.5 pl-1.5 pr-2">
          <button onClick={onClose} aria-label="Close radar" className="flex h-11 w-11 items-center justify-center rounded-full text-[#c5ced6] hover:bg-white/5"><X size={20} /></button>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold">Radar</p>
            <p className="text-xs text-ink-dim">Past hour · National Weather Service</p>
          </div>
          <button onClick={() => setFull(true)} aria-label="Full screen" disabled={!mapsKey} className="flex h-11 w-11 items-center justify-center rounded-full text-[#c5ced6] hover:bg-white/5"><Maximize2 size={19} /></button>
        </div>
      )}
      <div className={full ? 'flex min-h-0 flex-1 flex-col' : 'flex min-h-0 flex-1 flex-col px-2.5'}>{mapArea}</div>
      {full ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex p-4">
            <div className="pointer-events-auto flex h-11 items-center gap-1 rounded-full border border-[#33404c] bg-[rgba(22,29,36,.92)] pl-4 pr-1 text-sm font-semibold">
              Radar · {place}
              <button onClick={() => setFull(false)} aria-label="Exit full screen" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-dim hover:text-ink"><Minimize2 size={17} /></button>
              <button onClick={onClose} aria-label="Close radar" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-dim hover:text-ink"><X size={18} /></button>
            </div>
          </div>
          <div className="absolute inset-x-4 bottom-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[#33404c] bg-[rgba(22,29,36,.92)] py-2.5 pl-2.5 pr-4 md:inset-x-6">
            {playBtn}{timeline}{legend}
          </div>
        </>
      ) : (
        <>
          {mapsKey ? (
            <>
              <div className="flex items-center gap-3 px-4 pb-1 pt-3">{playBtn}{timeline}</div>
              <div className="flex items-center justify-between gap-3 px-4 pb-3">{legend}<span className="truncate text-[11px] text-ink-dim">Loops the last hour · 5-min frames</span></div>
            </>
          ) : <div className="h-3" />}
        </>
      )}
    </div>
  )
}
