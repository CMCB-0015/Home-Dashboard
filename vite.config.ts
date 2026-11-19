import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Panel's version, from the Home Assistant app file, shown in the Settings menu's footer
const PANEL_VERSION = (() => {
  try { return readFileSync('panel/config.yaml', 'utf8').match(/^version:\s*"?([^"\n]+)"?/m)?.[1] ?? 'dev' } catch { return 'dev' }
})()

// While developing, the dashboard server runs on port 8099 (npm run dev:server)
// and Vite passes /api requests through to it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __PANEL_VERSION__: JSON.stringify(PANEL_VERSION) },
  server: {
    proxy: { '/api': { target: 'http://localhost:8099', changeOrigin: false } },
  },
})
