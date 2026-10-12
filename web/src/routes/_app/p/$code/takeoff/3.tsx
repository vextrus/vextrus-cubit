/*
 * Step 3, Levels (S16-W1): its own canvas, beside `$step` (a static segment outranks `$step`).
 */
import { createFileRoute } from '@tanstack/react-router'
import { StoreysPage } from '@/takeoff/frame'

export const Route = createFileRoute('/_app/p/$code/takeoff/3')({
  component: StoreysPage,
})
