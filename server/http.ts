// Small helpers for building replies.

export const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export const fail = (message: string, status = 500) => ok({ error: message }, status)

/** Read a POST body without crashing on bad input. */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try { return (await req.json()) as T } catch { return {} as T }
}
