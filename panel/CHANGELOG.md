# Changelog

## 1.30.0
- **Holiday themes for the screensaver**, starting with **Christmas** (the "Ridgeline" scene): a snowy mountain ridge with peaks, forest, and big pines in twinkling multicolor lights; falling snow; the real time of day (stars and the moon at night, sun and blue sky by day — the lights stay on in daylight); and **Santa's sleigh crossing the moon** at night every few minutes. The clock, date, weather and chips move to the top-left over the scene, brighter so they read
- **Comes back every year on its own**: Christmas is set to **Auto**, on from **Dec 1 through Jan 6** every year, and off the rest of the year (the screensaver is exactly as before then). The choices are saved on the Lenovo per theme, so nothing is lost after the season. Other holidays can be added the same way, each with its own dates
- **Settings → Holiday themes** (new section): Christmas **Off / Auto / On**, **Scene brightness**, **Snow** (Off / Light / Normal / Heavy), **Christmas lights** (Few / Normal / Lots / Max), **Light brightness**, and **Preview Christmas** to see it any time of year
- The scene only loads and runs while it's on screen (about 30 frames a second, stops the moment Panel wakes)
- **Settings opens with every section collapsed**, every time
- Settings footer and System info show 1.30.0

## 1.29.0
- **Landscape lights on the Lights page**: the two VeSync outlets, **Front Yard Landscape** and **Backyard Landscape**, show with the Hue lights in their Home Assistant area: on/off switch, an "outlet" tag, and the power they're drawing ("on · 24 W"). They count as Out lights on the card
- **All indoor off and All off never touch the landscape outlets** (they stay on and keep their VeSync schedules). The card's All off is greyed when only the outlets are on
- Outlets are found by exact id (`switch.front_yard`, `switch.backyard_landscape_lights`), never by name, so nothing can mix them up with the Front Yard camera
- **Stargazing now also sets the front lights for the hour**: **Front Door off**, **Garage down to 60%**, **Front Yard Landscape off** (only the ones that are on; Garage only if brighter than 60%; nothing is ever turned on). At the end, or ×, each goes back exactly as it was (brightness and color) — unless a Hue timer, scene or VeSync schedule changed it during the hour, in which case that change wins. Tapping Stargazing again to restart the hour sets any of them that came on since. Survives an app restart, like the camera
- Settings → footer and System info show 1.29.0; System info lists VeSync under "Through Home Assistant"

## 1.28.0
- **Settings gear moved and shrunk** (option C): a tiny gear right after the two page dots at the top, in the same faint grey as an inactive dot. It no longer takes its own spot next to the clock. Still a finger-sized (invisible) tap area. On phones, where the dots are hidden, the gear sits there alone
- **Settings → Roborock** (new section):
  - **Auto-empty dust bin** on/off. Home Assistant has no switch for this, so Panel sends the robot's own command (`set_dust_collection_switch_status`). The robot can't report the setting back, so the switch shows what Panel last set. *Trial: if it errors, it gets revisited*
  - **Empty mode** (Smart / Light / Balanced / Max, as the dock offers them) through the dock's Home Assistant control; greyed while auto-empty is off
  - **Empty dust bin now** (robot must be on the dock)
  - **Run times**: the average of the last 5 runs for each kind of run, with "unusual run" flagged
  - **See and edit run times** opens a pop-up: Whole runs / Rooms, each time with its date, "Unusual" marked (more than a third off the others), and **Remove** for anomalies — no confirm step, with **Undo** until the pop-up closes. Averages and the card's "Done ~" use what's left
- Learned run and room times now keep the date each run finished. Times learned before this update have no date and show as "Earlier"
- **Removed the Supervisor access (`hassio_api`)** added in 1.27.0. System info gets the Home Assistant Core version through Panel's normal Home Assistant access; the OS version shows "—". Home Assistant may note the app's permissions changed
- Settings → footer and System info show 1.28.0

## 1.27.2
- Weather, **backup source**: when Open-Meteo doesn't answer, Panel now uses the **US National Weather Service** forecast (api.weather.gov, free, no key) automatically, and goes back to Open-Meteo as soon as it answers again (tried first at every 10-minute refresh). Everything on the weather card keeps working on the backup (hourly temperature, rain chance and inches, dew point, humidity, wind, conditions, the dew point card); sunrise and sunset are worked out by Panel. The backup has no UV index or air quality, so those chips are hidden while it's in use
- **No more sample weather on the real setup**: the DEMO weather only shows when testing without Home Assistant. If neither source answers, the card keeps the last forecast for up to 3 hours, then says "Weather unavailable"
- **Settings → Weather** (new section): which source the forecast is coming from, when it last loaded, and how each source is doing, with the real error when one fails
- The log now gives the real reason a weather request fails (e.g. "fetch failed (ENOTFOUND)", "no answer within 15 s") instead of just "fetch failed"; `/api/setup-check` gains a `weather` section
- Settings → System info: services list now shows Open-Meteo (weather) and National Weather Service (backup weather, radar)

## 1.27.1
- Weather: the **Humidity** and **Dew point** chips on the front of the card (the readings right now) can be tapped too, with the same thin green ring. Tapping either opens **today's** details with the humidity / dew point card already showing
- Settings → footer and System info show 1.27.1 (no other System info changes)

## 1.27.0
- **Settings menu**: a gear in the page header (top right, beside the clock — just the icon, no box around it) slides a Settings panel in from the right. Everything in it is saved on the Lenovo the moment it changes (`/data` key `panel-settings`), so no code rebuild and no app restart
- Sections are expandable headers, so more fit cleanly below. First section: **Screensaver** — live preview, **On** switch, **Dim after** 1 / 2 / 5 / 10 / 15 min, **Clock & text** brightness (10–60%), **Notification chips** brightness (0–100%, default **40%**, separate from the clock; 0% hides the chips), and **Preview now** (shows the screensaver full-screen; tap to go back)
- `idle_dim` in the Configuration tab stays the master off switch: off there = no screensaver whatever the menu says (the menu shows why). `idle_minutes` / `idle_brightness` are now only the starting values until the menu changes them
- Footer: **Panel version** · tap for **System info** — architecture (screens → Panel on the Lenovo → Home Assistant / direct services), the Lenovo's hardware with live memory, storage, processor load and up-since, software (Panel build, Home Assistant Core / OS, Node), network, and the update / safety-net reference. Live values refresh every 5 s while it's open
- The app now has read-only Supervisor access (`hassio_api`) so System info can show the Home Assistant versions
- The bedtime lamp stays on the Lights page (it's an automation, not a setting)

## 1.26.0
- Weather, a day's details: **Humidity** and **Dew point** chips show the day's **average** and wear a thin green ring: they're the two chips you can tap. Tapping either opens a **humidity / dew point card** under the chips (tap again to close). The browser's square tap flash is off on these chips, so the press shows as the chip's own rounded fill
- The card: the day's **ranges and averages** for dew point and humidity on top, then **dew point under temperature, hour by hour**, with the gap between them shaded, nights shaded, and a scale of how it feels (dry / comfortable / sticky / muggy). When the two lines come within 3°, a note above the plot says when ("Only 1° apart 12–6 AM · dew or fog likely"). Below: the lowest and highest dew point with times, and a one-line read of the day (steady, or a big swing as dry air mixes down)
- All text stays outside the plot: ° marks on the left, band names on the right (centered on their bands), the note above, hours below. On a phone the band names move to a key under the plot
- Hourly dew point and humidity now come along with the forecast (Open-Meteo)

## 1.25.1
- Irrigation, **schedule chips get Start at… too**: holding a schedule chip (e.g. **Lawns**) now opens the same pop-up as a zone chip — its zones and estimate, then **Starts: Now | Start at…** (same day / time picker, done-by time, and the warning if it would run into another Rachio run). No minute wheel: the schedule sets its own times
- At the time Panel starts the **Rachio schedule itself**, so that day's zone times win (seasonal adjustment included). Same rules as other scheduled quick runs: runs even with Rachio skips on, waits if something is watering, "Quick run missed · Run now" if the Lenovo was off
- Shows as "Lawns · 3 zones · ~21m" on the status chip, the card's Next run and the Irrigation page. Details list the zones with Rachio's estimated times; Edit changes only the day and time

## 1.25.0
- Vacuum, **scheduled cleans ("Start at…")**, kept by Panel on the Lenovo — not a Roborock app schedule. Map & rooms: a clock button beside Start, or press and hold any preset (page or card), opens a Start sheet: **Now** (default, unchanged) or **Start at…** — the Rachio quick run's day + type-or-pick time picker, in white, with the estimated finish. One time only, up to 14 days ahead, up to 10 pending
- At the time Panel checks the robot first (Roborock app schedules can't be seen from Home Assistant): **already cleaning** → skipped; **cleaned the same rooms in the last 2 h** → skipped (Panel's own cleans by room; one Panel didn't follow — Roborock app, Panel off — counts as every room); **dock can't mop** (clean water empty / dirty water full, mopping runs only) or **battery under 20%** → skipped. Otherwise it starts exactly like Start. Panel off at the time → "missed", never started late. Skipped / missed stay 24 h with **Run now** / Dismiss
- Status bar: "Vacuum scheduled · Bedrooms · Tomorrow 10:00 AM", "Vacuum in 4 min", amber "Vacuum skipped · clean water empty · Run now?", "Vacuum missed · Panel was off at 10:00 AM · Run now?" — tap for details. Card: a row with the next scheduled clean (or a skipped one). Map & rooms: "Scheduled" list above the presets. Details: what, settings, estimate, the skip rules; Edit · Start now · Cancel (5 s Undo)
- Server: `server/vacuumScheduled.ts` (`/data` key `vacuum-scheduled`, 15 s check), `/api/vacuum/scheduled` (add / update / cancel / dismiss / run-now); recent cleans logged in `vacuum-clean-log`. The Rachio `StartAt` picker now takes a colour and an extra note

## 1.24.0
- Irrigation, **scheduled quick runs**: the Quick run picker gets a **Starts** switch — **Now** (the default, same as before) or **Start at…**, with day chips (Today + the next 4 days, or a calendar up to 14 days ahead) and a time (type it, or tap hour / minutes / AM-PM). Works for one zone or several ("Add another zone"), from the card's zone chips, the card's hold pop-up and the Irrigation page
- Runs on **Panel's backend** (the Lenovo), not Rachio — Rachio's own schedules are untouched. Saved on the Lenovo (`/data` key `rachio-scheduled`), so a restart keeps them. At the time, Panel starts the zones as a normal manual run, so it **runs even if Rachio's automatic skips (rain, wind, freeze) are in place**
- **Runs into a Rachio schedule?** The picker checks Rachio's upcoming runs (and other scheduled quick runs) and shows an amber note — "Runs into Back Slope 7:00–7:02 AM" — with one-tap fixes: start so it **ends before**, or start **after it**
- **Something already watering at the time** → the quick run waits ("Quick run waiting" chip, amber) and starts as soon as it ends (gives up after 3 h)
- **Lenovo off at the time** (more than 3 min late) → it doesn't start on its own; a **"Quick run missed"** chip offers **Run now** or Dismiss
- Status bar chip **"Quick run scheduled"** (zone/minutes, when); "Quick run in N min" in the last hour. Tap → details: zones, total, done-by time, **Edit** (same picker, pre-filled), **Start now**, **Cancel this run** (with a 5-second Undo)
- Irrigation card: the week strip shows a clock on days with a scheduled quick run (a hollow cyan slot if Rachio has nothing that day); the day panel lists it; "Next run" shows the quick run when it comes before Rachio's next run. The Irrigation page lists scheduled quick runs above Zones
- One-off only — no repeats (Rachio's schedules do that)

## 1.23.2
- Vacuum: one-time reset (Connor's call) of the learned whole-run times for the three presets — **Kitchen, Margaux's room, Bedrooms** — since runs between 1.20.4 and 1.23.1 could be cut short at a mop wash. Each relearns from its next run; until then a preset's estimate is added up from its rooms' times (if known). Full clean and the room times are left as they are

## 1.23.1
- Vacuum, **fix: runs no longer end at the first mop wash.** Since 1.20.4 a trip back to the dock to wash the mop only counted as part of the run while a room was "still to go" — so a one-room run (Kitchen/Living Room, which starts at the dock) ended at its first wash and was learned as a few minutes, and the rest was then followed as a separate "Full clean". Now the robot's own **Cleaning** sensor (on for the whole job, washes included) decides; without it, any washing status keeps the run going. If "Cleaning" stays on while the robot sits quietly at the dock for 15 min, the run ends anyway
- One-time clean-up (Connor's call): Kitchen's learned times under 10 min (the 5 and 1 min cut-short runs) are dropped from run and room times, so Kitchen goes from "16 min avg of 4 (29, 5, 1, 28)" to 29, 28

## 1.23.0
- Weather, **Tides tab**: the expanded weather card gets a **Forecast / Tides** switch under the chips. **Forecast is always the default**, and the card goes back to it when it collapses, when you swipe to the Home page, and when the screensaver comes on. The top row (temperature, sunrise / sunset arc) is unchanged
- Tides shows one day, midnight to midnight: the tide as a teal line over a **0 ft baseline** (mean lower low water), with every high and low labeled with its height and time ("+0.6 ft", "6.9 ft"). Labels always sit clear of the line, above a high and below a low. Tides **below 0 ft are filled in orange**. Nights are shaded, and an amber line marks now
- Above the chart: today = the tide now (rising / falling), the next tide and the one after, with heights and times. Another day = its lowest low and highest high, with heights and times
- Seven day tiles under the chart (a small tide line plus that day's highest high and lowest low) pick the day. All days use one height scale, so they compare at a glance
- Tide predictions come from **NOAA** (free, no key), highs and lows for the next 9 days, refreshed every 6 hours. The line between them is drawn the way NOAA draws its own charts. New setting **tide_station** (empty = San Clemente)

## 1.22.0
- Vacuum, **new home map**: the Map & rooms page and the card's mini map now show Connor's real Roborock map (his "Edit Room" screenshot of Nov 15) cleaned up — outdoor spill, specks, hatching, furniture marks and labels removed, crisp walls — in the Roborock app's colours. One picture layer per room (`public/images/vacuum-map/<room>.png`), so picked rooms stay lit and the rest dim; rooms you can't pick are greyed. Invisible tap areas sit over each room (`HOME.vacuum.rooms[].rects`, now in map-picture pixels; `size` 926 × 709, dock moved to match)
- **Line up the map** (turns on drawn areas): Areas → two steps. 1 · with the robot on the dock, Read position. 2 · start a clean, pause it far from the dock, tap that spot on the map. Panel reads the robot's position each time (`roborock.get_vacuum_current_position`) and works out the scale and offset (handles a flipped axis). Taps too close to the dock, or that don't match where the robot is, are refused with a reason. Saved on the Lenovo (`/data` keys `vacuum-calibration`, `vacuum-cal-dock`); "Line up the map again" under the Areas list resets it. A value in `HOME.vacuum.calibration` still wins
- Map & rooms: the estimate strip hides while the Areas pop-up is open (rooms aren't used there)

## 1.21.0
- Vacuum, **runtime estimate before you start**. Map & rooms: a strip at the top shows how long what's picked would take and when it would be done ("~34 min · Done ~12:03 AM if started now"), with each picked room's time. It updates as you tap rooms or turn Vacuum / Mop on and off. Picked rooms show their time on the map (every room does when nothing is picked), and the Start button's line adds the time
- Each preset shows its time: on the Map & rooms page (right column) and in the card's Presets list (with its done-by time). The card's Full clean button shows its time when there's room
- How it's worked out (from 1.20.4's learning): the same run done before → its own average of the last 5; otherwise each room's average added up (× passes). A room with no time yet is named in amber and the total gets a "+". Nothing learned for that mode → "No estimate yet · learns from this run". Nothing picked = Full clean. Drawn areas get no estimate. Worked out in the browser as you tap, so it's instant
- The map shrinks a little while the strip shows, so the Start row still fits on one screen

## 1.20.4
- Vacuum, **finish time fix**: "Done ~" no longer creeps a minute ahead of the clock. The dock is in Kitchen/Living Room, so the robot never "walked into" that room and the kitchen was always counted as not started; its time had also been learned from the robot just driving through
- "Done ~" now comes from the **average of the last 5 runs of the same kind** (Kitchen, Bedrooms, Full clean…; vacuum + mop / vacuum only / mop only kept apart), not counting pauses. Set at the start, it stays put while the robot works and moves out only while paused. One run gives a first estimate; it improves with each run up to 5
- A set of rooms never run before adds up each room's 5-run average. Room times now count the room it starts in, run until the robot reaches the next room of the run (detours to wash the mop stay with that room), and never count a room it only drove through
- Past the usual time the card says **"Finishing up"** instead of pushing the time out. Runs sent to the dock early aren't learned. Old room times are cleared once (they included drive-throughs); Kitchen starts from one 24-minute run. Timing survives a Panel restart mid-run
- `/api/setup-check` → `vacuum.roomTimes` shows each average and the runs behind it

## 1.20.3
- Weather, **night fix**: after sunset the first day column reads **Tonight** with a moon and the night's sky ("Clear", "Partly cloudy", or rain/fog/storms if they fill at least a quarter of the night), instead of "Sunny" with a sun. Tapping it opens Tonight's details in the night tint
- The current reading (weather card, header, screensaver) switches between **Sunny / Clear** and **Mostly sunny / Mostly clear**, and sun / moon, right at sunrise and sunset, instead of waiting for the next weather update
- Every weather type checked day and night: clouds, fog, drizzle, rain, snow and thunderstorms look the same either way; only clear and partly cloudy skies change

## 1.20.2
- Cameras: switching **Home / Away** no longer shows "Motion · just now" on an old picture. The switch makes the bridge swap between two copies of the same latest picture (the small one from an Away alert and the HomeBase's full one), which looked like a new picture. Picture changes in the **3 minutes after a mode switch** now keep the previous motion time
- Cameras (Away mode): when an alert's picture is later replaced by the HomeBase's full picture of the same event, the motion keeps the alert's time and label instead of jumping to when the second picture arrived (alerts up to 10 minutes before a picture count as the same motion)

## 1.20.1
- Cameras: **no more false "Camera is offline"**. Switching the HomeBase to Away flagged the Front Yard camera unavailable for a moment while it worked fine. A camera now counts as offline only after Home Assistant has called it unavailable for **1 minute without a break**
- New setting **camera_offline_minutes** (Configuration tab, default 1, 0–120) to change that wait
- While a camera is briefly unavailable, its tile keeps the last motion picture instead of going blank

## 1.20.0
- Cameras, **motion without phone alerts**: in Home mode the HomeBase sends no motion alerts, so Panel now asks it **once a minute** for each camera's newest recording ("Refresh last event"). That's a local HomeBase lookup: it doesn't wake the cameras or use battery. Only the camera that actually recorded something gets a new picture, so **one camera's motion no longer shows on both**, and the time is within about a minute
- Cameras, **Away mode**: when the HomeBase is in Away, the cameras' real-time Motion and Person signals are used, with the exact time and the label (**Person**, Pet, Vehicle when the camera sends it)
- **Stargazing now turns the Front Yard camera off** for the hour (no motion light at all). **The Garage stays on.** Tap again = a full hour, × ends it, and Panel turns Front Yard back on at the end, even after a restart. The card says "Stargazing · Front Yard off", and the Front Yard picture shows "Camera off" (no live view while it's off)
- **Spotlight Enabled is never touched again.** Turning it off from Home Assistant broke the Front Yard light until it was reset. Panel no longer looks it up, and Panel's server refuses any command to a spotlight switch. A Stargazing hour started on 1.18/1.19 ends without touching it
- A camera that is switched off no longer raises an "offline" or battery chip

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
