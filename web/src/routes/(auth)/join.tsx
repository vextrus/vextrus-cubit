/*
 * /join#<token>: an invitation link's page (docs/design/m0-screens.md §4.2), outside the frame. The
 * token is in the fragment only; the page reads it and clears it (src/auth/Join.tsx).
 */
import { createFileRoute } from '@tanstack/react-router'
import { JoinPage, OutsideRouteError } from '@/auth'

export const Route = createFileRoute('/(auth)/join')({
  component: JoinPage,
  errorComponent: OutsideRouteError,
})
