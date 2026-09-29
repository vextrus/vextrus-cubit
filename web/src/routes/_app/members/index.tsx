/*
 * /members (docs/design/m0-screens.md §4.4), in the frame. A Guest has no Members page: the address
 * is "Page not found" for them, decided before anything is asked of the API, so no refused call is
 * made and nothing flashes (§1.4).
 */
import { createFileRoute, notFound } from '@tanstack/react-router'
import { NotFound } from '@/app/Frame'
import { sessionQuery } from '@/app/session'
import { can } from '@/auth'
import { MembersPage } from '@/members'

export const Route = createFileRoute('/_app/members/')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (!can(session, 'people')) throw notFound({ routeId: '/_app/members/' })
  },
  notFoundComponent: NotFound,
  component: MembersPage,
})
