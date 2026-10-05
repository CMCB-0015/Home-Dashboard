# Panel — home dashboard

A two-page dashboard for the house. Swipe between them.

- **Page 1 · Home** — cameras (latest motion snapshot, Home/Away), Tesla, climate, lights, Sonos, vacuum, irrigation
- **Page 2 · Today & this week** — Google Calendar, weather, Todoist shopping list

Tap any tile for its detail page.

## Passcode

Set `PANEL_PASSCODE` in Netlify → Site configuration → Environment variables. Each device enters it once.

## What's live

| Service | Status |
|---|---|
| Weather (Open-Meteo) | ✅ Live — no key needed |
| Rachio | ✅ Live once `RACHIO_API_KEY` is set |
| Everything else | Demo data until connected (buttons are safe to press) |

## Running it in your Codespace

```bash
npm install      # first time only
npm run dev      # then open the "5173" link that pops up
```

## Testing with real data before publishing (saves Netlify deploy credits)

```bash
cp .env.example .env      # once — then fill in PANEL_PASSCODE and any keys in .env
npm run dev:netlify       # runs the site AND the backend in the Codespace; open the "8888" link
```

`.env` is never uploaded to GitHub (it's in `.gitignore`).

## Irrigation quick-run buttons

Edit `src/config/irrigation.ts`. Names are matched to your Rachio zones and schedules;
the Irrigation detail page says if one doesn't match.

## Publishing

Push to GitHub. Netlify rebuilds the site automatically (settings come from `netlify.toml`).
Check the backend at `https://YOUR-SITE.netlify.app/api/health`.

## Where things live

```
src/pages/          the two pages and the detail screens
src/components/     tiles and building blocks
src/data/mockData.ts  demo data (same shape as live data)
src/index.css       all colors
netlify/functions/  the backend — one file per service
.env.example        every key the services will need, in connection order
```

## Connection order

Rachio ✅ → Todoist → Google (Calendar + Nest) → Hue → Sonos → Tesla → Eufy → Roborock.
BMW waits on BMW CarData access.
