/**
 * THE TEST-ID REGISTRY (AM-09 §1).
 *
 * `src/ui/testids.ts` is the single source of every test id in the product. Components read it,
 * Playwright page objects read it, Design Decisions cite it, and the engine's testContract is
 * written against it. A literal test id string anywhere else is a defect — because a literal is a
 * name with no declaration, and two files that each spell one have no way of disagreeing out loud.
 * C-05's freeze (routes, testids, procedures, fixtures, stdout lines, env vars named before code
 * exists) is satisfied by naming the keys an increment adds here.
 *
 * EVERY STRING BELOW IS BYTE-IDENTICAL TO THE ID THAT WAS ALREADY IN THE TREE. The registry was
 * harvested mechanically from `data-testid="…"` in `src/**` and from the ids the journeys address
 * (`getByTestId("…")`, `[data-testid="…"]` in `tests/e2e/**`), and `src/ui/testids.test.ts` holds
 * the committed golden list that says so. Renaming an id is never a refactor: a Design Decision
 * cites it, a baseline was taken through it and the engine's fault-271 testContract reads it, so a
 * rename is an amendment with those three named, not an edit to this file.
 *
 * THE GROUPING is by the screen or pattern that publishes the id, read from the id's own first
 * segment (`s-home-*` under `sHome`, `viewer-*` under `viewer`). Nothing is derived at runtime: the
 * strings are written out, so a grep for an id in this file finds it exactly as the DOM carries it.
 */

/** Every test id the product publishes, grouped by the screen or pattern that publishes it. */
export const TESTIDS = {
  accept: {
    invitationForm: "accept-invitation-form",
    invitationRefusal: "accept-invitation-refusal",
    invitationSubmit: "accept-invitation-submit",
    invitationWorkspace: "accept-invitation-workspace",
  },
  act: {
    dot: "act-dot",
  },
  acting: {
    root: "acting",
  },
  audit: {
    actConsequence: "audit-act-consequence",
    actEvidence: "audit-act-evidence",
    actRow: "audit-act-row",
    acts: "audit-acts",
    actsEmpty: "audit-acts-empty",
    filterActor: "audit-filter-actor",
    filterSubject: "audit-filter-subject",
    filterType: "audit-filter-type",
    panelJobs: "audit-panel-jobs",
    panelModelLedger: "audit-panel-model-ledger",
  },
  basis: {
    chip: "basis-chip",
    glyph: "basis-glyph",
  },
  boundary: {
    reached: "boundary-reached",
  },
  breadcrumb: {
    crumb: "breadcrumb-crumb",
    menu: "breadcrumb-menu",
    menuList: "breadcrumb-menu-list",
    root: "breadcrumb",
  },
  command: {
    palette: "command-palette",
    paletteEmpty: "command-palette-empty",
    paletteGroup: "command-palette-group",
    paletteInput: "command-palette-input",
    paletteItem: "command-palette-item",
    paletteItemReason: "command-palette-item-reason",
    paletteList: "command-palette-list",
    paletteLoading: "command-palette-loading",
    paletteRefusal: "command-palette-refusal",
  },
  consequence: {
    confirm: "consequence-confirm",
    dialog: "consequence-dialog",
    digestLine: "consequence-digest-line",
    effectLines: "consequence-effect-lines",
    effectSignatures: "consequence-effect-signatures",
    staleNotice: "consequence-stale-notice",
    subjectRow: "consequence-subject-row",
  },
  contextmenu: {
    content: "contextmenu-content",
  },
  coverage: {
    answer: "coverage-answer",
    cell: "coverage-cell",
    cellGlyph: "coverage-cell-glyph",
    certificatePreview: "coverage-certificate-preview",
    chip: "coverage-chip",
    declareOutOfScope: "coverage-declare-out-of-scope",
    empty: "coverage-empty",
    grid: "coverage-grid",
    holdOut: "coverage-hold-out",
    inspector: "coverage-inspector",
    inspectorCause: "coverage-inspector-cause",
    inspectorObservation: "coverage-inspector-observation",
    inspectorRemedy: "coverage-inspector-remedy",
    inspectorSighting: "coverage-inspector-sighting",
    kindRow: "coverage-kind-row",
    legend: "coverage-legend",
    legendEntry: "coverage-legend-entry",
    retry: "coverage-retry",
    screen: "coverage-screen",
    statement: "coverage-statement",
    statementNone: "coverage-statement-none",
    statementRow: "coverage-statement-row",
  },
  datatable: {
    cell: "datatable-cell",
    cellEditor: "datatable-cell-editor",
    cellEntered: "datatable-cell-entered",
    columns: "datatable-columns",
    columnsToggle: "datatable-columns-toggle",
    footer: "datatable-footer",
    groupRow: "datatable-group-row",
    groupSubtotal: "datatable-group-subtotal",
    header: "datatable-header",
    root: "datatable",
    row: "datatable-row",
    rowRefusal: "datatable-row-refusal",
    rowRefused: "datatable-row-refused",
    skeletonRow: "datatable-skeleton-row",
    total: "datatable-total",
    viewport: "datatable-viewport",
  },
  density: {
    optionComfortable: "density-option-comfortable",
    optionCompact: "density-option-compact",
    toggle: "density-toggle",
  },
  dialog: {
    content: "dialog-content",
  },
  dropdown: {
    content: "dropdown-content",
  },
  dropzone: {
    browse: "dropzone-browse",
    folderInput: "dropzone-folder-input",
    input: "dropzone-input",
    item: "dropzone-item",
    itemProgress: "dropzone-item-progress",
    root: "dropzone",
  },
  error: {
    retry: "error-retry",
    state: "error-state",
    stateMessage: "error-state-message",
    stateReport: "error-state-report",
    stateRetry: "error-state-retry",
    stateTitle: "error-state-title",
  },
  evidence: {
    link: "evidence-link",
    linkGlyph: "evidence-link-glyph",
  },
  gallery: {
    barrel: "gallery-barrel",
    entry: "gallery-entry",
    shell: "gallery-shell",
    state: "gallery-state",
  },
  invitations: {
    email: "invitations-email",
    none: "invitations-none",
    refusal: "invitations-refusal",
    resend: "invitations-resend",
    revoke: "invitations-revoke",
    row: "invitations-row",
    submit: "invitations-submit",
  },
  job: {
    timeline: "job-timeline",
    timelineIdle: "job-timeline-idle",
    timelineStep: "job-timeline-step",
    timelineStepFault: "job-timeline-step-fault",
    timelineStepStatus: "job-timeline-step-status",
    timelineStepTiming: "job-timeline-step-timing",
    timelineTransportLost: "job-timeline-transport-lost",
  },
  members: {
    historyEntry: "members-history-entry",
    inviteForm: "members-invite-form",
    list: "members-list",
    pendingInvitations: "members-pending-invitations",
    refusal: "members-refusal",
    removeForm: "members-remove-form",
    removeSubmit: "members-remove-submit",
    roleForm: "members-role-form",
    roleHistory: "members-role-history",
    roleSelect: "members-role-select",
    roleSubmit: "members-role-submit",
    row: "members-row",
    rowRole: "members-row-role",
    section: "members-section",
  },
  offered: {
    group: "offered-group",
    groupConfirm: "offered-group-confirm",
    groupCount: "offered-group-count",
    groups: "offered-groups",
  },
  participants: {
    assignDirection: "participants-assign-direction",
    assignForm: "participants-assign-form",
    assignRole: "participants-assign-role",
    assignSubject: "participants-assign-subject",
    history: "participants-history",
    historyRow: "participants-history-row",
    list: "participants-list",
    refusal: "participants-refusal",
    row: "participants-row",
  },
  popover: {
    content: "popover-content",
  },
  project: {
    archive: "project-archive",
    buildingType: "project-building-type",
    client: "project-client",
    code: "project-code",
    district: "project-district",
    edit: "project-edit",
    form: "project-form",
    formRefusal: "project-form-refusal",
    formSubmit: "project-form-submit",
    gfaM2: "project-gfa-m2",
    gfaSft: "project-gfa-sft",
    home: "project-home",
    homeActivity: "project-home-activity",
    homeActivityAll: "project-home-activity-all",
    homeActivityEmpty: "project-home-activity-empty",
    homeActivityRow: "project-home-activity-row",
    homeAiCalls: "project-home-ai-calls",
    homeAiCost: "project-home-ai-cost",
    homeAiCostUnit: "project-home-ai-cost-unit",
    homeAiLedger: "project-home-ai-ledger",
    homeAiNone: "project-home-ai-none",
    homeAiOutcomes: "project-home-ai-outcomes",
    homeAiSpend: "project-home-ai-spend",
    homeClient: "project-home-client",
    homeDistrict: "project-home-district",
    homeGfa: "project-home-gfa",
    homeGfaSft: "project-home-gfa-sft",
    homeHeader: "project-home-header",
    homeName: "project-home-name",
    homeParticipant: "project-home-participant",
    homeParticipantRole: "project-home-participant-role",
    homeParticipants: "project-home-participants",
    homeZoneBadge: "project-home-zone-badge",
    homeZones: "project-home-zones",
    name: "project-name",
    notes: "project-notes",
    quickAction: "project-quick-action",
    quickActions: "project-quick-actions",
    restore: "project-restore",
    siteAddress: "project-site-address",
    storeys: "project-storeys",
    tab: "project-tab",
    tabs: "project-tabs",
  },
  refusal: {
    code: "refusal-code",
    evidenceLink: "refusal-evidence-link",
    message: "refusal-message",
    remedy: "refusal-remedy",
    state: "refusal-state",
  },
  register: {
    answer: "register-answer",
    attribute: "register-attribute",
    campaign: "register-campaign",
    empty: "register-empty",
    inspector: "register-inspector",
    levelStack: "register-level-stack",
    lines: "register-lines",
    linesCount: "register-lines-count",
    measure: "register-measure",
    objectBasis: "register-object-basis",
    objectCorroboration: "register-object-corroboration",
    objectKey: "register-object-key",
    objectRole: "register-object-role",
    reading: "register-reading",
    refusal: "register-refusal",
    refusalObject: "register-refusal-object",
    refusals: "register-refusals",
    repudiatedCount: "register-repudiated-count",
    retry: "register-retry",
    sourceKey: "register-source-key",
    timeline: "register-timeline",
    tree: "register-tree",
    workspace: "register-workspace",
  },
  resizable: {
    handle: "resizable-handle",
  },
  root: {
    homeHeading: "root-home-heading",
    homeMain: "root-home-main",
    homeTagline: "root-home-tagline",
    homeWorkspaceDoor: "root-home-workspace-door",
  },
  ruleset: {
    editionDigest: "ruleset-edition-digest",
    editionIdentity: "ruleset-edition-identity",
    lineage: "ruleset-lineage",
    lineageStep: "ruleset-lineage-step",
    parameterRow: "ruleset-parameter-row",
    parameterTable: "ruleset-parameter-table",
    unpinned: "ruleset-unpinned",
  },
  sAuth: {
    email: "s-auth-email",
    fault: "s-auth-fault",
    notice: "s-auth-notice",
    password: "s-auth-password",
    refusal: "s-auth-refusal",
    sessionCurrent: "s-auth-session-current",
    sessionRevoke: "s-auth-session-revoke",
    sessionRow: "s-auth-session-row",
    signout: "s-auth-signout",
    submit: "s-auth-submit",
    tenantName: "s-auth-tenant-name",
  },
  sHome: {
    createProject: "s-home-create-project",
    grid: "s-home-grid",
    projectArchivedBadge: "s-home-project-archived-badge",
    projectCard: "s-home-project-card",
    projectLastActivity: "s-home-project-last-activity",
    projectOpen: "s-home-project-open",
    projectRuleset: "s-home-project-ruleset",
    projectStatus: "s-home-project-status",
    quickStats: "s-home-quick-stats",
    recentDocuments: "s-home-recent-documents",
    statBids: "s-home-stat-bids",
    statCampaigns: "s-home-stat-campaigns",
    statEstimates: "s-home-stat-estimates",
    statSheets: "s-home-stat-sheets",
  },
  scrollarea: {
    viewport: "scrollarea-viewport",
  },
  set: {
    browser: "set-browser",
    create: "set-create",
    createForm: "set-create-form",
    drawing: "set-drawing",
    drawingName: "set-drawing-name",
    drawingRevision: "set-drawing-revision",
    drawingRevisionCount: "set-drawing-revision-count",
    drawings: "set-drawings",
    drawingsLink: "set-drawings-link",
    empty: "set-empty",
    heading: "set-heading",
    memberToggle: "set-member-toggle",
    nameInput: "set-name-input",
    open: "set-open",
    pin: "set-pin",
    revision: "set-revision",
    revisionDigest: "set-revision-digest",
    revisionMember: "set-revision-member",
    revisions: "set-revisions",
    row: "set-row",
    rowDigest: "set-row-digest",
    rowName: "set-row-name",
  },
  sets: {
    empty: "sets-empty",
    index: "sets-index",
  },
  settings: {
    membersLink: "settings-members-link",
  },
  sheet: {
    card: "sheet-card",
    cardDiscipline: "sheet-card-discipline",
    cardFormat: "sheet-card-format",
    cardNumber: "sheet-card-number",
    cardOpen: "sheet-card-open",
    cardScale: "sheet-card-scale",
    cardScheme: "sheet-card-scheme",
    cardThumbnail: "sheet-card-thumbnail",
    cardTitle: "sheet-card-title",
    cardViews: "sheet-card-views",
    confirm: "sheet-confirm",
    content: "sheet-content",
    disciplineOption: "sheet-discipline-option",
    fact: "sheet-fact",
    filterOption: "sheet-filter-option",
    index: "sheet-index",
    search: "sheet-search",
  },
  sheets: {
    empty: "sheets-empty",
  },
  shell: {
    breadcrumb: "shell-breadcrumb",
    commandPalette: "shell-command-palette",
    deniedHolder: "shell-denied-holder",
    deniedPermission: "shell-denied-permission",
    empty: "shell-empty",
    emptyAction: "shell-empty-action",
    inspector: "shell-inspector",
    inspectorResize: "shell-inspector-resize",
    jobsTray: "shell-jobs-tray",
    jobsTrayEmpty: "shell-jobs-tray-empty",
    jobsTrayItem: "shell-jobs-tray-item",
    jobsTrayItemTiming: "shell-jobs-tray-item-timing",
    jobsTrayPanel: "shell-jobs-tray-panel",
    main: "shell-main",
    permissionDenied: "shell-permission-denied",
    rail: "shell-rail",
    railCollapse: "shell-rail-collapse",
    railMark: "shell-rail-mark",
    renameInput: "shell-rename-input",
    renameRefusal: "shell-rename-refusal",
    renameSubmit: "shell-rename-submit",
    root: "shell-root",
    sampleOffer: "shell-sample-offer",
    sampleOutcome: "shell-sample-outcome",
    settingsName: "shell-settings-name",
    status: "shell-status",
    statusJobs: "shell-status-jobs",
    tenantSwitcher: "shell-tenant-switcher",
    toolbar: "shell-toolbar",
    topbar: "shell-topbar",
    user: "shell-user",
    userSessions: "shell-user-sessions",
    userSignout: "shell-user-signout",
  },
  shortcut: {
    sheet: "shortcut-sheet",
    sheetKeys: "shortcut-sheet-keys",
    sheetRow: "shortcut-sheet-row",
  },
  skeleton: {
    root: "skeleton",
  },
  takeoff: {
    nav: "takeoff-nav",
    navCoverage: "takeoff-nav-coverage",
    navRegister: "takeoff-nav-register",
  },
  theme: {
    optionDark: "theme-option-dark",
    optionLight: "theme-option-light",
    optionSystem: "theme-option-system",
    toggle: "theme-toggle",
  },
  tooltip: {
    content: "tooltip-content",
  },
  tree: {
    item: "tree-item",
    root: "tree",
  },
  unit: {
    badge: "unit-badge",
  },
  viewer: {
    canvas: "viewer-canvas",
    empty: "viewer-empty",
    fidelityFact: "viewer-fidelity-fact",
    fidelityFacts: "viewer-fidelity-facts",
    fit: "viewer-fit",
    inspector: "viewer-inspector",
    inspectorCited: "viewer-inspector-cited",
    inspectorCitedLine: "viewer-inspector-cited-line",
    inspectorClear: "viewer-inspector-clear",
    inspectorCopy: "viewer-inspector-copy",
    inspectorEntity: "viewer-inspector-entity",
    inspectorHover: "viewer-inspector-hover",
    inspectorHoverHandle: "viewer-inspector-hover-handle",
    inspectorHoverLayer: "viewer-inspector-hover-layer",
    inspectorHoverType: "viewer-inspector-hover-type",
    inspectorKey: "viewer-inspector-key",
    inspectorMissing: "viewer-inspector-missing",
    inspectorMissingKey: "viewer-inspector-missing-key",
    inspectorReveal: "viewer-inspector-reveal",
    inspectorSelection: "viewer-inspector-selection",
    inspectorTabScale: "viewer-inspector-tab-scale",
    inspectorTabSelection: "viewer-inspector-tab-selection",
    inspectorTabs: "viewer-inspector-tabs",
    inspectorTrace: "viewer-inspector-trace",
    inspectorTraceFormula: "viewer-inspector-trace-formula",
    inspectorTraceOrigin: "viewer-inspector-trace-origin",
    inspectorTraceRetry: "viewer-inspector-trace-retry",
    inspectorTraceVariable: "viewer-inspector-trace-variable",
    layerCount: "viewer-layer-count",
    layerIsolate: "viewer-layer-isolate",
    layerLock: "viewer-layer-lock",
    layerRow: "viewer-layer-row",
    layerSelect: "viewer-layer-select",
    layerSwatch: "viewer-layer-swatch",
    layerVisible: "viewer-layer-visible",
    layers: "viewer-layers",
    loading: "viewer-loading",
    marquee: "viewer-marquee",
    partition: "viewer-partition",
    partitionAxis: "viewer-partition-axis",
    partitionCanvas: "viewer-partition-canvas",
    partitionGridDeferral: "viewer-partition-grid-deferral",
    partitionGridToggle: "viewer-partition-grid-toggle",
    partitionGroups: "viewer-partition-groups",
    partitionRetry: "viewer-partition-retry",
    partitionView: "viewer-partition-view",
    partitionViewBadge: "viewer-partition-view-badge",
    partitionViewReason: "viewer-partition-view-reason",
    partitionViewsToggle: "viewer-partition-views-toggle",
    scale: "viewer-scale",
    scaleAffirm: "viewer-scale-affirm",
    scaleAnswer: "viewer-scale-answer",
    scaleCheckVerification: "viewer-scale-check-verification",
    scaleDistance: "viewer-scale-distance",
    scaleMember: "viewer-scale-member",
    scaleObservation: "viewer-scale-observation",
    scaleObserve: "viewer-scale-observe",
    scaleProposal: "viewer-scale-proposal",
    scaleRetry: "viewer-scale-retry",
    scaleUnit: "viewer-scale-unit",
    scaleView: "viewer-scale-view",
    screen: "viewer-screen",
    snapAngle: "viewer-snap-angle",
    snapGlyph: "viewer-snap-glyph",
    snapOrtho: "viewer-snap-ortho",
    snapPick: "viewer-snap-pick",
    snapToggle: "viewer-snap-toggle",
    status: "viewer-status",
    statusDistance: "viewer-status-distance",
    statusSelection: "viewer-status-selection",
    statusSnap: "viewer-status-snap",
    zoomIn: "viewer-zoom-in",
    zoomOut: "viewer-zoom-out",
  },
} as const;

/** The registry's shape, so a helper can be written against it without restating it. */
export type TestIdRegistry = typeof TESTIDS;

/** The group names, one per screen or pattern. */
export type TestIdGroup = keyof TestIdRegistry;

/**
 * Every id in the registry, as a union of the literal strings themselves. A function that takes a
 * `TestId` cannot be handed an id that does not exist — which is the whole reason the registry is
 * typed rather than a bag of strings.
 */
export type TestId = { [G in TestIdGroup]: TestIdRegistry[G][keyof TestIdRegistry[G]] }[TestIdGroup];

/**
 * Every id, flat and sorted. The golden-list test reads this, and so does anything that needs to ask
 * "is this string an id the product publishes?" without knowing which screen publishes it.
 */
export const ALL_TESTIDS: readonly TestId[] = Object.freeze(
  Object.values(TESTIDS)
    .flatMap((group) => Object.values(group) as TestId[])
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
);

/** Is this string an id the product publishes? The membership test, read off the registry itself. */
export function isTestId(value: string): value is TestId {
  return (ALL_TESTIDS as readonly string[]).includes(value);
}

/**
 * The CSS attribute selector for an id — the one spelling of it, so a page object that needs a
 * selector rather than a Playwright locator does not write `[data-testid="…"]` by hand and re-open
 * the literal this file closed.
 */
export function testIdSelector(id: TestId): string {
  return `[data-testid="${id}"]`;
}

/**
 * The props a component spreads to publish its id: `<div {...testId(TESTIDS.sHome.grid)} />`. A
 * component that spreads this cannot publish an id the registry does not hold, and a reader of the
 * component sees the registry key rather than a string.
 */
export function testId(id: TestId): { "data-testid": TestId } {
  return { "data-testid": id };
}
