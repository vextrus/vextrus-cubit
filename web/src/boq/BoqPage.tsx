/*
 * The Priced BOQ (`/p/:code/boq`; docs/plans/M1.md C13): the strip (measured, awaiting an answer,
 * allowance, total, the total per area, the measured share), the BOQ Sections with their BOQ Items, and
 * the allowance lines at the end. On every priced row quantity × rate = amount, to the paisa; an item
 * with no rate says "rate not entered" and counts nothing, never ৳0. A quantity opens the item's
 * Measurement Lines (each with its Trace), a rate opens its Rate Analysis, with PWD page refs. The
 * Gross Floor Area is typed once for the Building and Enter puts it; with it the allowance lines show,
 * hatched and read "Vextrus default, Low".
 *
 * Keys (m0-screens §2): `↑ ↓ Home End` move between BOQ Items, `Enter` opens the focused item's
 * Measurement Lines, `F2` its Rate Analysis, Esc closes the panel.
 */
import { useRef, useState, type ReactNode } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { PageLayout } from '@/app/Frame'
import { sessionQuery } from '@/app/session'
import { LoadProblem, ProblemBar, can, problemOf, readOnlyRole, sameSession, usePageTitle, useSignedInAgain, type Problem } from '@/auth'
import { EMPTY, useFormat } from '@/format'
import { MachineText } from '@/format/machine'
import { RateAnalysis, priceAsTyped } from '@/rates'
import { ReadOnlyChip, Skeleton, TextField, cn, useKeys } from '@/ui'
import { areaUnitOf, boqKey, boqQuery, putGrossFloorArea, type AllowanceLine, type BoqItem, type BoqOut } from './data'
import { LinesPanel } from './LinesPanel'
import { groupName, partName, sectionName, stepName } from './words'

const projectRoute = getRouteApi('/_app/p/$code')

/** Rebar's item total is in whole kilograms; its Measurement Lines keep two places (docs/design/screens.md, Priced BOQ ruling 6). */
const decimalsOf = (unit: string) => (unit === 'kg' ? 0 : 2)

export function BoqLoading() {
  return (
    <PageLayout>
      <Skeleton rows={8} status={<Trans>Opening the Priced BOQ…</Trans>} />
    </PageLayout>
  )
}

type Open = { kind: 'lines' | 'rate'; item: BoqItem }

function Strip({ boq, unit }: { boq: BoqOut; unit: string }) {
  const { t } = useLingui()
  const f = useFormat()
  const { strip } = boq
  const share = Number(boq.measured_share)
  const percent = Number.isFinite(share) ? f.share(Math.round(share * 10_000), 10_000) : EMPTY
  const figure = (label: ReactNode, value: string, strong?: boolean) => (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-ink-secondary">{label}</dt>
      <dd className={cn('num text-md', strong && 'font-semibold')}>{value}</dd>
    </div>
  )
  return (
    <dl aria-label={t`Totals`} className="grid grid-cols-6 gap-4 rounded-md border border-border bg-paper px-4 py-3">
      {figure(<Trans>Measured</Trans>, f.money(strip.measured))}
      {figure(<Trans>Waiting on a Question</Trans>, f.money(strip.awaiting_answer))}
      {figure(<Trans>Allowance</Trans>, strip.gfa ? f.money(strip.allowance) : EMPTY)}
      {figure(<Trans>Total</Trans>, f.money(strip.total), true)}
      {figure(strip.gfa ? <Trans>Per {unit}</Trans> : <Trans>Per area</Trans>, strip.per_area ? f.money(strip.per_area) : EMPTY)}
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs text-ink-secondary">
          <Trans>Measured share of the total</Trans>
        </dt>
        <dd className="num text-md">{percent}</dd>
      </div>
    </dl>
  )
}

/** The stored Gross Floor Area (square metres, `unit: 'm2'`) in the unit the QS types it in. */
export function areaIn(gfa: { value: string; unit?: string }, unit: string): string {
  if (unit !== 'sft' || (gfa.unit ?? 'm2') !== 'm2') return gfa.value
  const sft = Number(gfa.value) / 0.09290304
  return String(Math.round(sft * 100) / 100)
}

function GrossFloorArea({ projectId, boq, changes }: { projectId: string; boq: BoqOut; changes: boolean }) {
  const { t } = useLingui()
  const f = useFormat()
  const client = useQueryClient()
  const unit = areaUnitOf(f.unitSystem)
  const entered = boq.strip.gfa ? areaIn(boq.strip.gfa, unit) : ''
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<ReactNode>(null)
  const [problem, setProblem] = useState<Problem>(null)
  const [saving, setSaving] = useState(false)
  useSignedInAgain(setProblem)
  const unitWords = unit === 'sft' ? t`sft` : t`m²`

  if (!changes) {
    const area = f.quantity(entered, 0)
    return (
      <p className="text-sm text-ink-secondary">
        {boq.strip.gfa ? (
          <Trans>
            Gross Floor Area: {area} {unitWords}
          </Trans>
        ) : (
          <Trans>Gross Floor Area not entered</Trans>
        )}
      </p>
    )
  }

  async function submit() {
    const given = (text ?? entered).trim()
    if (given === '') return
    const typed = priceAsTyped(given)
    if (typed === null) {
      setError(t`Type the area as a number, like 38400.`)
      return
    }
    setError(null)
    setProblem(null)
    setSaving(true)
    const current = sameSession(client)
    try {
      await putGrossFloorArea(projectId, boq.building_id, typed, unit)
      if (!current()) return
      // The typed text stays until the BOQ is read again, so the field never flashes the old area.
      await client.invalidateQueries({ queryKey: boqKey(projectId) })
      setText(null)
    } catch (e) {
      if (!current()) return
      setProblem(problemOf(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <TextField
        label={t`Gross Floor Area`}
        value={text ?? entered}
        disabled={saving}
        inputMode="decimal"
        error={error}
        fieldClassName="num w-[120px] text-end"
        after={<span className="text-sm text-ink-secondary">{unitWords}</span>}
        onChange={(event) => {
          setText(event.target.value)
          setError(null)
        }}
      />
      <ProblemBar problem={problem} />
    </form>
  )
}

/** A figure button that opens a panel: a plain button reading as the figure, ringed when focused by key. */
function FigureButton({ children, label, onClick }: { children: ReactNode; label?: string; onClick: (from: HTMLElement) => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => onClick(event.currentTarget)}
      className="num rounded-xs px-1 text-primary underline-offset-2 hover:underline"
    >
      {children}
    </button>
  )
}

function Head({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn('h-row px-2 text-start align-middle text-xs font-semibold text-ink-secondary', className)}>{children}</th>
}

function ItemRow({
  item,
  focused,
  open,
  onFocus,
  onOpen,
  rowRef,
}: {
  item: BoqItem
  focused: boolean
  open: Open | null
  onFocus: () => void
  onOpen: (kind: Open['kind'], from: HTMLElement) => void
  rowRef: (el: HTMLTableRowElement | null) => void
}) {
  const { t } = useLingui()
  const f = useFormat()
  const decimals = decimalsOf(item.billing_unit)
  const quantity = f.quantity(item.quantity, decimals)
  const number = item.number
  const unit = item.billing_unit
  const rate = item.rate ? f.money(item.rate) : null
  const awaiting = item.awaiting_answer ? f.quantity(item.awaiting_answer.quantity, decimals) : ''
  const basis =
    item.rebar_basis === 'by_ratio'
      ? t`by ratio`
      : item.rebar_basis === 'from_drawing'
        ? t`from the drawing`
        : item.rebar_basis === 'from_drawing_rules'
          ? t`from the drawing + rules`
          : null
  const selected = open?.item.item_code === item.item_code
  return (
    <tr
      ref={rowRef}
      data-item={item.item_code}
      tabIndex={focused ? 0 : -1}
      aria-current={selected || undefined}
      onFocus={(event) => {
        if (event.target === event.currentTarget) onFocus()
      }}
      className={cn(
        'border-b border-border last:border-b-0 hover:bg-hover',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        selected && 'bg-selected',
      )}
    >
      <td className="num h-row w-[64px] px-2 align-middle">{item.number}</td>
      <td className="h-row px-2 py-1 align-middle">
        <MachineText message={item.description} />
        {basis ? <span className="ms-2 rounded-xs border border-border-strong px-1 text-xs text-ink-secondary">{basis}</span> : null}
        {item.awaiting_answer ? (
          <span className="ms-2 text-xs text-ink-secondary">
            <Trans>
              + {awaiting} {unit} waiting on a Question
            </Trans>
          </span>
        ) : null}
      </td>
      <td className="num h-row w-[110px] px-2 text-end align-middle">
        <FigureButton label={t`${quantity} ${unit}, Measurement Lines of ${number}`} onClick={(from) => onOpen('lines', from)}>
          {quantity}
        </FigureButton>
      </td>
      <td className="h-row w-[48px] px-1 align-middle text-ink-secondary">{item.billing_unit}</td>
      <td className="num h-row w-[130px] px-2 text-end align-middle">
        <FigureButton
          label={rate ? t`${rate}, Rate Analysis of ${number}` : t`rate not entered, Rate Analysis of ${number}`}
          onClick={(from) => onOpen('rate', from)}
        >
          {rate ?? <span className="text-ink-secondary">{t`rate not entered`}</span>}
        </FigureButton>
      </td>
      <td className="num h-row w-[150px] px-2 text-end align-middle">{item.amount ? f.money(item.amount) : EMPTY}</td>
    </tr>
  )
}

function AllowanceTable({ lines }: { lines: readonly AllowanceLine[] }) {
  const { t, i18n } = useLingui()
  const f = useFormat()
  return (
    <section aria-labelledby="allowances-heading" className="flex flex-col gap-2">
      <h2 id="allowances-heading" className="text-md">
        <Trans>Allowances</Trans>
      </h2>
      <div className="overflow-x-auto rounded-md border border-border">
        <table aria-label={t`Allowances`} className="w-full table-fixed border-collapse bg-paper text-sm">
          <tbody>
            {lines.map((line) => {
              const step = stepName(line.step, i18n)
              const part = partName(line.part, i18n)
              const measured = f.money(line.measured_so_far)
              return (
                <tr
                  key={`${line.step}:${line.part}`}
                  className="border-b border-border bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--border)_6px_7px)] last:border-b-0"
                >
                  <td className="h-row px-2 align-middle">
                    <span className="font-medium">{step}</span>
                    {part ? <span className="text-ink-secondary">, {part}</span> : null}
                  </td>
                  <td className="h-row w-[220px] px-2 align-middle text-ink-secondary">
                    <Trans>Vextrus default, Low</Trans>
                  </td>
                  <td className="num h-row w-[220px] px-2 text-end align-middle text-ink-secondary">
                    <Trans>{measured} measured so far</Trans>
                  </td>
                  <td className="num h-row w-[150px] px-2 text-end align-middle">{f.money(line.amount)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function BoqPage() {
  const { t, i18n } = useLingui()
  const f = useFormat()
  const { data: session } = useSuspenseQuery(sessionQuery)
  const project = projectRoute.useLoaderData()
  const boq = useQuery(boqQuery(project.id))
  const [open, setOpen] = useState<Open | null>(null)
  const [focusedCode, setFocusedCode] = useState<string | null>(null)
  const rowEls = useRef(new Map<string, HTMLTableRowElement>())
  const opener = useRef<HTMLElement | null>(null)
  usePageTitle(t`Priced BOQ`)
  const readOnly = readOnlyRole(session)
  const data = boq.data
  const unpriced = data?.strip.unpriced_lines ?? 0
  const items = data ? data.sections.flatMap((s) => s.groups.flatMap((g) => g.items)) : []
  const codes = items.map((i) => i.item_code)
  const current = focusedCode !== null && codes.includes(focusedCode) ? focusedCode : (codes[0] ?? null)

  const onRow = () => document.activeElement instanceof HTMLTableRowElement && document.activeElement.dataset.item !== undefined
  const focusedItem = () => {
    const el = document.activeElement
    return el instanceof HTMLTableRowElement ? items.find((i) => i.item_code === el.dataset.item) : undefined
  }
  function move(to: number) {
    if (codes.length === 0) return
    const code = codes[Math.max(0, Math.min(codes.length - 1, to))]!
    setFocusedCode(code)
    rowEls.current.get(code)?.focus()
  }
  function openPanel(kind: Open['kind'], item: BoqItem, from: HTMLElement | null) {
    opener.current = from
    setOpen({ kind, item })
  }
  function closePanel() {
    setOpen(null)
    const back = opener.current
    if (back?.isConnected) back.focus()
  }
  const at = current === null ? -1 : codes.indexOf(current)
  useKeys([
    {
      key: '↑',
      label: t`Previous BOQ Item`,
      group: 'screen',
      when: onRow,
      run: () => move(at - 1),
    },
    {
      key: '↓',
      label: t`Next BOQ Item`,
      group: 'screen',
      when: onRow,
      run: () => move(at + 1),
    },
    {
      key: 'Home',
      label: t`First BOQ Item`,
      group: 'screen',
      when: onRow,
      run: () => move(0),
    },
    {
      key: 'End',
      label: t`Last BOQ Item`,
      group: 'screen',
      when: onRow,
      run: () => move(codes.length - 1),
    },
    {
      key: 'Enter',
      label: t`Open the Measurement Lines`,
      group: 'screen',
      when: onRow,
      run: () => {
        const item = focusedItem()
        if (item) openPanel('lines', item, document.activeElement as HTMLElement)
      },
    },
    {
      key: 'F2',
      label: t`Open the Rate Analysis`,
      group: 'screen',
      when: onRow,
      run: () => {
        const item = focusedItem()
        if (item) openPanel('rate', item, document.activeElement as HTMLElement)
      },
    },
  ])

  const title = open ? (
    <>
      <span className="num">{open.item.number}</span> <MachineText message={open.item.description} />
    </>
  ) : null
  const panel = open ? (
    open.kind === 'lines' ? (
      <LinesPanel key={open.item.item_code} projectId={project.id} code={project.code} itemCode={open.item.item_code} title={title} onClose={closePanel} />
    ) : (
      <RateAnalysis key={open.item.item_code} projectId={project.id} itemCode={open.item.item_code} title={title} onClose={closePanel} />
    )
  ) : undefined

  return (
    <PageLayout panel={panel}>
      <div className="flex flex-col gap-4">
        <div className="flex items-end gap-3">
          <h1 className="me-auto text-lg">
            <Trans>Priced BOQ</Trans>
          </h1>
          {readOnly ? <ReadOnlyChip role={readOnly} /> : null}
          {data ? <GrossFloorArea projectId={project.id} boq={data} changes={can(session, 'change')} /> : null}
        </div>
        {boq.error ? (
          <LoadProblem error={boq.error} onRetry={() => void boq.refetch()} />
        ) : !data ? (
          <Skeleton rows={8} status={<Trans>Opening the Priced BOQ…</Trans>} />
        ) : (
          <>
            <Strip boq={data} unit={areaUnitOf(f.unitSystem) === 'sft' ? t`sft` : t`m²`} />
            {data.strip.gfa ? null : (
              <p className="text-sm text-ink-secondary">
                <Trans>Enter the Gross Floor Area above to see the allowances and the total per area.</Trans>
              </p>
            )}
            {data.strip.unpriced_lines > 0 ? (
              <p className="text-sm text-ink-secondary">
                <Plural
                  value={unpriced}
                  one="# BOQ Item has no rate yet; it adds nothing to the totals until a price is entered under Market Prices."
                  other="# BOQ Items have no rate yet; they add nothing to the totals until prices are entered under Market Prices."
                />
              </p>
            ) : null}
            {items.length === 0 ? (
              <p className="text-sm text-ink-secondary">
                <Trans>Nothing is measured yet. BOQ Items appear here as Takeoff Steps are confirmed.</Trans>
              </p>
            ) : (
              data.sections.map((section) => (
                <section key={section.section} aria-label={sectionName(section.section, i18n)} className="flex flex-col gap-2">
                  <h2 className="text-md">{sectionName(section.section, i18n)}</h2>
                  {section.groups.map((group) => (
                    <div key={group.group} className="overflow-x-auto rounded-md border border-border">
                      <table aria-label={groupName(group.group, i18n)} className="w-full table-fixed border-collapse bg-paper text-sm">
                        <thead className="border-b border-border bg-chrome-sunken">
                          <tr>
                            <Head className="w-[64px]">{groupName(group.group, i18n)}</Head>
                            <Head>
                              <Trans>Description</Trans>
                            </Head>
                            <Head className="w-[110px] text-end">
                              <Trans>Quantity</Trans>
                            </Head>
                            <Head className="w-[48px]">
                              <Trans>Unit</Trans>
                            </Head>
                            <Head className="w-[130px] text-end">
                              <Trans>Rate</Trans>
                            </Head>
                            <Head className="w-[150px] text-end">
                              <Trans>Amount</Trans>
                            </Head>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((item) => (
                            <ItemRow
                              key={item.item_code}
                              item={item}
                              focused={item.item_code === current}
                              open={open}
                              onFocus={() => setFocusedCode(item.item_code)}
                              onOpen={(kind, from) => openPanel(kind, item, from)}
                              rowRef={(el) => {
                                if (el) rowEls.current.set(item.item_code, el)
                                else rowEls.current.delete(item.item_code)
                              }}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </section>
              ))
            )}
            {data.allowances.length > 0 ? <AllowanceTable lines={data.allowances} /> : null}
          </>
        )}
      </div>
    </PageLayout>
  )
}
