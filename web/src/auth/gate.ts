/*
 * The frame's door (docs/design/m0-screens.md §4.1, §4.2): before any screen after sign-in renders,
 * the session is read; signed out goes to /sign-in with the address to come back to, and a user with no
 * Developer to work in goes to 4.1's page for it: "Which Developer?", "Access ended" or "No access to
 * anything". The pages outside the frame use the same rule the other way round, so none is ever blank.
 */
import { redirect, type ParsedLocation } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { ApiRefused } from '@/api/client'
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

/** The frame's `beforeLoad`: the session, or a redirect to where the user belongs. */
export async function enterFrame(queryClient: QueryClient, location: ParsedLocation): Promise<void> {
  try {
    await queryClient.ensureQueryData(sessionQuery)
  } catch (error) {
    queryClient.removeQueries({ queryKey: sessionQuery.queryKey })
    const here = location.pathname + location.searchStr
    if (error instanceof ApiRefused && error.status === 401) throw redirect({ href: signInHref(here) })
    if (error instanceof NoDeveloper) throw redirect({ href: gateHref(error.me, here) })
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
