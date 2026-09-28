/*
 * A project the member may open (docs/plans/M0.md, "Project scope"): any other code, another
 * Developer's project or one not given, is "Page not found", so its existence never leaks.
 *
 * A route's notFoundComponent replaces that route's own component, so a not-found thrown here or below
 * is handled by this route (its component is only an outlet), and the frame drawn by `_app` stays, once.
 */
import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { NotFound } from '@/app/Frame'
import { projectFor, sessionQuery } from '@/app/session'
import { ProjectPending } from '@/app/routes'

export const Route = createFileRoute('/_app/p/$code')({
  // Checked before any child's beforeLoad (the index's redirect), so a project the member may not
  // open is refused where it was asked for, never redirected into.
  beforeLoad: async ({ context, params }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (!projectFor(session, params.code)) throw notFound({ routeId: '/_app/p/$code' })
  },
  loader: async ({ context, params }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    const project = projectFor(session, params.code)
    if (!project) throw notFound({ routeId: '/_app/p/$code' })
    return project
  },
  pendingComponent: ProjectPending,
  notFoundComponent: NotFound,
  component: Outlet,
})
