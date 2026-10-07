/*
 * Market Prices (`/p/:code/prices`): the working price set's Resources, each with its unit, its price in
 * the Market's money and the PWD Schedule of Rates page it comes from. A Resource with no price says
 * "rate not entered", never ৳0. A QS (or a Vextrus Engineer) types a new price and presses Enter; the
 * Priced BOQ is read again, so its rates and amounts move and its quantities do not. The MD and a
 * Guest only look.
 */
import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { PageLayout } from '@/app/Frame'
import { sessionQuery } from '@/app/session'
import { LoadProblem, ProblemBar, can, problemOf, readOnlyRole, usePageTitle, useSignedInAgain, type Problem } from '@/auth'
import { EMPTY, useFormat } from '@/format'
import { FieldError, ReadOnlyChip, Skeleton, useToast } from '@/ui'
import { priceAsTyped, pricesKey, pricesQuery, putPrice, type PriceRow } from './data'

const projectRoute = getRouteApi('/_app/p/$code')

export function PricesLoading() {
  return (
    <PageLayout>
      <Skeleton rows={8} status={<Trans>Opening Market Prices…</Trans>} />
    </PageLayout>
  )
}

function PriceField({ projectId, row, onProblem }: { projectId: string; row: PriceRow; onProblem: (p: Problem) => void }) {
  const { t } = useLingui()
  const client = useQueryClient()
  const toast = useToast()
  const [text, setText] = useState('')
  const [bad, setBad] = useState(false)
  const [saving, setSaving] = useState(false)
  const name = row.name

  async function submit() {
    if (text.trim() === '') return
    const amount = priceAsTyped(text)
    if (amount === null) {
      setBad(true)
      return
    }
    setBad(false)
    setSaving(true)
    onProblem(null)
    try {
      await putPrice(projectId, row.resource_code, amount)
      setText('')
      // Every figure priced from it moves: the BOQ and each Rate Analysis are read again, never patched here.
      await Promise.all([
        client.invalidateQueries({ queryKey: pricesKey(projectId) }),
        client.invalidateQueries({ queryKey: ['boq', projectId] }),
        client.invalidateQueries({ queryKey: ['rates', projectId] }),
      ])
      toast.show({ message: t`Price of ${name} saved.` })
    } catch (error) {
      onProblem(problemOf(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <input
        type="text"
        inputMode="decimal"
        value={text}
        disabled={saving}
        aria-label={t`New price for ${name}`}
        aria-invalid={bad || undefined}
        placeholder={t`New price`}
        onChange={(event) => {
          setText(event.target.value)
          setBad(false)
        }}
        className="num h-control w-[120px] rounded-md border border-input bg-paper px-2 text-end text-sm placeholder:text-muted-foreground aria-invalid:border-destructive"
      />
      <FieldError>{bad ? t`Type the price as a number, like 95.00.` : null}</FieldError>
    </form>
  )
}

export function PricesPage() {
  const { t } = useLingui()
  const f = useFormat()
  const { data: session } = useSuspenseQuery(sessionQuery)
  const projectId = projectRoute.useLoaderData().id
  const prices = useQuery(pricesQuery(projectId))
  const [problem, setProblem] = useState<Problem>(null)
  useSignedInAgain(setProblem)
  usePageTitle(t`Market Prices`)
  const changes = can(session, 'change')
  const readOnly = readOnlyRole(session)
  const data = prices.data

  return (
    <PageLayout>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg">
            <Trans>Market Prices</Trans>
          </h1>
          {data ? <p className="text-sm text-ink-secondary">{data.price_set.name}</p> : null}
          {readOnly ? <ReadOnlyChip role={readOnly} /> : null}
        </div>
        <ProblemBar problem={problem} />
        {prices.error ? (
          <LoadProblem error={prices.error} onRetry={() => void prices.refetch()} />
        ) : !data ? (
          <Skeleton rows={8} status={<Trans>Opening Market Prices…</Trans>} />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table aria-label={t`Market Prices`} className="w-full table-fixed border-collapse bg-paper text-sm">
              <thead className="border-b border-border bg-chrome-sunken text-xs text-ink-secondary">
                <tr>
                  <th className="h-row px-2 text-start font-semibold">
                    <Trans>Resource</Trans>
                  </th>
                  <th className="h-row w-[70px] px-2 text-start font-semibold">
                    <Trans>Unit</Trans>
                  </th>
                  <th className="h-row w-[150px] px-2 text-end font-semibold">
                    <Trans>Price</Trans>
                  </th>
                  <th className="h-row w-[260px] px-2 text-start font-semibold">
                    <Trans>Source</Trans>
                  </th>
                  <th className="h-row w-[150px] px-2 text-end font-semibold">
                    <Trans>Change to</Trans>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.prices.map((row) => (
                  <tr key={row.resource_code} className="border-b border-border last:border-b-0">
                    <td className="h-row truncate px-2" title={row.name}>
                      {row.name}
                    </td>
                    <td className="h-row px-2">{row.unit}</td>
                    <td className="num h-row px-2 text-end">
                      {row.price ? f.money(row.price) : <span className="text-ink-secondary">{t`rate not entered`}</span>}
                    </td>
                    <td className="h-row truncate px-2 text-ink-secondary" title={row.source_ref}>
                      {row.source_ref}
                    </td>
                    <td className="h-row px-2 text-end">{changes ? <PriceField projectId={projectId} row={row} onProblem={setProblem} /> : EMPTY}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
