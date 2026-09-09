/**
 * AC-1(a) — which refusal the roster's record is allowed to pass over.
 *
 * "This reader may not read that project" is a judgement the participants module makes about its own
 * ledger, and it is the only reason a project may be missing from the gathered record. Reading it off
 * a refusal CODE caught around the whole call reads the same answer from anywhere below — a scoped
 * handle that refuses, a guard of some other door — and turns a genuine refusal into silence
 * (debt-src-modules-162p03j). So the judgement is answered rather than thrown: the participants
 * module's own `roleHistoryIfReadable` answers null where its access guard refuses, and the tenancy
 * read gathers what it is given without a catch of its own.
 *
 * The ledgers themselves are never read here: how a record is derived belongs to the participants
 * module, which is its one home (B-17, ARCH-02).
 */
import { beforeEach, expect, test, vi } from "vitest";

const PARTICIPANTS_HISTORY = "../../../src/modules/spine/participants/history";

const TENANT = "3f1c2e10-8a44-4e2b-9f0a-1c2d3e4f5061";
const READER = "aaaaaaaa-1111-4222-8333-444444444444";
const ALICE = "bbbbbbbb-1111-4222-8333-444444444444";

/** Three projects, so a project passed over is distinguishable from a read that answered nothing. */
const PROJECTS = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"] as const;

const seam = vi.hoisted(() => ({
  roleHistoryIfReadable: vi.fn<(ctx: { tenantId: string; userId: string }, ref: { projectId: string }) => Promise<readonly unknown[] | null>>(),
  requireMembership: vi.fn(async () => undefined),
  requireRoleHistoryAccess: vi.fn(async () => undefined),
  projectRows: [] as { projectId: string }[],
}));

vi.mock("../../../src/modules/spine/participants", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    roleHistoryIfReadable: seam.roleHistoryIfReadable,
    // The gathering read asks the readable-or-null door; reaching past it for the throwing one is
    // what put the refusal-code catch in the tenancy module in the first place.
    roleHistory: () => {
      throw new Error("memberRoleHistories reads a project's record through roleHistoryIfReadable, not through roleHistory (AC-1(a))");
    },
  };
});
vi.mock("../../../src/modules/spine/participants/guard", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return { ...original, requireRoleHistoryAccess: seam.requireRoleHistoryAccess };
});
vi.mock("../../../src/modules/spine/tenancy/read/members", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return { ...original, requireMembership: seam.requireMembership };
});
vi.mock("../../../src/core/db", async (importOriginal) => {
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

const tenancy = await import("../../../src/modules/spine/tenancy/index");
const marker = await import("../../../src/core/faults/refusal-marker");
const errors = await import("../../../src/core/errors");

/** One movement on somebody's record, in the shape the participants module answers with. */
function entry(subjectUserId: string, role: string): unknown {
  return { direction: "GRANT", role, subject: { userId: subjectUserId, emailKey: null }, actor: null, occurredAt: new Date(2026, 0, 1) };
}

interface Gathered {
  readonly projectId: string;
  readonly entry: { readonly subject: { readonly userId: string } };
}

/** The gathering read this criterion is about, or a loud absence naming what the module owes. */
function door(): (actor: { tenantId: string; userId: string }) => Promise<ReadonlyMap<string, readonly Gathered[]>> {
  const gathered = (tenancy as Record<string, unknown>)["memberRoleHistories"];
  expect(typeof gathered, "src/modules/spine/tenancy exports memberRoleHistories").toBe("function");
  return gathered as (actor: { tenantId: string; userId: string }) => Promise<ReadonlyMap<string, readonly Gathered[]>>;
}

/** The readable-or-null door, read from the participants module that owns it. */
async function readable(): Promise<(ctx: { tenantId: string; userId: string }, ref: { projectId: string }) => Promise<readonly unknown[] | null>> {
  const history = (await vi.importActual(PARTICIPANTS_HISTORY)) as Record<string, unknown>;
  const answered = history["roleHistoryIfReadable"];
  expect(typeof answered, `${PARTICIPANTS_HISTORY} exports roleHistoryIfReadable — the access judgement answered rather than thrown (AC-1(a))`).toBe("function");
  return answered as (ctx: { tenantId: string; userId: string }, ref: { projectId: string }) => Promise<readonly unknown[] | null>;
}

beforeEach(() => {
  vi.clearAllMocks();
  seam.projectRows = PROJECTS.map((projectId) => ({ projectId }));
  seam.requireRoleHistoryAccess.mockImplementation(async () => undefined);
  seam.roleHistoryIfReadable.mockImplementation(async () => [entry(ALICE, "PRINCIPAL")]);
});

test("AC-1(a): the participants module answers null for a project its own access guard refuses", async () => {
  const roleHistoryIfReadable = await readable();
  seam.requireRoleHistoryAccess.mockImplementation(async () => {
    throw marker.refusal("PERMISSION_NOT_HELD", "the reader stands on neither this project nor the workspace's administration");
  });

  await expect(roleHistoryIfReadable({ tenantId: TENANT, userId: READER }, { projectId: PROJECTS[0] })).resolves.toBeNull();
});

test("AC-1(a): with the guard satisfied it answers the entries — an empty record is a record, not a refusal", async () => {
  const roleHistoryIfReadable = await readable();
  seam.projectRows = [];

  const answered = await roleHistoryIfReadable({ tenantId: TENANT, userId: READER }, { projectId: PROJECTS[0] });

  expect(Array.isArray(answered), "a project the reader may read answers its entries, never null").toBe(true);
});

test("AC-1(a): a project answered null is passed over and the rest of the roster's record still gathers", async () => {
  const memberRoleHistories = door();
  seam.roleHistoryIfReadable.mockImplementation(async (_ctx, ref) => (ref.projectId === PROJECTS[1] ? null : [entry(ALICE, "PRINCIPAL")]));

  const histories = await memberRoleHistories({ tenantId: TENANT, userId: READER });

  const alice = histories.get(ALICE) ?? [];
  expect(alice.length, "the projects that answered contribute their movements; the one answered null contributes none").toBe(seam.projectRows.length - 1);
  expect(
    new Set(alice.map((movement) => movement.projectId)),
    "exactly the project answered null is missing from the gathered record",
  ).toEqual(new Set(PROJECTS.filter((projectId) => projectId !== PROJECTS[1])));
});

test("AC-1(a): a PERMISSION_NOT_HELD thrown from below the readable door travels out of the gathering read", async () => {
  const memberRoleHistories = door();
  const code = errors.refusalOf("PERMISSION_NOT_HELD").code;
  seam.roleHistoryIfReadable.mockImplementation(async () => {
    throw marker.refusal("PERMISSION_NOT_HELD", "a handle below the access judgement refused this read");
  });

  const thrown = await memberRoleHistories({ tenantId: TENANT, userId: READER }).then(
    () => null,
    (reason: unknown) => reason,
  );

  expect(thrown, "the gathering read does not swallow a refusal it did not itself judge — there is no catch to swallow it").not.toBeNull();
  expect(
    marker.refusalCodeOf(thrown),
    "the code that travels is the one the refusal below carried, unchanged",
  ).toBe(code);
});
