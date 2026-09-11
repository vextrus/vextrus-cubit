/**
 * B-17 at the doors that still kept a guard of their own after `authorize()` was written.
 *
 * The guard had ONE caller (routers/spine.ts). Everywhere else a door re-asked the half-question
 * `holdsWorkspace` — is this person in the workspace — and admitted on it, so a workspace member
 * with no role on the project passed every project door in it. The upload doors are the plainest
 * case: a member could open, probe and continue an upload against any project of the workspace.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const guard = vi.hoisted(() => ({ authorize: vi.fn(async () => ({ authorized: true, actor: {}, tenantId: "tenant-1", userId: "user-1" })) }));
vi.mock("../../src/server/authorize", () => ({ authorize: guard.authorize, authorizeOrThrow: vi.fn() }));

const { admitForProject, isRefusedAdmission } = await import("../../src/app/api/upload/answers");

beforeEach(() => {
  guard.authorize.mockClear();
  guard.authorize.mockImplementation(async () => ({ authorized: true, actor: {}, tenantId: "tenant-1", userId: "user-1" }));
});

describe("POST /api/upload asks the one guard, and names the permission it moves", () => {
  test("the project and the named permission reach the guard", async () => {
    await admitForProject("user-1", "project-1");
    expect(guard.authorize, "a drawing is what a measurement is taken from, so the door moves MEASURE").toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
      permission: "MEASURE",
      actType: null,
    });
  });

  test("a workspace member the guard refuses is refused at the door", async () => {
    guard.authorize.mockImplementation(async () => ({ authorized: false, refusal: "PERMISSION_NOT_HELD" }) as never);
    const admission = await admitForProject("user-1", "project-1");
    expect(isRefusedAdmission(admission), "membership is no longer what admits an upload").toBe(true);
    expect((admission as { refusal: string }).refusal, "the door's own closed answer set is unchanged").toBe("WORKSPACE_PERMISSION_NOT_HELD");
  });

  test("no session is no admission, before any workspace question is asked", async () => {
    const admission = await admitForProject(null, "project-1");
    expect((admission as { refusal: string }).refusal).toBe("SIGNED_OUT");
    expect(guard.authorize, "a door with no session has nothing to authorize").not.toHaveBeenCalled();
  });
});
