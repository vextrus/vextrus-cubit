/**
 * AM-11's live witness for the Author edition door: "each door carries a live-database test proving
 * a caller without the permission is refused by name."
 *
 * AM-04 gives AUTHOR_RULESET_EDITION the permission AUTHOR_RULE_SET and bundles it into LEAD and
 * PRINCIPAL alone, so this stages three people on one project — a LEAD who holds it, a MEASURER who
 * participates and does not, and a workspace member who is on the project not at all — and asks the
 * one `authorize()` for each. The refusal is L-ACT-03's `PERMISSION_NOT_HELD`, carrying the act type
 * and the missing permission, and it is the SAME answer the act seam gives, because there is one
 * guard and the screen's door calls it.
 *
 * Raw SQL is spoken through psql, never a driver import — SEAM-TENANT's ban binds this file like the
 * rest of the tree. Product modules are imported after DATABASE_URL names the scratch database.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../harness";
import { GUC_SYSTEM_REASON, SEED_REASON } from "../support/fixtures";
import { lit, run, scalar } from "../support/live-sql";

type Authorize = typeof import("../../../src/server/authorize");

let scratch: ScratchDb;
let authorize: Authorize["authorize"];
let authorizeOrThrow: Authorize["authorizeOrThrow"];

const AUTHOR_RULE_SET = "AUTHOR_RULE_SET" as const;
const AUTHOR_RULESET_EDITION = "AUTHOR_RULESET_EDITION" as const;

const scene = { tenantId: "", projectId: "", leadId: "", measurerId: "", bystanderId: "" };

function seed(sql: string): string {
  return scalar(scratch.urlMigrate, `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);
}

function seedRun(sql: string): void {
  run(scratch.urlMigrate, `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);
}

/** One person of this workspace: an account, and the membership that admits them to it. */
function person(label: string): string {
  const userId = seed(
    `insert into users (email, password_hash) values (${lit(`${label}-${randomUUID()}@cubit.test`)}, ${lit("not-a-real-hash")}) returning user_id::text;`,
  );
  seedRun(`insert into memberships (tenant_id, user_id) values (${lit(scene.tenantId)}, ${lit(userId)});`);
  return userId;
}

/** A participant of the project, holding one role — participation first, then the grant on it. */
function participant(userId: string, role: string): void {
  seedRun(
    `insert into participants (tenant_id, project_id, user_id) values (${lit(scene.tenantId)}, ${lit(scene.projectId)}, ${lit(userId)});
     insert into participant_roles (tenant_id, project_id, user_id, role) values (${lit(scene.tenantId)}, ${lit(scene.projectId)}, ${lit(userId)}, ${lit(role)});`,
  );
}

beforeAll(async () => {
  scratch = await provisionScratchDb();
  process.env["DATABASE_URL"] = scratch.urlApp;

  scene.tenantId = seed(`insert into tenants (name) values ('Ruleset authoring door') returning tenant_id::text;`);
  scene.leadId = person("lead");
  scene.measurerId = person("measurer");
  scene.bystanderId = person("bystander");
  scene.projectId = seed(`insert into projects (tenant_id, name) values (${lit(scene.tenantId)}, 'Sattva Tower') returning project_id::text;`);

  // A project holds a PRINCIPAL at every moment (L-ACT-03), and the LEAD is the role AM-04 bundles
  // AUTHOR_RULE_SET into beside PRINCIPAL — so the LEAD is what this file proves the grant on.
  participant(scene.leadId, "LEAD");
  participant(scene.measurerId, "MEASURER");

  ({ authorize, authorizeOrThrow } = (await import("../../../src/server/authorize")) as Authorize);
}, 240_000);

afterAll(async () => {
  const { closePools } = (await import("../../../src/core/db")) as typeof import("../../../src/core/db");
  await closePools();
  await scratch?.drop();
});

describe("AM-04 · AM-11: the Author edition door admits AUTHOR_RULE_SET and refuses everyone else by name", () => {
  it("a LEAD of the project holds the permission the act moves", async () => {
    const answer = await authorize({ userId: scene.leadId, projectId: scene.projectId, permission: AUTHOR_RULE_SET, actType: AUTHOR_RULESET_EDITION });
    expect(answer.authorized, "AM-04 bundles AUTHOR_RULE_SET into LEAD, so a LEAD may author an edition").toBe(true);
  });

  it("a MEASURER who participates does NOT — the permission is its own, not a share of measuring", async () => {
    const answer = await authorize({ userId: scene.measurerId, projectId: scene.projectId, permission: AUTHOR_RULE_SET, actType: AUTHOR_RULESET_EDITION });
    expect(answer.authorized).toBe(false);
    expect(answer.authorized === false && answer.refusal, "L-ACT-03's refusal, by its registered code").toBe("PERMISSION_NOT_HELD");
  });

  it("a workspace member who is on the project not at all is refused by the same code", async () => {
    const answer = await authorize({ userId: scene.bystanderId, projectId: scene.projectId, permission: AUTHOR_RULE_SET, actType: AUTHOR_RULESET_EDITION });
    expect(answer.authorized).toBe(false);
    expect(answer.authorized === false && answer.refusal).toBe("PERMISSION_NOT_HELD");
  });

  it("the throwing door names the act type and the missing permission (L-ACT-03)", async () => {
    const thrown = await authorizeOrThrow({
      userId: scene.measurerId,
      projectId: scene.projectId,
      permission: AUTHOR_RULE_SET,
      actType: AUTHOR_RULESET_EDITION,
    }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(thrown, "a caller without the permission is refused, never admitted").not.toBeNull();
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    expect(message, "the refusal carries the act type it was asked for").toContain(AUTHOR_RULESET_EDITION);
    expect(message, "…and the permission that was missing").toContain(AUTHOR_RULE_SET);
  });
});
