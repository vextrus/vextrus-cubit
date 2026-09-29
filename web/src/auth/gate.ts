/*
 * The frame's door (docs/design/m0-screens.md §4.1, §4.2): before any screen after sign-in renders,
 * the session is read; signed out goes to /sign-in with the address to come back to, and a user with no
 * Developer to work in goes to 4.1's page for it: "Which Developer?", "Access ended" or "No access to
 * anything". The pages outside the frame use the same rule the other way round, so none is ever blank.
 *
 * The door is passed on every move inside the frame, not only the first: the session is read again
 * each time, so a member whose access was revoked meanwhile gets "Access ended" on their next click,
 * with no reload (4.4's finish line, step 10), and a tab whose session another tab changed learns it.
 */
import { redirect, type ParsedLocation } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { ApiRefused } from '@/api/client'
import { emitSessionEvent } from '@/api/events'
import { PATHS } from '@/app/AppLink'
import { NoDeveloper, gateOf, meQuery, sessionQuery, type Me } from '@/app/session'
import { safeNext } from './next'

/** Where `me` belongs, coming back to `next` once working in a Developer. */
export function gateHref(me: Me, next?: string): string {
  const gate = gateOf(me)
  const back = next ? `?${new URLSearchParams({ next })}` : ''
  if (gate.to === 'frame') return safeNext(next)
  if (gate.to === 'choose') return `${PATHS.chooseDeveloper}${back}`
  if (gate.to === 'ended') return PATHS.accessEnded
  return PATHS.noAccess
}

/** /sign-in, asking to come back to `next` (the address, never its fragment). */
export function signInHref(next?: string): string {
  const safe = next === undefined ? undefined : safeNext(next)
  return safe && safe !== PATHS.projects ? `${PATHS.signIn}?${new URLSearchParams({ next: safe })}` : PATHS.signIn
}

/** How long a move inside the frame waits for the session read again before going on with the one held. */
export const READ_AGAIN_WAIT_MS = 800

/**
 * The session read again as the frame is moved in. Out of reach, or signed out (the frame's
 * Signed-out dialog says so over the page, which stays), the session held stands; slow, the move
 * goes on after a moment with the session held, and the answer, when it comes, is acted on as the
 * frame's watch acts on any (SessionWatch).
 */
async function readAgain(queryClient: QueryClient): Promise<void> {
  const read = queryClient.fetchQuery({ ...sessionQuery, staleTime: 0, retry: false }).then(
    () => undefined,
    (error: unknown) => {
      if (error instanceof TypeError || (error instanceof ApiRefused && error.status === 401)) return
      throw error
    },
  )
  let waited: ReturnType<typeof setTimeout> | undefined
  const wait = new Promise<void>((resolve) => {
    waited = setTimeout(resolve, READ_AGAIN_WAIT_MS)
  })
  // An answer that comes after the wait is not lost: the query holds it, and the watch acts on it.
  read.catch(() => undefined)
  try {
    await Promise.race([read, wait])
  } finally {
    clearTimeout(waited)
  }
}

/** The frame's `beforeLoad`: the session, or a redirect to where the user belongs. */
export async function enterFrame(queryClient: QueryClient, location: ParsedLocation, cause: 'enter' | 'stay' | 'preload' = 'enter'): Promise<void> {
  const held = queryClient.getQueryData(sessionQuery.queryKey) !== undefined
  try {
    // A move inside the frame reads the session again; entering it reads it (or uses the one just
    // read by signing in or choosing), and a preload (a pointer resting on a link) uses the one held.
    if (held && cause === 'stay') await readAgain(queryClient)
    else await queryClient.ensureQueryData(sessionQuery)
  } catch (error) {
    const here = location.pathname + location.searchStr
    if (error instanceof ApiRefused && error.status === 401) {
      queryClient.removeQueries({ queryKey: sessionQuery.queryKey })
      throw redirect({ href: signInHref(here) })
    }
    if (error instanceof NoDeveloper) {
      // Working in the frame when access ended: its watch clears what the frame held once it has gone.
      if (held) emitSessionEvent('no-developer')
      else queryClient.removeQueries({ queryKey: sessionQuery.queryKey })
      throw redirect({ href: gateHref(error.me, here) })
    }
    queryClient.removeQueries({ queryKey: sessionQuery.queryKey })
    throw error
  }
}

/** For a page outside the frame: `/api/me`, fresh, or a redirect to sign-in when signed out. */
export async function signedIn(queryClient: QueryClient): Promise<Me> {
  const me = await queryClient.fetchQuery(meQuery)
  if (!me) throw redirect({ href: PATHS.signIn })
  return me
}

/** For a page outside the frame shown only at one gate: elsewhere, go where the user belongs. */
export async function atGate(queryClient: QueryClient, gate: 'choose' | 'ended' | 'no-access'): Promise<Me> {
  const me = await signedIn(queryClient)
  const here = gateOf(me).to
  const fits = gate === 'choose' ? me.memberships.length > 0 : here === gate
  if (!fits) throw redirect({ href: gateHref(me) })
  return me
}
