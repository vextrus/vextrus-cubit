/*
 * Where sign-in sends someone back to: `?next=` on /sign-in holds the address they were at, and is
 * followed only when it is a path inside this app. Anything else, an absolute or protocol-relative
 * URL (`https://evil.example`, `//evil.example`, `/\evil.example`), a scheme (`javascript:`), their
 * percent-encoded forms, a control character or space the browser would strip, or a page outside the
 * frame (sign-in itself, the chooser, the access pages, an invitation link), falls back to /projects.
 */
import { PATHS } from '@/app/AppLink'

const OUTSIDE_THE_FRAME = [PATHS.signIn, PATHS.join, PATHS.chooseDeveloper, PATHS.accessEnded, PATHS.noAccess]
const BASE = 'https://vextrus.invalid'

function decodeFully(value: string): string | null {
  let current = value
  for (let i = 0; i < 4; i++) {
    let next: string
    try {
      next = decodeURIComponent(current)
    } catch {
      return null
    }
    if (next === current) return current
    current = next
  }
  return null
}

/** A safe in-app address to go to after signing in, or /projects. The fragment is never kept. */
export function safeNext(next: unknown): string {
  const fallback = PATHS.projects
  if (typeof next !== 'string' || next.length === 0 || next.length > 2000) return fallback
  // Control characters, spaces and backslashes: browsers drop or turn them into slashes.
  if (/[\u0000- \u007f-\u009f\\]/.test(next)) return fallback // eslint-disable-line no-control-regex -- control characters are what it refuses
  if (!next.startsWith('/') || next.startsWith('//')) return fallback
  const decoded = decodeFully(next)
  if (decoded === null || decoded.startsWith('//') || /[\u0000- \u007f-\u009f\\]/.test(decoded)) return fallback // eslint-disable-line no-control-regex -- as above
  let url: URL
  try {
    url = new URL(next, BASE)
  } catch {
    return fallback
  }
  if (url.origin !== BASE) return fallback
  // Dot segments normalise away in parsing: "/.//evil.example" becomes the protocol-relative
  // "//evil.example". The address followed is the parsed one, so it is checked again as parsed.
  const parsed = decodeFully(url.pathname)
  if (parsed === null || url.pathname.startsWith('//') || parsed.startsWith('//') || /[\u0000- \u007f-\u009f\\]/.test(parsed)) return fallback // eslint-disable-line no-control-regex -- as above
  const path = parsed.toLowerCase().replace(/\/+$/, '')
  if (OUTSIDE_THE_FRAME.some((p) => path === p || path.startsWith(`${p}/`))) return fallback
  return url.pathname + url.search
}
