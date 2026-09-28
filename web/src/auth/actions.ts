/*
 * The session's acts: signing in, out, and choosing the Developer to work in. Each ends by clearing
 * everything the query cache held, so nothing one person or one Developer saw is ever shown to
 * another (the trust boundary: sign out as the QS, sign in as the Guest, and no QS row appears).
 */
import { useCallback, useMemo } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { ApiRefused, api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'
import { PATHS } from '@/app/AppLink'
import { meFrom, meQuery, type Me } from '@/app/session'
import { useToast } from '@/ui'
import { gateHref } from './gate'
import { tellOtherTabs } from './tabs'

type Router = ReturnType<typeof useRouter>
type MeOut = components['schemas']['MeOut']

/** What the session's acts clear: the query cache, the router's cached pages, and the toast. */
export interface Held {
  queryClient: QueryClient
  router: Router
  clearToast: () => void
}

/**
 * The session's epoch, per app: it moves on whenever what the app held is forgotten (a sign-out, a
 * switch, another person, access ended). An act awaited across that moment must not then show its
 * toast or write its answer into the cache, which belong to someone or somewhere else by now.
 */
const epochs = new WeakMap<QueryClient, number>()

/** Marks that everything held for the session so far is being forgotten. */
export function sessionChanged(queryClient: QueryClient): void {
  epochs.set(queryClient, (epochs.get(queryClient) ?? 0) + 1)
}

/**
 * Asked before an act's await: a check that is true while the session is still the one it was.
 *
 *   const current = sameSession(queryClient)
 *   await renew(id)
 *   if (current()) toast.show(…)
 */
export function sameSession(queryClient: QueryClient): () => boolean {
  const at = epochs.get(queryClient) ?? 0
  return () => (epochs.get(queryClient) ?? 0) === at
}

/** Who works in which Developer: the frame starts again, from nothing held, whenever it changes. */
export function identityOf(userId: string, developerId: string | null): string {
  return `${userId}:${developerId ?? ''}`
}

/** The identity this app's own act (sign-in, join, choose) moved to, so it is not taken for another tab's. */
const enteredHere = new WeakMap<QueryClient, string>()

/** True, once, when `identity` is the one this app's own act entered. */
export function tookEnteredHere(queryClient: QueryClient, identity: string): boolean {
  if (enteredHere.get(queryClient) !== identity) return false
  enteredHere.delete(queryClient)
  return true
}

/**
 * Forgets everything held for the person or Developer now leaving: every query's data (those a
 * screen shows now are reset, so the screen waits for them to be read again, never showing the old
 * rows, rather than being cut loose from the cache still showing them, as `clear()` would; the rest
 * are dropped), the router's cached pages (a project page's loader data would otherwise be shown
 * again under the same code in the next Developer), and a toast still on screen.
 */
export async function forgetAll({ queryClient, router, clearToast }: Held): Promise<void> {
  sessionChanged(queryClient)
  clearToast()
  router.clearCache()
  queryClient.removeQueries({ type: 'inactive' })
  await queryClient.resetQueries({ type: 'active' }).catch(() => undefined)
  queryClient.removeQueries({ type: 'inactive' })
}

/** After signing in, joining or choosing: forget everything held, keep the new `/api/me`, and go on. */
export async function enter(held: Held, out: MeOut, next?: string): Promise<Me> {
  const me = meFrom(out)
  enteredHere.set(held.queryClient, identityOf(me.user.id, me.developerId))
  await forgetAll(held)
  held.queryClient.setQueryData(meQuery.queryKey, me)
  tellOtherTabs(held.queryClient)
  await held.router.navigate({ href: gateHref(me, next) })
  // The page left behind is cached as it goes: drop it too.
  held.router.clearCache()
  return me
}

/** Signs in with an email and password; a refusal is thrown as an `ApiRefused`. */
export async function signIn(email: string, password: string): Promise<MeOut> {
  return (await unwrap(api.POST('/api/auth/sign-in', { body: { email, password } })))
}

/** Signs out: the API ends the session (already ended is fine), then /sign-in, and everything held is forgotten. */
export async function signOut(held: Held): Promise<void> {
  try {
    await unwrap(api.POST('/api/auth/sign-out'))
  } catch (error) {
    if (!(error instanceof ApiRefused && error.status === 401)) throw error
  }
  tellOtherTabs(held.queryClient)
  await held.router.navigate({ href: PATHS.signIn })
  await forgetAll(held)
}

/** Works in another of the user's Developers; everything held is forgotten and the projects list opens. */
export async function chooseDeveloper(held: Held, developerId: string, next?: string): Promise<Me> {
  const out = (await unwrap(api.POST('/api/me/developer', { body: { developer_id: developerId } })))
  return enter(held, out, next)
}

export function useHeld(): Held {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { clear } = useToast()
  return useMemo(() => ({ queryClient, router, clearToast: clear }), [queryClient, router, clear])
}

export function useEnter(): (out: MeOut, next?: string) => Promise<Me> {
  const held = useHeld()
  return useCallback((out, next) => enter(held, out, next), [held])
}

export function useSignOut(): () => Promise<void> {
  const held = useHeld()
  return useCallback(() => signOut(held), [held])
}

export function useChooseDeveloper(): (developerId: string, next?: string) => Promise<Me> {
  const held = useHeld()
  return useCallback((developerId, next) => chooseDeveloper(held, developerId, next), [held])
}
