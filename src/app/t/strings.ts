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
  /* Settings: the tenant slice — members, invitations, roles (docs/design/s-settings.md §8). */
  'tenant.settings.title': 'Settings',
  'tenant.settings.lead': 'The people in this workspace and the invitations awaiting an answer.',
  /*
   * §8 of s-settings.md would re-word this to "No pending invitations.", but the value is
   * pinned to docs/design/shell.md §7 by src/ui/shell/__tests__/shell-copy.test.ts, which
   * compares every `tenant.*` key against that table verbatim. Both the table and that test
   * belong to inc-009 and are outside this increment's ownership, so the re-wording is
   * raised as an objection rather than taken here.
   */
  'tenant.settings.empty.title': 'Nothing to configure yet.',
  'tenant.settings.empty.teach':
    'Workspace settings will appear here. The one thing to manage today is your signed-in sessions.',
  'tenant.settings.empty.action': 'View sessions',
  'tenant.settings.actionFailed':
    'The request did not complete. Check your connection and try again.',
  'tenant.settings.permission': 'settings.members.manage',
  'tenant.settings.permissionHolder': 'a workspace owner or admin',
  'tenant.members.title': 'Members',
  'tenant.members.you': 'You',
  'tenant.members.role': 'Role of {email}',
  'tenant.members.remove': 'Remove',
  'tenant.members.removeLabel': 'Remove {email}',
  'tenant.members.roleChanged': 'Role updated.',
  'tenant.members.removed': 'Member removed.',
  'tenant.role.owner': 'OWNER',
  'tenant.role.admin': 'ADMIN',
  'tenant.role.member': 'MEMBER',
  'tenant.invitations.title': 'Invitations',
  'tenant.invitations.email': 'Email',
  'tenant.invitations.role': 'Role',
  'tenant.invitations.submit': 'Send invitation',
  'tenant.invitations.emailInvalid': 'Enter a valid email address.',
  'tenant.invitations.invited': 'Invited {time}',
  'tenant.invitations.resend': 'Resend',
  'tenant.invitations.resendLabel': 'Resend the invitation to {email}',
  'tenant.invitations.revoke': 'Revoke',
  'tenant.invitations.revokeLabel': 'Revoke the invitation to {email}',
  'tenant.invitations.sent': 'Invitation sent to {email}.',
  'tenant.invitations.resent': 'Invitation sent again.',
  'tenant.invitations.revoked': 'Invitation revoked.',
  /* The invitation mail (§9): server-composed copy, in the same voice as the screen. */
  'tenant.mail.invite.subject': 'You are invited to {tenant} on Cubit',
  'tenant.mail.invite.body':
    '{inviter} invited you to join {tenant} as {role}. Create an account with this email address to accept: {url}',
  /** Who to ask for a permission this reader does not hold (R-UI-050, §6). */
  'tenant.permission.holder': 'the workspace owner',
  /*
   * The project settings ruleset pane (docs/design/s-project-settings.md §7, verbatim; the
   * seventeen parameter labels are §5's table, first column, keyed by its third).
   *
   * The units are strings here rather than `formatUnit`'s closed enum: L-FMT-02 carries
   * m/m²/m³/kg/nos and cannot spell sft, ft, in or cm², and widening the format seam is not
   * this pane's to do (Interpretation 2). The seven dimensionless parameters say `ratio`,
   * because an empty unit cell is silence and silence is never lawful (Interpretation 3).
   */
  'project.ruleset.title': 'Rule set',
  'project.ruleset.lead':
    '{name} ({code}) pinned this edition when the project was created. Every measurement in the project reads these values.',
  'project.ruleset.edition': 'Edition',
  'project.ruleset.digest': 'Digest',
  'project.ruleset.methods': 'Methods',
  'project.ruleset.methodsNone':
    'No measurement methods are in force yet. The digest covers the parameter values alone.',
  'project.ruleset.lineage.title': 'Lineage',
  'project.ruleset.lineage.lead':
    'This edition was forked from the workspace template, itself forked from the platform seed, when the project was created. Matching digests mean each fork copied its parent verbatim.',
  'project.ruleset.lineage.platform': 'Platform seed',
  'project.ruleset.lineage.tenant': 'Workspace template',
  'project.ruleset.lineage.project': 'This project',
  'project.ruleset.params.title': 'Parameters',
  'project.ruleset.params.parameter': 'Parameter',
  'project.ruleset.params.value': 'Value',
  'project.ruleset.params.unit': 'Unit',
  'project.ruleset.unit.m2': 'm²',
  'project.ruleset.unit.cm2': 'cm²',
  'project.ruleset.unit.sft': 'sft',
  'project.ruleset.unit.ft': 'ft',
  'project.ruleset.unit.in': 'in',
  'project.ruleset.unit.ratio': 'ratio',
  'project.ruleset.param.openingDeductionMinM2': 'Opening deduction minimum',
  'project.ruleset.param.memberEndNoDeductMaxCm2': 'Member end no-deduction maximum',
  'project.ruleset.param.embeddedDuctNoDeductMaxCm2': 'Embedded duct no-deduction maximum',
  'project.ruleset.param.finishOpeningDeductionMinM2': 'Finish opening deduction minimum',
  'project.ruleset.param.finishMinOutlineArea': 'Finish outline minimum area',
  'project.ruleset.param.finishMaxOutlineArea': 'Finish outline maximum area',
  'project.ruleset.param.scaleVerificationTolerance': 'Scale verification tolerance',
  'project.ruleset.param.scaleAnisotropyTolerance': 'Scale anisotropy tolerance',
  'project.ruleset.param.earthworkWorkingAllowance': 'Earthwork working allowance',
  'project.ruleset.param.earthworkDepthExtra': 'Earthwork depth extra',
  'project.ruleset.param.blindingProjection': 'Blinding projection',
  'project.ruleset.param.blindingThickness': 'Blinding thickness',
  'project.ruleset.param.placementContainmentMerge': 'Placement containment merge share',
  'project.ruleset.param.placementNearAnchor': 'Placement near-anchor share',
  'project.ruleset.param.placementFootprintMin': 'Placement footprint minimum',
  'project.ruleset.param.placementFootprintMax': 'Placement footprint maximum',
  'project.ruleset.param.placementHumanSnap': 'Placement human snap share',
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

/**
 * The same template with its slots filled, for the strings that are one string: an accessible
 * name, a live region's sentence, the subject and body of a mail. A slot nobody filled is left
 * as it is written rather than blanked — a sentence with a hole in it says something is
 * missing, which is true.
 */
export function fill(key: TenantStringKey, slots: Readonly<Record<string, string>>): string {
  let filled: string = ten(key);
  for (const [slot, value] of Object.entries(slots)) {
    filled = filled.split(`{${slot}}`).join(value);
  }
  return filled;
}
