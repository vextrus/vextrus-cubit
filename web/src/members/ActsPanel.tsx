/*
 * One person's acts (docs/design/m0-screens.md §4.4, "Acts"; stories 59, 60): the side panel the Acts
 * column opens, for the MD and the QS only (the owner's ruling, 28 Sep 2026: "MD and QS"). Newest
 * first, each worded from its code (§1.7) with the project and when: "Arif Rahman (Vextrus) created
 * this project · Kadam Residence · 26 Sep 2026, 15:42". A Vextrus Engineer, or Vextrus's staff, is
 * marked "(Vextrus)" after their name. Esc or the close button closes it.
 */
import { Fragment, useEffect, useRef, type ReactNode } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import type { MessageDescriptor } from '@lingui/core'
import { useInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'
import { sessionQuery } from '@/app/session'
import { useCloseOnEsc } from '@/app/shell'
import { LoadProblem } from '@/auth'
import { useFormat } from '@/format'
import { MachineText, type MachineMessage } from '@/format/machine'
import { Button, Empty, IconButton, Skeleton } from '@/ui'
import { DrawingText } from '@/ui/DrawingText'
import { History } from 'lucide-react'
import { ACTS_PAGE, type PersonRow } from './data'

type ActOut = components['schemas']['ActOut']

/** The act as the machine's sentence, its actor marked "(Vextrus)" where they are of Vextrus. */
export function actMessage(act: ActOut, vextrusName: (name: string) => string): MachineMessage {
  const params: Record<string, string | number> = {}
  for (const [name, value] of Object.entries(act.params)) if (typeof value === 'string' || typeof value === 'number') params[name] = value
  if (act.actor) params.actor = act.actor.vextrus ? vextrusName(act.actor.name) : act.actor.name
  return { code: act.code, params }
}

type BackIn = { sheet: string; title: string; reason: string }

/** The sheets a "confirmed back in" act names, each with the reason it was out (the API sends codes
 * under `excluded_before`, a numberless sheet's title beside an empty number); none for an act the API
 * sent without them, which the count words. Every entry is kept, so the count stays true. */
function backInOf(act: ActOut): BackIn[] {
  const named = act.code === BACK_IN ? act.params.excluded_before : undefined
  if (!Array.isArray(named)) return []
  return named.map((entry) => ({ sheet: entry.sheet ?? '', title: entry.title ?? '', reason: entry.reason ?? '' }))
}

const BACK_IN = 'takeoff.step1.confirmed_back_in'

/** The reason, worded to follow "excluded before as" (REASON_SHORT is made for "S-20 excluded:
 * superseded", where "as by others" would not read). */
const BACK_IN_REASON: Readonly<Record<string, MessageDescriptor>> = {
  superseded: msg`superseded`,
  duplicate: msg`a duplicate`,
  cover_index: msg`a cover or index`,
  for_information: msg`for information`,
  by_others: msg`the work of others`,
  blank: msg`blank`,
  other: msg`something else`,
}
const UNKNOWN_BACK_IN_REASON = msg`something Vextrus has no words for yet`

/** Up to this many sheets each is named in a sentence of its own words; more, the count leads. */
const FEW = 3

function SheetNamed({ sheet }: { sheet: BackIn }) {
  if (sheet.sheet) return <DrawingText kind="sheet-number" text={sheet.sheet} truncate={false} />
  if (sheet.title) return <DrawingText kind="title" text={sheet.title} truncate={false} />
  return <Trans>a sheet with no number or title</Trans>
}

function Listed({ items }: { items: ReactNode[] }) {
  const f = useFormat()
  const parts = new Intl.ListFormat(f.profile.locale, { type: 'conjunction' }).formatToParts(items.map((_, i) => String(i)))
  let at = 0
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>{part.type === 'element' ? items[at++] : part.value}</Fragment>
      ))}
    </>
  )
}

/** §4.4: "Confirmed S-07 back in, excluded before as superseded"; several sheets, a clause per reason:
 * "Confirmed S-07 and S-09 back in, excluded before as superseded; A-24 back in, excluded before as
 * for information"; past three the count leads: "Confirmed 5 sheets back in, excluded before: S-01,
 * S-02 and S-03 as superseded; A-24 and A-25 as a duplicate". */
function BackInSentence({ sheets }: { sheets: BackIn[] }) {
  const { i18n } = useLingui()
  const byReason = new Map<string, BackIn[]>()
  for (const sheet of sheets) byReason.set(sheet.reason, [...(byReason.get(sheet.reason) ?? []), sheet])
  const groups = [...byReason].map(([reason, held]) => ({
    why: i18n._(BACK_IN_REASON[reason] ?? UNKNOWN_BACK_IN_REASON satisfies MessageDescriptor),
    named: <Listed items={held.map((sheet, i) => <SheetNamed key={i} sheet={sheet} />)} />,
  }))
  const many = sheets.length > FEW
  return (
    <>
      {many ? <Plural value={sheets.length} one="Confirmed # sheet back in, excluded before:" other="Confirmed # sheets back in, excluded before:" /> : null}
      {groups.map(({ why, named }, i) => (
        <span key={i}>
          {many ? (
            <>
              {' '}
              <Trans>
                {named} as {why}
              </Trans>
            </>
          ) : i === 0 ? (
            <Trans>
              Confirmed {named} back in, excluded before as {why}
            </Trans>
          ) : (
            <Trans>
              {named} back in, excluded before as {why}
            </Trans>
          )}
          {i < groups.length - 1 ? '; ' : ''}
        </span>
      ))}
    </>
  )
}

export function ActsPanel({ person, onClose }: { person: PersonRow; onClose: () => void }) {
  const { t } = useLingui()
  const f = useFormat()
  const { data: session } = useSuspenseQuery(sessionQuery)
  const heading = useRef<HTMLHeadingElement>(null)
  useCloseOnEsc(true, onClose)
  useEffect(() => heading.current?.focus(), [person.userId])

  const acts = useInfiniteQuery({
    queryKey: ['acts', person.userId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      unwrap(api.GET('/api/activity', { params: { query: { actor: person.userId, limit: ACTS_PAGE, ...(pageParam ? { before: pageParam } : {}) } } })),
    getNextPageParam: (last) => (last.length === ACTS_PAGE ? (last.at(-1)?.id ?? null) : null),
  })

  const name = person.name
  const title = person.role === 'vextrus_engineer' ? t`${name} (Vextrus)` : name
  const vextrusName = (actor: string) => {
    const name = actor
    return t`${name} (Vextrus)`
  }
  const projectName = (id: string | null | undefined) => session.projects.find((p) => p.id === id)?.name ?? null
  const all = acts.data?.pages.flat() ?? []
  const count = all.length

  return (
    <section aria-labelledby="acts-heading" className="flex h-full flex-col">
      <header className="flex items-start gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          {/* Room below for its focus ring, clear of the line under it (gate 20a r2). */}
          <h2 id="acts-heading" ref={heading} tabIndex={-1} className="mb-[5px] truncate text-md">
            {title}
          </h2>
          <p className="text-xs text-ink-secondary">
            <Trans>Their acts, newest first</Trans>
          </p>
        </div>
        <IconButton label={t`Close`} combo="Esc" onClick={onClose}>
          <X strokeWidth={1.5} />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {acts.isPending ? (
          <Skeleton rows={6} status={<Trans>Reading their acts…</Trans>} />
        ) : acts.isError ? (
          <LoadProblem error={acts.error} onRetry={() => void acts.refetch()} />
        ) : all.length === 0 ? (
          <Empty glyph={<History />}>
            <Trans>No acts yet</Trans>
          </Empty>
        ) : (
          <>
            <p className="sr-only">
              <Plural value={count} one="# act shown" other="# acts shown" />
            </p>
            <ol className="flex flex-col">
              {all.map((act) => {
                const project = projectName(act.project_id)
                const date = f.date(act.occurred_at)
                const time = f.time(act.occurred_at)
                const backIn = backInOf(act)
                return (
                  <li key={act.id} className="border-b border-border py-2 text-sm last:border-b-0">
                    {backIn.length > 0 ? <BackInSentence sheets={backIn} /> : <MachineText message={actMessage(act, vextrusName)} />}
                    <span className="text-ink-secondary">
                      {project ? (
                        <>
                          {' · '}
                          <bdi>{project}</bdi>
                        </>
                      ) : null}
                      {' · '}
                      <span className="num whitespace-nowrap">{t`${date}, ${time}`}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
            {acts.hasNextPage ? (
              <Button className="mt-2" saving={acts.isFetchingNextPage} onClick={() => void acts.fetchNextPage()}>
                <Trans>Show earlier acts</Trans>
              </Button>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
