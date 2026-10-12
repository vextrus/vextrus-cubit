/*
 * A BOQ Item's Rate Analysis (docs/design/screens.md, Priced BOQ ruling 3: the rate is opened, never
 * typed over): each Resource it uses, its quantity per unit of the item, its price, the amount, and the
 * PWD Schedule of Rates page the price comes from. A Resource with no price says "rate not entered",
 * and the item's rate with it. A docked panel: Esc or Close leaves it.
 */
import { useEffect, useRef } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useCloseOnEsc } from '@/app/shell'
import { LoadProblem } from '@/auth'
import { EMPTY, useFormat } from '@/format'
import { Button, Skeleton } from '@/ui'
import { placesAsSent, rateQuery } from './data'

export function RateAnalysis({ projectId, itemCode, title, onClose }: { projectId: string; itemCode: string; title: React.ReactNode; onClose: () => void }) {
  const { t } = useLingui()
  const f = useFormat()
  const heading = useRef<HTMLHeadingElement>(null)
  useCloseOnEsc(true, onClose)
  useEffect(() => heading.current?.focus(), [itemCode])
  const rate = useQuery(rateQuery(projectId, itemCode))
  const r = rate.data
  const perUnit = r?.per_unit ?? ''
  const rateText = r?.rate ? f.money(r.rate) : ''
  return (
    <section aria-labelledby="rate-heading" className="flex h-full flex-col">
      <header className="flex items-start gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 id="rate-heading" ref={heading} tabIndex={-1} className="mb-1 text-md">
            <Trans>Rate Analysis</Trans>
          </h2>
          <p className="text-sm text-ink-secondary">{title}</p>
        </div>
        <Button variant="ghost" className="size-control px-0" aria-label={t`Close the Rate Analysis`} onClick={onClose}>
          <X aria-hidden className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {rate.error ? (
          <LoadProblem error={rate.error} onRetry={() => void rate.refetch()} />
        ) : !r ? (
          <Skeleton rows={4} status={<Trans>Opening the Rate Analysis…</Trans>} />
        ) : (
          <>
            <p className="mb-3 text-sm">
              {r.rate ? (
                <Trans>
                  Rate per {perUnit}: <span className="num font-semibold">{rateText}</span>
                </Trans>
              ) : (
                <Trans>
                  Rate per {perUnit}: <span className="font-semibold">rate not entered</span>. A Resource below has no price yet.
                </Trans>
              )}
            </p>
            <table aria-label={t`Resources of the rate`} className="w-full table-fixed border-collapse text-sm">
              <thead className="border-b border-border text-xs text-ink-secondary">
                <tr>
                  <th className="h-row px-1 text-start font-semibold">
                    <Trans>Resource</Trans>
                  </th>
                  <th className="h-row w-[64px] px-1 text-end font-semibold">
                    <Trans>Quantity</Trans>
                  </th>
                  <th className="h-row w-[92px] px-1 text-end font-semibold">
                    <Trans>Price</Trans>
                  </th>
                  <th className="h-row w-[92px] px-1 text-end font-semibold">
                    <Trans>Amount</Trans>
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.lines.map((line) => (
                  <tr key={line.resource_code} className="border-b border-border align-top last:border-b-0">
                    <td className="px-1 py-1.5">
                      <div>{line.name}</div>
                      <div className="text-xs text-muted-foreground">{line.source_ref}</div>
                    </td>
                    <td className="num px-1 py-1.5 text-end">
                      {f.quantity(line.qty, placesAsSent(line.qty))} {line.unit}
                    </td>
                    <td className="num px-1 py-1.5 text-end">
                      {line.price ? f.money(line.price) : <span className="text-ink-secondary">{t`rate not entered`}</span>}
                    </td>
                    <td className="num px-1 py-1.5 text-end">{line.amount ? f.money(line.amount) : EMPTY}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  )
}
