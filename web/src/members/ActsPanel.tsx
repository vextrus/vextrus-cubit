/*
 * One person's acts (docs/design/m0-screens.md §4.4, "Acts"; stories 59, 60): the side panel the Acts
 * column opens, for the MD and the QS only (the owner's ruling, 28 Sep 2026: "MD and QS"). Newest
 * first, each worded from its code (§1.7) with the project and when: "Arif Rahman (Vextrus) created
 * this project · Kadam Residence · 26 Sep 2026, 15:42". A Vextrus Engineer, or Vextrus's staff, is
 * marked "(Vextrus)" after their name. Esc or the close button closes it.
 */
import { useEffect, useRef } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { ApiRefused, api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'
import { sessionQuery } from '@/app/session'
import { useCloseOnEsc } from '@/app/shell'
import { useFormat } from '@/format'
import { MachineText, type MachineMessage } from '@/format/machine'
import { Button, Empty, ErrorBar, IconButton, Skeleton } from '@/ui'
import { History } from 'lucide-react'
import { ACTS_PAGE, type PersonRow } from './data'

type ActOut = components['schemas']['ActOut']

/** The act as the machine's sentence, its actor marked "(Vextrus)" where they are of Vextrus. */
export function actMessage(act: ActOut, vextrusName: (name: string) => string): MachineMessage {
  const params: Record<string, string | number> = { ...act.params }
  if (act.actor) params.actor = act.actor.vextrus ? vextrusName(act.actor.name) : act.actor.name
  return { code: act.code, params }
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
    retry: (failures, error) => !(error instanceof ApiRefused) && failures < 3,
  })

  const name = person.name
  const title = person.role === 'vextrus_engineer' ? t`${name} (Vextrus)` : name
  const vextrusName = (n: string) => t`${n} (Vextrus)`
  const projectName = (id: string | null | undefined) => session.projects.find((p) => p.id === id)?.name ?? null
  const all = acts.data?.pages.flat() ?? []

  return (
    <section aria-labelledby="acts-heading" className="flex h-full flex-col">
      <header className="flex items-start gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 id="acts-heading" ref={heading} tabIndex={-1} className="truncate text-md">
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
          <ErrorBar>{acts.error instanceof ApiRefused && acts.error.refusal ? <MachineText message={acts.error.refusal} /> : <Trans>Vextrus can’t be reached. Check your connection; this page keeps trying.</Trans>}</ErrorBar>
        ) : all.length === 0 ? (
          <Empty glyph={<History />}>
            <Trans>No acts yet.</Trans>
          </Empty>
        ) : (
          <>
            <p className="sr-only">
              <Plural value={all.length} one="# act shown" other="# acts shown" />
            </p>
            <ol className="flex flex-col">
              {all.map((act) => {
                const project = projectName(act.project_id)
                const date = f.date(act.occurred_at)
                const time = f.time(act.occurred_at)
                return (
                  <li key={act.id} className="border-b border-border py-2 text-sm last:border-b-0">
                    <MachineText message={actMessage(act, vextrusName)} />
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
