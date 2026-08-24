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
  /* S-Home §3: the teaching empty state, re-worded now that a project can be created. */
  'tenant.home.empty.title': 'No projects yet.',
  'tenant.home.empty.teach':
    'Create the first project. It starts with a name and a code; drawings and measurement follow from there.',
  'tenant.home.empty.action': 'Create a project',
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
  /* s-home §4: the create Dialog's own head, now that the form is behind it. */
  'tenant.projects.create.title': 'Create a project',
  'tenant.projects.create.body':
    "Name the project and give it a code. Everything else here is optional and can be changed later in the project's settings.",
  /* s-home Interpretation 2: the value stands, but the SAMPLE offer is out of scope at M0. */
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
  /*
   * S-Home — the projects grid, the create form and recent documents
   * (docs/design/s-home.md §8, verbatim).
   */
  'project.home.projectsTitle': 'Projects',
  'project.home.create': 'New project',
  'project.home.status.active': 'Active',
  'project.home.status.archived': 'Archived',
  'project.home.stats.sheets': 'Sheets',
  'project.home.stats.campaigns': 'Campaigns',
  'project.home.stats.estimates': 'Estimates',
  'project.home.stats.bids': 'Bids',
  'project.home.lastActivity': 'Last activity {time}',
  'project.home.showArchived': 'Show archived ({count})',
  'project.home.hideArchived': 'Hide archived',
  'project.home.documentsTitle': 'Recent documents',
  'project.home.documentsNone':
    'No documents yet. Uploaded drawings and generated documents will appear here.',
  'project.form.name': 'Name',
  'project.form.code': 'Code',
  'project.form.client': 'Client',
  'project.form.siteAddress': 'Site address',
  'project.form.district': 'District',
  'project.form.buildingType': 'Building type',
  'project.form.buildingTypePlaceholder': 'Select a type',
  'project.buildingType.residential': 'Residential',
  'project.buildingType.commercial': 'Commercial',
  'project.buildingType.mixed': 'Mixed',
  'project.buildingType.industrial': 'Industrial',
  'project.buildingType.infrastructure': 'Infrastructure',
  'project.form.storeys': 'Storeys',
  'project.form.gfaM2': 'Target GFA',
  'project.form.unitM2': 'm²',
  'project.form.notes': 'Notes',
  'project.form.cancel': 'Cancel',
  'project.form.submit': 'Create project',
  'project.form.nameRequired': 'Enter a name.',
  'project.form.codeRequired': 'Enter a code.',
  'project.form.storeysWhole': 'Storeys must be a whole number.',
  'project.form.gfaDecimal': 'Target GFA must be a plain number, without a comma or a space.',
  'project.form.failed': 'The request did not complete. Check your connection and try again.',
  /*
   * S-Project-Settings — the project fields pane and the participants pane
   * (docs/design/s-project-settings-project-fields-pane-participants-pane-ruleset-pane-untouched.md
   * §8, verbatim).
   */
  'project.settings.nav': 'Project settings',
  'project.settings.nav.project': 'Project',
  'project.settings.nav.participants': 'Participants',
  'project.settings.nav.ruleset': 'Rule set',
  'project.fields.title': 'Project',
  'project.fields.lead':
    'The details of {name} ({code}). Documents cite the project by them; measurements never read them.',
  'project.fields.status': 'Status',
  'project.fields.archive': 'Archive project',
  'project.fields.restore': 'Restore project',
  'project.fields.archivedDone': 'Project archived.',
  'project.fields.restoredDone': 'Project restored.',
  'project.fields.archivedNote':
    'This project is archived and stays off the workspace home. Restore it to bring it back.',
  'project.fields.gfaSft': '≈ {sft} sft',
  'project.fields.gfaSftNone': 'No target GFA set.',
  'project.fields.save': 'Save changes',
  'project.fields.saved': 'Changes saved.',
  'project.participants.title': 'Participants',
  'project.participants.lead':
    'The people on this project and the roles they hold. A role is assigned by a recorded act; the history below is that record.',
  'project.participants.member': 'Member',
  'project.participants.role': 'Role',
  'project.participants.assign': 'Preview assignment',
  'project.participants.you': 'You',
  'project.participants.dialogTitle': 'Assign {role} to {email}',
  'project.participants.dialogLead':
    'The server worked out what this assignment would do. Confirming applies exactly what is shown below.',
  'project.participants.summary.person': 'Participant',
  'project.participants.summary.current': 'Current role',
  'project.participants.summary.currentNone': 'Not a participant yet',
  'project.participants.summary.proposed': 'Proposed role',
  'project.participants.summary.principals': 'Principals after this change',
  'project.participants.cancel': 'Cancel',
  'project.participants.confirm': 'Confirm',
  'project.participants.stale':
    'The preview changed while this dialog was open. Review the updated values; confirming applies what is shown now.',
  'project.participants.failed':
    'This could not be confirmed — the request did not complete. Nothing was changed. Try confirming again.',
  'project.participants.committed': 'Role assigned.',
  'project.participants.historyTitle': 'Role history',
  'project.participants.historyEntry': '{actor} set {member} to {role}',
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
  /*
   * S-Audit — the act log explorer, the model-call ledger and the job history
   * (docs/design/s-audit.md §7, verbatim). One key per pane names it three times over: the
   * sub-nav item, the breadcrumb's pane crumb and the pane's own h1 (Interpretation 2).
   */
  'project.audit.nav': 'Audit',
  'project.audit.nav.acts': 'Act log',
  'project.audit.nav.models': 'Model calls',
  'project.audit.nav.jobs': 'Job history',
  'project.audit.acts.lead':
    'Every recorded act on {name} ({code}), newest first. Each entry shows who acted, who it concerned, what it changed and what it cited.',
  'project.audit.filter.type': 'Act type',
  'project.audit.filter.actor': 'Actor',
  'project.audit.filter.subject': 'Subject',
  'project.audit.filter.anyType': 'All act types',
  'project.audit.filter.anyActor': 'All actors',
  'project.audit.filter.anySubject': 'All subjects',
  'project.audit.filter.apply': 'Apply filters',
  'project.audit.entry.consequence': 'Consequence',
  'project.audit.entry.evidence': 'Evidence',
  'project.audit.entry.setRole': '{member} was set to {role}.',
  'project.audit.entry.evidenceNone':
    'No evidence cited. When acts cite drawings and documents, the citations appear here.',
  'project.audit.acts.empty.title': 'No acts match these filters.',
  'project.audit.acts.empty.teach':
    'Widen a filter, or clear them all to see every recorded act.',
  'project.audit.acts.empty.clear': 'Clear filters',
  'project.audit.models.lead':
    'The model calls made for this project — every call, its cost and its outcome.',
  'project.audit.models.empty.title': 'No model calls yet.',
  'project.audit.models.empty.teach':
    'When this project uses a model, each call is recorded here with its cost and its outcome.',
  'project.audit.jobs.lead':
    "The runs of this project's long-running work — imports, partitions, document renders.",
  'project.audit.jobs.empty.title': 'No job runs yet.',
  'project.audit.jobs.empty.teach':
    'When this project runs a job — importing a drawing, running a partition, rendering a document — each run appears here with its outcome.',
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
