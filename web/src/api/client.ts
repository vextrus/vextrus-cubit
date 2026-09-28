/*
 * The typed API client (ADR 0022: the React SPA takes its types from the OpenAPI schema). The types
 * are generated, never committed: `npm run api:types` runs openapi-typescript on the schema
 * `vextrus/api.py` serves, into src/api/schema.gen.ts (web.yml runs it before the typecheck).
 *
 *   import { api, unwrap } from '@/api/client'
 *   const me = await unwrap(api.GET('/api/me'))
 *   await unwrap(api.POST('/api/members/{membership_id}/revoke', { params: { path: { membership_id } } }))
 *
 * Every request goes through one transport (tests swap it for an in-memory backend, src/app/testing),
 * with the session cookie, and on every unsafe method the CSRF token, public operations included (the
 * API refuses an unsafe request without it: `platform.auth.csrf_failed`). The token is the cookie
 * Django sets; before the first unsafe request of a tab with no cookie yet, it is fetched from
 * `/api/auth/csrf`. Signing in rotates it, and the next request reads the new cookie.
 *
 * A refusal is read by `unwrap` into an `ApiRefused` (refusal.ts); a request that cannot reach the
 * server throws the browser's TypeError, which the frame shows as "Vextrus can't be reached". The
 * session's own refusals, signed out and no Developer, are announced to the frame (events.ts).
 */
import createClient, { type Middleware } from 'openapi-fetch'
import { emitSessionEvent } from './events'
import { refusalCode, sessionEventOf, unwrap } from './refusal'
import type { paths } from './schema.gen'

export { ApiRefused, readRefusal, unwrap } from './refusal'

/** Django's CSRF cookie and header (django-ninja session auth with CSRF, docs/plans/M0.md, 01a). */
const CSRF_COOKIE = 'csrftoken'
const CSRF_HEADER = 'X-CSRFToken'
const CSRF_PATH = '/api/auth/csrf'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE'])

type Transport = (request: Request) => Promise<Response>

let transport: Transport = (request) => fetch(request)

/** Tests only: answer every request with `fake` until the returned function restores the network. */
export function setTransport(fake: Transport): () => void {
  const before = transport
  transport = fake
  return () => {
    transport = before
  }
}

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`
  for (const part of document.cookie.split(';')) {
    const c = part.trim()
    if (c.startsWith(prefix)) return decodeURIComponent(c.slice(prefix.length))
  }
  return undefined
}

/** The CSRF token: the cookie, fetched first when the tab has none. */
async function csrfToken(): Promise<string | undefined> {
  const cookie = readCookie(CSRF_COOKIE)
  if (cookie) return cookie
  const response = await transport(new Request(CSRF_PATH, { credentials: 'same-origin' }))
  if (!response.ok) return undefined
  const body = (await response.json()) as { token?: unknown }
  return readCookie(CSRF_COOKIE) ?? (typeof body.token === 'string' ? body.token : undefined)
}

export const csrf: Middleware = {
  async onRequest({ request }) {
    if (SAFE_METHODS.has(request.method)) return request
    const token = await csrfToken()
    if (token) request.headers.set(CSRF_HEADER, token)
    return request
  },
}

/** Announces a refusal that ends the session's work here: signed out, or no Developer to work in. */
const sessionWatch: Middleware = {
  async onResponse({ response }) {
    if (response.status !== 401 && response.status !== 403) return undefined
    const event = sessionEventOf(await refusalCode(response.clone()))
    if (event) emitSessionEvent(event)
    return undefined
  },
}

/** A client for the app's own API: same origin, the session cookie, CSRF on every unsafe method. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the generated `paths` type is supplied by the caller
export function createApi<Paths extends {}>() {
  const client = createClient<Paths>({ baseUrl: '/', credentials: 'same-origin', fetch: (request) => transport(request) })
  client.use(csrf, sessionWatch)
  return client
}

/** The app's one client. */
export const api = createApi<paths>()

/**
 * A request to an operation the generated types do not hold yet (ticket #75's, until it merges; then
 * each caller moves to `api`). The same transport, CSRF and session watch; the body is JSON.
 */
export async function callLoose<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const request = new Request(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const prepared = (await csrf.onRequest?.({ request } as Parameters<NonNullable<Middleware['onRequest']>>[0])) ?? request
  const response = await transport(prepared as Request)
  await sessionWatch.onResponse?.({ request, response } as Parameters<NonNullable<Middleware['onResponse']>>[0])
  const parsed = response.status === 204 ? undefined : await response.json().catch(() => undefined)
  return unwrap(Promise.resolve(response.ok ? { data: parsed as T, response } : { error: parsed, response }))
}
