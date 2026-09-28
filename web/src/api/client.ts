/*
 * The typed API client (ADR 0022: the React SPA takes its types from the OpenAPI schema). The types
 * are generated at build time, never committed: `npm run api:types` runs openapi-typescript on the
 * schema ticket 01a's `vextrus/api.py` serves, into src/api/schema.gen.ts, and ticket 03 adds that
 * step to web.yml. Until then this module holds only what does not depend on the schema.
 *
 *   import type { paths } from './schema.gen'
 *   export const api = createApi<paths>()
 */
import createClient, { type Middleware } from 'openapi-fetch'

/** Django's CSRF cookie and header (django-ninja session auth with CSRF, docs/plans/M0.md, 01a). */
const CSRF_COOKIE = 'csrftoken'
const CSRF_HEADER = 'X-CSRFToken'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE'])

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`
  for (const part of document.cookie.split(';')) {
    const c = part.trim()
    if (c.startsWith(prefix)) return decodeURIComponent(c.slice(prefix.length))
  }
  return undefined
}

export const csrf: Middleware = {
  onRequest({ request }) {
    if (SAFE_METHODS.has(request.method)) return request
    const token = readCookie(CSRF_COOKIE)
    if (token) request.headers.set(CSRF_HEADER, token)
    return request
  },
}

/** A client for the app's own API: same origin, the session cookie, CSRF on every unsafe method. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the generated `paths` type is supplied by the caller
export function createApi<Paths extends {}>() {
  const client = createClient<Paths>({ baseUrl: '/', credentials: 'same-origin' })
  client.use(csrf)
  return client
}
