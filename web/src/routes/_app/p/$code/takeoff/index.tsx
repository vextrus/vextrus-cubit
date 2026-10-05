/*
 * The Takeoff without a step opens its current Takeoff Step (Step 1 in M0).
 */
import { createFileRoute } from '@tanstack/react-router'
import { stepRedirect } from '@/app/steps'

export const Route = createFileRoute('/_app/p/$code/takeoff/')({
  beforeLoad: ({ params }) => {
    throw stepRedirect(params.code)
  },
})
