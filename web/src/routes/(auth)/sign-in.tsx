/*
 * /sign-in (docs/design/m0-screens.md §4.2), outside the frame: signed in already, it goes where the
 * user belongs (never a blank page); `?next=` is the address to come back to, checked when followed.
 */
import { createFileRoute, redirect } from '@tanstack/react-router'
import { SignInPage, gateHref, RouteError } from '@/auth'
import { meQuery } from '@/app/session'

export const Route = createFileRoute('/(auth)/sign-in')({
  validateSearch: (search: Record<string, unknown>): { next?: string } => (typeof search.next === 'string' ? { next: search.next } : {}),
  beforeLoad: async ({ context, search }) => {
    // Unreachable, the form still shows: signing in says so.
    const me = await context.queryClient.fetchQuery({ ...meQuery, retry: false }).catch(() => null)
    if (me) throw redirect({ href: gateHref(me, search.next) })
  },
  component: SignInPage,
  errorComponent: RouteError,
})
