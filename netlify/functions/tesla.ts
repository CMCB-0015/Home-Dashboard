// Tesla — lock/unlock and preconditioning through the official Fleet API. Commands also need the app's key paired to the car.
import type { Config } from '@netlify/functions'
import { stub } from './_shared/http.ts'

// Not connected yet — logs requests and replies "ok". Needs: TESLA_CLIENT_ID, TESLA_CLIENT_SECRET, TESLA_REFRESH_TOKEN
export default async (req: Request) => stub('tesla', req, ['TESLA_CLIENT_ID', 'TESLA_CLIENT_SECRET', 'TESLA_REFRESH_TOKEN'])

export const config: Config = { path: '/api/tesla/command' }
