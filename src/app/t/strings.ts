/**
 * The signed-in `/t` screens' string table (R-SPINE-060).
 *
 * The minimal top bar, the landing's empty state, the session device list and the 404 the
 * guard answers with. Every value is `docs/design/s-auth.md` §10, verbatim — and only those:
 * the wordmark the top bar carries is the same word the card screens carry, so it is read
 * from `auth.brand` rather than registered a second time under a second name.
 */
export const TENANT_STRINGS = Object.freeze({
  'tenant.nav.sessions': 'Sessions',
  'tenant.signOut': 'Sign out',
  'tenant.home.empty.title': 'No projects in this workspace yet.',
  'tenant.home.empty.teach':
    'This is where your projects will appear. Review your active sessions in the meantime.',
  'tenant.home.empty.action': 'View sessions',
  'tenant.sessions.title': 'Sessions',
  'tenant.sessions.lead':
    'Every device signed in to your account. Revoking a session signs that device out immediately.',
  'tenant.sessions.current': 'This device',
  'tenant.sessions.revoke': 'Revoke',
  'tenant.sessions.signedIn': 'Signed in {time}',
  'tenant.sessions.unknownDevice': 'Unknown device',
  'tenant.sessions.revoked': 'Session revoked.',
  'tenant.sessions.revokeFailed': 'The session could not be revoked. Try again.',
  /* The three rail areas the shell opens onto (docs/design/shell.md §4, §7). */
  'tenant.projects.title': 'Projects',
  'tenant.projects.empty.title': 'No projects yet.',
  'tenant.projects.empty.teach': 'Create a project, then upload a drawing to start measuring.',
  'tenant.projects.empty.action': 'Create a project',
  /* §4: the action is honest about what it can do today — creating projects is deferred. */
  'tenant.projects.create.title': 'Create a project',
  'tenant.projects.create.body':
    'Creating projects is not available yet. A project will start with a name and its first drawing upload.',
  'tenant.projects.create.sample':
    'A sample project, clearly labelled SAMPLE, will also be available to explore.',
  'tenant.books.title': 'Books',
  'tenant.books.empty.title': 'No books yet.',
  'tenant.books.empty.teach':
    "A book prices a project's measured work. Create a project first; its books appear here.",
  'tenant.books.empty.action': 'Go to Projects',
  'tenant.settings.title': 'Settings',
  'tenant.settings.empty.title': 'Nothing to configure yet.',
  'tenant.settings.empty.teach':
    'Workspace settings will appear here. The one thing to manage today is your signed-in sessions.',
  'tenant.settings.empty.action': 'View sessions',
  /** Who to ask for a permission this reader does not hold (R-UI-050, §6). */
  'tenant.permission.holder': 'the workspace owner',
  'tenant.notFound.title': 'This workspace could not be found.',
  'tenant.notFound.teach': 'Check the address, or sign in with an account that belongs to it.',
  'tenant.notFound.action': 'Sign in',
} as const);

/** The closed key set: exactly the keys the table above carries. */
export type TenantStringKey = keyof typeof TENANT_STRINGS;

/** Read one string by a key the compiler can check. */
export function ten(key: TenantStringKey): string {
  return TENANT_STRINGS[key];
}

/**
 * Split a template around its `{slot}`, so the slot renders as its own element — the signed-in
 * time in `.numeric` — without the component composing the sentence.
 */
export function around(key: TenantStringKey, slot: string): readonly [string, string] {
  const template = ten(key);
  const marker = `{${slot}}`;
  const at = template.indexOf(marker);
  if (at === -1) return [template, ''];
  return [template.slice(0, at), template.slice(at + marker.length)];
}
