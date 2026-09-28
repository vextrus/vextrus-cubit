/*
 * "Access ended" (docs/design/m0-screens.md §4.1), outside the frame: only while the user's access
 * has ended; anyone else goes where they belong.
 */
import { createFileRoute } from '@tanstack/react-router'
import { AccessEndedPage, atGate, RouteError } from '@/auth'

export const Route = createFileRoute('/(auth)/access-ended')({
  beforeLoad: ({ context }) => atGate(context.queryClient, 'ended'),
  component: AccessEndedPage,
  errorComponent: RouteError,
})
