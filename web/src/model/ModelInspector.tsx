/*
 * The 3D view's inspector, docked on the right (m0-screens §4.1: it never floats): with nothing picked, a
 * line saying how to pick; with an Element picked, what it is (mark, Family, Storey, grid reference), its
 * IFC class and classification, its Attributes and its Trace, each fact with where it was read.
 */
import type { ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { LoadProblem } from '@/auth'
import { lengthFromMm, useFormat } from '@/format'
import { Skeleton } from '@/ui'
import { elementQuery, type ElementOut, type TraceOut } from './data'

function Block({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5 border-b border-border px-3 py-3 text-sm">
      <h3 className="text-xs font-semibold text-ink-secondary">{title}</h3>
      {children}
    </section>
  )
}

function useFactName() {
  const { t } = useLingui()
  return (fact: string): string => {
    if (fact === 'section_b') return t`Section width`
    if (fact === 'section_d') return t`Section depth`
    return fact
  }
}

function useFamilyName() {
  const { t } = useLingui()
  return (family: string): string => {
    if (family === 'column') return t`Column`
    if (family === 'storey') return t`Storey`
    if (family === 'grid_line') return t`Grid line`
    return family
  }
}

function useKindName() {
  const { t } = useLingui()
  return (kind: string): string => (kind === 'label' ? t`read from a label` : kind === 'geometry' ? t`read from the drawing’s lines` : kind)
}

function Attribute({ a }: { a: ElementOut['attrs'][number] }) {
  const f = useFormat()
  const factName = useFactName()
  const value =
    a.unit === 'm' && Number.isFinite(Number(a.value)) ? f.length(lengthFromMm(Number(a.value) * 1000)) : <>{a.unit ? `${a.value} ${a.unit}` : a.value}</>
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-secondary">{factName(a.key)}</dt>
      <dd className="num">{value}</dd>
    </div>
  )
}

function TraceRow({ row }: { row: TraceOut }) {
  const factName = useFactName()
  const kindName = useKindName()
  const place = Object.values(row.anchor).join(', ')
  return (
    <li className="flex flex-col">
      <span>{factName(row.fact)}</span>
      <span className="text-xs text-ink-secondary">
        {kindName(row.kind)}
        {place ? <span className="num"> · {place}</span> : null}
      </span>
    </li>
  )
}

function Picked({ element }: { element: ElementOut }) {
  const familyName = useFamilyName()
  return (
    <>
      <div className="flex flex-col gap-0.5 border-b border-border px-3 py-3">
        <h2 className="text-md font-semibold">{element.mark}</h2>
        <p className="text-sm text-ink-secondary">
          {familyName(element.family)} · {element.storey}
          {element.grid_ref ? <span> · {element.grid_ref}</span> : null}
        </p>
      </div>
      <Block title={<Trans>IFC class</Trans>}>
        <p>{element.ifc_class}</p>
      </Block>
      {element.classification.length > 0 ? (
        <Block title={<Trans>Classification</Trans>}>
          <ul className="flex flex-col gap-0.5">
            {element.classification.map((c) => (
              <li key={`${c.system}-${c.code}`}>
                {c.system} <span className="num">{c.code}</span>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}
      {element.attrs.length > 0 ? (
        <Block title={<Trans>Attributes</Trans>}>
          <dl className="flex flex-col gap-1">
            {element.attrs.map((a) => (
              <Attribute key={a.key} a={a} />
            ))}
          </dl>
        </Block>
      ) : null}
      <Block title={<Trans>Trace</Trans>}>
        {element.trace.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {element.trace.map((row, i) => (
              <TraceRow key={`${row.fact}-${i}`} row={row} />
            ))}
          </ul>
        ) : (
          <p className="text-ink-secondary">
            <Trans>Nothing was read for this Element: it was typed.</Trans>
          </p>
        )}
      </Block>
    </>
  )
}

export function ModelInspector({ projectId, elementId }: { projectId: string; elementId: string | null }) {
  const { t } = useLingui()
  const element = useQuery({
    ...elementQuery(projectId, elementId ?? ''),
    enabled: elementId !== null,
  })
  return (
    <aside
      data-region="inspector"
      aria-label={t`Inspector`}
      className="focus-inset flex w-inspector shrink-0 flex-col overflow-y-auto border-s border-border bg-chrome"
    >
      {elementId === null ? (
        <p className="px-3 py-4 text-sm text-ink-secondary">
          <Trans>Click an Element to see what it is and where it was read.</Trans>
        </p>
      ) : element.data ? (
        <Picked element={element.data} />
      ) : element.error ? (
        <LoadProblem error={element.error} onRetry={() => void element.refetch()} className="m-3" />
      ) : (
        <Skeleton rows={4} className="m-3" status={<Trans>Opening the Element…</Trans>} />
      )}
    </aside>
  )
}
