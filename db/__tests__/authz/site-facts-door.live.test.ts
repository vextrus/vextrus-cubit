/**
 * AM-11's live witness for the Site facts door: a caller without AUTHOR_PROJECT_FACT is refused
 * PERMISSION_NOT_HELD, by name, at `authorize()` AND at the act seam — the two places L-ACT-03 says
 * the question is asked ("the permission check lives in the act seam", and AM-11's "each door
 * carries a live-database test proving a caller without the permission is refused").
 *
 * AM-06 §1 enters AUTHOR_SITE_FACT under the EXISTING AUTHOR_PROJECT_FACT and mints no permission of
 * its own, so this door is the one L-ACT-03 already cut: the permission is bundled into MEASURER and
 * PRINCIPAL and into no other shipped role. A REVIEWER on the very same project — a full participant,
 * with permissions of their own — is the honest counter-example; the last describe walks the whole
 * shipped roster rather than that one example, because "and into no other role" is a claim about all
 * six, and a bundle that quietly gained the permission would fail here by name.
 *
 * Raw SQL is spoken through psql, never a driver import (SEAM-TENANT). Product modules are imported
 * after DATABASE_URL names the scratch database, and by relative path: `@/*` is not resolved here.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../harness";
import { GUC_SYSTEM_REASON, SEED_REASON } from "../support/fixtures";
import { lit, run, scalar } from "../support/live-sql";

type Authorize = typeof import("../../../src/server/authorize");
type Acts = typeof import("../../../src/core/acts");
type Faults = typeof import("../../../src/core/faults/refusal-marker");

let scratch: ScratchDb;
let authorize: Authorize["authorize"];
let authorizeOrThrow: Authorize["authorizeOrThrow"];
let preview: Acts["preview"];
let commit: Acts["commit"];
let consequenceDigest: Acts["consequenceDigest"];
let refusalCodeOf: Faults["refusalCodeOf"];

const AUTHOR_PROJECT_FACT = "AUTHOR_PROJECT_FACT" as const;
const AUTHOR_SITE_FACT = "AUTHOR_SITE_FACT" as const;

/** One workspace, one project, and the people who differ only in the roles they hold. */
const scene = { tenantId: "", measurerId: "", reviewerId: "", bystanderId: "", projectId: "" };

/**
 * Every shipped role, and whether L-ACT-03 bundles AUTHOR_PROJECT_FACT into it. The roster is walked
 * whole so the door is proven to admit by the permission and by nothing else.
 */
const BUNDLING: Readonly<Record<string, boolean>> = {
  MEASURER: true,
  REVIEWER: false,
  LEAD: false,
  ESTIMATOR: false,
  BID_MANAGER: false,
  PRINCIPAL: true,
};

/** The one participant of each role, by role — seeded once, asked at both doors below. */
const holders: Record<string, string> = {};

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

/** A participant of the project, holding one role — the composite FK L-ACT-03 names. */
function participant(userId: string, role: string): void {
  seedRun(
    `insert into participants (tenant_id, project_id, user_id) values (${lit(scene.tenantId)}, ${lit(scene.projectId)}, ${lit(userId)});
     insert into participant_roles (tenant_id, project_id, user_id, role) values (${lit(scene.tenantId)}, ${lit(scene.projectId)}, ${lit(userId)}, ${lit(role)});`,
  );
}

/** How many entries this project's ledger holds — the count a refused door may never move. */
function siteFactRows(): number {
  return Number(scalar(scratch.urlMigrate, `select count(*)::text from site_facts where project_id = ${lit(scene.projectId)};`));
}

beforeAll(async () => {
  scratch = await provisionScratchDb();
  process.env["DATABASE_URL"] = scratch.urlApp;

  scene.tenantId = seed(`insert into tenants (name) values ('Site facts door') returning tenant_id::text;`);
  scene.measurerId = person("measurer");
  scene.reviewerId = person("reviewer");
  scene.bystanderId = person("bystander");
  scene.projectId = seed(`insert into projects (tenant_id, name) values (${lit(scene.tenantId)}, 'Site facts door') returning project_id::text;`);
  participant(scene.measurerId, "MEASURER");
  participant(scene.reviewerId, "REVIEWER");
  holders["MEASURER"] = scene.measurerId;
  holders["REVIEWER"] = scene.reviewerId;
  for (const role of Object.keys(BUNDLING)) {
    if (holders[role] !== undefined) continue;
    const userId = person(role.toLowerCase());
    participant(userId, role);
    holders[role] = userId;
  }

  ({ authorize, authorizeOrThrow } = (await import("../../../src/server/authorize")) as Authorize);
  ({ preview, commit, consequenceDigest } = (await import("../../../src/core/acts")) as Acts);
  ({ refusalCodeOf } = (await import("../../../src/core/faults/refusal-marker")) as Faults);
}, 240_000);

afterAll(async () => {
  const { closePools } = (await import("../../../src/core/db")) as typeof import("../../../src/core/db");
  await closePools();
  await scratch?.drop();
});

/**
 * What the panel states, so both doors are asked the same question about the same act. The entry
 * itself is lawful — a fact of the roster, a unit the canon carries to metres and a source note — so
 * the only thing that can refuse it below is the permission (AM-06 §1).
 */
const stated = () =>
  ({
    type: AUTHOR_SITE_FACT,
    projectId: scene.projectId,
    fact: "GROUND_LEVEL",
    valueAsWritten: "-1.2",
    unitAsWritten: "m",
    sourceNote: "Survey sheet S-01",
  }) as const;

/** The actor context a participant acts in — the human the act log takes as its author (L-ACT-01). */
const actorOf = (userId: string) => ({ tenantId: scene.tenantId, userId, actorKind: "human" as const });

describe("the Site facts door asks for AUTHOR_PROJECT_FACT and mints no permission of its own (AM-06 §1, AM-11)", () => {
  it("admits the MEASURER, who is a role L-ACT-03 bundles the permission into", async () => {
    const answer = await authorize({ userId: scene.measurerId, projectId: scene.projectId, permission: AUTHOR_PROJECT_FACT, actType: AUTHOR_SITE_FACT });
    expect(answer.authorized).toBe(true);
    expect(answer.authorized === true && answer.actor).toEqual({ tenantId: scene.tenantId, userId: scene.measurerId, actorKind: "human" });
  });

  it("refuses a REVIEWER on the same project — a participant, and a holder of other permissions", async () => {
    const answer = await authorize({ userId: scene.reviewerId, projectId: scene.projectId, permission: AUTHOR_PROJECT_FACT, actType: AUTHOR_SITE_FACT });
    expect(answer.authorized).toBe(false);
    expect(answer.authorized === false && answer.refusal).toBe("PERMISSION_NOT_HELD");
  });

  it("refuses a workspace member who is on the project not at all", async () => {
    const answer = await authorize({ userId: scene.bystanderId, projectId: scene.projectId, permission: AUTHOR_PROJECT_FACT, actType: AUTHOR_SITE_FACT });
    expect(answer.authorized === false && answer.refusal).toBe("PERMISSION_NOT_HELD");
  });

  it("carries the act type and the missing permission when the door throws (L-ACT-03)", async () => {
    const thrown = await authorizeOrThrow({
      userId: scene.reviewerId,
      projectId: scene.projectId,
      permission: AUTHOR_PROJECT_FACT,
      actType: AUTHOR_SITE_FACT,
    }).catch((error: unknown) => error);
    expect(refusalCodeOf(thrown)).toBe("PERMISSION_NOT_HELD");
    expect(String((thrown as Error).message)).toContain(AUTHOR_SITE_FACT);
    expect(String((thrown as Error).message)).toContain(AUTHOR_PROJECT_FACT);
  });
});

describe("the act seam asks the same question, and answers it the same way (L-ACT-03, L-ACT-01)", () => {
  it("refuses a REVIEWER's preview by name, before any entry is read", async () => {
    const thrown = await preview(actorOf(scene.reviewerId), stated()).catch((error: unknown) => error);
    expect(refusalCodeOf(thrown)).toBe("PERMISSION_NOT_HELD");
    expect(String((thrown as Error).message)).toContain(AUTHOR_SITE_FACT);
    expect(String((thrown as Error).message)).toContain(AUTHOR_PROJECT_FACT);
  });

  it("refuses a REVIEWER's commit by name, and appends nothing — neither the act row nor the entry", async () => {
    const before = siteFactRows();
    const consequence = await preview(actorOf(scene.measurerId), stated());
    const thrown = await commit(actorOf(scene.reviewerId), stated(), consequenceDigest(consequence)).catch((error: unknown) => error);
    expect(refusalCodeOf(thrown)).toBe("PERMISSION_NOT_HELD");
    expect(String((thrown as Error).message)).toContain(AUTHOR_SITE_FACT);
    // The act row and the entry commit in one transaction or neither (L-ACT-01): a door that refused
    // has written nothing at all, which is what the ledger is asked here.
    expect(siteFactRows()).toBe(before);
  });

  it("admits the MEASURER's preview, which is what makes the refusals above about the permission", async () => {
    const consequence = await preview(actorOf(scene.measurerId), stated());
    expect(consequence.actType).toBe(AUTHOR_SITE_FACT);
    expect(consequence.subjects.map((subject) => subject.subjectId)).toEqual(["GROUND_LEVEL"]);
  });
});

describe("L-ACT-03 walked whole: the permission admits, and every role that lacks it is refused", () => {
  for (const [role, bundles] of Object.entries(BUNDLING)) {
    it(`${bundles ? "admits" : "refuses"} a participant holding only ${role}, at authorize() and at the seam`, async () => {
      const userId = holders[role] ?? "";
      const answer = await authorize({ userId, projectId: scene.projectId, permission: AUTHOR_PROJECT_FACT, actType: AUTHOR_SITE_FACT });
      expect(answer.authorized, `${role} is ${bundles ? "" : "not "}a holder of ${AUTHOR_PROJECT_FACT} (L-ACT-03)`).toBe(bundles);

      // The seam is asked the same question about the same act, with a submission nothing but the
      // permission can refuse — so a difference between the two answers would be the door's, not the
      // input's (L-ACT-03: the permission check lives in the act seam).
      const answered = await preview(actorOf(userId), stated()).catch((error: unknown) => error);
      if (bundles) {
        expect((answered as { actType?: string }).actType).toBe(AUTHOR_SITE_FACT);
        return;
      }
      expect(refusalCodeOf(answered)).toBe("PERMISSION_NOT_HELD");
      expect(String((answered as Error).message)).toContain(AUTHOR_SITE_FACT);
      expect(String((answered as Error).message)).toContain(AUTHOR_PROJECT_FACT);
    });
  }
});
