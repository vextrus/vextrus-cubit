/**
 * The three project lifecycle doors ask the one guard (B-17, ARCH-02).
 *
 * `actorIn` (src/app/(app)/t/[tenant]/actions.ts) stopped at `holdsWorkspace`: ANY member of a
 * workspace could archive, restore or rewrite the fields of ANY project in it, whatever they held
 * on that project. L-ACT-03 names what lifecycle moves — ADMINISTER_PROJECT, the PRINCIPAL-only
 * bundle — and the seam behind these doors refuses by that very name, so the door asks for it.
 *
 * A creation names no project: there is no project yet to hold a grant on, so membership is what
 * admits it, and the door asks the guard the workspace question alone.
 *
 * The doors' answer is unchanged: PERMISSION_NOT_HELD, the code they already carried back.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const TENANT = "tenant-1";
const PROJECT = "project-1";

const guard = vi.hoisted(() => ({
  authorize: vi.fn(async () => ({ authorized: true, actor: {}, tenantId: "tenant-1", userId: "user-1" })),
}));
vi.mock("../../src/server/authorize", () => ({ authorize: guard.authorize, authorizeOrThrow: vi.fn() }));

const seams = vi.hoisted(() => ({
  archiveProject: vi.fn(async () => {}),
  restoreProject: vi.fn(async () => {}),
  updateProject: vi.fn(async () => {}),
  session: vi.fn(async () => ({ sessionId: "s", userId: "user-1" }) as { sessionId: string; userId: string } | null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("../../src/modules/spine/projects", () => ({
  archiveProject: seams.archiveProject,
  createProject: vi.fn(async () => ({ projectId: "project-made" })),
  restoreProject: seams.restoreProject,
  updateProject: seams.updateProject,
}));
vi.mock("../../src/server/shell/session", () => ({ endSession: vi.fn(), presentedSessionToken: vi.fn(async () => "a-live-token") }));
vi.mock("../../src/server/shell/resolve", () => ({ sessionOf: seams.session }));
vi.mock("../../src/server/shell/workspace", () => ({ renameWorkspace: vi.fn(), holdsWorkspace: vi.fn(async () => true) }));
vi.mock("../../src/server/shell/sample-seed", () => ({ sampleSeed: vi.fn(async () => ({ available: false })) }));

const actions = await import("../../src/app/(app)/t/[tenant]/actions");

/** A presentable draft, so the save door reaches the guard rather than the field judgement. */
function draft(): FormData {
  const form = new FormData();
  for (const [field, value] of Object.entries({
    tenantId: TENANT,
    projectId: PROJECT,
    name: "Tower A",
    code: "TWR-A",
    client: "A Client",
    siteAddress: "12 Road",
    district: "Dhaka",
    buildingType: "RESIDENTIAL",
    storeys: "6",
    gfaM2: "1200",
    notes: "",
  }))
    form.set(field, value);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  guard.authorize.mockImplementation(async () => ({ authorized: true, actor: {}, tenantId: TENANT, userId: "user-1" }));
  seams.session.mockImplementation(async () => ({ sessionId: "s", userId: "user-1" }));
});

describe("archive, restore and save ask the one guard for the permission lifecycle moves", () => {
  for (const [name, call] of [
    ["archive", () => actions.archiveProjectAction(TENANT, PROJECT)],
    ["restore", () => actions.restoreProjectAction(TENANT, PROJECT)],
  ] as const) {
    test(`${name} names the project and ADMINISTER_PROJECT at the guard`, async () => {
      await call();
      expect(guard.authorize, "L-ACT-03's PRINCIPAL-only bundle is what lifecycle moves").toHaveBeenCalledWith({
        userId: "user-1",
        tenantId: TENANT,
        projectId: PROJECT,
        permission: "ADMINISTER_PROJECT",
        actType: null,
      });
    });

    test(`a workspace member without it is refused at the ${name} door, and the seam is never called`, async () => {
      guard.authorize.mockImplementation(async () => ({ authorized: false, refusal: "PERMISSION_NOT_HELD" }) as never);
      expect(await call(), "the code these doors already carried back, unchanged").toEqual({ done: false, refusal: "PERMISSION_NOT_HELD" });
      expect(seams.archiveProject, "nothing is written for a caller the guard did not admit").not.toHaveBeenCalled();
      expect(seams.restoreProject).not.toHaveBeenCalled();
    });
  }

  test("a field edit names the project it edits, and a member without the permission writes nothing", async () => {
    guard.authorize.mockImplementation(async () => ({ authorized: false, refusal: "PERMISSION_NOT_HELD" }) as never);
    const answer = await actions.saveProjectAction(null, draft());
    expect(answer).toEqual({ saved: false, refusal: "PERMISSION_NOT_HELD" });
    const asked = guard.authorize.mock.calls.at(0) as unknown[] | undefined;
    expect(asked?.[0], "the edited project is named, so the grant can be read").toMatchObject({
      projectId: PROJECT,
      permission: "ADMINISTER_PROJECT",
    });
    expect(seams.updateProject).not.toHaveBeenCalled();
  });

  test("a creation names no project and asks the workspace question alone", async () => {
    const form = draft();
    form.set("projectId", "");
    await actions.saveProjectAction(null, form);
    expect(guard.authorize, "there is no project yet to hold a grant on").toHaveBeenCalledWith({ userId: "user-1", tenantId: TENANT });
  });
});
