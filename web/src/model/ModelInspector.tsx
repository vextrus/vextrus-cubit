/*
 * The 3D view's inspector, docked on the right (m0-screens §4.1: it never floats): with nothing picked, a
 * line saying how to pick; with an Element picked, what it is (mark, Family, Storey, grid reference), its
 * IFC class and classification, its Attributes and its Trace, each fact with where it was read.
 */
import type { ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { AppLink } from '@/app/AppLink'
import { LoadProblem } from '@/auth'
import { lengthFromMm, useFormat } from '@/format'
import { step1SheetPath } from '@/takeoff/paths'
import { useStoreyWord } from '@/takeoff/storeys'
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

/** A stored key's last word: `vx.column.section_b` is `section_b`. */
const bareKey = (key: string): string => key.split('.').pop() ?? key

/** Keys kept for the machine (the plan position), never shown in the inspector. */
const HIDDEN_KEYS = new Set(['x_m', 'y_m', 'z_m'])
export const shownAttr = (key: string): boolean => !HIDDEN_KEYS.has(bareKey(key))

/** The grid reference as a QS says it: a stored list such as `['3/C', '5.858', '-0']` is its first item. */
export function gridWords(ref: string): string {
  const listed = /^\s*\[\s*['"]([^'"]*)['"]/.exec(ref)
  return listed ? (listed[1] ?? ref) : ref
}

function Grid({ stored }: { stored: string }) {
  const grid = gridWords(stored)
  return <Trans>Grid {grid}</Trans>
}

function useFactName() {
  const { t } = useLingui()
  return (fact: string): string => {
    const key = bareKey(fact)
    if (key === 'section_b') return t`Section b`
    if (key === 'section_d') return t`Section d`
    if (key === 'height_m' || key === 'height') return t`Height`
    if (key === 'mark') return t`Mark`
    if (key === 'storey') return t`Storey`
    if (key === 'grid_ref' || key === 'at') return t`Grid`
    const words = key.replace(/_/g, ' ')
    return words.charAt(0).toUpperCase() + words.slice(1)
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
  const { code } = useParams({ strict: false }) as { code?: string }
  const number = row.sheet_number ?? null
  const where = number ? <Trans>Sheet {number}</Trans> : <Trans>A sheet of the Drawing Set</Trans>
  return (
    <li className="flex flex-col">
      <span>{factName(row.fact)}</span>
      <span className="text-xs text-ink-secondary">
        {code && row.sheet_id && number ? (
          <AppLink to={step1SheetPath(code, row.sheet_id)} className="underline">
            {where}
          </AppLink>
        ) : (
          where
        )}{' '}
        · {row.sheet_title || kindName(row.kind)}
      </span>
    </li>
  )
}

function Picked({ element }: { element: ElementOut }) {
  const familyName = useFamilyName()
  const storeyWord = useStoreyWord()
  const attrs = element.attrs.filter((a) => shownAttr(a.key))
  return (
    <>
      <div className="flex flex-col gap-0.5 border-b border-border px-3 py-3">
        <h2 className="text-md font-semibold">{element.mark}</h2>
        <p className="text-sm text-ink-secondary">
          {familyName(element.family)} · {storeyWord(element.storey)}
          {element.grid_ref ? (
            <span>
              {' · '}
              <Grid stored={element.grid_ref} />
            </span>
          ) : null}
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
      {attrs.length > 0 ? (
        <Block title={<Trans>Attributes</Trans>}>
          <dl className="flex flex-col gap-1">
            {attrs.map((a) => (
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
