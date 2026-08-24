'use client';

/**
 * `AppShell` — the one persistent layout every signed-in `/t/{tenantSlug}` route renders
 * inside (R-UI-030, docs/design/shell.md §1–§5).
 *
 * Left rail, top bar, main area, right inspector, and nothing else: the shell holds no area's
 * content and knows no area's data. What it does know is the URL, because R-UI-031 makes the
 * URL the source of truth — the current rail item, the breadcrumb's second crumb and the
 * `aria-current` mark are all read from `usePathname()` and from nothing else, so a deep link,
 * a rail click and the browser's back button cannot disagree about where the reader is.
 *
 * The slots whose feature is a later milestone — the project switcher, ⌘K, jobs and
 * notifications — are live triggers with an honest answer inside (Interpretation 2), never a
 * disabled control that says nothing when a reader presses it (R-UI-020).
 *
 * It is a client component because three things here are the browser's: the rail's collapse
 * (in memory, per tab — Interpretation 5), the overlays, and the connection state that mounts
 * the offline banner. Everything a server knows — the tenant, the memberships, the account —
 * arrives as props from the segment layout that guarded the request.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { EvidenceLink, OfflineBanner } from '../patterns';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Kbd,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../primitives';
import { cx } from '../primitives/class-names';
import { ShellAreaState } from './shell-area-state';
import {
  PROJECT_SEGMENT,
  RAIL_AREAS,
  SHELL_STATES,
  TENANT_HOME_SEGMENT,
  segmentOf,
  tenantPath,
} from './contract';
import type { RailArea } from './contract';
import { sh, shFill } from './strings';

/** ARIA and DOM vocabulary — machine words, not copy (R-SPINE-060). */
const TRUE = 'true';
const FALSE = 'false';
const HIDDEN = 'true';
const MENU_RADIO = 'menuitemradio';
const GROUP = 'group';
const RIGHT = 'right';
const BOTTOM = 'bottom';
const END = 'end';
const START = 'start';

/** Where sign-out leaves a reader, and the endpoint that ends the session on the way (§3). */
const SIGN_IN = '/sign-in';
const SIGN_OUT_ENDPOINT = '/api/auth/sign-out';

/** The two keys the ⌘K affordance shows. Key caps are the keyboard's own marks, not copy. */
const COMMAND_KEYS = Object.freeze(['⌘', 'K']);

/** The rail's labels, by segment — R-UI-030 fixes these three and the shell owns their words. */
const RAIL_LABELS: Readonly<Record<RailArea, string>> = Object.freeze({
  projects: sh('shell.nav.projects'),
  books: sh('shell.nav.books'),
  settings: sh('shell.nav.settings'),
});

/** The test id each rail item carries, from the increment's test contract (C-05). */
const RAIL_TESTIDS: Readonly<Record<RailArea, string>> = Object.freeze({
  projects: 'rail-nav-projects',
  books: 'rail-nav-books',
  settings: 'rail-nav-settings',
});

/* ─────────────────────────────────── the icons (§2, §3) ─────────────────────────────────── */

/**
 * 16 px line glyphs, 1.5 px stroke, `currentColor` — decoration beside a label that already
 * says what the item is, so every one of them is `aria-hidden` (R-UI-060: no colour-only, and
 * no glyph-only, meaning).
 */
function Glyph({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <svg
      className="shell-glyph"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={HIDDEN}
    >
      {children}
    </svg>
  );
}

/** Projects — a sheet with its top-right corner folded. */
const ProjectsIcon = (): ReactElement => (
  <Glyph>
    <path d="M9.5 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5z" />
    <path d="M9.5 2v3.5H13" />
  </Glyph>
);

/** Books — two upright spines. */
const BooksIcon = (): ReactElement => (
  <Glyph>
    <path d="M3 2.5h3v11H3z" />
    <path d="M8 2.5h3v11H8z" />
  </Glyph>
);

/** Settings — slider lines with offset dots. */
const SettingsIcon = (): ReactElement => (
  <Glyph>
    <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
    <path d="M4.5 4.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0" />
    <path d="M8.5 8a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0" />
    <path d="M3.5 11.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0" />
  </Glyph>
);

const RAIL_ICONS: Readonly<Record<RailArea, () => ReactElement>> = Object.freeze({
  projects: ProjectsIcon,
  books: BooksIcon,
  settings: SettingsIcon,
});

const ChevronRightIcon = (): ReactElement => (
  <Glyph>
    <path d="M6 3.5 10.5 8 6 12.5" />
  </Glyph>
);

const ChevronLeftIcon = (): ReactElement => (
  <Glyph>
    <path d="M10 3.5 5.5 8 10 12.5" />
  </Glyph>
);

const ChevronDownIcon = (): ReactElement => (
  <Glyph>
    <path d="M3.5 6 8 10.5 12.5 6" />
  </Glyph>
);

/** Jobs — a clock face, because a job is work that takes time (§3). */
const JobsIcon = (): ReactElement => (
  <Glyph>
    <path d="M2.5 8a5.5 5.5 0 1 0 11 0 5.5 5.5 0 1 0-11 0" />
    <path d="M8 5v3.2l2 1.3" />
  </Glyph>
);

const NotificationsIcon = (): ReactElement => (
  <Glyph>
    <path d="M4 7a4 4 0 0 1 8 0c0 2.2.5 3.3 1 4H3c.5-.7 1-1.8 1-4z" />
    <path d="M6.5 13a1.6 1.6 0 0 0 3 0" />
  </Glyph>
);

/** The check that marks the workspace a reader is already in (§2). */
const CheckIcon = (): ReactElement => (
  <Glyph>
    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
  </Glyph>
);

/* ──────────────────────────────────────── the rail ──────────────────────────────────────── */

export interface TenantOption {
  readonly slug: string;
  readonly name: string;
}

interface RailItemProps {
  readonly area: RailArea;
  readonly slug: string;
  readonly current: boolean;
  readonly collapsed: boolean;
}

/**
 * One rail item. Collapsed, the label leaves the screen but not the accessibility tree, and a
 * Tooltip carries it on hover and on focus (§2) — a rail of unlabelled icons is a rail only
 * somebody who already knows the product can use.
 */
function RailItem({ area, slug, current, collapsed }: RailItemProps): ReactElement {
  const label = RAIL_LABELS[area];
  const Icon = RAIL_ICONS[area];
  const item = (
    <Link
      href={tenantPath(slug, area)}
      data-testid={RAIL_TESTIDS[area]}
      aria-current={current ? 'page' : undefined}
      className={cx('shell-nav-item', 'datum-focus-ring')}
    >
      <Icon />
      <span className="shell-nav-label">{label}</span>
    </Link>
  );
  if (!collapsed) return item;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{item}</TooltipTrigger>
      <TooltipContent side={RIGHT}>{label}</TooltipContent>
    </Tooltip>
  );
}

interface TenantSwitcherProps {
  readonly tenantName: string;
  readonly slug: string;
  readonly memberships: readonly TenantOption[];
  readonly collapsed: boolean;
}

/**
 * The tenant switcher (§2): the workspace this reader is in, and a menu of the ones they may
 * move to. The current workspace is a checked radio item rather than a hidden one — a reader
 * has to be able to see where they are without leaving.
 */
function TenantSwitcher({
  tenantName,
  slug,
  memberships,
  collapsed,
}: TenantSwitcherProps): ReactElement {
  const initial = tenantName.slice(0, 1).toUpperCase();
  const trigger = (
    <DropdownMenuTrigger data-testid="rail-tenant-switcher" className="shell-tenant-trigger">
      <span aria-hidden={HIDDEN} className="shell-tenant-tile">
        {initial}
      </span>
      <span className="shell-tenant-name">{tenantName}</span>
      <span aria-hidden={HIDDEN} className="shell-tenant-chevron">
        <ChevronRightIcon />
      </span>
    </DropdownMenuTrigger>
  );
  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side={RIGHT}>{tenantName}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <DropdownMenuContent
        align={START}
        side={RIGHT}
        aria-label={sh('shell.rail.tenants')}
        className="shell-tenant-menu"
      >
        {memberships.map((membership) => (
          <DropdownMenuItem
            key={membership.slug}
            data-testid="tenant-switcher-item"
            role={MENU_RADIO}
            aria-checked={membership.slug === slug}
            className="shell-tenant-item"
            onSelect={() => {
              window.location.assign(tenantPath(membership.slug));
            }}
          >
            <span aria-hidden={HIDDEN} className="shell-tenant-check">
              {membership.slug === slug ? <CheckIcon /> : null}
            </span>
            {membership.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─────────────────────────────────────── the top bar ─────────────────────────────────────── */

interface SlotPopoverProps {
  readonly trigger: ReactElement;
  readonly body: string;
  readonly action?: { readonly href: string; readonly label: string };
}

/**
 * A later-milestone slot: a live trigger whose surface says what the slot will hold and what
 * to do today (Interpretation 2, R-UI-020 — "silence never happens").
 */
function SlotPopover({ trigger, body, action }: SlotPopoverProps): ReactElement {
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={END} side={BOTTOM} className="shell-popover">
        <p className="shell-popover-body">{body}</p>
        {action === undefined ? null : (
          <p className="shell-popover-action">
            <EvidenceLink href={action.href}>{action.label}</EvidenceLink>
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface UserSlotProps {
  readonly accountEmail: string;
  readonly signOutLabel: string;
}

/**
 * The account and the way out (§3, Interpretation 1). Sign out is a directly visible control
 * rather than a menu item: it ends the session with a fetch and then navigates, so the cookie
 * is already gone when `/sign-in` is asked for.
 */
function UserSlot({ accountEmail, signOutLabel }: UserSlotProps): ReactElement {
  const [leaving, setLeaving] = useState(false);

  const signOut = useCallback(async () => {
    setLeaving(true);
    try {
      await fetch(SIGN_OUT_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch {
      // The cookie may already be gone; either way the reader asked to leave.
    }
    window.location.assign(SIGN_IN);
  }, []);

  return (
    <div role={GROUP} aria-label={sh('shell.user')} data-testid="topbar-user" className="shell-user">
      <span className="shell-user-email" title={accountEmail}>
        {accountEmail}
      </span>
      <Button
        variant="ghost"
        data-testid="auth-sign-out"
        loading={leaving}
        onClick={() => {
          void signOut();
        }}
      >
        {signOutLabel}
      </Button>
    </div>
  );
}

/* ──────────────────────────────────────── the shell ──────────────────────────────────────── */

/**
 * The project the URL has open, when it has one (docs/design/s-project-settings-…
 * Interpretation 5). `href` is where its name links: the project's own settings pane, which is
 * its only destination at M0.
 */
export interface OpenProject {
  readonly name: string;
  readonly href: string;
}

export interface AppShellProps {
  /** The workspace the URL names, as a person reads it. */
  readonly tenantName: string;
  readonly slug: string;
  /** The open project, on `/t/{slug}/p/{projectId}/…` and nowhere else. */
  readonly project?: OpenProject | undefined;
  /**
   * URL tail → the crumb it reads as, for the panes a project route ends on. The tail rather
   * than the area segment, because every one of them sits under the same `/p/{projectId}` and
   * the segment alone could not tell them apart.
   */
  readonly paneLabels?: Readonly<Record<string, string>> | undefined;
  /** Every workspace this reader belongs to, oldest membership first (§2). */
  readonly memberships: readonly TenantOption[];
  /** The signed-in account, shown in the user slot. */
  readonly accountEmail: string;
  /** `tenant.signOut`, handed down: the areas' copy is the `/t` segment's table, not the shell's. */
  readonly signOutLabel: string;
  /** URL segment → breadcrumb label, for the areas the rail does not carry (Interpretation 7). */
  readonly areaLabels?: Readonly<Record<string, string>> | undefined;
  readonly children: ReactNode;
}

export function AppShell({
  tenantName,
  slug,
  project,
  paneLabels,
  memberships,
  accountEmail,
  signOutLabel,
  areaLabels,
  children,
}: AppShellProps): ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  const [offline, setOffline] = useState(false);
  const pathname = usePathname();

  // R-UI-031: the URL, and nothing kept beside it, says which area is open.
  const segment = segmentOf(pathname ?? tenantPath(slug));

  // Interpretation 5: a project route is inside the Projects area, so the rail's Projects item
  // is the marked one there too — a project is where that area leads.
  const railSegment = segment === PROJECT_SEGMENT ? RAIL_AREAS[0] : segment;

  // Interpretation 5: on a project route the last crumb is the open pane, by its own label.
  const paneLabel = useMemo(() => {
    if (project === undefined) return undefined;
    const parts = (pathname ?? '').split('/').filter((part) => part !== '');
    return paneLabels?.[parts[parts.length - 1] ?? ''];
  }, [paneLabels, pathname, project]);

  const crumb = useMemo(() => {
    if (segment === TENANT_HOME_SEGMENT) return undefined;
    const railLabel = (RAIL_LABELS as Readonly<Record<string, string | undefined>>)[segment];
    return areaLabels?.[segment] ?? railLabel;
  }, [areaLabels, segment]);

  // §6: the browser's own events, read once on mount so a reader who arrived offline is told.
  useEffect(() => {
    const answer = (): void => setOffline(!window.navigator.onLine);
    answer();
    window.addEventListener('online', answer);
    window.addEventListener('offline', answer);
    return () => {
      window.removeEventListener('online', answer);
      window.removeEventListener('offline', answer);
    };
  }, []);

  return (
    <div className="shell-frame" data-collapsed={collapsed ? TRUE : FALSE}>
      <nav
        data-testid="shell-rail"
        data-collapsed={collapsed ? TRUE : FALSE}
        aria-label={sh('shell.rail.label')}
        className="shell-rail"
      >
        <TenantSwitcher
          tenantName={tenantName}
          slug={slug}
          memberships={memberships}
          collapsed={collapsed}
        />
        <Separator className="shell-rail-separator" />
        <ul className="shell-nav">
          {RAIL_AREAS.map((area) => (
            <li key={area} className="shell-nav-row">
              <RailItem
                area={area}
                slug={slug}
                current={area === railSegment}
                collapsed={collapsed}
              />
            </li>
          ))}
        </ul>
        <div className="shell-rail-spacer" />
        <IconButton
          data-testid="rail-toggle"
          className="shell-rail-toggle"
          aria-expanded={!collapsed}
          label={collapsed ? sh('shell.rail.expand') : sh('shell.rail.collapse')}
          icon={collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          onClick={() => setCollapsed((was) => !was)}
        />
      </nav>

      <div className="shell-column">
        <header data-testid="shell-topbar" className="shell-topbar">
          <nav
            data-testid="topbar-breadcrumb"
            aria-label={sh('shell.breadcrumb')}
            className="shell-breadcrumb"
          >
            {project === undefined && crumb === undefined ? (
              <span className="shell-crumb-current">{tenantName}</span>
            ) : (
              <>
                <Link
                  href={tenantPath(slug)}
                  className={cx('shell-crumb-link', 'datum-focus-ring')}
                >
                  {tenantName}
                </Link>
                {/* Interpretation 5: on a project route the project's own name sits between
                    the workspace and the open pane, as an anchor to the project itself. */}
                {project === undefined ? null : (
                  <>
                    <span aria-hidden={HIDDEN} className="shell-crumb-separator">
                      /
                    </span>
                    <Link
                      href={project.href}
                      className={cx('shell-crumb-link', 'datum-focus-ring')}
                    >
                      {project.name}
                    </Link>
                  </>
                )}
                {paneLabel === undefined && crumb === undefined ? null : (
                  <>
                    <span aria-hidden={HIDDEN} className="shell-crumb-separator">
                      /
                    </span>
                    <span className="shell-crumb-current">{paneLabel ?? crumb}</span>
                  </>
                )}
              </>
            )}
          </nav>

          <div className="shell-slots">
            <SlotPopover
              trigger={
                <Button
                  variant="ghost"
                  data-testid="topbar-project-switcher"
                  className="shell-project-trigger"
                >
                  <span className="shell-project-none">
                    {project?.name ?? sh('shell.topbar.project.none')}
                  </span>
                  <span aria-hidden={HIDDEN} className="shell-slot-chevron">
                    <ChevronDownIcon />
                  </span>
                </Button>
              }
              body={
                project === undefined
                  ? sh('shell.topbar.project.empty')
                  : shFill('shell.topbar.project.current', { name: project.name })
              }
              action={{
                href: tenantPath(slug, RAIL_AREAS[0]),
                label: sh('shell.topbar.project.action'),
              }}
            />
            <SlotPopover
              trigger={
                <Button
                  variant="ghost"
                  data-testid="topbar-command"
                  aria-label={sh('shell.topbar.command')}
                  className="shell-command-trigger"
                >
                  {COMMAND_KEYS.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </Button>
              }
              body={sh('shell.topbar.command.empty')}
            />
            <SlotPopover
              trigger={
                <IconButton
                  data-testid="topbar-jobs"
                  label={sh('shell.topbar.jobs')}
                  icon={<JobsIcon />}
                />
              }
              body={sh('shell.topbar.jobs.empty')}
            />
            <SlotPopover
              trigger={
                <IconButton
                  data-testid="topbar-notifications"
                  label={sh('shell.topbar.notifications')}
                  icon={<NotificationsIcon />}
                />
              }
              body={sh('shell.topbar.notifications.empty')}
            />
            <UserSlot accountEmail={accountEmail} signOutLabel={signOutLabel} />
          </div>
        </header>

        <div className="shell-body">
          <main data-testid="shell-main" className="shell-main">
            {/* §6: the banner is a bar across the whole of `shell-main`, above the area
                content — and it is a *sibling* of the column, never a wrapper around it.
                Re-parenting the area on an `offline` event would unmount everything the
                reader had in hand (a half-typed field, an open surface) at the exact moment
                the connection went, which is the opposite of "content stays visible". */}
            {offline ? (
              <div className="shell-offline-bar">
                <OfflineBanner />
              </div>
            ) : null}
            <div className="shell-main-column">{children}</div>
          </main>
          <aside
            data-testid="shell-inspector"
            aria-label={sh('shell.inspector')}
            className="shell-inspector"
          >
            {/* §5: at M0 nothing is selectable, so the inspector teaches what will fill it. */}
            <ShellAreaState
              state={SHELL_STATES.empty}
              title={sh('shell.inspector.empty.title')}
              teach={sh('shell.inspector.empty.teach')}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
