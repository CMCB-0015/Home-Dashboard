// Sonos — play/pause, skip, volume through the official Sonos Control API.
import type { Config } from '@netlify/functions'
import { stub } from './_shared/http.ts'

// Not connected yet — logs requests and replies "ok". Needs: SONOS_CLIENT_ID, SONOS_CLIENT_SECRET, SONOS_REFRESH_TOKEN
export default async (req: Request) => stub('sonos', req, ['SONOS_CLIENT_ID', 'SONOS_CLIENT_SECRET', 'SONOS_REFRESH_TOKEN'])

export const config: Config = { path: '/api/sonos/command' }
