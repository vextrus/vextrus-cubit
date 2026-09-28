/*
 * "No access to anything" (docs/design/m0-screens.md §4.1), outside the frame: only for a user with no
 * Membership, current or ended; anyone else goes where they belong.
 */
import { createFileRoute } from '@tanstack/react-router'
import { NoAccessPage, atGate } from '@/auth'

export const Route = createFileRoute('/(auth)/no-access')({
  beforeLoad: ({ context }) => atGate(context.queryClient, 'no-access'),
  component: NoAccessPage,
})
