/**
 * s-settings-site-facts I-527, the read half — who entered each standing fact is the act log's
 * actor for the act the entry cites, read live against a scratch database the committed migrations
 * built (V-DB).
 *
 * What `siteFactActorsOf` has to make true, and what each limb below witnesses:
 *
 *   1. An entry entered through the one act seam names the account that performed it — the actor the
 *      log recorded, not the entry's own row (a ledger row names its act and nothing else).
 *   2. Two facts entered by two people name two people.
 *   3. The read is bounded to the project it is asked about: an act of another project of the same
 *      workspace, cited by a standing handed in, names nobody here.
 *   4. The read is bounded to the workspace by the tenant's own handle: the same act id asked for
 *      under another workspace names nobody (SEAM-TENANT, row-level security).
 *   5. A standing with nothing entered asks the log nothing and answers nothing.
 *
 * Raw SQL is spoken through psql, never a driver import (SEAM-TENANT). Product modules are imported
 * after DATABASE_URL names the scratch database, and by relative path: `@/*` is not resolved here.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../db/__tests__/harness";
import { GUC_SYSTEM_REASON, SEED_REASON } from "../../../db/__tests__/support/fixtures";
import { lit, run, scalar } from "../../../db/__tests__/support/live-sql";

type Acts = typeof import("../../../src/core/acts");
type SiteFactsLaw = typeof import("../../../src/core/site-facts/law");
type SiteFactsServer = typeof import("../../../src/modules/takeoff/site-facts-ui/server");

let scratch: ScratchDb;
let preview: Acts["preview"];
let commit: Acts["commit"];
let consequenceDigest: Acts["consequenceDigest"];
let siteFactsOf: SiteFactsServer["siteFactsOf"];
let siteFactActorsOf: SiteFactsServer["siteFactActorsOf"];
let standingSiteFacts: SiteFactsLaw["standingSiteFacts"];

const AUTHOR_SITE_FACT = "AUTHOR_SITE_FACT" as const;

/** One workspace, two MEASURERs on one project, a second project, and a second workspace. */
const scene = { tenantId: "", otherTenantId: "", surveyorId: "", engineerId: "", projectId: "", otherProjectId: "", otherProjectActId: "" };

function seed(sql: string): string {
  return scalar(scratch.urlMigrate, `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);
}

function seedRun(sql: string): void {
  run(scratch.urlMigrate, `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);
}

function user(name: string, tenantId: string): string {
  const userId = seed(`insert into users (email, password_hash) values (${lit(`${name}-${randomUUID()}@cubit.test`)}, ${lit("not-a-real-hash")}) returning user_id::text;`);
  seedRun(`insert into memberships (tenant_id, user_id) values (${lit(tenantId)}, ${lit(userId)});`);
  return userId;
}

/** One project of a workspace, with each named account a MEASURER on it (L-ACT-03's bundle holds AUTHOR_PROJECT_FACT). */
function project(tenantId: string, name: string, measurers: readonly string[]): string {
  const projectId = seed(`insert into projects (tenant_id, name) values (${lit(tenantId)}, ${lit(name)}) returning project_id::text;`);
  for (const userId of measurers) {
    seedRun(
      `insert into participants (tenant_id, project_id, user_id) values (${lit(tenantId)}, ${lit(projectId)}, ${lit(userId)});
       insert into participant_roles (tenant_id, project_id, user_id, role) values (${lit(tenantId)}, ${lit(projectId)}, ${lit(userId)}, 'MEASURER');`,
    );
  }
  return projectId;
}

/** Enter one fact through the one act seam, as the panel's door does: preview, then commit its digest. */
async function enter(userId: string, fact: string, value: string, note: string): Promise<string> {
  const actor = { tenantId: scene.tenantId, userId, actorKind: "human" as const };
  const input = { type: AUTHOR_SITE_FACT, projectId: scene.projectId, fact, valueAsWritten: value, unitAsWritten: "m", sourceNote: note } as const;
  const shown = await preview(actor, input);
  const written = await commit(actor, input, consequenceDigest(shown));
  return written.actId;
}

beforeAll(async () => {
  scratch = await provisionScratchDb();
  process.env["DATABASE_URL"] = scratch.urlApp;

  scene.tenantId = seed(`insert into tenants (name) values ('Site fact actors') returning tenant_id::text;`);
  scene.otherTenantId = seed(`insert into tenants (name) values ('Another workspace') returning tenant_id::text;`);
  scene.surveyorId = user("surveyor", scene.tenantId);
  scene.engineerId = user("engineer", scene.tenantId);
  scene.projectId = project(scene.tenantId, "Site facts entered by two people", [scene.surveyorId, scene.engineerId]);
  scene.otherProjectId = project(scene.tenantId, "Another project of the workspace", [scene.surveyorId]);
  scene.otherProjectActId = seed(
    `insert into acts (tenant_id, project_id, actor_id, act_type, subjects, consequence_digest)
     values (${lit(scene.tenantId)}, ${lit(scene.otherProjectId)}, ${lit(scene.surveyorId)}, ${lit(AUTHOR_SITE_FACT)}, '["GROUND_LEVEL"]'::jsonb, 'seed-digest')
     returning act_id::text;`,
  );

  ({ preview, commit, consequenceDigest } = (await import("../../../src/core/acts")) as Acts);
  ({ standingSiteFacts } = (await import("../../../src/core/site-facts/law")) as SiteFactsLaw);
  ({ siteFactsOf, siteFactActorsOf } = (await import("../../../src/modules/takeoff/site-facts-ui/server")) as SiteFactsServer);
}, 240_000);

afterAll(async () => {
  const { closePools } = (await import("../../../src/core/db")) as typeof import("../../../src/core/db");
  await closePools();
  await scratch?.drop();
});

describe("I-527: who entered a standing fact is the act log's actor for the act it cites", () => {
  it("names the account that performed each entry's act — two facts, two people", async () => {
    const groundAct = await enter(scene.surveyorId, "GROUND_LEVEL", "-1.2", "Survey sheet S-01");
    const waterAct = await enter(scene.engineerId, "WATER_TABLE", "-3.5", "Borehole log BH-2");

    const scope = { tenantId: scene.tenantId, projectId: scene.projectId };
    const standing = await siteFactsOf(scope);
    expect(standing.GROUND_LEVEL?.actId, "the ledger's entry cites the act that entered it").toBe(groundAct);

    const actors = await siteFactActorsOf(scope, standing);
    expect(actors, "each standing entry's act names its performer, and nothing else is answered").toEqual({
      [groundAct]: scene.surveyorId,
      [waterAct]: scene.engineerId,
    });
  });

  it("is bounded to the project asked about: another project's act names nobody here", async () => {
    const scope = { tenantId: scene.tenantId, projectId: scene.projectId };
    const standing = await siteFactsOf(scope);
    const foreign = standingSiteFacts([
      {
        fact: "BLINDING_THICKNESS",
        valueAsWritten: "75",
        unitAsWritten: "mm",
        canonicalMetres: "0.075",
        sourceNote: "handed in by the test",
        actId: scene.otherProjectActId,
        enteredAt: new Date().toISOString(),
      },
    ]);
    const actors = await siteFactActorsOf(scope, { ...standing, ...foreign });
    expect(Object.keys(actors), "the other project's act is not this project's to name").not.toContain(scene.otherProjectActId);
    expect(Object.keys(actors)).toHaveLength(2);
  });

  it("is bounded to the workspace by the tenant's own handle: asked under another workspace, it names nobody", async () => {
    const standing = await siteFactsOf({ tenantId: scene.tenantId, projectId: scene.projectId });
    const actors = await siteFactActorsOf({ tenantId: scene.otherTenantId, projectId: scene.projectId }, standing);
    expect(actors).toEqual({});
  });

  it("a project with nothing entered asks the log nothing and answers nothing", async () => {
    const scope = { tenantId: scene.tenantId, projectId: scene.otherProjectId };
    const actors = await siteFactActorsOf(scope, await siteFactsOf(scope));
    expect(actors).toEqual({});
  });
});
