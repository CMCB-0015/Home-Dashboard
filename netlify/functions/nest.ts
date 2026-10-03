// Google Nest thermostats — target temperature and mode (Google Smart Device Management API).
import type { Config } from '@netlify/functions'
import { stub } from './_shared/http.ts'

// Not connected yet — logs requests and replies "ok". Needs: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, NEST_PROJECT_ID
export default async (req: Request) => stub('nest', req, ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'NEST_PROJECT_ID'])

export const config: Config = { path: '/api/nest/set' }
