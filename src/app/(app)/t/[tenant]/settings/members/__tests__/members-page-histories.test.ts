/**
 * AC-2(d), the screen's half — the members page composes every row's record from ONE read.
 *
 * Today the page asks the tenancy module for one member's record per member, and each of those
 * asks the participants module once per project: a roster of M members over P projects is M × P
 * guarded ledger reads for one render. The module's own suite judges the new door; this file judges
 * that the screen uses it, once, and hands each row the record the door keyed under that member.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const TENANT = "3f1c2e10-8a44-4e2b-9f0a-1c2d3e4f5061";
const ALICE = "bbbbbbbb-1111-4222-8333-444444444444";
const BOB = "cccccccc-1111-4222-8333-444444444444";
const CAROL = "dddddddd-1111-4222-8333-444444444444";
const PROJECT = "11111111-1111-4111-8111-111111111111";

/** One movement, as the tenancy module answers with it. */
const movement = (subjectUserId: string, role: string) => ({
  projectId: PROJECT,
  entry: { direction: "granted", role, subject: { userId: subjectUserId, emailKey: null }, actor: null, occurredAt: new Date(2026, 0, 1) },
});

const seam = vi.hoisted(() => ({
  membersOf: vi.fn(),
  memberRoleHistories: vi.fn(),
  memberRoleHistory: vi.fn(async () => []),
  pendingInvitations: vi.fn(async () => []),
  sessionOf: vi.fn(async () => ({ userId: ALICE })),

}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../../../../../../../modules/spine/tenancy", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return { ...original, membersOf: seam.membersOf, memberRoleHistories: seam.memberRoleHistories, memberRoleHistory: seam.memberRoleHistory, pendingInvitations: seam.pendingInvitations };
});
vi.mock("../../../../../../../server/shell/resolve", () => ({ sessionOf: seam.sessionOf }));
vi.mock("../../../../../../../server/shell/session", () => ({ presentedSessionToken: async () => "token" }));
// The section and the panel are their own criteria's; this one is about what the page composed, so
// they stand in and the element the page built is read for the props it handed over.
vi.mock("../members-section", () => ({ MembersSection: () => null }));
vi.mock("../invitations/invitations-panel", () => ({ InvitationsPanel: () => null }));

const WorkspaceMembers = (await import("../page")).default;
const { MembersSection } = await import("../members-section");

interface Row {
  readonly userId: string;
  readonly history: readonly unknown[];
}

/** One node of the element the page returned, as a bag with a type and props. */
interface Node {
  readonly type?: unknown;
  readonly props?: { readonly children?: unknown } & Record<string, unknown>;
}

/** The props the page handed the section, found in the tree it composed. */
function sectionProps(node: unknown): Record<string, unknown> | null {
  const element = node as Node | null;
  if (element === null || typeof element !== "object") return null;
  if (element.type === MembersSection) return { ...element.props };
  const children = element.props?.["children"];
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = sectionProps(child);
    if (found !== null) return found;
  }
  return null;
}

/** The rows the page handed the section, or a loud absence. */
function composedRows(rendered: unknown): readonly Row[] {
  const props = sectionProps(rendered);
  expect(props, "the page renders the members section with the rows it composed").not.toBeNull();
  return (props as { rows: readonly Row[] }).rows;
}

beforeEach(() => {
  vi.clearAllMocks();
  seam.membersOf.mockResolvedValue([
    { userId: ALICE, workspaceRole: "OWNER", createdAt: new Date(2026, 0, 1), emailKey: null },
    { userId: BOB, workspaceRole: "MEMBER", createdAt: new Date(2026, 0, 1), emailKey: null },
    { userId: CAROL, workspaceRole: "MEMBER", createdAt: new Date(2026, 0, 1), emailKey: null },
  ]);
  seam.memberRoleHistories.mockResolvedValue(
    new Map([
      [ALICE, [movement(ALICE, "PRINCIPAL")]],
      [BOB, [movement(BOB, "CONTRIBUTOR"), movement(BOB, "REVIEWER")]],
    ]),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

test("AC-2(d): the roster's records come from one read, however many members the roster holds", async () => {
  await WorkspaceMembers({ params: Promise.resolve({ tenant: TENANT }) });

  expect(seam.memberRoleHistories.mock.calls.length, "one read answers the whole roster's records").toBe(1);
  expect(seam.memberRoleHistories.mock.calls[0], "the read is scoped to the actor the page minted").toEqual([{ tenantId: TENANT, userId: ALICE }]);
  expect(seam.memberRoleHistory, "no per-member read stands beside it — that is the round trip this row is about").not.toHaveBeenCalled();
});

test("AC-2(d): every row carries the record the read keyed under that member", async () => {
  const rows = composedRows(await WorkspaceMembers({ params: Promise.resolve({ tenant: TENANT }) }));
  const byUser = new Map(rows.map((row) => [row.userId, row]));

  expect(rows.length, "every member of the roster gets a row").toBe(3);
  expect((byUser.get(ALICE)?.history ?? []).length, "Alice's row carries her one movement").toBe(1);
  expect((byUser.get(BOB)?.history ?? []).length, "Bob's row carries both of his").toBe(2);
  expect(byUser.get(CAROL)?.history, "a member the read holds no movements for gets an empty record, not an absent one").toEqual([]);
});
