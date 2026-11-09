# Panel

Connor's home dashboard. Open it at **http://192.168.86.207:8099** on the tablet,
phones or computer (home Wi-Fi only) and bookmark it.

## Settings (Configuration tab)

- **passcode** — each device enters this once. Changing it signs every device out.
- **rachio_api_key** — Rachio app → Account → API Access.
- **weather_lat / weather_lon / weather_location_name** — forecast location.
- **brief_feed_key** — the same value as `PANEL_FEED_KEY` in The Brief's Netlify settings. Turns on sports chips in the status bar.
- **twilight_feed_key** — the same value as `PANEL_FEED_KEY` in Twilight's Netlify settings. Turns on Vandenberg launch chips in the status bar.
- **google_client_id / google_client_secret** — Panel's own Google sign-in key, for adding, editing and deleting calendar events (see Calendar below).
- **google_maps_key** — a Google Maps key for the weather radar and the Tesla map (see Weather and Tesla map below).
- **idle_dim / idle_minutes / idle_brightness** — the idle screensaver (experimental; see Idle screensaver below). Off = Panel never dims.

Click **Save**, then **Restart** the app after changing settings.

## Idle screensaver (experimental, 1.16.0)

After **idle_minutes** (default 2) with no touch, Panel fades to a near-black screen with a faint clock, the date, the current weather and any alert, camera or launch chips. **The first tap only wakes Panel** — it never presses the button underneath. Any key wakes it on the Chromebook. An open camera live view closes when it dims (battery cameras).

- **idle_brightness** (10–60, default 32): how bright the clock and text are, in %. The background stays near-black.
- The tablet's backlight stays on; a web page can't turn it down. ChromeOS: Settings → Power → When idle → Keep display on.
- **To turn it off:** set **idle_dim** off, Save, Restart Panel. Panel then works exactly as 1.15.0 did.
- **To remove it for good:** the baseline is **1.15.0, commit 37bbb8c** (GitHub tag `baseline-pre-idle-dim`). Revert the 1.16.0 idle commit, or restore 37bbb8c's code under a *higher* version number (Home Assistant only offers higher versions).

## If something looks wrong

- **Log tab**: shows what the dashboard is doing and any errors.
- **http://192.168.86.207:8099/api/setup-check** (after unlocking the dashboard):
  every light, speaker, thermostat and calendar name the dashboard found. Use it to
  fix names in `src/config/home.ts`.

## Quick-play buttons saved from the dashboard

Buttons saved with **Save as quick-play button** on the Sonos page are kept in the
app's own storage, so they survive restarts and updates. Rename or delete them on the
Sonos page. The buttons in `src/config/home.ts` can only be changed in code.

## Launches in the status bar

Vandenberg launches come from Twilight's feed (`statusBar.launchFeedUrl` in
`src/config/home.ts`: https://rocket-view-tracker.netlify.app/api/panel). Put the key in
**twilight_feed_key** on the Configuration tab — never in the code. A launch shows from
3 days out ("Falcon 9 · Starlink · Thu 6:42 PM", or "Falcon 9 · Fri · time TBD" when only
the day is set) and drops off an hour after liftoff; Twilight leaves out launched and
scrubbed ones. Panel checks every 15 minutes, every 5 within 6 hours of a set launch
time, every minute in the last hour. If chips don't appear, `/api/setup-check` →
`launches.notes` says why.

## Twilight and The Brief open in a pop-up

Tapping a launch chip opens Twilight over the dashboard, on that launch; tapping a
sports chip opens The Brief the same way. Close with the X, by swiping the top bar
down, or by tapping the dimmed edge; the dashboard stays full screen. Both apps allow
being shown inside Panel only at http://192.168.86.207:8099 (their
`frame-ancestors` setting). If one comes up blank, open Panel at that address, or add
the other address to that app's `netlify.toml`. The small arrow button next to the X
opens the app in the browser instead.

## Sports in the status bar

Games and races come from The Brief's schedule feed (`statusBar.sportsFeedUrl` in
`src/config/home.ts`; chips open `briefUrl`). The feed is protected by a shared key:
put it in **brief_feed_key** on the Configuration tab — never in the code, the repo is
public. If chips don't appear, `/api/setup-check` → `sports.notes` says why. The feed is JSON:

```json
{ "events": [
  { "id": "suns-1024", "kind": "suns", "title": "Suns vs. Portland",
    "start": "2026-10-24T19:00:00-07:00", "end": null, "channel": "ESPN", "big": false }
] }
```

`kind` is suns, dbacks, f1, golf or major. `big: true` (F1 races, golf majors) shows the
event up to 3 days ahead; everything else shows today and tomorrow. F1 chips don't
show a channel.

## Tesla card

Comes from the Teslemetry integration in Home Assistant; entities are found on their
own. `/api/setup-check` → `tesla` lists what was found and what's missing (a missing
control shows dimmed on the Climate panel). The "en route home" row needs the
Teslemetry **Route** or **Destination** entity enabled (Settings → Devices →
WillaWilla → entities). The dashboard never wakes the car just to refresh; the first
button press wakes it (10–30 seconds).

Frunk and trunk: tap the ring dot on the car picture to open; it turns into an amber
"Trunk open" / "Frunk open" pill once the car reports it. Tap "Trunk open" to close
the power trunk. The frunk can only be closed by hand (Tesla doesn't allow closing it
remotely). The 4th button vents the windows (blue while vented); tap again to close
them. Uses Teslemetry's **Trunk**, **Frunk** and **Windows** cover entities.

Driving: the card shows the car on a moving road with the speed ("Driving · 42 mph",
"Driving · 0 mph" at a light) and the road it's on, plus a line with this drive's time
and miles so far. Driving home, the live map takes the picture's place and the line
shows when the car will be home. Turn on Teslemetry's **Shift state** and **Speed**
entities (Home Assistant → Settings → Devices → WillaWilla; both are off by default):
without them Panel can only tell the car is driving from its GPS position moving.

Zones: parked in a Home Assistant zone other than home, the card says so — a zone
named **Work** shows "At Work" ("Charging · Work" while charging). Make the zone in
Home Assistant → Settings → Areas, labels & zones → Zones. Addresses stay in Home
Assistant, not in Panel.

Tire pressure: on the Vehicles page, the psi button in the card's top corner switches
to a top-down view of the car with each tire's pressure and when it last reported (tires
only report while the car is awake). A tire 5 psi or more under the recommended 42 psi
turns amber, and the Home card says which one. Needs Teslemetry's four **Tire pressure**
entities turned on. The 42 and the 5 are `tirePsi` and `tireLowBy` in
`src/config/home.ts`.

### Tesla map

With **google_maps_key** set, the card shows a live map while the car is driving home
(the car, home and the way home, with the minutes left — "Arriving" at the end), and the Vehicles page gets a
**Location** map: the car with an arrow for the way it's heading, home, a dotted trail of
this drive, and — while navigating home — Google's route home in blue, with the arrival time
and any traffic delay. Drag or zoom to look around; the arrow button follows the car again.
The card only shows a map while the car is navigating home; the Vehicles page always shows
where the car is.

One-time setup (same Google Cloud project and key as the radar):
1. Cloud Console → APIs & Services → Library → **Routes API** → **Enable**.
2. Credentials → the Maps key → **API restrictions**: add **Routes API** next to Maps JavaScript
   API → Save. Keep the website restriction (`http://192.168.86.207:8099/*`): Panel sends that
   address with its route requests.
3. For the road name while driving ("I-5 S · San Juan Capistrano"): Library → **Geocoding
   API** → **Enable**, and add **Geocoding API** to the key's API restrictions. The browser
   asks Google at most once a minute while the car drives (never while parked). Without it the
   road name is simply left out.
4. Home Assistant → Settings → Devices → WillaWilla → enable the **GPS heading** and
   **Traffic delay** entities (both are off by default). Without them the arrow follows the
   drive and the traffic line is hidden.

Panel asks Google for the route at most once a minute, and only while the car is navigating
home (the free monthly allowance covers this many times over). `/api/setup-check` →
`tesla.map` says whether the route requests work, and why not if Google refuses. If Panel is
opened at a different address, set `PANEL_URL` to it.

## Vacuum card and Map & rooms

Comes from the Roborock integration. Home Assistant only offers the Roborock map as a
picture, so the dashboard draws its own floor plan from `vacuum.rooms` in
`src/config/home.ts` and matches each room by name to the rooms in the Roborock app
(`match` lists the names to try). `/api/setup-check` → `vacuum` shows the Roborock room
names and which ones matched — if a preset or room is greyed out, fix the name there or
in `match`.

Drawing areas on the map is off until the floor plan is lined up with the robot's map
(`vacuum.calibration`); rooms work without it.

**Finish time:** the card shows "Done ~time" once every room left in the run has been
timed on an earlier clean (vacuum + mop and vacuum only are timed separately).
`/api/setup-check` → `vacuum.roomTimes` lists what's been learned. Mopping uses Medium
water unless another level is picked on the Map & rooms page (`vacuum.waterDefault` in
`src/config/home.ts`).

## Calendar

Page 2 shows every Google calendar Home Assistant has (`calendars: ['*']` in
`src/config/home.ts`; list names instead to pick, or add names to `hiddenCalendars`).
Each calendar gets its own color; pin one in `calendarColors`. The chips above the
calendar hide or show a calendar on that screen only. The status bar shows events from
`statusBar.calendars` (Family). Tapping an event shows its details and a Google map of
its location; maps always open in Google Maps.

**Times (1.7.0):** type into the start or end box ("1030a", "2:15 pm", "14:00") or tap the hour,
minute and AM / PM in the picker under it. On the tablet the first tap opens the picker without the
keyboard; tap the box again to type.

**Adding, editing and deleting (1.6.0).** The **+** next to Week / Month adds an event on
the picked day; **press and hold any day** (week strip or month grid) to add one on that
day. Family is picked by default. Event details have **Edit · Delete**. A repeating event
asks "This event / This and following" (delete) or "This event / All events" (save).
Delete is one tap with a 5-second **Undo**; it goes to Google when the bar runs out.

Reading still comes from Home Assistant. Changes go straight to Google through Panel's
own link (Home Assistant's Google connection can't edit an event), then Panel asks Home
Assistant to sync, so a change shows at once ("Saving" until Google confirms).

One-time setup:
1. Google Cloud Console → the **Home Assistant Dashboard** project → APIs & Services →
   Credentials → Create credentials → OAuth client ID → **Desktop app**, named "Panel".
2. Paste the Client ID and Client secret into **google_client_id** and
   **google_client_secret**, Save, Restart Panel.
3. On the dashboard tap **+** → **Open Google sign-in** → pick the account → Allow.
   Google ends on a page that won't load (`http://127.0.0.1:8099/google-linked?…`);
   copy that whole address and paste it into Panel → **Link**.

The OAuth consent screen of the project must be **In production** (not Testing), or Google
ends the sign-in after 7 days. The lasting sign-in is saved in Panel's `/data` folder
(`google-calendar.json`); `/api/setup-check` → `googleCalendarLink` shows its state and the
calendars Google reports. To undo: Google Account → Security → Third-party access → remove it.

## Weather

The card starts **collapsed** to its top row; drag the bar along its bottom down to open the rest
(or tap it), and up to close. The shopping list takes whatever height is left. A rain chip on the
collapsed row warns of rain (40% or more) later today or in the next 6 days.

The card tints with the sky (warm by day, indigo at night, blue in rain), shows sunrise →
sunset as an arc, a temperature curve over rain-chance bars for the next 12 hours, and the
next 6 days (today first) as low-to-high bars with the rain chance and inches, and under them an
hour-by-hour rain plot lined up with the days (1.8.1). Tap a day (or today's temperature) for that day: rain total
and peak chance, wind and gusts, UV, humidity range, dew point, sunrise/sunset and a 24-hour
chart with inches of rain per 3 hours. Data: Open-Meteo, every 10 minutes.

**Radar** (header button) loops the last hour of National Weather Service radar in 5-minute
frames (Iowa State University's free tile service, `nexrad-n0q`), on a dark Google map
centered on the house, blending each frame into the next (it waits until all 12 frames
have loaded before playing); tap the timeline to stop on a frame, pinch or +/− to zoom, full
screen from the corner button. It needs **google_maps_key**: in the same Google Cloud
project turn on **Maps JavaScript API** (Google wants a billing account on the project; the
free monthly allowance covers a home dashboard), create an **API key**, restrict it to that
API and to `http://192.168.86.207:8099/*`, paste it in, Save, Restart.

## Cameras (Eufy)

**One-time setup (done Nov 8, 2026):** the **eufy-sdk bridge** app (repository
`https://github.com/mega-yfue/ha-eufy-sdk-addon`, signed in with the secondary Eufy account, country `US`)
and the **eufy-sdk** integration (Marketplace → custom repository `https://github.com/mega-yfue/ha-eufy-sdk`,
host = the Lenovo's address, port 3000). Panel finds the cameras on its own, by device; renaming a camera
in the Eufy app needs no change here.

- **Card:** latest motion picture ("Last event"), what the camera saw ("Detection"), Battery and Solar
  Intensity. Tap a camera for live view.
- **Live view** uses Home Assistant's own WebRTC (no extra setting). It ends when the pop-up closes, when the
  screen stops checking in for 30 seconds, and after 10 minutes, so a battery camera is never left streaming.
- **Stargazing** turns the cameras' "Spotlight Enabled" switches off for an hour (only the ones that were on),
  and back on when the hour is up. It survives an app restart.
- **Motion chips:** 3 minutes for motion now; motion between 10 PM and 6 AM stays until 9 AM.
- **Nothing showing?** Open `/api/setup-check` → `cameras`: each camera lists the entities it found. A
  `null` means that entity is missing or disabled in Home Assistant (Settings → Devices & services → eufy-sdk →
  the camera → entities).
- **Bridge log noise:** `get_devs_list failed (10003)` repeats with a shared (secondary) account; harmless.
- The secondary Eufy account must stay **signed out of the Eufy app** on phones (Eufy allows one session).

## Shopping list (Bring!)

**One-time setup:** in Home Assistant, Settings → Devices & services → Add integration → **Bring!**, and sign
in with your Bring! email and password (if you signed up with Google or Apple, set a password in the Bring! app
first). Each Bring! list then shows under **To-do lists** in Home Assistant's sidebar, and the card finds them on
its own — no names to set in Panel. Optional: use a second Bring! account invited to your lists, so Panel never
uses your main login.

- **Tap** an item = checked off (fades into the Recent chips; tap again while fading to undo). **Tap a Recent
  chip** = back on the list. **Press and hold** an item = details ("2 lbs") and Remove.
- **List picker** (header): every Bring! list by name; remembered per screen.
- **Going shopping / Done shopping** send Bring!'s notice to the list's members.
- Changes from the dashboard reach Bring! at once; changes in the Bring! app show here within about 90 seconds.
- `/api/setup-check` → `shopping` lists the Bring! lists Panel found. If a renamed list keeps its old name,
  reload the Bring! integration in Home Assistant (Settings → Devices & services → Bring! → ⋮ → Reload).

## Irrigation card

Quick-run chips come from `src/config/irrigation.ts`: tap to start, hold to choose the
time. The 7-day strip shows each schedule's runs; tap a day to skip a run. Rachio's API
can only skip a schedule's **next** run and has no "unskip", so later runs say so and
an undo has to be done in the Rachio app. There is no "next zone" button because
Rachio's public API has no command for it. The rain while watering is decoration only;
set `RAIN_EFFECT = false` in `src/config/irrigation.ts` to turn it off.
