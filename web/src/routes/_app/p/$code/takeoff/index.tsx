/*
 * The Takeoff without a step opens its current Takeoff Step (Step 1 in M0).
 */
import { createFileRoute, redirect } from '@tanstack/react-router'
import { currentStep } from '@/app/steps'

export const Route = createFileRoute('/_app/p/$code/takeoff/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/p/$code/takeoff/$step', params: { code: params.code, step: String(currentStep().number) }, replace: true })
  },
})
