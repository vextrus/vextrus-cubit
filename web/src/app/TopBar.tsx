/*
 * The top bar (docs/design/m0-screens.md §4.1), start to end: the brand mark; the project switcher
 * (only the projects the member may open; on pages outside a project, the Developer's name), never a
 * building picker (§1.10); text navigation with only Takeoff and Drawing Set in M0; the AccessChip for
 * anyone whose access has an end date or covers chosen projects; then "Jump to…  Ctrl K" and the user
 * menu (the Developer switcher for a user with more than one Membership, "Members and access" but for
 * a Guest, "Keys", and "Sign out", which ends the session at the API and clears everything held). No
 * Revision label in M0. It is the first F6 region.
 */
import { useRef } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useRouterState } from '@tanstack/react-router'
import { ChevronDown, Search } from 'lucide-react'
import { useFormat } from '@/format'
import { AccessChip, BrandMark, KeyCombo, cn } from '@/ui'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/ui/primitives/dropdown-menu'
import { useChooseDeveloper, useSignOut } from '@/auth/actions'
import { can } from '@/auth/can'
import { useSayRefused } from '@/auth/sayRefused'
import { AppLink, PATHS, useGo } from './AppLink'
import { roleName } from './roles'
import type { ProjectSummary, Session } from './session'
import { useShell } from './shell'

const Code = ({ code }: { code: string }) => (
  <bdi dir="ltr" className="num text-xs text-muted-foreground">
    {code}
  </bdi>
)

function ProjectSwitcher({ session, project }: { session: Session; project: ProjectSummary }) {
  const { t } = useLingui()
  const go = useGo()
  const name = project.name
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-control max-w-[260px] items-center gap-1 rounded-md px-2 text-sm font-semibold hover:bg-hover"
        aria-label={t`Project: ${name}. Switch project`}
      >
        <span className="truncate">{project.name}</span>
        <ChevronDown aria-hidden size={14} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[240px]">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{session.developer.name}</DropdownMenuLabel>
        {session.projects.map((p) => (
          <DropdownMenuItem key={p.code} onSelect={() => go(PATHS.takeoff(p.code, 1))} aria-current={p.code === project.code || undefined}>
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <Code code={p.code} />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => go(PATHS.projects)}>
          <Trans>All projects</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <AppLink
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative inline-flex h-topbar items-center px-2 text-sm',
        'after:absolute after:inset-x-2 after:bottom-0 after:h-0.5',
        active ? 'font-medium text-foreground after:bg-primary' : 'text-ink-secondary hover:text-foreground',
      )}
    >
      {children}
    </AppLink>
  )
}

function UserMenu({ session }: { session: Session }) {
  const { t, i18n } = useLingui()
  const go = useGo()
  const shell = useShell()
  const signOut = useSignOut()
  const choose = useChooseDeveloper()
  const sayRefused = useSayRefused()
  const trigger = useRef<HTMLButtonElement>(null)
  // "Keys" opens the overlay once the menu has closed and focus is back on its trigger, so closing the
  // overlay returns focus there (03's design gate, minor N1).
  const keysNext = useRef(false)
  const name = session.user.name
  const role = roleName(session.role, i18n)
  const others = session.memberships.filter((m) => m.developer.id !== session.developer.id)
  const current = session.developer.name
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        ref={trigger}
        className="inline-flex h-control items-center gap-1 rounded-md px-2 text-sm hover:bg-hover"
        aria-label={t`${name}, ${role}: your menu`}
      >
        <span className="whitespace-nowrap">
          <Trans>
            {name}, {role}
          </Trans>
        </span>
        <ChevronDown aria-hidden size={14} strokeWidth={1.5} className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[220px]"
        onCloseAutoFocus={(event) => {
          if (!keysNext.current) return
          keysNext.current = false
          event.preventDefault()
          trigger.current?.focus()
          shell.openKeys(trigger.current)
        }}
      >
        {/* The Developer switcher, for a user with more than one Membership (§4.1). */}
        {others.length > 0 ? (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              <Trans>Working in {current}</Trans>
            </DropdownMenuLabel>
            {others.map((m) => {
              const developer = m.developer.name
              return (
                <DropdownMenuItem key={m.id} onSelect={() => void choose(m.developer.id).catch(sayRefused)}>
                  <span className="min-w-0 flex-1 truncate">
                    <Trans>Switch to {developer}</Trans>
                  </span>
                  <span className="text-xs text-muted-foreground">{roleName(m.role, i18n)}</span>
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
          </>
        ) : null}
        {can(session, 'people') ? (
          <DropdownMenuItem onSelect={() => go(PATHS.members)}>
            <Trans>Members and access</Trans>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onSelect={() => {
            keysNext.current = true
          }}
        >
          <span className="flex-1">
            <Trans>Keys</Trans>
          </span>
          <KeyCombo combo="?" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut().catch(sayRefused)}>
          <Trans>Sign out</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function TopBar({ session, project }: { session: Session; project: ProjectSummary | undefined }) {
  const { t } = useLingui()
  const f = useFormat()
  const shell = useShell()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const until = session.until
  return (
    <header data-region="top-bar" className="focus-inset flex h-topbar shrink-0 items-center gap-2 border-b border-border bg-chrome ps-3 pe-2">
      <AppLink to={PATHS.projects} className="inline-flex size-control items-center justify-center rounded-md">
        <BrandMark size={22} />
      </AppLink>
      {project ? (
        <ProjectSwitcher session={session} project={project} />
      ) : (
        <span className="px-2 text-sm font-semibold whitespace-nowrap">{session.developer.name}</span>
      )}
      {project ? (
        <nav aria-label={t`Project`} className="flex items-stretch">
          <NavLink to={PATHS.takeoff(project.code, 1)} active={/\/takeoff(?:\/|$)/.test(path)}>
            <Trans>Takeoff</Trans>
          </NavLink>
          <NavLink to={PATHS.drawingSet(project.code)} active={path.endsWith('/drawing-set')}>
            <Trans>Drawing Set</Trans>
          </NavLink>
        </nav>
      ) : null}
      {/* The AccessChip takes the room there is, so its end date is never cut (design gate 20a r1). */}
      <div className="ms-2 flex min-w-0 flex-1">
        <AccessChip
          vextrus={session.role === 'vextrus_engineer'}
          developer={session.developer.name}
          projects={session.scope}
          until={until ? f.date(until) : null}
          daysLeft={until ? f.daysUntil(until) : null}
        />
      </div>
      <button
        type="button"
        onClick={(event) => shell.openJump(event.currentTarget)}
        className="inline-flex h-control w-[220px] items-center gap-2 rounded-md border border-border-strong bg-paper ps-2 pe-1 text-sm text-muted-foreground hover:border-input"
      >
        <Search aria-hidden size={14} strokeWidth={1.5} />
        <span className="flex-1 text-start">
          <Trans>Jump to…</Trans>
        </span>
        <KeyCombo combo="Ctrl K" />
      </button>
      <UserMenu session={session} />
    </header>
  )
}
