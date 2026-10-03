# Panel — home dashboard

A two-page dashboard for the house. Swipe between them.

- **Page 1 · Home** — cameras (latest motion snapshot, Home/Away), Tesla, climate, lights, Sonos, vacuum, irrigation
- **Page 2 · Today & this week** — Google Calendar, weather, Todoist shopping list

Tap any tile for its detail page.

## What's live

| Service | Status |
|---|---|
| Weather (Open-Meteo) | ✅ Live — no key needed |
| Everything else | Demo data until connected (buttons are safe to press) |

## Running it in your Codespace

```bash
npm install      # first time only
npm run dev      # then open the "5173" link that pops up
```

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

Rachio → Todoist → Google (Calendar + Nest) → Hue → Sonos → Tesla → Eufy → Roborock.
BMW waits on BMW CarData access.
