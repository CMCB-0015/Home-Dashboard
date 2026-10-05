// Rachio sprinklers — start/stop zones, plus a webhook Rachio can push events to. API key: Rachio app → Account → API Access.
import type { Config } from '@netlify/functions'
import { stub } from './_shared/http.ts'

// Not connected yet — logs requests and replies "ok". Needs: RACHIO_API_KEY
// The webhook stays open because Rachio's servers call it (it will check its own secret once connected).
export default async (req: Request) =>
  stub('rachio', req, ['RACHIO_API_KEY'], new URL(req.url).pathname.endsWith('/webhook'))

export const config: Config = { path: ['/api/rachio/command', '/api/rachio/webhook'] }
