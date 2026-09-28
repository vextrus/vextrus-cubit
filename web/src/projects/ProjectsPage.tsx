/*
 * Projects (docs/design/m0-screens.md §4.3; stories 2–4, 56, 99, 102; wireframes `projects-*.svg`): the
 * Developer's projects in one list, only those the member may open (the API lists no other).
 *
 * Header: "Projects", and "3 projects at Shapla Homes Ltd" (a member given chosen projects: "2 projects
 * at Shapla Homes Ltd are open to you"); the ReadOnlyChip for the MD and a Guest; "Members and access"
 * (not for a Guest) and "New project" (for the QS and the Vextrus Engineer, when not given chosen
 * projects: 08 refuses the rest). The table: Code · Name · Address · Drawing Set · Takeoff · Updated; the
 * last three show 1.2's empty figure until 20b and 19a send them. ↑ ↓ Home End move, Enter opens.
 *
 * Empty: "No projects yet. Create one for each development whose drawings you will take off." [New
 * project] (the MD: "No projects yet. Your QS creates them."). A Guest, or anyone given chosen projects
 * that are gone, is shown 4.1's "No access to anything".
 */
import { useState } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useSuspenseQuery } from '@tanstack/react-query'
import { FolderPlus } from 'lucide-react'
import { AppLink, PATHS, useGo } from '@/app/AppLink'
import { PageLayout } from '@/app/Frame'
import { sessionQuery, type ProjectSummary, type Session } from '@/app/session'
import { can, mayCreateProject, readOnlyRole, usePageTitle } from '@/auth'
import { EMPTY } from '@/format'
import { Button, Empty, List, ReadOnlyChip, Skeleton, buttonVariants, cn } from '@/ui'
import { NewProjectDialog } from './NewProjectDialog'

/** The header's count line. */
function CountLine({ session }: { session: Session }) {
  const developer = session.developer.name
  const n = session.projects.length
  if (session.scope === 'all') return <Plural value={n} one={`# project at ${developer}`} other={`# projects at ${developer}`} />
  return <Plural value={n} one={`# project at ${developer} is open to you`} other={`# projects at ${developer} are open to you`} />
}

const COLUMNS = 'grid w-full grid-cols-[88px_220px_minmax(0,1fr)_200px_180px_96px] items-center gap-x-2'

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

function Row({ project }: { project: ProjectSummary }) {
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
      <span className="text-ink-secondary">{EMPTY}</span>
      <span className="text-ink-secondary">{EMPTY}</span>
      <span className="text-end text-ink-secondary">{EMPTY}</span>
    </AppLink>
  )
}

/** The list, the loading rows, or the empty state. */
export function ProjectsTable({ session, onNew }: { session: Session; onNew: () => void }) {
  const { t } = useLingui()
  const go = useGo()
  const projects = session.projects
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
        renderItem={(p) => <Row project={p} />}
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
  else words = <Trans>You have no access to any Developer at the moment. Ask your MD, or Vextrus, for an invitation.</Trans>
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
