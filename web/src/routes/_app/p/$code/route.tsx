/*
 * A project the member may open (docs/plans/M0.md, "Project scope"): any other code, another
 * Developer's project or one not given, is "Page not found", so its existence never leaks.
 */
import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { projectFor, sessionQuery } from '@/app/session'
import { ProjectPending } from '@/app/routes'

export const Route = createFileRoute('/_app/p/$code')({
  loader: async ({ context, params }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    const project = projectFor(session, params.code)
    if (!project) throw notFound()
    return project
  },
  pendingComponent: ProjectPending,
  component: Outlet,
})
