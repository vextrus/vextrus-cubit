/*
 * Step 6, Columns (S16-W1): its own canvas, beside `$step` (a static segment outranks `$step`).
 */
import { createFileRoute } from '@tanstack/react-router'
import { ColumnsPage } from '@/takeoff/frame'

export const Route = createFileRoute('/_app/p/$code/takeoff/6')({
  component: ColumnsPage,
})
