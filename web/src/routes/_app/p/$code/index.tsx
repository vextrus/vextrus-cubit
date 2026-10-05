/*
 * A project's own address opens its current Takeoff Step (screens.md 5: nothing opens looking empty).
 * In M0 that is always Step 1, the only one open.
 */
import { createFileRoute } from '@tanstack/react-router'
import { stepRedirect } from '@/app/steps'

export const Route = createFileRoute('/_app/p/$code/')({
  beforeLoad: ({ params }) => {
    throw stepRedirect(params.code)
  },
})
