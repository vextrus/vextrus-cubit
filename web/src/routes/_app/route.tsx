/*
 * The frame every screen after sign-in sits in (src/app/Frame.tsx; docs/design/m0-screens.md §4.1).
 * Feature routes go under this folder, `src/routes/_app/<feature>/`, so they sit in the frame.
 *
 * Its door (src/auth/gate.ts): signed out goes to /sign-in with the address to come back to; signed in
 * with no Developer to work in, to "Which Developer?", "Access ended" or "No access to anything". The
 * frame then watches the session (src/auth/SessionWatch.tsx): signed out while working, access ended.
 */
import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AppFrame, NotFound } from '@/app/Frame'
import { FramePending, SessionWatch, enterFrame } from '@/auth'

export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context, location }) => enterFrame(context.queryClient, location),
  pendingComponent: FramePending,
  component: AppLayout,
  // Inside the layout, which already draws the frame: never a second frame (the root's is whole).
  notFoundComponent: NotFound,
})

function AppLayout() {
  return (
    <AppFrame>
      <Outlet />
      <SessionWatch />
    </AppFrame>
  )
}
