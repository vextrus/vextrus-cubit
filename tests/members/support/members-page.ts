/**
 * The members surface's page-object surface (C-05, inc-010a2 test contract): the routes and the
 * `data-testid` names the increment fixes, declared ONCE here and imported everywhere they are
 * asserted (B-19's "fixture identities are declared once"), plus the DOM reading each suite does
 * over them.
 *
 * Only the contract and the mechanics live here. Nothing in this file judges the surface — the
 * rules are in the suites — so it cannot be edited into agreement with a screen that does not
 * satisfy them.
 *
 * The queries are written against a structural shape rather than against `Document`, so one reader
 * serves a jsdom document parsed out of a server-rendered response and a container mounted by
 * `@testing-library/react` alike.
 */

/* --------------------------------------------------------------------------- the contract */

/**
 * Every `data-testid` this increment's spec fixes for the members surface, by the name a suite
 * refers to it as. The two invitation ids are fixed here too: inc-010b builds against them, and the
 * Design Decision is where they are ruled — this increment renders neither.
 */
export const TESTIDS = {
  membersLink: "settings-members-link",
  section: "members-section",
  list: "members-list",
  row: "members-row",
  rowRole: "members-row-role",
  roleHistory: "members-role-history",
  historyEntry: "members-history-entry",
  roleForm: "members-role-form",
  roleSelect: "members-role-select",
  roleSubmit: "members-role-submit",
  removeForm: "members-remove-form",
  removeSubmit: "members-remove-submit",
  refusal: "members-refusal",
  inviteForm: "members-invite-form",
  pendingInvitations: "members-pending-invitations",
} as const;

/** The ids this increment's own surface renders — the two invitation panels are inc-010b's. */
export const RENDERED_TESTIDS: readonly string[] = Object.entries(TESTIDS)
  .filter(([name]) => name !== "inviteForm" && name !== "pendingInvitations")
  .map(([, id]) => id);

/** Every id the contract fixes, invitation panels included (what the Design Decision must name). */
export const CONTRACT_TESTIDS: readonly string[] = Object.values(TESTIDS);

/** The one testid the shipped RefusalState carries, wherever it renders (R-UI-020's one home). */
export const REFUSAL_STATE_TESTID = "refusal-state";
export const REFUSAL_MESSAGE_TESTID = "refusal-message";
export const REFUSAL_REMEDY_TESTID = "refusal-remedy";

/** The route as the tree spells it — the key `routesOnDisk()` derives and the matrix declares. */
export const MEMBERS_ROUTE_KEY = "/t/[tenant]/settings/members";

/** The route as a person's address bar spells it, and the landing it is reached from. */
export const MEMBERS_ROUTE_PATTERN = "/t/{tenant}/settings/members";
export const SETTINGS_ROUTE_PATTERN = "/t/{tenant}/settings";

/** The route directory the interfaces line names, repo-relative. */
export const MEMBERS_ROUTE_DIR = "src/app/(app)/t/[tenant]/settings/members";

/** The modules the interfaces line names inside it, by the export each owes. */
export const MEMBERS_MODULES = {
  actions: `${MEMBERS_ROUTE_DIR}/actions.ts`,
  section: `${MEMBERS_ROUTE_DIR}/members-section.tsx`,
  states: `${MEMBERS_ROUTE_DIR}/states.ts`,
  strings: `${MEMBERS_ROUTE_DIR}/strings.ts`,
  page: `${MEMBERS_ROUTE_DIR}/page.tsx`,
} as const;

/** The server actions the contract names. */
export const ACTION_NAMES = ["changeMemberRoleAction", "removeMemberAction"] as const;

/** The address of one workspace's settings landing, and of its members surface. */
export const settingsPath = (tenantId: string): string => `/t/${tenantId}/settings`;
export const membersPath = (tenantId: string): string => `/t/${tenantId}/settings/members`;

/* --------------------------------------------------------------------------- reading a page */

/** The shape every reader here needs of an element: attributes, text, and its own subtree. */
export interface ReadableElement {
  getAttribute(name: string): string | null;
  textContent: string | null;
  querySelectorAll(selectors: string): ArrayLike<ReadableElement>;
}

/** The shape of anything a query can be run against — a document, a container, an element. */
export interface ReadableRoot {
  querySelectorAll(selectors: string): ArrayLike<ReadableElement>;
}

/** The CSS selector one testid is found by. */
export const testIdSelector = (testId: string): string => `[data-testid="${testId}"]`;

/** Every element carrying one testid, in document order. */
export function byTestId(root: ReadableRoot, testId: string): ReadableElement[] {
  return Array.from(root.querySelectorAll(testIdSelector(testId)));
}

/** The one element carrying a testid, or null when the surface renders none. */
export function oneByTestId(root: ReadableRoot, testId: string): ReadableElement | null {
  return byTestId(root, testId)[0] ?? null;
}

/** The text a person reads out of a subtree, whitespace collapsed. */
export const readText = (element: ReadableElement | null): string => (element?.textContent ?? "").replace(/\s+/g, " ").trim();

/** The roster's rows, in the order the surface renders them. */
export const memberRows = (root: ReadableRoot): ReadableElement[] => byTestId(root, TESTIDS.row);

/** The role word one row shows. */
export const roleOf = (row: ReadableElement): string => readText(oneByTestId(row, TESTIDS.rowRole));

/** The history movements one row shows. */
export const historyEntriesOf = (row: ReadableElement): ReadableElement[] => byTestId(row, TESTIDS.historyEntry);

/** Every refusal code a subtree publishes machine-readably, in document order. */
export function refusalCodesIn(root: ReadableRoot): string[] {
  return Array.from(root.querySelectorAll("[data-code]"))
    .map((element) => element.getAttribute("data-code") ?? "")
    .filter((code) => code.length > 0);
}
