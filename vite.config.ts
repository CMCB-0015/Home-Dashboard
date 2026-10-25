import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// While developing, the dashboard server runs on port 8099 (npm run dev:server)
// and Vite passes /api requests through to it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { '/api': { target: 'http://localhost:8099', changeOrigin: false } },
  },
})
