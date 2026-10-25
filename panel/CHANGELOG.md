# Changelog

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
