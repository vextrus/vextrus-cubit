/*
 * Step 1, Sheets (ticket 22): its own canvas, beside `$step` (a static segment outranks `$step`).
 */
import { createFileRoute } from '@tanstack/react-router'
import { Step1Page } from '@/takeoff'

export const Route = createFileRoute('/_app/p/$code/takeoff/1')({
  component: Step1Page,
})
