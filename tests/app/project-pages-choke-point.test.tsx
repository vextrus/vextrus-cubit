/**
 * The four project pages that still reached the choke point through `projectHeld` (§N).
 *
 * `projectHeld({ tenantId: params.tenant }, project)` answers a different question from the one a
 * guard asks: "is that project in that workspace" is true of a workspace the caller has never been
 * a member of, and asking it arms the row policy with the tenant segment — a value the caller wrote
 * — on the way. Each page now asks `authorizePage()` for itself: session, then the workspace the
 * PROJECT is really in, then the read; and the permission each screen discloses is read for the
 * account the guard resolved, under the tenant the guard answered.
 *
 * The segment and the real workspace are deliberately different strings here: a page that still
 * scoped its read by `params.tenant` passes no test in this file.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const SEGMENT = "tenant-as-typed";
const REAL = "tenant-as-owned";
const PROJECT = "project-1";
const USER = "user-1";

const guard = vi.hoisted(() => ({
  authorizePage: vi.fn(async () => ({ authorized: true, actor: {}, tenantId: "tenant-as-owned", userId: "user-1" })),
}));
vi.mock("../../src/server/authorize-page", () => ({ authorizePage: guard.authorizePage }));

const seams = vi.hoisted(() => ({
  setsOf: vi.fn(async () => []),
  setOf: vi.fn(async () => ({ setId: "set-1", name: "A set" })),
  drawingLineagesOf: vi.fn(async () => []),
  holdsPinSet: vi.fn(async () => true),
  coverageViewOf: vi.fn(async () => ({ rows: [] })),
  registerViewOf: vi.fn(async () => ({ objects: [] })),
  permissionsHeld: vi.fn(async () => new Set(["MEASURE", "SET_BILL_BOUNDARY"])),
  forTenant: vi.fn((scope: { tenantId: string }) => ({ transaction: async (run: (tx: unknown) => Promise<unknown>) => run({ scope }) })),
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("../../src/modules/takeoff/sets", () => ({
  setsOf: seams.setsOf,
  setOf: seams.setOf,
  drawingLineagesOf: seams.drawingLineagesOf,
  holdsPinSet: seams.holdsPinSet,
}));
vi.mock("../../src/modules/takeoff/coverage/server", () => ({ coverageViewOf: seams.coverageViewOf }));
vi.mock("../../src/modules/takeoff/register-ui/server", () => ({ registerViewOf: seams.registerViewOf }));
vi.mock("../../src/core/acts", async (original) => ({ ...(await original<Record<string, unknown>>()), permissionsHeld: seams.permissionsHeld }));
vi.mock("../../src/core/db", async (original) => ({ ...(await original<Record<string, unknown>>()), forTenant: seams.forTenant }));

const address = { params: Promise.resolve({ tenant: SEGMENT, project: PROJECT }) };

beforeEach(() => {
  vi.clearAllMocks();
  guard.authorizePage.mockImplementation(async () => ({ authorized: true, actor: {}, tenantId: REAL, userId: USER }));
});

/** What every one of the four must have asked, in the shape the choke point takes. */
function expectAsked(): void {
  expect(guard.authorizePage, "the page asks the choke point for itself — the segment is an assertion the guard checks").toHaveBeenCalledWith({
    tenant: SEGMENT,
    project: PROJECT,
  });
}

describe("each project page reaches the choke point itself, and reads under what it answered", () => {
  test("S-Drawings-Sets: the sets index", async () => {
    const { default: page } = await import("../../src/app/(app)/t/[tenant]/p/[project]/drawings/sets/page");
    await page(address);
    expectAsked();
    expect(seams.setsOf, "the read is scoped by the workspace the guard answered, never by the segment").toHaveBeenCalledWith({ tenantId: REAL, projectId: PROJECT });
    expect(seams.holdsPinSet, "the disclosure is read for the account the guard resolved").toHaveBeenCalledWith({ tenantId: REAL, projectId: PROJECT }, USER);
  });

  test("S-Drawings-Sets: one set, whole", async () => {
    const { default: page } = await import("../../src/app/(app)/t/[tenant]/p/[project]/drawings/sets/[set]/page");
    await page({ params: Promise.resolve({ tenant: SEGMENT, project: PROJECT, set: "set-1" }) });
    expectAsked();
    expect(seams.setOf).toHaveBeenCalledWith({ tenantId: REAL, projectId: PROJECT }, "set-1");
    expect(seams.holdsPinSet).toHaveBeenCalledWith({ tenantId: REAL, projectId: PROJECT }, USER);
  });

  test("S-Coverage: the residue grid", async () => {
    const { default: page } = await import("../../src/app/(app)/t/[tenant]/p/[project]/takeoff/coverage/page");
    await page({ ...address, searchParams: Promise.resolve({}) });
    expectAsked();
    expect(seams.coverageViewOf).toHaveBeenCalledWith({ tenantId: REAL, projectId: PROJECT });
    expect(seams.forTenant, "the permission read is armed with the guard's workspace").toHaveBeenCalledWith({ tenantId: REAL });
    expect(seams.permissionsHeld.mock.calls[0]?.slice(1), "asked about the project, for the account the guard resolved").toEqual([PROJECT, USER]);
  });

  test("S-Takeoff: the register workspace", async () => {
    const { default: page } = await import("../../src/app/(app)/t/[tenant]/p/[project]/takeoff/register/page");
    await page(address);
    expectAsked();
    expect(seams.registerViewOf).toHaveBeenCalledWith({ tenantId: REAL, projectId: PROJECT });
    expect(seams.forTenant).toHaveBeenCalledWith({ tenantId: REAL });
    expect(seams.permissionsHeld.mock.calls[0]?.slice(1)).toEqual([PROJECT, USER]);
  });
});
