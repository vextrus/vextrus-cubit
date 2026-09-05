/**
 * AC-2(d) — one read for the whole roster's role histories.
 *
 * `memberRoleHistory` asks the participants module once per project, and the members screen asks it
 * once per member: a workspace of M members and P projects costs M × P guarded ledger reads to
 * render one page. The record itself does not depend on which member is being asked about — the
 * ledgers are the workspace's — so the module gets a door that gathers all of them once and keys
 * the answer by the subject it is about.
 *
 * What is judged here is how many times the participants module is asked and what the answer holds,
 * never how the ledgers are read: that belongs to the participants module, which is their one home.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { refusal } from "../../../../../core/faults/refusal-marker";
import type { RoleHistoryEntry } from "../../../participants";

const TENANT = "3f1c2e10-8a44-4e2b-9f0a-1c2d3e4f5061";
const READER = "aaaaaaaa-1111-4222-8333-444444444444";
const ALICE = "bbbbbbbb-1111-4222-8333-444444444444";
const BOB = "cccccccc-1111-4222-8333-444444444444";

/** Three projects, so "once per project" is distinguishable from "once per member". */
const PROJECTS = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"] as const;

const seam = vi.hoisted(() => ({
  roleHistory: vi.fn<(ctx: { tenantId: string; userId: string }, ref: { projectId: string }) => Promise<readonly unknown[]>>(),
  requireMembership: vi.fn(async () => undefined),
  projectRows: [] as { projectId: string }[],
}));

vi.mock("../../../participants", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return { ...original, roleHistory: seam.roleHistory };
});
vi.mock("../members", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return { ...original, requireMembership: seam.requireMembership };
});
vi.mock("../../../../../core/db", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  const handle: Record<string | symbol, unknown> = {};
  const proxy: unknown = new Proxy(handle, {
    get(_target, property) {
      if (property === "then") return (resolve: (value: unknown) => unknown) => resolve([...seam.projectRows]);
      return () => proxy;
    },
  });
  return { ...original, forTenant: () => proxy };
});

const tenancy = await import("../../index");

/** One movement on somebody's record, as the participants module answers with it. */
function entry(subjectUserId: string, role: string): RoleHistoryEntry {
  return {
    direction: "GRANT",
    role,
    subject: { userId: subjectUserId, emailKey: null },
    actor: null,
    occurredAt: new Date(2026, 0, 1),
  } as RoleHistoryEntry;
}

interface Gathered {
  readonly projectId: string;
  readonly entry: RoleHistoryEntry;
}

/** The door this criterion is about, or a loud absence naming what the module still owes. */
function door(): (actor: { tenantId: string; userId: string }) => Promise<ReadonlyMap<string, readonly Gathered[]>> {
  const gathered = (tenancy as Record<string, unknown>)["memberRoleHistories"];
  expect(typeof gathered, "src/modules/spine/tenancy exports memberRoleHistories — the roster's record, read once (B-17, ARCH-02)").toBe("function");
  return gathered as (actor: { tenantId: string; userId: string }) => Promise<ReadonlyMap<string, readonly Gathered[]>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  seam.projectRows = PROJECTS.map((projectId) => ({ projectId }));
  seam.roleHistory.mockImplementation(async (_ctx, ref) => (ref.projectId === PROJECTS[0] ? [entry(ALICE, "PRINCIPAL"), entry(BOB, "CONTRIBUTOR")] : [entry(ALICE, "CONTRIBUTOR")]));
});

afterEach(() => {
  vi.clearAllMocks();
});

test("AC-2(d): the whole roster's record costs one ledger read per project, whatever the roster holds", async () => {
  const memberRoleHistories = door();

  const histories = await memberRoleHistories({ tenantId: TENANT, userId: READER });

  expect(seam.roleHistory.mock.calls.length, "one read per project of the workspace — the record does not depend on which member is asked about").toBe(seam.projectRows.length);
  expect(
    [...seam.roleHistory.mock.calls].map((call) => call[1].projectId).sort(),
    "every project of the workspace is visited, each exactly once",
  ).toEqual([...PROJECTS].sort());
  // Two members appear in the answer, and the cost did not double with them.
  expect([...histories.keys()].sort(), "the answer is keyed by the subject each movement is about").toEqual([ALICE, BOB].sort());
});

test("AC-2(d): each key holds exactly that subject's movements, with the project they happened on", async () => {
  const memberRoleHistories = door();

  const histories = await memberRoleHistories({ tenantId: TENANT, userId: READER });

  const alice = histories.get(ALICE) ?? [];
  expect(alice.length, "Alice's record holds one movement per project she moved on").toBe(3);
  expect(
    alice.every((movement) => movement.entry.subject.userId === ALICE),
    "a subject's record holds only movements about them",
  ).toBe(true);
  expect(
    new Set(alice.map((movement) => movement.projectId)),
    "each movement carries the project it happened on",
  ).toEqual(new Set(PROJECTS));

  const bob = histories.get(BOB) ?? [];
  expect(bob.length, "Bob moved on one project only").toBe(1);
});

test("AC-2(d): a project this reader may not read is passed over, not turned into a refusal of the whole read", async () => {
  const memberRoleHistories = door();
  seam.roleHistory.mockImplementation(async (_ctx, ref) => {
    if (ref.projectId === PROJECTS[1]) throw refusal("PERMISSION_NOT_HELD", "the reader stands on neither this project nor the workspace's administration");
    return [entry(ALICE, "PRINCIPAL")];
  });

  const histories = await memberRoleHistories({ tenantId: TENANT, userId: READER });

  expect((histories.get(ALICE) ?? []).length, "the projects this reader may read still answer; the one they may not contributes nothing").toBe(2);
});

test("AC-2(d): a failure that is not a permission answer still travels", async () => {
  const memberRoleHistories = door();
  seam.roleHistory.mockImplementation(async () => {
    throw new Error("the ledger could not be read");
  });

  await expect(memberRoleHistories({ tenantId: TENANT, userId: READER })).rejects.toThrow("the ledger could not be read");
});

test("AC-2(d): memberRoleHistory answers exactly the map's entry for that subject", async () => {
  const memberRoleHistories = door();
  const single = (tenancy as Record<string, unknown>)["memberRoleHistory"];
  expect(typeof single, "the one-member read stays exported — the merged db-lane suite calls it").toBe("function");
  const forOne = single as (actor: { tenantId: string; userId: string }, subjectUserId: string) => Promise<readonly Gathered[]>;

  const histories = await memberRoleHistories({ tenantId: TENANT, userId: READER });

  await expect(forOne({ tenantId: TENANT, userId: READER }, ALICE)).resolves.toEqual(histories.get(ALICE));
  await expect(forOne({ tenantId: TENANT, userId: READER }, BOB)).resolves.toEqual(histories.get(BOB));
  await expect(forOne({ tenantId: TENANT, userId: READER }, "dddddddd-1111-4222-8333-444444444444"), "a member with no movements has an empty record, not an absent one").resolves.toEqual([]);
});

test("AC-2(d): membership of the workspace is what admits the read", async () => {
  const memberRoleHistories = door();
  seam.requireMembership.mockRejectedValueOnce(refusal("WORKSPACE_PERMISSION_NOT_HELD", "a stranger to the workspace is refused rather than answered"));

  await expect(memberRoleHistories({ tenantId: TENANT, userId: READER })).rejects.toThrow();
  expect(seam.roleHistory, "a stranger's read never reaches the ledgers").not.toHaveBeenCalled();
});
