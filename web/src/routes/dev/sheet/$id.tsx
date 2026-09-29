/*
 * /dev/sheet/:id: the sheet viewer's harness (ticket 16; m0-screens 4.6). Development builds only:
 * vite.config.ts leaves the `dev` folder out of a production build's route tree, and `npm run build`
 * fails if the harness reaches the bundle (scripts/check-dist.mjs).
 */
import { createFileRoute } from '@tanstack/react-router'
import { SheetHarness } from '@/dev/sheet/SheetHarness'

export const Route = createFileRoute('/dev/sheet/$id')({
  component: SheetHarnessRoute,
})

function SheetHarnessRoute() {
  const { id } = Route.useParams()
  return <SheetHarness id={id} />
}
