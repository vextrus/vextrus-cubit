/*
 * A Takeoff Step's canvas: Steps 2–14 are not open in M0 (their empty state); Step 1's canvas is
 * ticket 22's, which adds `takeoff/1.tsx` beside this file (a static segment outranks `$step`).
 * Anything but 1–14 is "Page not found".
 */
import { createFileRoute, notFound } from '@tanstack/react-router'
import { StepCanvas } from '@/app/routes'
import { stepFor } from '@/app/steps'

export const Route = createFileRoute('/_app/p/$code/takeoff/$step')({
  beforeLoad: ({ params }) => {
    if (!stepFor(params.step)) throw notFound()
  },
  component: StepCanvas,
})
