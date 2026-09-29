/*
 * /dev/sheet: the sheets the viewer's harness can open (ticket 16). Development builds only, as
 * /dev/sheet/:id.
 */
import { createFileRoute } from '@tanstack/react-router'
import { SheetHarnessIndex } from '@/dev/sheet/SheetHarness'

export const Route = createFileRoute('/dev/sheet/')({
  component: SheetHarnessIndex,
})
