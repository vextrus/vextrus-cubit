/*
 * Jump to (Ctrl K; docs/design/m0-screens.md §2.2, §4.1): the projects the member may open (story 102;
 * a member given chosen projects sees only those), and inside a project its Drawing Set, Step 1 and
 * Members and access (not for a Guest, §1.4), and its Step 1 sheets by number or title (S25-D4).
 */
import { Trans, useLingui } from '@lingui/react/macro'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ui/primitives/command'
import { useQuery } from '@tanstack/react-query'
import { proposalsQuery } from '@/takeoff/data'
import { step1SheetPath } from '@/takeoff/paths'
import { PATHS, useGo } from './AppLink'
import type { ProjectSummary, Session } from './session'

export function JumpTo({
  open,
  onOpenChange,
  session,
  project,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: Session
  project: ProjectSummary | undefined
}) {
  const { t } = useLingui()
  const go = useGo()
  const jump = (to: string) => {
    onOpenChange(false)
    go(to)
  }
  const name = project?.name ?? ''
  // The Step's sheets, read only once Jump to is open inside a project (the list is the Step's own cache).
  const sheets = useQuery({ ...proposalsQuery(project?.id ?? ''), enabled: open && project !== undefined }).data
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={t`Jump to`} description={t`Go to a project, or to a place in this one.`}>
      <CommandInput placeholder={t`Jump to a project or a place…`} />
      <CommandList>
        <CommandEmpty>
          <Trans>Nothing here by that name.</Trans>
        </CommandEmpty>
        {project ? (
          <CommandGroup heading={t`In ${name}`}>
            <CommandItem value={`drawing-set ${t`Drawing Set`}`} onSelect={() => jump(PATHS.drawingSet(project.code))}>
              <Trans>Drawing Set</Trans>
            </CommandItem>
            <CommandItem value={`step-1 ${t`Step 1, Sheets`}`} onSelect={() => jump(PATHS.takeoff(project.code, 1))}>
              <Trans>Step 1, Sheets</Trans>
            </CommandItem>
            {session.role !== 'guest' ? (
              <CommandItem value={`members ${t`Members and access`}`} onSelect={() => jump(PATHS.members)}>
                <Trans>Members and access</Trans>
              </CommandItem>
            ) : null}
          </CommandGroup>
        ) : null}
        {project && sheets?.length ? (
          <CommandGroup heading={t`Sheets`}>
            {sheets.map((p) => (
              <CommandItem key={p.id} value={`sheet ${p.number ?? ''} ${p.title ?? ''} ${p.id}`} onSelect={() => jump(step1SheetPath(project.code, p.number || p.sheet_id))}>
                <bdi dir="ltr" className="num text-xs text-muted-foreground">
                  {p.number}
                </bdi>
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        <CommandGroup heading={t`Projects`}>
          {session.projects.map((p) => (
            <CommandItem key={p.code} value={`project ${p.code} ${p.name}`} onSelect={() => jump(PATHS.takeoff(p.code, 1))}>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <bdi dir="ltr" className="num text-xs text-muted-foreground">
                {p.code}
              </bdi>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
