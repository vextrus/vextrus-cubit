/*
 * Any address nothing else matches, behind the frame's door: signed out, it goes to sign-in and comes
 * back; signed in, it is "Page not found" in the frame (docs/design/m0-screens.md §4.1). Without it,
 * such an address reached the root's not-found before anyone was known to be signed in.
 */
import { createFileRoute } from '@tanstack/react-router'
import { NotFound } from '@/app/Frame'

export const Route = createFileRoute('/_app/$')({
  component: NotFound,
})
