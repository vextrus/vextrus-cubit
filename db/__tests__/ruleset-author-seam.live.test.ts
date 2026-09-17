/**
 * L-MEA-01's mint, driven live against a scratch database the committed migrations built (V-DB):
 * "authoring mints a new edition, never updates one".
 *
 * What the store has to make true, and what each limb below witnesses:
 *
 *   1. A commit APPENDS. The creation pin L-REG-07 wrote is still there afterwards, byte for byte,
 *      and the new row names it as its parent — so the lineage is a chain and not a replacement.
 *   2. The project reads the NEWEST project-scope row. That is why `tenant_ruleset_editions_pin_once`
 *      had to become the plain `tenant_ruleset_editions_pin_newest`: a project holds every edition it
 *      has ever minted, and "current" is a question about order, not about uniqueness.
 *   3. The digest keys CONTENT. A value that moved moves it; a verbatim fork does not move it, and
 *      the seam refuses that by name rather than minting a row that changes no figure anybody reads.
 *   4. Identity is (scope, name, version), so a version this project already holds is refused
 *      EDITION_VERSION_TAKEN — a second edition behind one name is two editions nobody can tell apart.
 *
 * Raw SQL is spoken through psql, never a driver import (SEAM-TENANT). Product modules are imported
 * after DATABASE_URL names the scratch database, and by relative path: `@/*` is not resolved here.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { GUC_SYSTEM_REASON, SEED_REASON } from "./support/fixtures";
import { lit, run, scalar } from "./support/live-sql";

type Acts = typeof import("../../src/core/acts");
type Editions = typeof import("../../src/core/rulesets/editions");
type Faults = typeof import("../../src/core/faults/refusal-marker");

let scratch: ScratchDb;
let commit: Acts["commit"];
let consequenceDigest: Acts["consequenceDigest"];
let preview: Acts["preview"];
let projectRulesetView: Editions["projectRulesetView"];
let refusalCodeOf: Faults["refusalCodeOf"];

const AUTHOR_RULESET_EDITION = "AUTHOR_RULESET_EDITION" as const;
const MOVED = "openingDeductionMinM2";

/** One workspace, one LEAD, one project pinned at creation — the state authoring starts from. */
const scene = { tenantId: "", leadId: "", projectId: "", pinEditionId: "", pinDigest: "", pinVersion: "" };

function seed(sql: string): string {
  return scalar(scratch.urlMigrate, `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);
}

function seedRun(sql: string): void {
  run(scratch.urlMigrate, `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);
}

/** The actor every limb acts as: the LEAD, whose bundle AM-04 puts AUTHOR_RULE_SET in. */
const lead = () => ({ tenantId: scene.tenantId, userId: scene.leadId, actorKind: "human" as const });

/** What the screen states: a version, and the decimals under the pin's own parameter keys. */
const stated = (version: string, values: Readonly<Record<string, string>>) =>
  ({ type: AUTHOR_RULESET_EDITION, projectId: scene.projectId, version, values }) as const;

/** Every project-scope edition this project holds, newest last — the ledger, read raw. */
function editionsOfProject(): string[] {
  const rows = seed(
    `select coalesce(string_agg(version || '|' || content_digest || '|' || coalesce(parent_edition_id::text, ''), ',' order by created_at, edition_id), 'none')
     from tenant_ruleset_editions where project_id = ${lit(scene.projectId)} and scope = 'project';`,
  );
  return rows === "none" ? [] : rows.split(",");
}

beforeAll(async () => {
  scratch = await provisionScratchDb();
  process.env["DATABASE_URL"] = scratch.urlApp;

  scene.tenantId = seed(`insert into tenants (name) values ('Ruleset authoring seam') returning tenant_id::text;`);
  scene.leadId = seed(`insert into users (email, password_hash) values (${lit(`lead-${randomUUID()}@cubit.test`)}, ${lit("not-a-real-hash")}) returning user_id::text;`);
  seedRun(`insert into memberships (tenant_id, user_id) values (${lit(scene.tenantId)}, ${lit(scene.leadId)});`);
  scene.projectId = seed(`insert into projects (tenant_id, name) values (${lit(scene.tenantId)}, 'Authoring seam') returning project_id::text;`);
  seedRun(
    `insert into participants (tenant_id, project_id, user_id) values (${lit(scene.tenantId)}, ${lit(scene.projectId)}, ${lit(scene.leadId)});
     insert into participant_roles (tenant_id, project_id, user_id, role) values (${lit(scene.tenantId)}, ${lit(scene.projectId)}, ${lit(scene.leadId)}, 'LEAD');`,
  );

  // The creation pin: a verbatim fork of the platform seed, which is exactly what L-REG-07 writes.
  const seedEditionId = seed(`select edition_id::text from ruleset_editions where scope = 'platform' limit 1;`);
  scene.pinEditionId = seed(
    `insert into tenant_ruleset_editions (tenant_id, scope, project_id, parent_edition_id, name, version, content_digest, parameters, methods)
     select ${lit(scene.tenantId)}, 'project', ${lit(scene.projectId)}, ${lit(seedEditionId)}, name, version, content_digest, parameters, methods
     from ruleset_editions where edition_id = ${lit(seedEditionId)} returning edition_id::text;`,
  );
  scene.pinDigest = seed(`select content_digest from tenant_ruleset_editions where edition_id = ${lit(scene.pinEditionId)};`);
  scene.pinVersion = seed(`select version from tenant_ruleset_editions where edition_id = ${lit(scene.pinEditionId)};`);

  ({ commit, consequenceDigest, preview } = (await import("../../src/core/acts")) as Acts);
  ({ projectRulesetView } = (await import("../../src/core/rulesets/editions")) as Editions);
  ({ refusalCodeOf } = (await import("../../src/core/faults/refusal-marker")) as Faults);
}, 240_000);

afterAll(async () => {
  const { closePools } = (await import("../../src/core/db")) as typeof import("../../src/core/db");
  await closePools();
  await scratch?.drop();
});

describe("authoring mints a new edition and never updates one (L-MEA-01, R-SPINE-012)", () => {
  it("previews the fork as a Consequence naming the pin it is forked from", async () => {
    const consequence = await preview(lead(), stated("2026.09", { [MOVED]: "0.25" }));
    expect(consequence.rendering).toBe("SUBJECTS");
    const subject = consequence.subjects[0];
    expect(subject?.subjectId).toBe(scene.projectId);
    // Identity and digest stand beside one another on both sides, and neither substitutes for the
    // other: the reader confirms the version they are minting AND the content it fingerprints.
    expect(subject?.before).toEqual([expect.stringContaining(scene.pinVersion) as unknown as string, scene.pinDigest]);
    expect(subject?.after?.[0]).toContain("2026.09");
    expect(subject?.after?.[1]).not.toBe(scene.pinDigest);
    // A preview writes nothing.
    expect(editionsOfProject()).toHaveLength(1);
  });

  it("commits by APPENDING a row whose parent is the pin, which is left exactly as it was", async () => {
    const input = stated("2026.10", { [MOVED]: "0.25" });
    const consequence = await preview(lead(), input);
    const written = await commit(lead(), input, consequenceDigest(consequence));
    expect(written.actId).not.toBe("");

    const held = editionsOfProject();
    expect(held).toHaveLength(2);
    // The creation pin still stands, with its own digest and no parent of this workspace's.
    expect(held[0]?.startsWith(`${scene.pinVersion}|${scene.pinDigest}|`)).toBe(true);
    // …and the minted edition names it as its parent (L-REG-07's chain, one step longer).
    expect(held[1]?.split("|")[0]).toBe("2026.10");
    expect(held[1]?.split("|")[2]).toBe(scene.pinEditionId);
    // The digest keys content, so the value that moved moved it.
    expect(held[1]?.split("|")[1]).not.toBe(scene.pinDigest);
  });

  it("makes the project READ the newest project-scope row, and carries its lineage with it", async () => {
    const view = await projectRulesetView({ tenantId: scene.tenantId, projectId: scene.projectId });
    expect(view.pinned).toBe(true);
    if (!view.pinned) return;
    expect(view.identity.version).toBe("2026.10");
    expect(view.parameters[MOVED]).toEqual({ value: "0.25", unit: "m2" });
    // Units, keys and methods are the pin's: authoring states values and copies the rest (I-265).
    expect(Object.keys(view.parameters)).toHaveLength(17);
    // platform → project (the creation pin) → project (the minted edition).
    expect(view.lineage.map((step) => step.scope)).toEqual(["platform", "project", "project"]);
  });

  it("refuses a version this project already holds (EDITION_VERSION_TAKEN)", async () => {
    const thrown = await preview(lead(), stated("2026.10", { [MOVED]: "0.3" })).catch((error: unknown) => error);
    expect(refusalCodeOf(thrown)).toBe("EDITION_VERSION_TAKEN");
    expect(editionsOfProject()).toHaveLength(2);
  });

  it("refuses a verbatim fork by name: a row that changes no figure is no act (ACT_CHANGES_NOTHING)", async () => {
    const thrown = await preview(lead(), stated("2026.11", {})).catch((error: unknown) => error);
    expect(refusalCodeOf(thrown)).toBe("ACT_CHANGES_NOTHING");
    expect(editionsOfProject()).toHaveLength(2);
  });

  it("refuses a commit carrying a digest the current state does not produce (CONSEQUENCES_NOT_CARRIED)", async () => {
    const input = stated("2026.12", { [MOVED]: "0.4" });
    const stale = consequenceDigest(await preview(lead(), stated("2026.12", { [MOVED]: "0.5" })));
    const thrown = await commit(lead(), input, stale).catch((error: unknown) => error);
    expect(refusalCodeOf(thrown)).toBe("CONSEQUENCES_NOT_CARRIED");
    expect(editionsOfProject()).toHaveLength(2);
  });
});
