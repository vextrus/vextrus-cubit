/**
 * AM-11's live witness for the Author edition door: a caller without AUTHOR_RULE_SET is refused
 * PERMISSION_NOT_HELD, by name, at `authorize()` AND at the act seam — the two places L-ACT-03 says
 * the question is asked ("the permission check lives in the act seam", and AM-11's "each door
 * carries a live-database test proving a caller without the permission is refused").
 *
 * AM-04 is what makes this a door of its own: AUTHOR_RULE_SET is bundled into LEAD and PRINCIPAL and
 * into no other shipped role, so a MEASURER on the very same project — a full participant, with a
 * permission of their own — is the honest counter-example. The last describe walks the whole shipped
 * roster rather than that one example, because "and into no other role" is a claim about all six.
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
let refusalCodeOf: Faults["refusalCodeOf"];

const AUTHOR_RULE_SET = "AUTHOR_RULE_SET" as const;
const AUTHOR_RULESET_EDITION = "AUTHOR_RULESET_EDITION" as const;

/** One workspace, one pinned project, and three people who differ only in the roles they hold. */
const scene = { tenantId: "", leadId: "", measurerId: "", bystanderId: "", projectId: "" };

/**
 * Every shipped role, and whether AM-04 bundles AUTHOR_RULE_SET into it: "into LEAD and PRINCIPAL
 * and into no other shipped role". The roster is walked whole so the door is proven to admit by the
 * permission and by nothing else — a bundle that quietly gained it would fail here by name.
 */
const BUNDLING: Readonly<Record<string, boolean>> = {
  MEASURER: false,
  REVIEWER: false,
  LEAD: true,
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

beforeAll(async () => {
  scratch = await provisionScratchDb();
  process.env["DATABASE_URL"] = scratch.urlApp;

  scene.tenantId = seed(`insert into tenants (name) values ('Ruleset authoring door') returning tenant_id::text;`);
  scene.leadId = person("lead");
  scene.measurerId = person("measurer");
  scene.bystanderId = person("bystander");
  scene.projectId = seed(`insert into projects (tenant_id, name) values (${lit(scene.tenantId)}, 'Authoring door') returning project_id::text;`);
  participant(scene.leadId, "LEAD");
  participant(scene.measurerId, "MEASURER");
  holders["LEAD"] = scene.leadId;
  holders["MEASURER"] = scene.measurerId;
  for (const role of Object.keys(BUNDLING)) {
    if (holders[role] !== undefined) continue;
    const userId = person(role.toLowerCase());
    participant(userId, role);
    holders[role] = userId;
  }

  // The project's pin: a fork of the platform seed the migration minted, which is what the act would
  // fork in turn. The door is refused before it is ever read, so its content does not matter here.
  const seedEditionId = seed(`select edition_id::text from ruleset_editions where scope = 'platform' limit 1;`);
  seedRun(
    `insert into tenant_ruleset_editions (tenant_id, scope, project_id, parent_edition_id, name, version, content_digest, parameters, methods)
     select ${lit(scene.tenantId)}, 'project', ${lit(scene.projectId)}, ${lit(seedEditionId)}, name, version, content_digest, parameters, methods
     from ruleset_editions where edition_id = ${lit(seedEditionId)};`,
  );

  ({ authorize, authorizeOrThrow } = (await import("../../../src/server/authorize")) as Authorize);
  ({ preview } = (await import("../../../src/core/acts")) as Acts);
  ({ refusalCodeOf } = (await import("../../../src/core/faults/refusal-marker")) as Faults);
}, 240_000);

afterAll(async () => {
  const { closePools } = (await import("../../../src/core/db")) as typeof import("../../../src/core/db");
  await closePools();
  await scratch?.drop();
});

/** What the screen states, so both doors are asked the same question about the same act. */
const stated = () => ({ type: AUTHOR_RULESET_EDITION, projectId: scene.projectId, version: "2026.09", values: { openingDeductionMinM2: "0.25" } }) as const;

/**
 * The same act stating no figure at all — a verbatim fork. It is a lawful submission (L-MEA-01: the
 * identity moves and the digest is the parent's by construction), so the only thing that can refuse
 * it here is the permission, which is what makes the roster below about the grant and nothing else.
 */
const verbatim = () => ({ type: AUTHOR_RULESET_EDITION, projectId: scene.projectId, version: "2026.10", values: {} }) as const;

/** The actor context a participant acts in — the human the act log takes as its author (L-ACT-01). */
const actorOf = (userId: string) => ({ tenantId: scene.tenantId, userId, actorKind: "human" as const });

describe("the Author edition door asks for AUTHOR_RULE_SET (AM-04, AM-11)", () => {
  it("admits the LEAD, who is the role AM-04 bundles the permission into", async () => {
    const answer = await authorize({ userId: scene.leadId, projectId: scene.projectId, permission: AUTHOR_RULE_SET, actType: AUTHOR_RULESET_EDITION });
    expect(answer.authorized).toBe(true);
    expect(answer.authorized === true && answer.actor).toEqual({ tenantId: scene.tenantId, userId: scene.leadId, actorKind: "human" });
  });

  it("refuses a MEASURER on the same project — a participant, and a holder of another permission", async () => {
    const answer = await authorize({ userId: scene.measurerId, projectId: scene.projectId, permission: AUTHOR_RULE_SET, actType: AUTHOR_RULESET_EDITION });
    expect(answer.authorized).toBe(false);
    expect(answer.authorized === false && answer.refusal).toBe("PERMISSION_NOT_HELD");
  });

  it("refuses a workspace member who is on the project not at all", async () => {
    const answer = await authorize({ userId: scene.bystanderId, projectId: scene.projectId, permission: AUTHOR_RULE_SET, actType: AUTHOR_RULESET_EDITION });
    expect(answer.authorized === false && answer.refusal).toBe("PERMISSION_NOT_HELD");
  });

  it("carries the act type and the missing permission when the door throws (L-ACT-03)", async () => {
    const thrown = await authorizeOrThrow({
      userId: scene.measurerId,
      projectId: scene.projectId,
      permission: AUTHOR_RULE_SET,
      actType: AUTHOR_RULESET_EDITION,
    }).catch((error: unknown) => error);
    expect(refusalCodeOf(thrown)).toBe("PERMISSION_NOT_HELD");
    expect(String((thrown as Error).message)).toContain(AUTHOR_RULESET_EDITION);
    expect(String((thrown as Error).message)).toContain(AUTHOR_RULE_SET);
  });
});

describe("the act seam asks the same question, and answers it the same way (L-ACT-03)", () => {
  it("refuses a MEASURER's preview by name, before any edition is read", async () => {
    const thrown = await preview({ tenantId: scene.tenantId, userId: scene.measurerId, actorKind: "human" }, stated()).catch((error: unknown) => error);
    expect(refusalCodeOf(thrown)).toBe("PERMISSION_NOT_HELD");
    expect(String((thrown as Error).message)).toContain(AUTHOR_RULE_SET);
  });

  it("admits the LEAD's preview, which is what makes the refusal above about the permission", async () => {
    const consequence = await preview({ tenantId: scene.tenantId, userId: scene.leadId, actorKind: "human" }, stated());
    expect(consequence.actType).toBe(AUTHOR_RULESET_EDITION);
    expect(consequence.subjects.map((subject) => subject.subjectId)).toEqual([scene.projectId]);
  });
});

describe("AM-04 walked whole: the permission admits, and every role that lacks it is refused", () => {
  for (const [role, bundles] of Object.entries(BUNDLING)) {
    it(`${bundles ? "admits" : "refuses"} a participant holding only ${role}, at authorize() and at the seam`, async () => {
      const userId = holders[role] ?? "";
      const answer = await authorize({ userId, projectId: scene.projectId, permission: AUTHOR_RULE_SET, actType: AUTHOR_RULESET_EDITION });
      expect(answer.authorized, `${role} is ${bundles ? "" : "not "}a holder of ${AUTHOR_RULE_SET} (AM-04)`).toBe(bundles);

      // The seam is asked the same question about the same act, with a submission nothing but the
      // permission can refuse — so a difference between the two answers would be the door's, not
      // the input's (L-ACT-03: the permission check lives in the act seam).
      const answered = await preview(actorOf(userId), verbatim()).catch((error: unknown) => error);
      if (bundles) {
        expect((answered as { actType?: string }).actType).toBe(AUTHOR_RULESET_EDITION);
        return;
      }
      expect(answer.authorized === false && answer.refusal).toBe("PERMISSION_NOT_HELD");
      expect(refusalCodeOf(answered)).toBe("PERMISSION_NOT_HELD");
      expect(String((answered as Error).message)).toContain(AUTHOR_RULESET_EDITION);
      expect(String((answered as Error).message)).toContain(AUTHOR_RULE_SET);
    });
  }
});
