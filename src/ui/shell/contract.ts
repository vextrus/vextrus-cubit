/**
 * The shell's vocabulary, as values rather than as words typed into JSX.
 *
 * Two rules meet here. R-SPINE-060 forbids string literals in JSX, so `state="empty"` is
 * written `state={SHELL_STATES.empty}` and reads from this table; and every export of a
 * `'use client'` module reaches a Server Component as a client reference rather than as the
 * value it names, so the constants a server page passes down cannot live in `app-shell.tsx`.
 * This module is neither client nor server, and both sides read the same object.
 */

/** The seven states R-UI-050 requires every screen to define and be able to render. */
export const SHELL_STATES = Object.freeze({
  loading: 'loading',
  empty: 'empty',
  error: 'error',
  refusal: 'refusal',
  partial: 'partial',
  offline: 'offline',
  permissionDenied: 'permission-denied',
} as const);

/** One of the seven, as the clause names it. */
export type ShellState = (typeof SHELL_STATES)[keyof typeof SHELL_STATES];

/** Which content the loading state stands in for: an area column, or the inspector's column. */
export const SHELL_SHAPES = Object.freeze({
  area: 'area',
  inspector: 'inspector',
} as const);

export type ShellSkeletonShape = (typeof SHELL_SHAPES)[keyof typeof SHELL_SHAPES];

/**
 * The rail's four slots are fixed by R-UI-030; three of them are areas with a URL segment.
 * Sessions is an area with no rail item (docs/design/shell.md Interpretation 7), which is why
 * it is not here: the rail is this list, and the breadcrumb names whatever the URL says.
 */
export const RAIL_AREAS = Object.freeze(['projects', 'books', 'settings'] as const);

/** A rail area's own URL segment. */
export type RailArea = (typeof RAIL_AREAS)[number];

/** The tenant home, whose segment is the empty one — `/t/{slug}` and nothing after it. */
export const TENANT_HOME_SEGMENT = '';

/**
 * The segment a project's own routes sit on: `/t/{slug}/p/{projectId}/…`.
 *
 * It is not a rail area — the rail's Projects item stays the marked one on every project route
 * (docs/design/s-project-settings-… Interpretation 5), because a project is where the Projects
 * area leads.
 */
export const PROJECT_SEGMENT = 'p';

/** `/t/{slug}` and `/t/{slug}/{segment}` — the addresses R-UI-031 makes the source of truth. */
export function tenantPath(slug: string, segment: string = TENANT_HOME_SEGMENT): string {
  return segment === TENANT_HOME_SEGMENT ? `/t/${slug}` : `/t/${slug}/${segment}`;
}

/**
 * The segment a `/t/{slug}/…` path is on, or the home segment. The URL is the source of
 * truth, so this is the only thing that decides which rail item is current (R-UI-031).
 */
export function segmentOf(pathname: string): string {
  const parts = pathname.split('/').filter((part) => part !== '');
  // ['t', slug, segment, …] — anything deeper belongs to the area, which owns its own crumbs.
  return parts[2] ?? TENANT_HOME_SEGMENT;
}
