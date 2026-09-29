/*
 * /p/:code/drawing-set (docs/design/m0-screens.md §4.1, §4.5), in the frame, for every role that may
 * open the project: the MD and a Guest read it, the QS and a Vextrus Engineer add and change files.
 * The files and the Market's Disciplines are asked for before the page shows, so it never opens looking
 * empty while they come; a refusal is the page's to say (the queries keep it), never the route's.
 */
import { createFileRoute } from '@tanstack/react-router'
import { projectFor, sessionQuery } from '@/app/session'
import { DrawingSetLoading, DrawingSetPage, disciplinesQuery, filesQuery } from '@/drawing-set'

export const Route = createFileRoute('/_app/p/$code/drawing-set/')({
  loader: async ({ context, params }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    const project = projectFor(session, params.code)
    if (!project) return
    await Promise.all([context.queryClient.prefetchQuery(filesQuery(project.id)), context.queryClient.prefetchQuery(disciplinesQuery(project.id))])
  },
  pendingComponent: DrawingSetLoading,
  component: DrawingSetPage,
})
