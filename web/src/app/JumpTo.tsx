/*
 * Jump to (Ctrl K; docs/design/m0-screens.md §2.2, §4.1): the projects the member may open (story 102;
 * a member given chosen projects sees only those), and inside a project its Drawing Set, Step 1 and
 * Members and access (not for a Guest, §1.4). Sheets by number or title join when the sheet list exists
 * (16, 22).
 */
import { Trans, useLingui } from '@lingui/react/macro'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ui/primitives/command'
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
