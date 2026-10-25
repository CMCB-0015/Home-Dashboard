# Panel — home dashboard

A two-page dashboard for the house. Swipe between them.

- **Page 1 · Home** — status bar (alerts, today's calendar, games), cameras, Tesla, climate, lights, Sonos, vacuum, irrigation
- **Page 2 · Today & this week** — Google Calendar, weather, shopping list

It runs on the Lenovo as a **Home Assistant app** and only works on the home Wi-Fi.
Open **http://192.168.86.207:8099** and bookmark it.

## What's live

| Service | How | Status |
|---|---|---|
| Lights (Hue), Climate (Nest), Sonos, Calendar | Home Assistant, live updates | ✅ |
| Rachio | Its own code, checked around the clock | ✅ once the API key is set |
| Sports in the status bar | The Brief's schedule feed, key in the app's `brief_feed_key` setting | ✅ once the key is set |
| Tesla (WillaWilla) | Teslemetry in Home Assistant | ✅ |
| Vacuum (Roborock S8 Pro Ultra) | Roborock in Home Assistant, rooms matched by name | ✅ |
| Weather | Open-Meteo, no key | ✅ |
| Cameras (Eufy), Shopping list | — | Placeholder cards until connected |

## Testing in the Codespace

```bash
npm install              # first time, or after package changes
cp .env.example .env     # once — then set PANEL_PASSCODE in .env
npm run dev:all          # runs the dashboard server and the screens together
```

Open the **5173** link from the Ports tab. The Codespace can't reach Home Assistant
(it's in the cloud, the house is local-only), so the Home Assistant tiles show demo
data there. Rachio and weather are real if `.env` has the Rachio key.

`npm run check` type-checks everything. `npm run build` builds what the Lenovo runs.

## Releasing a new version to the Lenovo

1. Push your changes to GitHub.
2. Raise `version` in `panel/config.yaml` (for example `1.0.0` → `1.0.1`) and add a line to
   `panel/CHANGELOG.md`. Push again.
3. In Home Assistant: **Settings → Apps → Panel → Update** (use ⋮ → **Check for updates**
   on the App store page if it doesn't show yet). The Lenovo downloads and builds the new
   code, which takes a few minutes.

## Changing what the tiles show

- `src/config/home.ts` — which lights are on the Lights card, timer lights, the bedroom cans,
  the bedtime lamp, the Sonos quick-play buttons and speaker groups, and the calendars. Names are matched loosely.
  After unlocking the dashboard, `/api/setup-check` lists every name it found.
- `src/config/irrigation.ts` — the Rachio quick-run buttons.

## Where things live

```
src/pages/            the two pages and the detail screens
src/components/       tiles and building blocks (lights/ has the Lights card and panel)
src/config/           settings you edit (home.ts, irrigation.ts)
src/data/mockData.ts  demo data (same shape as live data)
src/index.css         all colors
server/               the dashboard server: Home Assistant connection, Rachio, weather, passcode
panel/                the Home Assistant app (version, settings, how it's built)
repository.yaml       lets Home Assistant install the app from this repo
```
