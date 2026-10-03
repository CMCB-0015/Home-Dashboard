// Philips Hue lights — on/off and brightness through the Hue cloud (remote) API.
import type { Config } from '@netlify/functions'
import { stub } from './_shared/http.ts'

// Not connected yet — logs requests and replies "ok". Needs: HUE_CLIENT_ID, HUE_CLIENT_SECRET, HUE_REFRESH_TOKEN, HUE_APP_KEY
export default async (req: Request) => stub('hue', req, ['HUE_CLIENT_ID', 'HUE_CLIENT_SECRET', 'HUE_REFRESH_TOKEN', 'HUE_APP_KEY'])

export const config: Config = { path: '/api/hue/set' }
