# Changelog

## 1.4.3
- Vacuum: mopping always uses **Medium** water flow (Start, Kitchen and Bedrooms presets, and the Map & rooms page), unless a different level is picked on the Map & rooms page for that run. Margaux's room stays vacuum only
- Vacuum: **"Done ~5:42 PM"** while cleaning, on the card and the Map & rooms page. The dashboard learns how long each room takes from real runs (mop-wash trips included, pauses not), separately for vacuum + mop and vacuum only. The first clean of each kind is a learning run, so no time shows until every room left has been timed once
- Vacuum: a trip back to the dock to wash the mop no longer ends the run on the card
- Vacuum: a clean started in the Roborock app is followed as a full clean (and timed) the same way
- Includes 1.4.2 (real Hue names), 1.4.1 and 1.4.0 (Irrigation card)

## 1.4.2
- Lights now use the real Hue names: Patio string lights → Patio Lights, Patio sconces → Patio Sconce Lights, Bedroom overhead → the Bedroom Soffit zone, Bedside lamp → Hue color candle 1
- Bedroom cans: Window = Bedroom Recessed 1, Dresser = Bedroom Recessed 2 (swap in `src/config/home.ts` if backwards)
- Timer lights (left on by "All indoor off"): Front Door, Garage, Side Yard
- Bedside lamp after TV now looks for the LG C5 and Hue color candle 1
- Includes 1.4.0 (new Irrigation card) and 1.4.1 (Irrigation card waits for Rachio to confirm starts and stops)

## 1.4.1
- Fix: starting a run from the Irrigation card no longer flips back to idle. Rachio takes a little while to report a run it just started, so the card now keeps showing it watering (countdown and Stop) while the dashboard checks Rachio every 10 seconds until it confirms
- Same for Stop: the card stays stopped instead of flashing back to watering while Rachio catches up
- If Rachio hasn't confirmed after 90 seconds, the card goes back to what Rachio reports and an alert says so ("Rachio didn’t confirm … started — check the Rachio app")
- Starting the Lawns schedule shows the right zone order and finish time straight away

## 1.4.0
- New Irrigation card: next run, a 7-day strip of scheduled runs (today outlined), and quick-run chips
- Tap a day to see its runs and skip one (Rachio can only skip a schedule's next run; undo is in the Rachio app)
- Quick runs: tap to start now, press and hold to pick the time (2 / 5 / 10 / 15 min or − / +)
- While watering: a countdown ring for the current zone, the zone after it and when the run finishes; Pause 1 h / Resume and Stop, one tap each
- Decorative rain on the card while a zone waters (off with reduce motion, or RAIN_EFFECT = false in src/config/irrigation.ts)
- The week strip fills in fixed schedules from their Rachio rules, so it covers all 7 days

## 1.3.0
- One tap for everything: no more "tap again to confirm" (All off, Rachio quick runs and Skip tomorrow, Tesla unlock). A short flash shows the tap went through
- Calendar: Week / Month switch; month grid with paging to any month and the picked day's events underneath
- Calendar: every Google calendar in Home Assistant, each in its own color, with chips to show or hide a calendar on that screen; each event says which calendar it's on
- Tap an event for its details: calendar, time, the place (name and address) on a Google map, Google Maps and Directions buttons, and the event's notes with working links
- The status bar still shows Family calendar events only (statusBar.calendars)
- Maps open in Google Maps everywhere (the Tesla location link no longer uses Apple Maps)

## 1.2.0
- New Tesla card (WillaWilla, through Teslemetry): battery and range, lock (two taps to unlock), climate, charging, frunk and trunk; glows green while charging, blue top bar with climate on
- Climate panel: target temperature, power, front and rear defrost, seat heat and cooling, steering wheel, rear seats
- Charging panel: charge limit (60% / 80% default), start/stop, amps, charge port, scheduled charging
- "En route home" row with arrival time, only when the car is navigating home
- New Vacuum card (Roborock S8 Pro Ultra): dock status (clean water, dirty water, mop drying), full clean and presets (Kitchen, Margaux's room, Bedrooms); while cleaning, a small map with the room it's in and progress, glowing in that room's color
- New Map & rooms page: pick rooms on the floor plan, set suction, passes, water flow and mop route, Start; presets and the dock on the side
- Vacuum alerts (empty clean-water tank, full dirty-water tank, stuck) show in the status bar
- Sports chips read The Brief's schedule feed with the new brief_feed_key setting
- Fix: the car's climate is never mistaken for the house thermostat

## 1.1.0
- New Sonos card: shuffle, Up next queue, volume, and a folded Quick play list (Chill, Rock, All my tracks)
- New Sonos page (Speakers & music): pick speakers or a group, set each volume, tap a Sonos Favorite to play it
- Clear messages when a speaker isn't reachable (for example the Roam 2 asleep) or a Favorite is missing
- Fix: the dashboard now reconnects on its own after Home Assistant restarts or updates
- Album glow: the Sonos card takes on the color of the album art (like the Lights card), full while playing, half when paused
- Save as quick-play button: save the checked speakers, a Favorite, each volume and shuffle as a new Quick play button; rename or delete it on the Sonos page
- Status bar at the top of the Home page (replaces the activity strip): alerts, Family calendar items for today and tomorrow, and games from The Brief once its schedule feed is set

## 1.0.0
- First version on the Lenovo: live updates from Home Assistant (lights, climate, Sonos, calendar)
- New Lights card (Ambient), light panel, bedroom cans, bedside lamp after TV
- Rachio checked around the clock, faster around scheduled runs, with "Skipped" detection
- Cameras, vacuum, vehicles and shopping list shown as placeholders until connected
