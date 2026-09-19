/**
 * PUBLIC ACCEPTANCE — AC-2 (inc-304b-site-facts-panel): L-ACT-02's pair for AUTHOR_SITE_FACT,
 * driven live against a scratch database the committed migrations built (V-DB).
 *
 * What the pair has to make true, and what each limb below witnesses:
 *
 *   1. A PREVIEW is a typed Consequence computed by the committing code path: one subject per fact,
 *      `before` what the ledger stands at and `after` the canon's own figure for what was written —
 *      the figure `siteFactWrite` makes, asked of the law here rather than transcribed (B-17).
 *   2. Its EFFECTS name the lines that would re-derive: the project's stored earthwork quantity
 *      lines, and nothing else it happens to hold. A project with none states the empty list rather
 *      than omitting the slot.
 *   3. A COMMIT appends. One act row, one site_facts row, the row naming the act — and a restatement
 *      appends a SECOND row rather than editing the first (L-ACT-01, R-TO-051): the standing is
 *      derived from the rows at read time, so `standingSiteFacts` answers with the latest.
 *   4. The digest is the guard: a digest the current state does not produce is
 *      `CONSEQUENCES_NOT_CARRIED` and writes nothing (L-ACT-02).
 *   5. A malformed entry is refused BEFORE any row exists, by the law's own names — an entry with no
 *      source note is `SITE_FACT_SOURCE_UNSTATED` (AM-06 §1), a reading in a unit the canon carries
 *      no length factor for is `UNIT_UNMAPPED` (L-FRM-06).
 *
 * THE KIND SPELLINGS (verifier's objection, recorded here because a test may not assert a spelling
 * the tree does not carry): the spec's interfaces name the earthwork kinds
 * `["earthwork.excavation", "earthwork.blinding"]`. `earthwork.blinding` is in no roster of this
 * tree — the foundations rail measures `earthwork.excavation` and `pcc.blinding`
 * (`src/modules/takeoff/rails/foundations.ts`, `src/core/catalogue/kinds.ts`), and `quantity_lines`
 * carries a CHECK over `KINDS`, so a row of the spelled kind cannot exist. The RULE the criterion
 * states — the lines that re-derive are the project's excavation and blinding lines, and not its
 * other lines — is what is asserted, against the two kinds the rail actually holds.
 *
 * WHERE THIS FILE LIVES. AC-2 names it `db/__tests__/site-facts-act.live.test.ts`; it stands here
 * instead, beside the module it judges, on the engine's placement ruling for this increment. The
 * lane is unchanged: the unit config collects no suite that reaches the live-database seeds, and
 * `db/__tests__/vitest.config.ts` collects every suite that does, wherever it lives — so this is
 * still `pnpm test:db`'s, and `pnpm test` still opens no database (the split is proved by
 * tests/toolchain/test-lane-split.test.ts).
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
type Faults = typeof import("../../../src/core/faults/refusal-marker");

let scratch: ScratchDb;
let preview: Acts["preview"];
let commit: Acts["commit"];
let consequenceDigest: Acts["consequenceDigest"];
let siteFactWrite: SiteFactsLaw["siteFactWrite"];
let standingSiteFacts: SiteFactsLaw["standingSiteFacts"];
let refusalCodeOf: Faults["refusalCodeOf"];

const AUTHOR_SITE_FACT = "AUTHOR_SITE_FACT" as const;
const GROUND_LEVEL = "GROUND_LEVEL";

/** The reading this walk enters, and the note it was read from (AM-06 §1: every entry carries one). */
const READING = { value: "-1.2", unit: "m", note: "Survey sheet S-01" } as const;

/**
 * The restatement: the same fact, read again off a later sheet — an entry, never an edit.
 *
 * It is written in MILLIMETRES deliberately. A reading stated in metres is its own canonical figure
 * (`convert(v, "m", "m")` is `v`), so a Consequence that carried the value AS WRITTEN would be
 * indistinguishable from one that carried the canon's. In millimetres the two differ, and the
 * assertions below can say which one the act computed (L-QTY-03, L-FRM-06).
 */
const RESTATED = { value: "-1200", unit: "mm", note: "Survey sheet S-02" } as const;

/**
 * One workspace, one MEASURER, and two projects: the one this walk enters a fact on — which also
 * holds published quantity lines — and a bare one, which is what makes "[] for a project with none"
 * a reading rather than an assumption.
 */
const scene = { tenantId: "", measurerId: "", projectId: "", bareProjectId: "", excavationLineId: "", blindingLineId: "", concreteLineId: "" };

function seed(sql: string): string {
  return scalar(scratch.urlMigrate, `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);
}

function seedRun(sql: string): void {
  run(scratch.urlMigrate, `set ${GUC_SYSTEM_REASON} = ${lit(SEED_REASON)};\n${sql}`);
}

/** The actor every limb acts as: the MEASURER, whose bundle L-ACT-03 puts AUTHOR_PROJECT_FACT in. */
const measurer = () => ({ tenantId: scene.tenantId, userId: scene.measurerId, actorKind: "human" as const });

/** What the panel states at the seam, for one fact of one project. */
const stated = (projectId: string, reading: { value: string; unit: string; note: string }, fact: string = GROUND_LEVEL) =>
  ({ type: AUTHOR_SITE_FACT, projectId, fact, valueAsWritten: reading.value, unitAsWritten: reading.unit, sourceNote: reading.note }) as const;

/** One project of this workspace, with the MEASURER participating on it. */
function project(name: string): string {
  const projectId = seed(`insert into projects (tenant_id, name) values (${lit(scene.tenantId)}, ${lit(name)}) returning project_id::text;`);
  seedRun(
    `insert into participants (tenant_id, project_id, user_id) values (${lit(scene.tenantId)}, ${lit(projectId)}, ${lit(scene.measurerId)});
     insert into participant_roles (tenant_id, project_id, user_id, role) values (${lit(scene.tenantId)}, ${lit(projectId)}, ${lit(scene.measurerId)}, 'MEASURER');`,
  );
  return projectId;
}

/** One published quantity line of a kind, on the project's one campaign — the gate's own row shape. */
function publishedLine(campaignId: string, revisionId: string, kind: string, objectKey: string): string {
  return seed(
    `insert into quantity_lines
       (tenant_id, campaign_id, project_id, set_revision_id, object_key, drawing_id, view_key, class, kind, rule_id, rule_version,
        edition_digest, engine, quantity_basis, selection_basis, coverage, value, unit, formula, bindings, selectors, deductions, omitted, calibration_keys)
     values (${lit(scene.tenantId)}, ${lit(campaignId)}, ${lit(scene.projectId)}, ${lit(revisionId)}, ${lit(objectKey)}, gen_random_uuid(), 'plan',
        'footing', ${lit(kind)}, 'seed-rule', '1', 'seed-edition-digest', 'VECTOR', 'MEASURED', 'MEASURED', 'COMPLETE', '1.0', 'm3',
        'seeded line', '{}'::json, '{}'::json, '[]'::json, '[]'::json, '[]'::json)
     returning line_id::text;`,
  );
}

/** One appended entry as the ledger holds it — the shape `standingSiteFacts` derives a standing from. */
type LedgerRow = {
  fact: string;
  valueAsWritten: string;
  unitAsWritten: string;
  canonicalMetres: string;
  sourceNote: string;
  actId: string;
  enteredAt: string;
};

/** Every site-fact row of the walked project, oldest first — the ledger, read raw as the store reads it. */
function ledgerRows(projectId: string = scene.projectId): LedgerRow[] {
  const json = seed(
    `select coalesce(json_agg(json_build_object(
              'fact', fact, 'valueAsWritten', value_as_written, 'unitAsWritten', unit_as_written,
              'canonicalMetres', canonical_metres, 'sourceNote', source_note, 'actId', act_id::text, 'enteredAt', entered_at)
            order by entered_at, site_fact_id)::text, '[]')
     from site_facts where tenant_id = ${lit(scene.tenantId)} and project_id = ${lit(projectId)};`,
  );
  return JSON.parse(json) as LedgerRow[];
}

/** Every act of the walked project, by type — what the seam wrote, counted where it was written. */
function actsOfType(actType: string): string[] {
  const ids = seed(
    `select coalesce(string_agg(act_id::text, ',' order by occurred_at, act_id), '')
     from acts where tenant_id = ${lit(scene.tenantId)} and project_id = ${lit(scene.projectId)} and act_type = ${lit(actType)};`,
  );
  return ids === "" ? [] : ids.split(",");
}

beforeAll(async () => {
  scratch = await provisionScratchDb();
  process.env["DATABASE_URL"] = scratch.urlApp;

  scene.tenantId = seed(`insert into tenants (name) values ('Site facts act') returning tenant_id::text;`);
  scene.measurerId = seed(
    `insert into users (email, password_hash) values (${lit(`measurer-${randomUUID()}@cubit.test`)}, ${lit("not-a-real-hash")}) returning user_id::text;`,
  );
  seedRun(`insert into memberships (tenant_id, user_id) values (${lit(scene.tenantId)}, ${lit(scene.measurerId)});`);
  scene.projectId = project("Site facts walk");
  scene.bareProjectId = project("Site facts, nothing measured");

  // The published lines the act's effects are read over: one campaign of the walked project, holding
  // an excavation line, a blinding line and a concrete line. The concrete line is the control — it is
  // the same project, the same campaign and a line all the same, and it must not re-derive.
  const pinAct = seed(
    `insert into acts (tenant_id, project_id, actor_id, act_type, subjects, consequence_digest)
     values (${lit(scene.tenantId)}, ${lit(scene.projectId)}, ${lit(scene.measurerId)}, 'PIN_DRAWING_SET', '[]'::jsonb, 'seed-digest') returning act_id::text;`,
  );
  const setId = seed(
    `insert into drawing_sets (tenant_id, project_id, name, created_by)
     values (${lit(scene.tenantId)}, ${lit(scene.projectId)}, 'Seed set', ${lit(scene.measurerId)}) returning set_id::text;`,
  );
  const revisionId = seed(
    `insert into drawing_set_revisions (tenant_id, set_id, project_id, digest, manifest, act_id)
     values (${lit(scene.tenantId)}, ${lit(setId)}, ${lit(scene.projectId)}, 'seed-revision-digest', '[]'::json, ${lit(pinAct)}) returning set_revision_id::text;`,
  );
  const campaignId = seed(
    `insert into campaigns (tenant_id, project_id, set_revision_id, edition_id, edition_digest, catalogue_digest, level_stack_digest, status, act_id)
     values (${lit(scene.tenantId)}, ${lit(scene.projectId)}, ${lit(revisionId)}, gen_random_uuid(), 'seed-edition-digest', 'seed-catalogue-digest',
             'seed-level-digest', 'OPEN', ${lit(pinAct)}) returning campaign_id::text;`,
  );
  scene.excavationLineId = publishedLine(campaignId, revisionId, "earthwork.excavation", "footing/F1");
  scene.blindingLineId = publishedLine(campaignId, revisionId, "pcc.blinding", "footing/F2");
  scene.concreteLineId = publishedLine(campaignId, revisionId, "rcc.concrete", "footing/F3");

  ({ preview, commit, consequenceDigest } = (await import("../../../src/core/acts")) as Acts);
  ({ siteFactWrite, standingSiteFacts } = (await import("../../../src/core/site-facts/law")) as SiteFactsLaw);
  ({ refusalCodeOf } = (await import("../../../src/core/faults/refusal-marker")) as Faults);
}, 240_000);

afterAll(async () => {
  const { closePools } = (await import("../../../src/core/db")) as typeof import("../../../src/core/db");
  await closePools();
  await scratch?.drop();
});

/** The canon's own figure for a reading — what the Consequence's `after` says, asked of the law. */
const canonical = (reading: { value: string; unit: string; note: string }): string =>
  siteFactWrite({ fact: GROUND_LEVEL, valueAsWritten: reading.value, unitAsWritten: reading.unit, sourceNote: reading.note }).canonicalMetres;

/** The millimetre reading and the metres it carries to are different strings — which is the point. */
const CARRIED_FROM_MM = (): string => canonical(RESTATED);

describe("AC-2: the preview is a typed Consequence over one subject, with the earthwork lines it moves", () => {
  it("AC-2: names the act, the rendering, and exactly one subject standing at nothing", async () => {
    const consequence = await preview(measurer(), stated(scene.projectId, READING));
    expect(consequence.actType).toBe(AUTHOR_SITE_FACT);
    expect(consequence.rendering, "one fact judged is a subject list (L-ACT-02)").toBe("SUBJECTS");
    expect(consequence.subjects.map((subject) => ({ subjectId: subject.subjectId, before: [...subject.before], after: [...subject.after] })), "one act per fact (AM-06 §1)").toEqual([
      { subjectId: GROUND_LEVEL, before: [], after: [canonical(READING)] },
    ]);
  });

  it("AC-2: effects.linesRederiving is the project's earthwork lines, code-point sorted, and nothing else", async () => {
    const consequence = await preview(measurer(), stated(scene.projectId, READING));
    const earthwork = [scene.excavationLineId, scene.blindingLineId].sort();
    expect(consequence.effects?.linesRederiving, "the lines whose bindings read site facts are the ones that re-derive (R-TO-020)").toEqual(earthwork);
    expect(consequence.effects?.linesRederiving, "a concrete line of the same campaign reads no site fact, so it does not move").not.toContain(scene.concreteLineId);
    expect(consequence.effects?.signaturesVoiding, "an entered fact voids no signature: the slot is stated empty, never absent").toEqual([]);
  });

  it("AC-2: a project with no measured lines states the empty list rather than omitting the slot", async () => {
    const consequence = await preview(measurer(), stated(scene.bareProjectId, READING));
    expect(consequence.effects?.linesRederiving).toEqual([]);
    expect(consequence.effects?.signaturesVoiding).toEqual([]);
  });
});

describe("AC-2: the commit appends the act and the entry in one transaction (L-ACT-01, AM-06 §1)", () => {
  it("AC-2: writes one act and one site_facts row, the row naming the act that entered it", async () => {
    const consequence = await preview(measurer(), stated(scene.projectId, READING));
    const written = await commit(measurer(), stated(scene.projectId, READING), consequenceDigest(consequence));

    expect(actsOfType(AUTHOR_SITE_FACT), "one entry is one act").toEqual([written.actId]);
    const rows = ledgerRows();
    expect(rows.length, "one act, one appended entry").toBe(1);
    expect(rows[0]).toMatchObject({
      fact: GROUND_LEVEL,
      valueAsWritten: READING.value,
      unitAsWritten: READING.unit,
      canonicalMetres: canonical(READING),
      sourceNote: READING.note,
      actId: written.actId,
    });
  });

  it("AC-2: a restatement appends a second row — never an update — and the standing reads the latest", async () => {
    const consequence = await preview(measurer(), stated(scene.projectId, RESTATED));
    expect(consequence.subjects[0]?.before, "the digest binds what the fact stood at when it was previewed").toEqual([canonical(READING)]);

    // The reading is in millimetres, so what the Consequence carries says whether the act asked the
    // canon at all: `after` is the metres the canon made of it, never the figure the person typed.
    expect(consequence.subjects[0]?.after, "the subject's `after` is siteFactWrite's own canonical metres").toEqual([CARRIED_FROM_MM()]);
    expect(consequence.subjects[0]?.after, "…and not the reading as written, which a millimetre entry is not (L-QTY-03)").not.toEqual([RESTATED.value]);

    const written = await commit(measurer(), stated(scene.projectId, RESTATED), consequenceDigest(consequence));
    const rows = ledgerRows();
    expect(rows.length, "the ledger is append-only: a correction is another entry (R-TO-051)").toBe(2);
    expect(rows[1]).toMatchObject({ valueAsWritten: RESTATED.value, sourceNote: RESTATED.note, actId: written.actId });

    const standing = standingSiteFacts(rows);
    expect(standing[GROUND_LEVEL]?.valueAsWritten, "what the fact stands at is the latest entry of it").toBe(RESTATED.value);
    expect(standing[GROUND_LEVEL]?.actId).toBe(written.actId);
    expect(standing[GROUND_LEVEL]?.canonicalMetres, "the ledger holds the canon's figure beside the reading (L-QTY-03)").toBe(CARRIED_FROM_MM());
    expect(actsOfType(AUTHOR_SITE_FACT).length, "two entries are two acts").toBe(2);

    // What the fact NOW stands at, read back through a further preview: the standing a Consequence
    // binds is the canonical figure, not the millimetre string the last entry was written in.
    const next = await preview(measurer(), stated(scene.projectId, READING));
    expect(next.subjects[0]?.before, "`before` is what the ledger stands at, in metres").toEqual([CARRIED_FROM_MM()]);
    expect(next.subjects[0]?.before, "…never the reading as written of the entry that set it").not.toEqual([RESTATED.value]);
  });

  it("AC-2: a digest the current state does not produce refuses CONSEQUENCES_NOT_CARRIED and writes nothing", async () => {
    const before = ledgerRows().length;
    const elsewhere = await preview(measurer(), stated(scene.bareProjectId, READING));

    const thrown = await commit(measurer(), stated(scene.projectId, READING), consequenceDigest(elsewhere)).catch((error: unknown) => error);
    expect(refusalCodeOf(thrown)).toBe("CONSEQUENCES_NOT_CARRIED");
    expect(ledgerRows().length, "a refused commit appends nothing").toBe(before);
    expect(actsOfType(AUTHOR_SITE_FACT).length, "…and writes no act either: both or neither (L-ACT-01)").toBe(2);
  });
});

describe("AC-2: a malformed entry is refused at preview, before any row exists (AM-06 §1, L-FRM-06)", () => {
  it("AC-2: an entry whose source note says nothing is SITE_FACT_SOURCE_UNSTATED", async () => {
    const before = ledgerRows().length;
    const thrown = await preview(measurer(), stated(scene.projectId, { value: "-1.2", unit: "m", note: "   " })).catch((error: unknown) => error);
    expect(refusalCodeOf(thrown)).toBe("SITE_FACT_SOURCE_UNSTATED");
    expect(ledgerRows().length).toBe(before);
  });

  it("AC-2: a reading the canon carries no length factor for is UNIT_UNMAPPED", async () => {
    const before = ledgerRows().length;
    const thrown = await preview(measurer(), stated(scene.projectId, { value: "-1.2", unit: "kg", note: READING.note })).catch((error: unknown) => error);
    expect(refusalCodeOf(thrown)).toBe("UNIT_UNMAPPED");
    expect(ledgerRows().length).toBe(before);
  });
});
