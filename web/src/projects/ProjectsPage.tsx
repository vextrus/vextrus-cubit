/*
 * Projects (docs/design/m0-screens.md §4.3; stories 2–4, 56, 99, 102; wireframes `projects-*.svg`): the
 * Developer's projects in one list, only those the member may open (the API lists no other).
 *
 * Header: "Projects", and "3 projects at Shapla Homes Ltd" (a member given chosen projects: "2 projects
 * at Shapla Homes Ltd are open to you"); the ReadOnlyChip for the MD and a Guest; "Members and access"
 * (not for a Guest) and "New project" (for the QS and the Vextrus Engineer, when not given chosen
 * projects: 08 refuses the rest). The table: Code · Name · Address · Drawing Set · Takeoff · Updated; each
 * row reads its own project's files, Step 1 progress and newest act (readings.ts) and words them in 4.3's
 * words ("6 files read, 1 held", "Step 1: 5 Questions open", the newest day); a reading not in, refused
 * or failed is 1.2's empty figure and nothing else. ↑ ↓ Home End move, Enter opens Step 1.
 *
 * Empty: "No projects yet. Create one for each development whose drawings you will take off." [New
 * project] (the MD: "No projects yet. Your QS creates them."). A Guest, or anyone given chosen projects
 * that are gone, is shown 4.1's "No access to anything".
 */
import { useEffect, useRef, useState } from 'react'
import { plural } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { FolderPlus } from 'lucide-react'
import { AppLink, PATHS, useGo } from '@/app/AppLink'
import { PageLayout } from '@/app/Frame'
import { sessionQuery, type ProjectSummary, type Session } from '@/app/session'
import { can, mayCreateProject, readOnlyRole, usePageTitle } from '@/auth'
import { EMPTY, useFormat } from '@/format'
import { disciplineName } from '@/takeoff/SheetList'
import { Button, Empty, List, ReadOnlyChip, Skeleton, buttonVariants, cn } from '@/ui'
import { NewProjectDialog } from './NewProjectDialog'
import { driveWords, filesQuery, isMoving, latestActKey, latestActQuery, listProgressQuery, takeoffWords, updatedAt, type DriveWords, type TakeoffPart, type TakeoffWords } from './readings'

/** The header's count line. */
function CountLine({ session }: { session: Session }) {
  const developer = session.developer.name
  const n = session.projects.length
  if (session.scope === 'all') return <Plural value={n} one={`# project at ${developer}`} other={`# projects at ${developer}`} />
  return <Plural value={n} one={`# project at ${developer} is open to you`} other={`# projects at ${developer} are open to you`} />
}

const COLUMNS = 'grid w-full grid-cols-[88px_200px_minmax(0,1fr)_minmax(0,220px)_minmax(0,320px)_96px] items-center gap-x-2'

function HeaderRow() {
  return (
    <div role="presentation" aria-hidden className={cn(COLUMNS, 'h-row border-b border-border bg-chrome-sunken px-2 text-xs font-semibold text-ink-secondary')}>
      <span>
        <Trans>Code</Trans>
      </span>
      <span>
        <Trans>Name</Trans>
      </span>
      <span>
        <Trans>Address</Trans>
      </span>
      <span>
        <Trans>Drawing Set</Trans>
      </span>
      <span>
        <Trans>Takeoff</Trans>
      </span>
      <span className="text-end">
        <Trans>Updated</Trans>
      </span>
    </div>
  )
}

/** A reading's words in one muted line, its full text in its title; the empty figure until it is in. */
function Cell({ text, className }: { text: string | null; className?: string }) {
  return (
    <span className={cn('truncate text-ink-secondary', className)} title={text ?? undefined}>
      {text ?? EMPTY}
    </span>
  )
}

/** "6 files read, 1 held" (§4.3's Drawing Set column). */
function useDriveText(): (words: DriveWords) => string {
  const { t } = useLingui()
  const f = useFormat()
  return (words) => {
    if (words.kind === 'none') return t`No drawings yet`
    if (words.kind === 'reading') {
      if (words.at) {
        const position = f.integer(words.at.position)
        const total = f.integer(words.at.total)
        return words.at.unit === 'page'
          ? t({ message: plural(words.files, { one: `Reading # file, page ${position} of ${total}`, other: `Reading # files, page ${position} of ${total}` }) })
          : t({ message: plural(words.files, { one: `Reading # file, sheet ${position} of ${total}`, other: `Reading # files, sheet ${position} of ${total}` }) })
      }
      return t({ message: plural(words.files, { one: 'Reading # file', other: 'Reading # files' }) })
    }
    const parts = [words.read === 0 ? t`No files read` : t({ message: plural(words.read, { one: '# file read', other: '# files read' }) })]
    const held = f.integer(words.held)
    const trouble = f.integer(words.trouble)
    const refused = f.integer(words.refused)
    const stopped = f.integer(words.stopped)
    if (words.held > 0) parts.push(t`${held} held`)
    if (words.trouble > 0) parts.push(t`${trouble} could not be read`)
    if (words.refused > 0) parts.push(t`${refused} refused`)
    if (words.stopped > 0) parts.push(t`${stopped} stopped`)
    return parts.join(t({ message: ', ', comment: 'Joins the counts of the Drawing Set column: "6 files read, 1 held".' }))
  }
}

/** "Step 1: 5 Questions open", or the per-Discipline parts as the Step 1 inspector's PartsLine words them. */
function useTakeoffText(): (words: TakeoffWords) => string {
  const { i18n, t } = useLingui()
  const f = useFormat()
  const part = (p: TakeoffPart) => {
    const name = disciplineName(p.discipline, i18n)
    if (p.kind === 'confirmed') return t`${name} confirmed`
    if (p.kind === 'left') {
      const leftText = f.integer(p.sheets)
      return t`${name} ${leftText} to confirm`
    }
    if (p.kind === 'questions') {
      const openText = f.integer(p.open)
      return p.open === 1 ? t`${name}: 1 Question open` : t`${name}: ${openText} Questions open`
    }
    return t`${name}: a view unaccounted`
  }
  return (words) => {
    switch (words.kind) {
      case 'not_started':
        return t`Not started`
      case 'questions': {
        return t({ message: plural(words.open, { one: 'Step 1: # Question open', other: 'Step 1: # Questions open' }) })
      }
      case 'to_confirm': {
        return t({ message: plural(words.sheets, { one: 'Step 1: # sheet to confirm', other: 'Step 1: # sheets to confirm' }) })
      }
      case 'not_confirmed':
        return t`Step 1: not yet confirmed`
      case 'confirmed':
        return t`Step 1 confirmed`
      case 'parts': {
        const parts = words.parts.map(part).join(' · ')
        return t`Step 1: ${parts}`
      }
    }
  }
}

function DriveCell({ projectId }: { projectId: string }) {
  const words = useDriveText()
  const files = useQuery(filesQuery(projectId))
  return <Cell text={files.data ? words(driveWords(files.data.files)) : null} />
}

function TakeoffCell({ projectId }: { projectId: string }) {
  const words = useTakeoffText()
  const progress = useQuery(listProgressQuery(projectId))
  return <Cell text={progress.data ? words(takeoffWords(progress.data)) : null} />
}

/** The newest of its created day, its newest file and (for a viewer who may see acts) its newest act. */
function UpdatedCell({ project, mayActs }: { project: ProjectSummary; mayActs: boolean }) {
  const f = useFormat()
  const files = useQuery(filesQuery(project.id))
  const act = useQuery(latestActQuery(project.id, mayActs))
  // A reading that cannot be had (refused or failed) leaves the date unknown: the empty figure, never an older day.
  const settled = files.isSuccess && (!mayActs || act.isSuccess)
  const at = settled ? updatedAt(project.createdAt, files.data?.files ?? [], mayActs ? act.data?.occurred_at : null) : null
  return <Cell text={at ? f.date(at) : null} className="text-end" />
}

/** When a project's files stop moving, its Step 1 and its newest act are read once more. */
function useReadAgainWhenStill(projectId: string, mayActs: boolean) {
  const queryClient = useQueryClient()
  const files = useQuery(filesQuery(projectId))
  const moving = files.data?.files.some(isMoving) ?? false
  const was = useRef(moving)
  useEffect(() => {
    if (was.current && !moving) {
      void queryClient.refetchQueries({ queryKey: listProgressQuery(projectId).queryKey, exact: true })
      if (mayActs) void queryClient.refetchQueries({ queryKey: latestActKey(projectId), exact: true })
    }
    was.current = moving
  }, [moving, projectId, mayActs, queryClient])
}

function Row({ project, mayActs }: { project: ProjectSummary; mayActs: boolean }) {
  useReadAgainWhenStill(project.id, mayActs)
  return (
    <AppLink to={PATHS.project(project.code)} className={cn(COLUMNS, 'h-full min-w-0 text-foreground')} tabIndex={-1}>
      <bdi dir="ltr" className="num truncate">
        {project.code}
      </bdi>
      <span className="truncate" title={project.name}>
        {project.name}
      </span>
      <span className="truncate text-ink-secondary" title={project.address}>
        {project.address || EMPTY}
      </span>
      <DriveCell projectId={project.id} />
      <TakeoffCell projectId={project.id} />
      <UpdatedCell project={project} mayActs={mayActs} />
    </AppLink>
  )
}

/** The list, the loading rows, or the empty state. */
export function ProjectsTable({ session, onNew }: { session: Session; onNew: () => void }) {
  const { t } = useLingui()
  const go = useGo()
  const projects = session.projects
  const mayActs = can(session, 'acts')
  const [focused, setFocused] = useState<string | null>(projects[0]?.code ?? null)
  if (projects.length === 0) return <ProjectsEmpty session={session} onNew={onNew} />
  return (
    <div className="overflow-hidden rounded-md border border-border bg-paper">
      <HeaderRow />
      <List
        label={t`Projects`}
        items={projects}
        getKey={(p) => p.code}
        focusedKey={focused}
        onFocusedKeyChange={setFocused}
        rowClassName="border-border last:border-b-0"
        keys={[{ key: 'Enter', label: t`Open the project`, group: 'screen', run: () => (focused ? go(PATHS.project(focused)) : undefined) }]}
        renderItem={(p) => <Row project={p} mayActs={mayActs} />}
      />
    </div>
  )
}

export function ProjectsEmpty({ session, onNew }: { session: Session; onNew: () => void }) {
  let words
  let action = null
  if (mayCreateProject(session)) {
    words = <Trans>No projects yet. Create one for each development whose drawings you will take off.</Trans>
    action = (
      <Button variant="primary" onClick={onNew}>
        <Trans>New project</Trans>
      </Button>
    )
  } else if (session.role === 'md' && session.scope === 'all') words = <Trans>No projects yet. Your QS creates them.</Trans>
  else if (session.scope === 'all') {
    // A Guest given every project, at a Developer with none yet.
    const developer = session.developer.name
    words = <Trans>No projects yet. You will see them here once {developer} creates them.</Trans>
  } else if (session.role === 'guest') {
    // Every project a Guest was given is gone: 4.1's "No access to anything" (m0-screens §4.3).
    words = <Trans>You have no access to any Developer at the moment. Ask your MD, or Vextrus, for an invitation.</Trans>
  } else words = <Trans>None of the projects you were given is open now. Ask whoever invited you to give you another.</Trans>
  return (
    <div className="rounded-md border border-border bg-paper">
      <Empty glyph={<FolderPlus />} action={action}>
        {words}
      </Empty>
    </div>
  )
}

/** Loading (§4.3): five Skeleton rows. */
export function ProjectsLoading() {
  return <Skeleton rows={5} status={<Trans>Opening the projects…</Trans>} />
}

export function ProjectsPage() {
  const { t } = useLingui()
  const { data: session } = useSuspenseQuery(sessionQuery)
  const [creating, setCreating] = useState(false)
  usePageTitle(t`Projects`)
  const readOnly = readOnlyRole(session)
  return (
    <PageLayout>
      <header className="mb-5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl">
            <Trans>Projects</Trans>
          </h1>
          {session.projects.length > 0 ? (
            <p className="text-sm text-ink-secondary">
              <CountLine session={session} />
            </p>
          ) : null}
        </div>
        {readOnly ? <ReadOnlyChip role={readOnly} className="mt-1.5" /> : null}
        {can(session, 'people') ? (
          <AppLink to={PATHS.members} className={buttonVariants({ variant: 'ghost' })}>
            <Trans>Members and access</Trans>
          </AppLink>
        ) : null}
        {mayCreateProject(session) ? (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Trans>New project</Trans>
          </Button>
        ) : null}
      </header>
      <ProjectsTable session={session} onNew={() => setCreating(true)} />
      {mayCreateProject(session) ? <NewProjectDialog session={session} open={creating} onOpenChange={setCreating} /> : null}
    </PageLayout>
  )
}
