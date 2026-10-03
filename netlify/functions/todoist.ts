// Todoist shopping list — add and check off items. Token: Todoist → Settings → Integrations → Developer.
import type { Config } from '@netlify/functions'
import { stub } from './_shared/http.ts'

// Not connected yet — logs requests and replies "ok". Needs: TODOIST_API_TOKEN, TODOIST_PROJECT_ID
export default async (req: Request) => stub('todoist', req, ['TODOIST_API_TOKEN', 'TODOIST_PROJECT_ID'])

export const config: Config = { path: ['/api/todoist/add', '/api/todoist/toggle'] }
