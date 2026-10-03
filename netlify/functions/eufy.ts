// Eufy HomeBase Home/Away mode (and later, snapshots + live links) via the community eufy-security-client library.
import type { Config } from '@netlify/functions'
import { stub } from './_shared/http.ts'

// Not connected yet — logs requests and replies "ok". Needs: EUFY_USERNAME, EUFY_PASSWORD
export default async (req: Request) => stub('eufy', req, ['EUFY_USERNAME', 'EUFY_PASSWORD'])

export const config: Config = { path: '/api/eufy/guard-mode' }
