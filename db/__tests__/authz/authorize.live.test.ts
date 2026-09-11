/**
 * The one door-guard, driven live against a scratch database the committed migrations built (V-DB).
 *
 * Three doors were each open in a different way before `src/server/authorize.ts`, and each limb
 * below is the witness for one of them:
 *
 *   1. `projectActorFor` (routers/spine.ts) took a `permission` and used it only to WORD the
 *      refusal — it admitted on `holdsWorkspace`. So a workspace member who participates in a
 *      project not at all passed every project door of that workspace. The limb stages exactly that
 *      person and asserts PERMISSION_NOT_HELD, and stages a MEASURER and asserts that MEASURE is
 *      admitted while ADMINISTER_PROJECT — which L-ACT-03 makes PRINCIPAL-only — is not.
 *   2. `drawingInScope` scoped a drawing by TENANT (the row policy) and never by project. The limb
 *      stages two projects of ONE workspace and asks one project's door for the other's drawing.
 *   3. `GET /api/events` asked for no session at all. The limb calls the shipped handler with an
 *      empty cookie jar and asserts 401 with a registered code.
 *
 * Raw SQL is spoken through psql, never a driver import — SEAM-TENANT's ban binds this file like the
 * rest of the tree. Product modules are imported after DATABASE_URL names the scratch database, the
 * shape `support/seam.ts` uses, and by relative path: the `@/*` alias is not resolved inside them.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../harness";
import { GUC_SYSTEM_REASON, SEED_REASON } from "../support/fixtures";
import { lit, run, scalar } from "../support/live-sql";

/** The cookie jar the events limb presents: an empty one, which is the whole point of the limb. */
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
  headers: async () => new Headers(),
}));

type Authorize = typeof import("../../../src/server/authorize");
type IngestRequest = typeof import("../../../src/modules/takeoff/ingest/request");
type EventsRoute = typeof import("../../../src/app/api/events/route");

let scratch: ScratchDb;
let authorize: Authorize["authorize"];
let drawingInScope: IngestRequest["drawingInScope"];

/** The scene: one workspace, three people, two projects, and a drawing that belongs to one of them. */
const scene = {
  tenantId: "",
  principalId: "",
  measurerId: "",
  bystanderId: "",
  projectA: "",
  projectB: "",
  drawingOfB: "",
};

/** A staging statement, run under the system reason the seam's own writes record (SEAM-TENANT). */
function seed(sql: string): string {
  return scalar(scratch.urlMigrate, `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);
}

function seedRun(sql: string): void {
  run(scratch.urlMigrate, `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);
}

/** One person of this workspace: an account, and the membership that admits them to it. */
function person(label: string): string {
  const userId = seed(`insert into users (email, password_hash) values (${lit(`${label}-${randomUUID()}@cubit.test`)}, ${lit("not-a-real-hash")}) returning user_id::text;`);
  seedRun(`insert into memberships (tenant_id, user_id) values (${lit(scene.tenantId)}, ${lit(userId)});`);
  return userId;
}

beforeAll(async () => {
  scratch = await provisionScratchDb();
  process.env["DATABASE_URL"] = scratch.urlApp;

  scene.tenantId = seed(`insert into tenants (name) values ('Authorize acceptance') returning tenant_id::text;`);
  scene.principalId = person("principal");
  scene.measurerId = person("measurer");
  scene.bystanderId = person("bystander");
  scene.projectA = seed(`insert into projects (tenant_id, name) values (${lit(scene.tenantId)}, 'Project A') returning project_id::text;`);
  scene.projectB = seed(`insert into projects (tenant_id, name) values (${lit(scene.tenantId)}, 'Project B') returning project_id::text;`);

  // The grants: a PRINCIPAL on A (L-ACT-03 makes a project hold one at every moment), a MEASURER on
  // A, and nothing at all for the bystander — who is nonetheless a full member of the workspace.
  // `participant_roles` is a composite FK onto `participants` (L-ACT-03: "participation is a
  // composite FK from the act log"), so the participation stands before any role is granted on it.
  seedRun(
    `insert into participants (tenant_id, project_id, user_id) values (${lit(scene.tenantId)}, ${lit(scene.projectA)}, ${lit(scene.principalId)});
     insert into participants (tenant_id, project_id, user_id) values (${lit(scene.tenantId)}, ${lit(scene.projectA)}, ${lit(scene.measurerId)});
     insert into participants (tenant_id, project_id, user_id) values (${lit(scene.tenantId)}, ${lit(scene.projectB)}, ${lit(scene.principalId)});`,
  );
  seedRun(
    `insert into participant_roles (tenant_id, project_id, user_id, role) values (${lit(scene.tenantId)}, ${lit(scene.projectA)}, ${lit(scene.principalId)}, 'PRINCIPAL');
     insert into participant_roles (tenant_id, project_id, user_id, role) values (${lit(scene.tenantId)}, ${lit(scene.projectA)}, ${lit(scene.measurerId)}, 'MEASURER');
     insert into participant_roles (tenant_id, project_id, user_id, role) values (${lit(scene.tenantId)}, ${lit(scene.projectB)}, ${lit(scene.principalId)}, 'PRINCIPAL');`,
  );

  // A drawing of project B, with the content row its composite key points at.
  const sha256 = randomUUID().replaceAll("-", "").padEnd(64, "0");
  seedRun(
    `insert into files (tenant_id, sha256, byte_length, format, scan_verdict) values (${lit(scene.tenantId)}, ${lit(sha256)}, 1024, 'dxf', 'clean');`,
  );
  scene.drawingOfB = seed(
    `insert into drawings (tenant_id, project_id, sha256, name, format, uploaded_by)
     values (${lit(scene.tenantId)}, ${lit(scene.projectB)}, ${lit(sha256)}, 'B-101 Plan', 'dxf', ${lit(scene.principalId)}) returning drawing_id::text;`,
  );

  ({ authorize } = (await import("../../../src/server/authorize")) as Authorize);
  ({ drawingInScope } = (await import("../../../src/modules/takeoff/ingest/request")) as IngestRequest);
}, 240_000);

afterAll(async () => {
  const { closePools } = (await import("../../../src/core/db")) as typeof import("../../../src/core/db");
  await closePools();
  await scratch?.drop();
});

describe("authorize() tests the permission it is handed (L-ACT-03)", () => {
  it("refuses a workspace member who holds no role on the project — the guard that used to admit them", async () => {
    const answer = await authorize({ userId: scene.bystanderId, projectId: scene.projectA, permission: "MEASURE" });
    expect(answer.authorized).toBe(false);
    expect(answer.authorized === false && answer.refusal).toBe("PERMISSION_NOT_HELD");
  });

  it("refuses the WRONG permission and admits the right one for the same person on the same project", async () => {
    const admitted = await authorize({ userId: scene.measurerId, projectId: scene.projectA, permission: "MEASURE" });
    expect(admitted.authorized).toBe(true);
    expect(admitted.authorized === true && admitted.actor).toEqual({ tenantId: scene.tenantId, userId: scene.measurerId, actorKind: "human" });

    // ADMINISTER_PROJECT is PRINCIPAL-only; a MEASURER's roles bundle no such permission.
    const refused = await authorize({ userId: scene.measurerId, projectId: scene.projectA, permission: "ADMINISTER_PROJECT", actType: "ASSIGN_PARTICIPANT_ROLE" });
    expect(refused.authorized).toBe(false);
    expect(refused.authorized === false && refused.refusal).toBe("PERMISSION_NOT_HELD");

    const principal = await authorize({ userId: scene.principalId, projectId: scene.projectA, permission: "ADMINISTER_PROJECT" });
    expect(principal.authorized).toBe(true);
  });

  it("refuses a permission held on ANOTHER project of the same workspace", async () => {
    const answer = await authorize({ userId: scene.measurerId, projectId: scene.projectB, permission: "MEASURE" });
    expect(answer.authorized).toBe(false);
  });
});

describe("authorize() binds a drawing to the project that named it (R-SPINE-004)", () => {
  it("refuses a drawing of a sibling project of the SAME workspace", async () => {
    const answer = await authorize({ userId: scene.principalId, projectId: scene.projectA, drawingId: scene.drawingOfB });
    expect(answer.authorized).toBe(false);
    expect(answer.authorized === false && answer.refusal).toBe("WORKSPACE_PERMISSION_NOT_HELD");
  });

  it("admits the same drawing at the door of the project that owns it", async () => {
    const answer = await authorize({ userId: scene.principalId, projectId: scene.projectB, drawingId: scene.drawingOfB });
    expect(answer.authorized).toBe(true);
  });

  it("drawingInScope() says the same thing at the takeoff seam's own door", async () => {
    expect(await drawingInScope(scene.tenantId, scene.drawingOfB, scene.projectA)).toBeNull();
    expect(await drawingInScope(scene.tenantId, scene.drawingOfB, scene.projectB)).not.toBeNull();
    // The tenant-only reading is still available to the doors that name no project, unchanged.
    expect(await drawingInScope(scene.tenantId, scene.drawingOfB)).not.toBeNull();
  });
});

describe("GET /api/events identifies its caller (R-SPINE-001)", () => {
  it("answers 401 with a registered code when no session is presented", async () => {
    const { GET } = (await import("../../../src/app/api/events/route")) as EventsRoute;
    const answer = await GET(new Request("http://localhost/api/events?jobId=whatever"));
    expect(answer.status).toBe(401);
    expect(((await answer.json()) as { refusal?: string }).refusal).toBe("SIGNED_OUT");
  });
});
