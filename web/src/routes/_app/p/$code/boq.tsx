/*
 * /p/:code/boq: the Priced BOQ (docs/plans/M1.md C13), in the frame, for every role that may open the
 * project; the MD and a Guest read it, the QS and a Vextrus Engineer enter the Gross Floor Area. The
 * page asks for its data itself, so a refusal is the page's to say, never the route's.
 */
import { createFileRoute } from '@tanstack/react-router'
import { BoqLoading, BoqPage } from '@/boq'

export const Route = createFileRoute('/_app/p/$code/boq')({
  pendingComponent: BoqLoading,
  component: BoqPage,
})
