/*
 * Step 4, Grid (S16-W1): its own canvas, beside `$step` (a static segment outranks `$step`).
 */
import { createFileRoute } from '@tanstack/react-router'
import { GridPage } from '@/takeoff/frame'

export const Route = createFileRoute('/_app/p/$code/takeoff/4')({
  component: GridPage,
})
