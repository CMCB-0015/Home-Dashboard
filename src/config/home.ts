// ── Which Home Assistant devices go where ───────────────────────────────────
// Edit this file to change what the tiles show. Names are matched loosely
// against the names in Home Assistant (which come from the Hue, Nest and Sonos
// apps): capitals, spaces and a trailing "s" don't matter. If a name doesn't
// match exactly one device, the dashboard says so on the Lights page instead
// of guessing. Open /api/setup-check on the dashboard to see every name it found.

export const HOME = {
  lights: {
    /** The four buttons on the Lights card, in order (top-left, top-right, bottom-left, bottom-right) */
    quick: [
      { label: 'Patio string lights', light: 'Patio Lights' },
      { label: 'Patio sconces', light: 'Patio Sconce Lights' },
      { label: 'Bedroom overhead', light: 'Bedroom Soffit' },
      { label: 'Bedside lamp', light: 'Hue color candle 1' },
    ],

    /** Lights on a timer all the time. "All indoor off" leaves these alone. */
    timer: ['Front Door', 'Garage', 'Side Yard'],

    /** A light counts as "Out" when its name or its Home Assistant area contains one of these words */
    outdoorWords: ['patio', 'yard', 'garage', 'driveway', 'porch', 'outside', 'outdoor', 'front door', 'side yard'],

    /**
     * The two bedroom cans: the Hue zone that holds only these two, and each can on its own.
     * Which can is Window and which is Dresser isn't confirmed yet: swap the two names if they're backwards.
     */
    bedroomCans: { group: 'Bedroom Soffit', window: 'Bedroom Recessed 1', dresser: 'Bedroom Recessed 2' },

    /**
     * Smart outlets that run lights (VeSync), by EXACT Home Assistant id (not by name: "Front Yard"
     * is also the camera's name). Shown with the lights as on/off rows with live watts.
     * "All indoor off" and "All off" never touch them: they're meant to stay on (they run on the
     * VeSync app's own schedules); only their own switch and Stargazing change them. (1.29.0)
     */
    outlets: [
      { id: 'switch.front_yard', name: 'Front Yard Landscape' },
      { id: 'switch.backyard_landscape_lights', name: 'Backyard Landscape' },
    ],
  },

  /**
   * Stargazing (Cameras card) also sets these for its hour, then puts each one back the way it
   * was, unless something else (a Hue timer, a scene, a VeSync schedule) changed it in the
   * meantime: then that change wins. (1.29.0)
   */
  stargazing: {
    /** Hue lights turned off (only if on) */
    lightsOff: ['Front Door'],
    /** Hue lights dimmed to this brightness (only if on and brighter; never turned on) */
    lightsDim: [{ light: 'Garage', pct: 60 }],
    /** Outlets (ids from lights.outlets) turned off (only if on) */
    outletsOff: ['switch.front_yard'],
  },

  /** "Bedside lamp after TV": when the living room TV turns off in the time window, turn this lamp on */
  bedtime: {
    lamp: 'Hue color candle 1',
    /** Matched against TV names; leave as is if the LG is the only LG TV */
    tv: 'LG C5',
    defaultStart: '20:00',
    defaultEnd: '22:00',
    brightnessPct: 100,
    /** Hue's "Bright" scene is about 2700 K soft white */
    kelvin: 2700,
  },

  sonos: {
    /**
     * Quick-play buttons on the Sonos card. Each plays a Sonos Favorite on these
     * speakers at these volumes (Sonos's 0–100 scale). Favorites are made in the
     * Sonos app: open a Tidal playlist → ⋯ → Add to Sonos Favorites.
     */
    presets: [
      { id: 'chill', name: 'Chill', favorite: 'Chill', speakers: [{ name: 'Patio 1', volume: 30 }, { name: 'Patio 2', volume: 30 }], shuffle: false },
      { id: 'rock', name: 'Rock', favorite: 'Rock', speakers: [{ name: 'Roam 2', volume: 35 }], shuffle: false },
      { id: 'all-tracks', name: 'All my tracks', favorite: 'All my tracks', speakers: [{ name: 'Roam 2', volume: 35 }], shuffle: true },
    ],
    /** One-tap speaker groups on the Sonos page. "*" means every speaker. */
    groupChips: [
      { label: 'Patio 1 + 2', speakers: ['Patio 1', 'Patio 2'] },
      { label: 'Garage', speakers: ['Roam 2'] },
      { label: 'Everywhere', speakers: ['*'] },
    ],
  },

  /**
   * Calendars on page 2. '*' = every Google calendar in Home Assistant; or
   * list names, e.g. ['Family', 'Connor']. Each calendar gets a color (pin
   * one in calendarColors), and the chips on the calendar card show or hide
   * each one on that screen.
   */
  calendars: ['*'] as readonly string[],
  /** Calendars to leave out even with '*' */
  hiddenCalendars: [] as readonly string[],
  calendarColors: { Family: '#6fa8ff' } as Record<string, string>,

  /** The Tesla card (Teslemetry in Home Assistant) */
  tesla: {
    /** Shown large on the card */
    name: 'WillaWilla',
    /** Who's driving, for the "en route home" row */
    driver: 'Connor',
    /** Charge-limit buttons on the Charging panel; defaultLimit gets the "default" label */
    chargePresets: [60, 80],
    defaultLimit: 80,
    /** Recommended cold tire pressure (Tesla app → Controls). A tire this many psi under turns amber */
    tirePsi: 42,
    tireLowBy: 5,
  },

  /**
   * The vacuum card and Map & rooms page (Roborock S8 Pro Ultra).
   *
   * Home Assistant only gives the Roborock map as a flat picture, so the
   * dashboard draws its own floor plan from these room shapes (x, y, width,
   * height, in floor-plan units; `main` is the box that gets the label).
   * `match` lists the names the room might have in the Roborock app — the
   * dashboard looks them up through roborock.get_maps to learn each room's
   * number. A room that doesn't match shows on the map but can't be picked.
   */
  vacuum: {
    model: 'S8 Pro Ultra',
    /** Water flow when mopping, unless a different one is picked on the Map & rooms page for that run */
    waterDefault: 'medium' as 'low' | 'medium' | 'high',
    rooms: [
      { id: 'kitchen', name: 'Kitchen/Living Room', color: '#6aa6ec', main: 1, match: ['Kitchen/Living Room', 'Living Room', 'Kitchen'],
        rects: [[190, 43, 180, 73], [58, 116, 312, 220], [13, 336, 363, 120], [13, 456, 181, 126], [13, 582, 50, 46], [251, 456, 125, 158]] },
      { id: 'masterbath', name: 'Master bath', color: '#e8c15a', main: 0, match: ['Master bath', 'Master bathroom', 'Primary bathroom'],
        rects: [[416, 46, 192, 110], [416, 156, 77, 53], [530, 156, 78, 53]] },
      { id: 'hallbath', name: 'Hall bath', color: '#3fd6c0', main: 0, match: ['Hall bath', 'Hall bathroom', 'Bathroom'],
        rects: [[473, 224, 135, 112]] },
      { id: 'master', name: 'Master bedroom', color: '#8fb8ef', main: 0, match: ['Master bedroom', 'Primary bedroom'],
        rects: [[608, 14, 305, 322], [685, 336, 228, 50]] },
      { id: 'hall', name: 'Hallway', color: '#e0805f', main: 0, match: ['Hallway', 'Hall', 'Corridor'],
        rects: [[376, 336, 309, 75], [465, 411, 103, 58], [603, 411, 82, 282]] },
      { id: 'guest', name: 'Guest bedroom', color: '#5f93dd', main: 0, match: ['Guest bedroom', 'Guest room', 'Guest'],
        rects: [[384, 469, 219, 224]] },
      { id: 'margaux', name: 'Margaux’s room', color: '#5fe0c4', main: 0, match: ['Margaux’s room', "Margaux's room", 'Margaux', 'Kids room'],
        rects: [[685, 386, 228, 307]] },
    ],
    /**
     * Floor-plan size, and where the dock sits on it. Units are pixels of the
     * map picture (public/images/vacuum-map/<room id>.png: Connor's Roborock
     * "Edit Room" screenshot of Nov 15 2026, cleaned up — outdoor spill, specks,
     * hatching and labels removed — one transparent layer per room). The rects
     * above are the invisible tap areas over each room.
     */
    size: [926, 709],
    dock: [39, 577],
    mapPicture: '/images/vacuum-map',
    /** Order the robot cleans in for a full clean (for "room 2 of 7") */
    fullOrder: ['kitchen', 'hall', 'guest', 'margaux', 'master', 'hallbath', 'masterbath'],
    presets: [
      { id: 'kitchen', name: 'Kitchen', rooms: ['kitchen'], vacuum: true, mop: true, color: '#6aa6ec' },
      { id: 'margaux', name: 'Margaux’s room', rooms: ['margaux'], vacuum: true, mop: false, color: '#5fe0c4' },
      { id: 'bedrooms', name: 'Bedrooms', rooms: ['master', 'margaux', 'guest'], vacuum: true, mop: true, color: '#8fb8ef' },
    ],
    /**
     * Drawn areas need the floor plan lined up with the robot's own map
     * (millimetres): robot = [a + b·x, c + d·y]. Normally set from the Map &
     * rooms page (Areas → Line up the map) and saved on the Lenovo; a value
     * here overrides that.
     */
    calibration: null as null | { x: [number, number]; y: [number, number] },
  },

  /** The status bar at the top of the Home page */
  statusBar: {
    /** Calendars whose events show as chips (other calendars stay on page 2 only) */
    calendars: ['Family'] as readonly string[],
    /** The Brief — tapping a sports chip opens it (or the game's own page, when the feed gives one) */
    briefUrl: 'https://rad-peony-6d6054.netlify.app' as string | null,
    /**
     * The Brief's schedule feed. The Lenovo reads it every 15 minutes with the
     * key from the app's Configuration tab (brief_feed_key) — the key never goes
     * in this file, because the repo is public. No key = no sports chips.
     */
    sportsFeedUrl: 'https://rad-peony-6d6054.netlify.app/.netlify/functions/api?action=schedule' as string | null,
    /** Twilight (Vandenberg launches) — tapping a launch chip opens it in the pop-up, on that launch */
    twilightUrl: 'https://rocket-view-tracker.netlify.app' as string | null,
    /**
     * Twilight's launch feed. The Lenovo reads it with the key from the app's
     * Configuration tab (twilight_feed_key) — never in this file. No key = no launch chips.
     */
    launchFeedUrl: 'https://rocket-view-tracker.netlify.app/api/panel' as string | null,
    /** Launch chips show this many days ahead */
    launchDays: 3,
  },
} as const

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Find the one item whose name matches. Exact match wins; otherwise every word must appear. */
export function matchName<T extends { name: string }>(target: string, items: T[]): { item?: T; reason?: string } {
  const exact = items.filter((i) => squash(i.name) === squash(target) || squash(i.name).replace(/s$/, '') === squash(target).replace(/s$/, ''))
  if (exact.length === 1) return { item: exact[0] }
  if (exact.length > 1) return { reason: `"${target}" matches ${exact.length} devices: ${exact.map((i) => i.name).join(', ')}` }
  const want = words(target).map((w) => w.replace(/s$/, ''))
  const loose = items.filter((i) => want.every((w) => squash(i.name).includes(w)))
  if (loose.length === 1) return { item: loose[0] }
  if (loose.length > 1) return { reason: `"${target}" matches ${loose.length} devices: ${loose.map((i) => i.name).join(', ')}` }
  return { reason: `Nothing named "${target}"` }
}
