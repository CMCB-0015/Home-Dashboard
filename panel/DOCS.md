# Panel

Connor's home dashboard. Open it at **http://192.168.86.207:8099** on the tablet,
phones or computer (home Wi-Fi only) and bookmark it.

## Settings (Configuration tab)

- **passcode** — each device enters this once. Changing it signs every device out.
- **rachio_api_key** — Rachio app → Account → API Access.
- **weather_lat / weather_lon / weather_location_name** — forecast location.
- **brief_feed_key** — the same value as `PANEL_FEED_KEY` in The Brief's Netlify settings. Turns on sports chips in the status bar.
- **google_client_id / google_client_secret** — Panel's own Google sign-in key, for adding, editing and deleting calendar events (see Calendar below).
- **google_maps_key** — a Google Maps key for the weather radar (see Weather below).

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

The card tints with the sky (warm by day, indigo at night, blue in rain), shows sunrise →
sunset as an arc, a temperature curve over rain-chance bars for the next 12 hours, and the
next 6 days as low-to-high bars. Tap a day (or today's temperature) for that day: rain total
and peak chance, wind and gusts, UV, humidity range, dew point, sunrise/sunset and a 24-hour
chart with inches of rain per 3 hours. Data: Open-Meteo, every 10 minutes.

**Radar** (header button) loops the last hour of National Weather Service radar in 5-minute
frames (Iowa State University's free tile service, `nexrad-n0q`), on a dark Google map
centered on the house; tap the timeline to stop on a frame, pinch or +/− to zoom, full
screen from the corner button. It needs **google_maps_key**: in the same Google Cloud
project turn on **Maps JavaScript API** (Google wants a billing account on the project; the
free monthly allowance covers a home dashboard), create an **API key**, restrict it to that
API and to `http://192.168.86.207:8099/*`, paste it in, Save, Restart.

## Irrigation card

Quick-run chips come from `src/config/irrigation.ts`: tap to start, hold to choose the
time. The 7-day strip shows each schedule's runs; tap a day to skip a run. Rachio's API
can only skip a schedule's **next** run and has no "unskip", so later runs say so and
an undo has to be done in the Rachio app. There is no "next zone" button because
Rachio's public API has no command for it. The rain while watering is decoration only;
set `RAIN_EFFECT = false` in `src/config/irrigation.ts` to turn it off.
