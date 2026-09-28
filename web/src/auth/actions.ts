/*
 * The session's acts: signing in, out, and choosing the Developer to work in. Each ends by clearing
 * everything the query cache held, so nothing one person or one Developer saw is ever shown to
 * another (the trust boundary: sign out as the QS, sign in as the Guest, and no QS row appears).
 */
import { useCallback } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { ApiRefused, api, unwrap } from '@/api/client'
import type { MeOut75 } from '@/api/until75'
import { PATHS } from '@/app/AppLink'
import { meFrom, meQuery, type Me } from '@/app/session'
import { gateHref } from './gate'
import { rememberMarket } from './market'

type Router = ReturnType<typeof useRouter>

/** After signing in, joining or choosing: forget everything held, keep the new `/api/me`, and go on. */
export async function enter(queryClient: QueryClient, router: Router, out: MeOut75, next?: string): Promise<Me> {
  const me = meFrom(out)
  await forgetAll(queryClient)
  queryClient.setQueryData(meQuery.queryKey, me)
  if (me.market) rememberMarket(me.market)
  await router.navigate({ href: gateHref(me, next) })
  return me
}

/**
 * Forgets every query's data. Those a screen shows now are reset, so the screen waits for them to be
 * read again (a skeleton, never the old rows) rather than being cut loose from the cache still
 * showing them, as `clear()` would; the rest are dropped.
 */
export async function forgetAll(queryClient: QueryClient): Promise<void> {
  queryClient.removeQueries({ type: 'inactive' })
  await queryClient.resetQueries({ type: 'active' }).catch(() => undefined)
  queryClient.removeQueries({ type: 'inactive' })
}

/** Signs in with an email and password; a refusal is thrown as an `ApiRefused`. */
export async function signIn(email: string, password: string): Promise<MeOut75> {
  return (await unwrap(api.POST('/api/auth/sign-in', { body: { email, password } }))) as MeOut75
}

/** Signs out: the API ends the session (already ended is fine), the cache is cleared, then /sign-in. */
export async function signOut(queryClient: QueryClient, router: Router): Promise<void> {
  try {
    await unwrap(api.POST('/api/auth/sign-out'))
  } catch (error) {
    if (!(error instanceof ApiRefused && error.status === 401)) throw error
  }
  await router.navigate({ href: PATHS.signIn })
  await forgetAll(queryClient)
}

/** Works in another of the user's Developers; the cache is cleared and the projects list opens. */
export async function chooseDeveloper(queryClient: QueryClient, router: Router, developerId: string, next?: string): Promise<Me> {
  const out = (await unwrap(api.POST('/api/me/developer', { body: { developer_id: developerId } }))) as MeOut75
  return enter(queryClient, router, out, next)
}

export function useSignOut(): () => Promise<void> {
  const queryClient = useQueryClient()
  const router = useRouter()
  return useCallback(() => signOut(queryClient, router), [queryClient, router])
}

export function useChooseDeveloper(): (developerId: string, next?: string) => Promise<Me> {
  const queryClient = useQueryClient()
  const router = useRouter()
  return useCallback((developerId, next) => chooseDeveloper(queryClient, router, developerId, next), [queryClient, router])
}
