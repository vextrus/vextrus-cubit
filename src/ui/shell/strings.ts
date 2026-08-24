/**
 * The shell's own string table (R-SPINE-060).
 *
 * The frame speaks for the product before any screen does: the rail's regions, the top bar's
 * slots and the honest answer each later-milestone slot gives today. Every value is
 * `docs/design/shell.md` §7, verbatim — the areas' copy is not here, it joins the table
 * s-auth founded at `src/app/t/strings.ts`, because that is where the screens that say it
 * live.
 */
export const SHELL_STRINGS = Object.freeze({
  /** The rail's accessible name — the region, not the product. */
  'shell.rail.label': 'Workspace',
  /** The tenant switcher menu's accessible name. */
  'shell.rail.tenants': 'Switch workspace',
  /** The collapse toggle, while the rail is expanded. */
  'shell.rail.collapse': 'Collapse the rail',
  /** The same control, while it is collapsed. */
  'shell.rail.expand': 'Expand the rail',
  'shell.nav.projects': 'Projects',
  'shell.nav.books': 'Books',
  'shell.nav.settings': 'Settings',
  /** The breadcrumb's accessible name. */
  'shell.breadcrumb': 'Breadcrumb',
  /** The project switcher's own words while no project is open. */
  'shell.topbar.project.none': 'No project',
  'shell.topbar.project.empty': 'No project is open. Choose one from the Projects list.',
  /** …and while one is (docs/design/s-project-settings-… Interpretation 5). */
  'shell.topbar.project.current': 'You are working in {name}.',
  'shell.topbar.project.action': 'Go to Projects',
  /** ⌘K's accessible name — the palette itself is M2. */
  'shell.topbar.command': 'Search and commands',
  'shell.topbar.command.empty':
    'The command palette is not available yet. Use the rail to move between areas.',
  'shell.topbar.jobs': 'Jobs',
  'shell.topbar.jobs.empty': 'No jobs are running. Long-running work reports its progress here.',
  'shell.topbar.notifications': 'Notifications',
  'shell.topbar.notifications.empty':
    'Nothing needs your attention. Notifications will appear here.',
  /** The user slot: the account identity and the way out (Interpretation 1). */
  'shell.user': 'Account',
  /** The inspector region's accessible name. */
  'shell.inspector': 'Details',
  'shell.inspector.empty.title': 'Nothing is selected.',
  'shell.inspector.empty.teach': 'Select an item and its details appear here.',
  /** What the loading state announces while an area is working (R-UI-050). */
  'shell.loading': 'Loading this area.',
} as const);

/** The closed key set: exactly the keys the table above carries. */
export type ShellStringKey = keyof typeof SHELL_STRINGS;

/** Read one string by a key the compiler can check. */
export function sh(key: ShellStringKey): string {
  return SHELL_STRINGS[key];
}

/**
 * The same string with its `{slot}`s filled — the `/t` table's `fill`, for the one shell
 * sentence that names something the frame was handed. A slot nobody filled is left as it is
 * written rather than blanked: a sentence with a hole in it says something is missing, which
 * is true.
 */
export function shFill(key: ShellStringKey, slots: Readonly<Record<string, string>>): string {
  let filled: string = sh(key);
  for (const [slot, value] of Object.entries(slots)) {
    filled = filled.split(`{${slot}}`).join(value);
  }
  return filled;
}
