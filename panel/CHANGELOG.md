# Changelog

## 1.7.0
- Calendar: **type the time straight into the start and end boxes** — "1030a", "10:30 am", "2:15p", "14:00", "9" all work (without AM/PM, 1–6 means afternoon). The line above the picker shows what it understood, or "Not a time yet" in amber; leaving the box keeps the last good time
- Calendar: **new time picker** under the times replaces the sliding chips (which only showed a couple of hours): every hour, every 5 minutes and AM / PM on screen at once. An hour button picks whichever AM/PM is closer (from 11:30 AM, "12" is noon). Changing the start keeps the length; setting the end changes the length (an end before the start = the next day, "+1 day")
- Calendar: on the tablet the first tap on a time only opens the picker (no keyboard covering it); tap the box again for the keyboard. With a mouse or trackpad, just type
- Calendar: a new event's suggested time follows the day — changing the day while the time is untouched resets it to 9 AM (fixes events added at night starting at 10 PM)
- Weather: the card is **collapsed** by default to its top row (temperature with high / low, condition, feels-like, sunrise → sunset, Radar). If rain is coming, a chip says when ("Rain Sat · 80%", 40% or more)
- Weather: **drag the bar along the bottom** of the card down to expand to the full card, up to collapse (one snap stop each way; a quarter of the way is enough), or tap it. Remembered on each screen
- The shopping list moves down instead of being covered: it takes the rest of the column and scrolls inside itself. Opening a day's details or the radar opens the card while they show

## 1.6.1
- Radar moves more smoothly: each 5-minute frame now **crossfades** into the next (about a third of a second) instead of cutting, so storms read as moving
- Radar **loads every frame first** ("Loading radar · 8 of 12") and only then starts playing, so rain no longer pops in mid-loop. Zooming or moving the map waits for the new pictures the same way; if a frame is slow, it plays anyway after 10 seconds
- **Faster loop:** about 0.4 s per frame, resting about 1.7 s on the latest frame before it starts over

## 1.6.0
- Calendar: **add events** with the **+** next to Week / Month, or **press and hold any day** (a ring fills around it, then the panel opens). Title, calendar (Family by default; read-only calendars like Holidays aren't offered), all day, day and time with quick buttons (start in half hours, then a length), place and notes. Save is one tap
- Calendar: **Edit · Delete** on event details. Editing changes the real Google event (guests, reminders and Meet links stay). A repeating event asks which ones: delete "This event / This and following", save "This event / All events". The repeat pattern itself is changed in Google Calendar
- Calendar: delete is one tap with a **5-second Undo**; it only goes to Google when the bar runs out
- Calendar: a new or changed event shows right away with a small "Saving" tag; Panel asks Home Assistant to sync instead of waiting for the 5-minute refresh. If Google says no, the panel reopens with everything typed and the reason
- Calendar changes go to Google through Panel's own link (one-time sign-in, new settings **google_client_id** / **google_client_secret**); reading still comes from Home Assistant. The calendar's look is unchanged
- Weather: new **Sky** card — tints with the sky (day, night, rain, clouds), sunrise → sunset arc with the sun's position (sunrise countdown at night), humidity / dew point / wind / UV / air chips, a temperature curve over hourly rain-chance bars with inches of rain, and the next 6 days as low-to-high bars (high in red, low in blue)
- Weather: **tap a day** (or today's temperature) for that day in detail: rain total and peak chance, wind and gusts, UV, humidity range, dew point, sunrise/sunset and a 24-hour chart
- Weather: **Radar** button — the last hour of National Weather Service radar in 5-minute frames, looping on a dark Google map centered on the house, with play/pause, a timeline, zoom and full screen. Needs the new **google_maps_key** setting

## 1.5.0
- Fix: skipping a run could skip the wrong schedule. The card now uses Rachio's own list as the only source: each run's skipped flag (and why: rain, wind…), its real zone times (seasonal shift included), and no runs guessed from the schedule rules. Skip only goes to a schedule whose very next run is that one and isn't already skipped (Rachio's skip works on the schedule's next run, so a second skip could undo it or hit another run)
- After a skip, the dashboard reads Rachio back and checks that exactly that run was skipped; if Rachio skipped something else (or nothing), an alert says what happened
- Skip tomorrow leaves runs Rachio already skipped alone
- Tesla card: plugged in anywhere shows the rear view with the charge cable — while charging a faint white cable with a green pulse flowing into the car; plugged in but not charging a solid blue cable and "Plugged in" in blue
- Tesla card: while driving, a front view on the road with lane dashes moving past and the car's real rims spinning with road speed
- Tesla card: charging status shows when it reaches the limit ("Charging · 80% by ~9:40 PM", from Teslemetry's time to full charge); header reads "Charging · Home" / "Plugged in · Home" at home, no place name away
- The Tesla motion is CSS only and stops with reduce motion
- Irrigation card, while watering: every zone in the run is listed (done ✓, watering now with time left / total, up next with run time, skipped), with "Lawns · zone 2 of 3". It replaces the dimmed week strip while a multi-zone run waters
- Zone times include Rachio's seasonal shift: the current zone's time is live from Rachio, and the rest are scaled by the same amount (Rachio's settings only hold the base times)
- Next zone button: stops the current zone and starts the rest of the run, in order, with their adjusted times (Rachio's public API has no skip-zone command, so the rest shows as a manual run in Rachio's history). Hidden on the last zone
- A start from the card only counts as confirmed when Rachio reports that run, not just anything watering; otherwise the "didn't confirm" alert shows
- The card picks up the next zone within a few seconds of the last one ending (it checks at the zone's actual end time)

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
