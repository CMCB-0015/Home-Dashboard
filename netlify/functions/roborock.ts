// Roborock vacuum — start, pause, dock, run profiles (community cloud library, picked when we get there).
import type { Config } from '@netlify/functions'
import { stub } from './_shared/http.ts'

// Not connected yet — logs requests and replies "ok". Needs: ROBOROCK_USERNAME, ROBOROCK_PASSWORD
export default async (req: Request) => stub('roborock', req, ['ROBOROCK_USERNAME', 'ROBOROCK_PASSWORD'])

export const config: Config = { path: '/api/roborock/command' }
