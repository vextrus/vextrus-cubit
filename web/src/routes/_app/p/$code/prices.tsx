/*
 * /p/:code/prices: Market Prices (docs/plans/M1.md C12), in the frame. The QS and a Vextrus Engineer
 * change a price; the MD and a Guest read.
 */
import { createFileRoute } from '@tanstack/react-router'
import { PricesLoading, PricesPage } from '@/rates'

export const Route = createFileRoute('/_app/p/$code/prices')({
  pendingComponent: PricesLoading,
  component: PricesPage,
})
