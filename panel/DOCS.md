# Panel

Connor's home dashboard. Open it at **http://192.168.86.207:8099** on the tablet,
phones or computer (home Wi-Fi only) and bookmark it.

## Settings (Configuration tab)

- **passcode** — each device enters this once. Changing it signs every device out.
- **rachio_api_key** — Rachio app → Account → API Access.
- **weather_lat / weather_lon / weather_location_name** — forecast location.
- **brief_feed_key** — the same value as `PANEL_FEED_KEY` in The Brief's Netlify settings. Turns on sports chips in the status bar.

Click **Save**, then **Restart** the app after changing settings.

## If something looks wrong

- **Log tab**: shows what the dashboard is doing and any errors.
- **http://192.168.86.207:8099/api/setup-check** (after unlocking the dashboard):
  every light, speaker, thermostat and calendar name the dashboard found. Use it to
  fix names in `src/config/home.ts`.

## Quick-play buttons saved from the dashboard

Buttons saved with **Save as quick-play button** on the Sonos page are kept in the
app's own storage, so they survive restarts and updates. Rename or delete them on the
Sonos page. The buttons in `src/config/home.ts` can only be changed in code.

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

## Irrigation card

Quick-run chips come from `src/config/irrigation.ts`: tap to start, hold to choose the
time. The 7-day strip shows each schedule's runs; tap a day to skip a run. Rachio's API
can only skip a schedule's **next** run and has no "unskip", so later runs say so and
an undo has to be done in the Rachio app. There is no "next zone" button because
Rachio's public API has no command for it. The rain while watering is decoration only;
set `RAIN_EFFECT = false` in `src/config/irrigation.ts` to turn it off.
