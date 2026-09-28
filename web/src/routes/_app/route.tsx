/*
 * The frame every screen after sign-in sits in (src/app/Frame.tsx; docs/design/m0-screens.md §4.1).
 * Feature routes go under this folder, `src/routes/_app/<feature>/`, so they sit in the frame.
 */
import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AppFrame } from '@/app/Frame'
import { NotFoundInFrame } from '@/app/routes'
import { sessionQuery } from '@/app/session'

export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context }) => context.queryClient.ensureQueryData(sessionQuery),
  component: AppLayout,
  notFoundComponent: NotFoundInFrame,
})

function AppLayout() {
  return (
    <AppFrame>
      <Outlet />
    </AppFrame>
  )
}
