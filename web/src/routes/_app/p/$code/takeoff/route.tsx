/*
 * The Takeoff's canvas screen (src/app/CanvasFrame.tsx; docs/design/m0-screens.md §4.1, §4.7): the
 * step rail, toolbar, inspector and status bar around the step's own canvas, the child route.
 */
import { createFileRoute } from '@tanstack/react-router'
import { TakeoffLayout } from '@/app/routes'

export const Route = createFileRoute('/_app/p/$code/takeoff')({
  component: TakeoffLayout,
})
