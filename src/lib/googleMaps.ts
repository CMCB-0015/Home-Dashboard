// Google Maps (JavaScript API) for Panel: one loader shared by every map
// (weather radar, Tesla), the dark style that matches the dashboard, and a
// flag for when Google refuses the key. The key is Panel's google_maps_key setting.

/** Dark map to match the dashboard */
export const DARK = [
  { elementType: 'geometry', stylers: [{ color: '#18212a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8493a1' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0e1318' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1620' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#56636f' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a3540' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#33404c' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#33404c' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
]

/* eslint-disable @typescript-eslint/no-explicit-any */
let mapsLoad: Promise<any> | null = null
let authFailed = false
/** Google rejected the key (wrong key, API not turned on, or the website restriction) */
export const mapsAuthFailed = () => authFailed

export function loadMaps(key: string): Promise<any> {
  const w = window as any
  if (w.google?.maps?.Map) return Promise.resolve(w.google.maps)
  if (mapsLoad) return mapsLoad
  mapsLoad = new Promise((resolve, reject) => {
    w.__panelMapsReady = () => resolve(w.google.maps)
    // Google calls this when it doesn't accept the key
    w.gm_authFailure = () => { authFailed = true; window.dispatchEvent(new Event('panel-maps-auth')) }
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&callback=__panelMapsReady`
    s.async = true
    s.onerror = () => { mapsLoad = null; reject(new Error('Couldn’t load Google Maps — check the internet connection')) }
    document.head.appendChild(s)
  })
  return mapsLoad
}

