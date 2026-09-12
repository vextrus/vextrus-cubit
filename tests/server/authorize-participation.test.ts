/**
 * L-ACT-03 cuts TWO questions and the tree had only ever asked one.
 *
 * What a person may MOVE is a permission. Whether they are ON the project at all is participation —
 * "participants attach to (project, user), append-only, mandatory" — and it is what the clause
 * admits a lifecycle door on: "Project lifecycle and identity (archive, restore, field edits)
 * require tenant OWNER/ADMIN or participation on the project".
 *
 * ADMINISTER_PROJECT is deliberately PRINCIPAL-only, so a door that asked for it refused every LEAD,
 * MEASURER, REVIEWER, ESTIMATOR and BID_MANAGER participant the law admits. These are the
 * adversary's F4 cases, kept: the guard is asked exactly what the door asks it, once per shipped
 * role bundle.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ROLE_PERMISSIONS, ROLES, permissionsOf } from "../../src/core/acts/law";

const TENANT = "1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9";
const PROJECT = "9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d";

const seam = vi.hoisted(() => ({
  holdsWorkspace: vi.fn(async () => true),
  participatesIn: vi.fn(async () => true),
  permissionsHeld: vi.fn(async () => new Set(["REVIEW"])),
}));
vi.mock("../../src/server/shell/workspace", () => ({ holdsWorkspace: seam.holdsWorkspace }));
vi.mock("../../src/core/acts", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  participatesIn: seam.participatesIn,
  permissionsHeld: seam.permissionsHeld,
}));
vi.mock("../../src/core/db", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  runAsSystem: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ tenantId: TENANT, projectId: PROJECT }] }) }) }) }),
  forTenant: () => ({
    transaction: async (work: (tx: unknown) => unknown) => work({}),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ projectId: PROJECT }] }) }) }),
  }),
}));

const { authorize } = await import("../../src/server/authorize");

beforeEach(() => {
  vi.clearAllMocks();
  seam.holdsWorkspace.mockImplementation(async () => true);
  seam.participatesIn.mockImplementation(async () => true);
});

describe("the lifecycle question is participation, and every shipped role answers it", () => {
  for (const role of ROLES) {
    test(`a ${role} participant may archive, restore and edit the project they are on`, async () => {
      seam.permissionsHeld.mockImplementation(async () => new Set(ROLE_PERMISSIONS[role]));
      const answer = await authorize({ userId: `${role}-1`, tenantId: TENANT, projectId: PROJECT, participation: true });
      expect(answer.authorized, `${role} holds ${[...permissionsOf([role])].join(", ") || "no permission"} and is still a participant the clause admits`).toBe(true);
    });
  }

  test("a member of the workspace who is on no project of it is refused, by the code the door already answered", async () => {
    seam.participatesIn.mockImplementation(async () => false);
    const answer = await authorize({ userId: "member-1", tenantId: TENANT, projectId: PROJECT, participation: true });
    expect(answer.authorized).toBe(false);
    expect((answer as { refusal: string }).refusal, "no new code: the closed taxonomy is unchanged").toBe("PERMISSION_NOT_HELD");
  });

  test("participation is not 'holds some permission': a participant with no role yet is still on the project", async () => {
    seam.permissionsHeld.mockImplementation(async () => new Set());
    const answer = await authorize({ userId: "new-1", tenantId: TENANT, projectId: PROJECT, participation: true });
    expect(answer.authorized, "a role is assigned by an act, which happens after the attachment").toBe(true);
  });

  test("a non-member is refused before participation is ever read", async () => {
    seam.holdsWorkspace.mockImplementation(async () => false);
    const answer = await authorize({ userId: "stranger", tenantId: TENANT, projectId: PROJECT, participation: true });
    expect(answer.authorized).toBe(false);
    expect(seam.participatesIn, "membership comes first: the grants are tenant-scoped rows").not.toHaveBeenCalled();
  });
});

describe("a READ door may not name MEASURE — the role table says why", () => {
  test("four of the six shipped roles hold no MEASURE, so naming it at a read door refuses them", () => {
    const without = ROLES.filter((role) => !permissionsOf([role]).has("MEASURE"));
    expect([...without].sort(), "each of these participates in projects and is served by screens built over the feed").toEqual([
      "BID_MANAGER",
      "ESTIMATOR",
      "LEAD",
      "REVIEWER",
    ]);
  });

  test("and each of them passes the question a read door does ask", async () => {
    for (const role of ROLES.filter((candidate) => !permissionsOf([candidate]).has("MEASURE"))) {
      seam.permissionsHeld.mockImplementation(async () => new Set(ROLE_PERMISSIONS[role]));
      const answer = await authorize({ userId: `${role}-1`, tenantId: TENANT, projectId: PROJECT, drawingId: "0f9b1b7c-2f3a-4c2e-9d1a-2b3c4d5e6f70", participation: true });
      expect(answer.authorized, `${role} is on the project and may see what it holds`).toBe(true);
    }
  });
});
