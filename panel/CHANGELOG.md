# Changelog

## 1.19.0
- Irrigation, Quick run with a time: the Irrigation page's "Run 10 min" is now **Quick run**. It opens a pop-up with a minute wheel (1–60 min, starts on 10) plus 2 / 5 / 10 / 15 / 30 shortcuts, then Start. One tap, no confirm
- **Add another zone**: line up several zones in one quick run, each with its own time; they run one after another (Rachio `zone/start_multiple`) and the card lists them as "Quick run · zone 1 of 3"
- Holding a zone chip on the Irrigation card (Back slope, Back lawn) opens the same pop-up, starting on that chip's time. Holding Lawns still shows its zones and Start
- Watering on the Slate: for a run with several zones the countdown ring (84 px) sits on the left and the zone list fills the right side down to the buttons; long names wrap to two lines, the zone watering now is highlighted and kept in view, and longer lists scroll. Schedule, zone number and finish time sit on one line under the header
- Fix: a Stop (or a new start) right after another button press could be "confirmed" by a reading of Rachio taken before the press, so the card flipped back to watering — or stayed idle — for up to a minute. Only readings taken after the press can confirm it now

## 1.18.1
- Cameras: **motion shows again**. Your cameras don't send Home Assistant a Detection event, so a **new "Last event" picture now counts as motion** (it only changes when the camera recorded something). Detection events still win when a camera sends them, and add the type (Person, Pet, Vehicle)
- Cameras: the picture says when it's from: **"Motion · just now"** for 3 minutes, then the time, **"Motion · 7:34 PM"** ("Yesterday 7:34 PM", "Sat 7:34 PM" for older ones)
- Cameras: a Home Assistant restart or an integration reload re-stamps the picture; that is not counted as motion (nor are the picture's token renewals). Right after an update, each camera starts from "No motion yet" until its next motion
- Live view: **video only** (it plays muted anyway). Asking for sound made Home Assistant start a sound converter that failed on the Slate ("webrtc: streams: exec/rtsp … 404"). Also uses a little less camera battery
- Live view: **one automatic retry** before showing an error, and plain error text (the technical message goes to the browser console)

## 1.18.0
- **Idle screensaver (experimental)**, rebuilt on top of 1.17.0: after 2 minutes with no touch, Panel fades to a near-black screen with a faint clock, the date, the current weather and alert / camera / launch chips. The first tap only wakes it — it never presses what's underneath. An open camera live view closes when it dims
- Settings **idle_dim** (on/off), **idle_minutes** (default 2), **idle_brightness** (10–60%, default 32). idle_dim off = no screensaver at all, exactly as 1.17.0
- Baseline to go back to: **1.17.0** (commit f7d09da, branch `baseline-pre-idle-dim`). See DOCS → Idle screensaver

## 1.17.0
- **Baseline release: no idle screensaver.** Same as 1.16.1 with the experimental screensaver from 1.16.0 taken out (its three idle_* settings are gone too). This is the version to go back to if the screensaver ever misbehaves (GitHub branch `baseline-pre-idle-dim`)

## 1.16.1
- Cameras: **fixed "Motion · just now" showing all the time**. Motion now comes only from each camera's real Detection event (person, pet, vehicle, motion). 1.15.0 also used the picture's update time, which changes whenever Home Assistant renews the picture's access token (every few minutes). Until a camera reports its first detection, its picture says "No motion yet" and no chip shows
- Cameras: the overnight-motion list from 1.15.0 held those false events and is cleared on update
- Cameras: a picture only re-downloads when it actually changes
- **Open screens reload themselves after a Panel update** (the tablet and phone no longer keep the old screens on new data)

## 1.16.0
- Idle screensaver (experimental) — removed again in 1.17.0, back in 1.18.0

## 1.15.0
- Cameras: **connected** — Front Yard and Garage (eufyCam S3 Pro) and the HomeBase, through Home Assistant's eufy-sdk integration and the eufy-sdk bridge app. Replaces the placeholder card
- Each camera shows its **latest motion picture** with what it saw and when ("Person · 14m ago", "Pet", "Vehicle"), and a **battery** drawn like the Tesla card's (green bar to the real level, red under 20%) with the %. When the solar panel reads 10 or more, a **sun with the solar level** sits beside it ("82% │ ☀ 72")
- **Motion just now** (first 3 minutes): that camera gets an outline and a filled "Person · just now" tag, the card a soft camera-colored glow, and a camera-colored chip leads the status bar. Tap the chip for that camera's live view
- **Overnight motion** (10 PM–6 AM) keeps a chip until 9 AM: "Garage · Pet detected at 2:43 AM last night". Camera chips lead the status bar
- **Live view**: tap a camera. Opens in the same pop-up as Twilight; video comes straight from Home Assistant (WebRTC) and **stops when you close it** (battery cameras). Also stops if the tablet goes to sleep or the page goes to the background, and after 10 minutes. Front Yard / Garage switch at the bottom
- **Stargazing**: one tap turns off the motion lights ("Spotlight Enabled") on both cameras for 1 hour; they keep recording. A countdown sits beside the button in 5-minute steps ("35 min"); tap Stargazing again to reset it to a full hour, × to end it now. The Lenovo turns the lights back on when the hour is up, even with no screen open, and after an app restart
- **HomeBase Home / Away** switches the HomeBase's Security mode
- Status bar: a camera that's **offline** or under **20% battery** gets an amber chip
- `/api/setup-check` → `cameras` lists every camera entity Panel found (picture, detection, battery, solar, spotlight) and the HomeBase

## 1.14.0
- Tesla: **driving home on the tablet** — the live map now takes the car picture's place, so the line with the arrival time and miles is never cut off. "Arriving" (green) at the end
- Tesla: **speed and road while driving** — "Driving · 42 mph" (and "Driving · 0 mph" at a light). Driving anywhere else: the car on the road with the speed big and the road it's on ("I-5 S · San Juan Capistrano") under it, plus this drive's time and miles so far
- Tesla: the road name comes from Google's **Geocoding API** on the same Maps key — turn it on once (DOCS → Tesla map). Asked at most once a minute, only while driving
- Tesla: **knows it's driving** even with Teslemetry's Shift state / Speed entities off (by the car moving on GPS) — the card had shown the parked picture with the trunk dots while driving. Turning those two entities on is still best; `/api/setup-check` lists them
- Tesla: **"At Work"** — parked in a Home Assistant zone named Work, the card says "At Work" ("Charging · Work"); the Vehicles page too. Any other zone works the same way
- Vehicles page: **tire pressure view** — the psi button in the card's top corner shows the car from above with each tire's pressure and when it reported, like the Tesla app. A tire 5 psi or more under the recommended 42 turns amber, and the Home card says which ("Rear left tire low · 36 psi"). Status list gains a Tires row
- Vehicles page: the card keeps the car on the road while driving home (the big map is right beside it), and the Location header says "En route home" instead of "Parked"

## 1.13.0
- Status bar: **Vandenberg launches from Twilight** — a launch shows from 3 days out as a night-sky navy chip with a small star: "Falcon 9 · Starlink · Thu 6:42 PM", or "Falcon 9 · Fri · time TBD" when only the day is set (never hidden). Drops off an hour after liftoff; launched and scrubbed ones aren't shown
- New setting **twilight_feed_key** (Configuration tab): the same value as `PANEL_FEED_KEY` in Twilight's Netlify settings. No key = no launch chips; `/api/setup-check` → `launches` says why
- Panel checks Twilight every 15 minutes, every 5 within 6 hours of a set launch time and every minute in the last hour
- **Twilight and The Brief open in a pop-up** over the dashboard instead of a new tab, so the tablet stays full screen. A launch chip opens Twilight on that launch (the rest of Twilight is there to scroll); a sports chip opens The Brief. Close with the X, a swipe down on the top bar, or a tap on the dimmed edge

## 1.12.0
- Page 1 fits the tablet screen: no scrolling to reach the bottom cards' buttons (screens at least 1024 × 680; phones still scroll)
- Every card's buttons stay at the bottom of the card; if a card ever has more than fits, only its middle scrolls
- Vacuum card for the narrow slot: dock picture beside the dock status, presets in one "Presets" row that opens a list, Full clean and Map & rooms in the footer (Pause and Dock while cleaning), small map beside the room while cleaning
- The Tesla picture and camera snapshots size themselves to the space they have

## 1.11.0
- Shopping list: **connected to Bring!** (through Home Assistant's Bring! integration), replacing the Todoist placeholder
- **Tap an item** to check it off: it's struck through, fades and moves to the **Recent** chips (Bring!'s "Recently" items). Tap it again while it fades to undo. **Tap a Recent chip** to put it back on the list
- **Press and hold an item** for its panel: **details** shown next to the item and in the Bring! app ("2 lbs", "organic"; quick chips 2 · 3 · 4 · 1 lb · 2 lbs · Organic) and **Remove from list**
- **List picker** in the header lists every Bring! list in Home Assistant by its Bring! name; lists added, removed or renamed in Bring! follow on their own. The pick is remembered per screen. With one list it's just a label
- Footer: **Going shopping** and **Done shopping** send Bring!'s own notice to everyone on the list
- Typing an item that's already on the list does nothing; typing one of the Recent items puts that one back (Bring! keeps one of each)
- If Bring! stops responding the card says "List unavailable" and nothing else on the page is affected
- Items update live (Home Assistant sends each list's changes as they happen); changes made in the Bring! app arrive within about 90 seconds (how often Home Assistant checks Bring!)

## 1.10.0
- Climate: **new "Halo" card** — a Nest-style dial: black glass face in a dark metal bezel with a thin ring of light (red heating, blue cooling, climate blue when holding). The big number is the target; "Inside" is the room. While heating or cooling the card takes the color (soft wash and top bar), like the Lights and Sonos cards
- Climate: **turn the dial like a knob** to change the temperature — grab the bezel anywhere and rotate (clockwise = warmer, about 8° of turn per degree). It moves from where it already is, so touching the dial never jumps the target. The change goes to the Nest **once, when you let go** ("Set to 72° · release to send" while turning)
- Climate: in Heat · Cool, turning moves whichever end you grabbed nearer (blue low dot, red high dot) and keeps them at least 3° apart
- Climate: **tap the center of the dial** for the mode menu — Heat, Cool, Off. Heat · Cool and Eco are still on the Climate page. In Eco and Off the dial is locked
- The −/+ buttons stay for one-degree nudges; arrow keys work on the dial too

## 1.9.0
- Tesla: **frunk and trunk dots on the car picture** — a white ring dot that slowly breathes sits on the frunk and the trunk (parked or plugged in). Tap one to open it: it shows "Opening…", then an amber **"Trunk open" / "Frunk open"** pill once the car reports it, and the status line says so too
- Tesla: **close the trunk** — tap the "Trunk open" pill and it closes and turns back into the dot. The frunk can only be closed by hand, so its pill is just a label ("The frunk closes by hand")
- Tesla: the 4th button now **vents the windows** (blue glow while vented, "Windows vented" in the status line); tap again to close them. The old Open frunk / Open trunk buttons are gone
- Tesla: **less "Waking car…" waiting** — a command now counts as done the moment the car reports the change over Teslemetry's live stream, instead of waiting for Tesla's server to confirm. "Waking car…" only shows while the car really was asleep, and the status line says what's happening ("Opening trunk…")

## 1.8.2
- Tesla: seat buttons go straight to full — one tap = full heat or cooling, a second tap = full in the other mode, a third = off (rear seats: on/off at full heat). The three bars still show the level
- Tesla: the first tap picks cooling when the cabin is warmer than the climate set point and heating when it's cooler (outside temperature decides when it's within 3°); while a seat is off, a faint red or blue ring shows which way the next tap goes. Tesla's Auto seat climate is never used

## 1.8.1
- Weather: **hour-by-hour rain plot** under the day columns (opened card): chance of rain shaded in blue (0–100%), each day's stretch of hours right under its column, hours already gone today greyed with an amber line at now
- Weather: the day columns now **start with Today** (like a weather app) and show the expected **inches of rain** under the chance
- The shopping list keeps at least its title and add box when the weather card is opened; on a short screen the page scrolls a little instead of hiding the list

## 1.8.0
- Tesla: **live map while driving home** — the card's "en route home" row becomes a map strip with the car, home and the route, plus the minutes left; the arrival time and distance sit under it
- Tesla: the Vehicles page gets a **Location** map — the car with an arrow for its heading, home, a dotted trail of this drive, and Google's route home in blue while navigating home, with "18 min · Home at 5:42 PM · 12 mi" and any traffic delay. Drag and zoom to look around; the arrow button follows the car again. Parked, it shows where the car is
- The route comes from Google's **Routes API** using the same Maps key as the radar, at most once a minute while navigating home. One-time setup: turn on the Routes API and allow it on the key (DOCS → Tesla map). Until then the map shows the trail only
- Uses Teslemetry's **GPS heading** and **Traffic delay** entities when they're enabled in Home Assistant (both off by default); the Status list moves under the Tesla card on the Vehicles page

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
