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
      { label: 'Patio string lights', light: 'Patio string lights' },
      { label: 'Patio sconces', light: 'Patio sconces' },
      { label: 'Bedroom overhead', light: 'Bedroom overhead' },
      { label: 'Bedside lamp', light: 'Bedside lamp' },
    ],

    /** Lights on a timer all the time. "All indoor off" leaves these alone. */
    timer: ['Front door', 'Garage', 'Side yard'],

    /** A light counts as "Out" when its name or its Home Assistant area contains one of these words */
    outdoorWords: ['patio', 'yard', 'garage', 'driveway', 'porch', 'outside', 'outdoor', 'front door', 'side yard'],

    /** The two bedroom cans: the Hue group that holds both, and each can on its own */
    bedroomCans: { group: 'Bedroom overhead', window: 'Window', dresser: 'Dresser' },
  },

  /** "Bedside lamp after TV": when the living room TV turns off in the time window, turn this lamp on */
  bedtime: {
    lamp: 'Bedside lamp',
    /** Matched against TV names; leave as is if the LG is the only LG TV */
    tv: 'LG',
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

  /** Google calendars shown on page 2 */
  calendars: ['Family'],

  /** The Tesla card (Teslemetry in Home Assistant) */
  tesla: {
    /** Shown large on the card */
    name: 'WillaWilla',
    /** Who's driving, for the "en route home" row */
    driver: 'Connor',
    /** Charge-limit buttons on the Charging panel; defaultLimit gets the "default" label */
    chargePresets: [60, 80],
    defaultLimit: 80,
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
    rooms: [
      { id: 'kitchen', name: 'Kitchen/Living Room', color: '#6aa6ec', main: 1, match: ['Kitchen/Living Room', 'Living Room', 'Kitchen'],
        rects: [[162, 2, 110, 75], [32, 77, 245, 170], [0, 247, 277, 65], [0, 312, 172, 150], [172, 372, 105, 70]] },
      { id: 'masterbath', name: 'Master bath', color: '#e8c15a', main: 0, match: ['Master bath', 'Master bathroom', 'Primary bathroom'],
        rects: [[309, 20, 141, 80], [309, 100, 60, 45]] },
      { id: 'hallbath', name: 'Hall bath', color: '#3fd6c0', main: 0, match: ['Hall bath', 'Hall bathroom', 'Bathroom'],
        rects: [[354, 157, 98, 83]] },
      { id: 'master', name: 'Master bedroom', color: '#8fb8ef', main: 0, match: ['Master bedroom', 'Primary bedroom'],
        rects: [[452, 0, 232, 234]] },
      { id: 'hall', name: 'Hallway', color: '#e0805f', main: 0, match: ['Hallway', 'Hall', 'Corridor'],
        rects: [[277, 244, 235, 63], [452, 307, 60, 207]] },
      { id: 'guest', name: 'Guest bedroom', color: '#5f93dd', main: 0, match: ['Guest bedroom', 'Guest room', 'Guest'],
        rects: [[287, 347, 165, 167]] },
      { id: 'margaux', name: 'Margaux’s room', color: '#5fe0c4', main: 0, match: ['Margaux’s room', "Margaux's room", 'Margaux', 'Kids room'],
        rects: [[512, 237, 178, 277]] },
    ],
    /** Floor-plan size, and where the dock sits on it */
    size: [690, 514],
    dock: [14, 423],
    /** Order the robot cleans in for a full clean (for "room 2 of 7") */
    fullOrder: ['kitchen', 'hall', 'guest', 'margaux', 'master', 'hallbath', 'masterbath'],
    presets: [
      { id: 'kitchen', name: 'Kitchen', rooms: ['kitchen'], vacuum: true, mop: true, color: '#6aa6ec' },
      { id: 'margaux', name: 'Margaux’s room', rooms: ['margaux'], vacuum: true, mop: false, color: '#5fe0c4' },
      { id: 'bedrooms', name: 'Bedrooms', rooms: ['master', 'margaux', 'guest'], vacuum: true, mop: true, color: '#8fb8ef' },
    ],
    /**
     * Drawn areas need the floor plan lined up with the robot's own map
     * (millimetres). Until this is filled in at install, the Areas tool says
     * so and rooms are the way to pick. robot = [a + b·x, c + d·y].
     */
    calibration: null as null | { x: [number, number]; y: [number, number] },
  },

  /** The status bar at the top of the Home page */
  statusBar: {
    /** The Brief — tapping a sports chip opens it (or the game's own page, when the feed gives one) */
    briefUrl: 'https://rad-peony-6d6054.netlify.app' as string | null,
    /**
     * The Brief's schedule feed. The Lenovo reads it every 15 minutes with the
     * key from the app's Configuration tab (brief_feed_key) — the key never goes
     * in this file, because the repo is public. No key = no sports chips.
     */
    sportsFeedUrl: 'https://rad-peony-6d6054.netlify.app/.netlify/functions/api?action=schedule' as string | null,
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
