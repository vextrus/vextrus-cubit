/*
 * A BOQ Item's Measurement Lines (CONTEXT.md): one line per Element, with its quantity in the item's
 * Billing Unit and its Trace, which opens the sheet at where the Element was read (Step 1's sheet viewer
 * on that sheet). A docked panel: Esc or Close leaves it.
 */
import { useEffect, useRef } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { AppLink } from '@/app/AppLink'
import { useCloseOnEsc } from '@/app/shell'
import { LoadProblem } from '@/auth'
import { useFormat } from '@/format'
import { useStoreyWord } from '@/takeoff/storeys'
import { step1SheetPath } from '@/takeoff/paths'
import { Button, DrawingText, Skeleton, buttonVariants, cn } from '@/ui'
import { linesQuery } from './data'

export function LinesPanel({
  projectId,
  code,
  itemCode,
  title,
  onClose,
}: {
  projectId: string
  code: string
  itemCode: string
  title: React.ReactNode
  onClose: () => void
}) {
  const { t } = useLingui()
  const f = useFormat()
  const storeyWord = useStoreyWord()
  const heading = useRef<HTMLHeadingElement>(null)
  useCloseOnEsc(true, onClose)
  useEffect(() => heading.current?.focus(), [itemCode])
  const lines = useQuery(linesQuery(projectId, itemCode))
  const rows = lines.data?.lines
  return (
    <section aria-labelledby="lines-heading" className="flex h-full flex-col">
      <header className="flex items-start gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 id="lines-heading" ref={heading} tabIndex={-1} className="mb-1 text-md">
            <Trans>Measurement Lines</Trans>
          </h2>
          <p className="text-sm text-ink-secondary">{title}</p>
        </div>
        <Button variant="ghost" className="size-control px-0" aria-label={t`Close the Measurement Lines`} onClick={onClose}>
          <X aria-hidden className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {lines.error ? (
          <LoadProblem error={lines.error} onRetry={() => void lines.refetch()} />
        ) : !rows ? (
          <Skeleton rows={4} status={<Trans>Opening the Measurement Lines…</Trans>} />
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink-secondary">
            <Trans>No Element is measured into this BOQ Item yet.</Trans>
          </p>
        ) : (
          <table aria-label={t`Measurement Lines`} className="w-full table-fixed border-collapse text-sm">
            <thead className="border-b border-border text-xs text-ink-secondary">
              <tr>
                <th className="h-row px-1 text-start font-semibold">
                  <Trans>Element</Trans>
                </th>
                <th className="h-row px-1 text-start font-semibold">
                  <Trans>Storey</Trans>
                </th>
                <th className="h-row w-[110px] px-1 text-end font-semibold">
                  <Trans>Quantity</Trans>
                </th>
                <th className="h-row w-[64px] px-1 text-end font-semibold">
                  <span className="sr-only">
                    <Trans>Trace</Trans>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((line) => {
                const mark = line.mark
                const first = line.trace[0]
                return (
                  <tr key={line.id} className="border-b border-border last:border-b-0">
                    <td className="h-row truncate px-1">
                      <DrawingText kind="mark" text={line.mark} />
                    </td>
                    <td className="h-row truncate px-1">
                      <bdi>{storeyWord(line.storey)}</bdi>
                    </td>
                    <td className="num h-row px-1 text-end">
                      {f.quantity(line.quantity, 2)} {line.billing_unit}
                    </td>
                    <td className="h-row px-1 text-end">
                      {first ? (
                        <AppLink
                          to={step1SheetPath(code, first.sheet_id)}
                          className={cn(buttonVariants({ variant: 'ghost' }), 'h-[24px] px-1.5 text-primary')}
                          aria-label={t`Trace ${mark} to its sheet`}
                        >
                          <Trans>Trace</Trans>
                        </AppLink>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
