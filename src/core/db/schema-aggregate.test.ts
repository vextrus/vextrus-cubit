// @vitest-environment node
/**
 * The split proof for the tenant seam's schema (AM-11, SEAM-TENANT, B-05, B-19).
 *
 * AM-11 moves 59 tables out of one 2,345-line file and into one file per area — flat siblings of
 * `schema.ts`, because SEAM-TENANT's lint rule allowlists the driver in `src/core/db.ts` and ONE
 * level under `src/core/db/` and nothing deeper — leaving `schema.ts` as the schema that ENUMERATES
 * those files and spreads their groups into `SEAM_SCHEMA`. The claim is that the typed surface did
 * not move: the same tables, under the same keys, with the same SQL names and the same columns.
 *
 * TABLES_BEFORE and EXPORTS_BEFORE are baselines, deliberately transcribed: a derivation cannot catch
 * a table or a public name the split dropped. An increment that lands a table re-baselines them in
 * its own commit and says so (B-19, B-20). EXPORTS_BEFORE is asserted as a SUBSET rather than an
 * equality on purpose — the split adds the areas' own `*_TABLES` handles, which are how `SEAM_SCHEMA`
 * is enumerated, and a star re-export that silently dropped an ambiguous name is exactly what the
 * subset direction catches.
 *
 * The columns are held to by DIGEST rather than by transcription: the sha-256 over each key, its SQL
 * table name and its column names in code-point order. A column renamed or lost on the way into an
 * area file changes it; a split that changed nothing does not. Columns are read off drizzle's own
 * table objects through their symbols rather than through the ORM's `_` escape, which SEAM-TENANT
 * bans outside the seam and this file is not inside (a co-located `.test.ts` is never allowlisted).
 *
 * Modules are loaded by absolute path — the contract this tree's other split proofs use: a module the
 * product does not provide yet fails as an assertion naming the file, never as a resolution error.
 *
 * Re-baselined for ONE ADDED table and nothing else: `placementOutlines` (`placement_outlines`,
 * db/migrations/0059_placement-outlines.sql), the plan the ring a member was placed by ENCLOSES — one
 * row per ring-placed placement: its geometry (a rectangle or a polygon), its shoelace area, its
 * perimeter and a rectangle's own two sides, in the unit the ring was read in and cited to the ring
 * (Interpretation I-333, L-FRM-02) — so a foundation is measured over the plan the drawing drew and
 * never over a bounding box. Both rosters gain the one key, in code-point order, and the columns
 * digest moves with them because the surface it hashes gained a table. Nothing already on either
 * roster moved; the previous digest was 4ee17c4350f985251ad06254a7050b69db32b33b91623c34b18c46db8c4e0fe4.
 *
 * Re-baselined before that for ONE ADDED table and nothing else: `memberTypeDimensions` (`member_type_dimensions`,
 * db/migrations/0058_member-type-dimensions.sql), the dimensions a schedule states for a member
 * type BESIDE its section — one row per (variant, dimension): a pile's diameter and its length, read
 * off the pile schedule's own cells in the unit its head states (Interpretation I-322, AM-06 §2). A
 * schedule's NOS column is not among them: it is corroboration placement reads, and is stored
 * nowhere (R-TO-031). Both rosters gain the one key, in code-point order, and the columns digest
 * moves with them because the surface it hashes gained a table. Nothing already on either roster
 * moved; the previous digest was 67ccfde82c100befbf5ea691e5e2677974a40dc895b4856bbba95002c7b41c8d.
 *
 * Re-baselined before that for ONE ADDED table and nothing else: `noteClauseProposals` (`note_clause_proposals`),
 * the offers a model made of the general-note clauses the grammar read nothing in — one row per
 * clause of an ingest, carrying the class proposed, the grammar's own figure for it and the ledger
 * call that made it, so TRANSCRIBE_SHEET_NOTES can judge what was kept against what was offered
 * (R-TO-034, L-AI-02, L-AI-03). Both rosters gain the one key, in code-point order, and the columns
 * digest moves with them because the surface it hashes gained a table. Nothing already on either
 * roster moved; the previous digest was f3e45a1f899709c8d0161b0a3750d9c8d3e2cc1ce8d3afe93579b2ea1345fa4a.
 *
 * Re-baselined before that for ONE ADDED table and nothing else: `barRows` (`bar_rows`), L-REG-04's bill of
 * bars — one content-keyed row per (member, role, diameter, group), carrying the three BS 8666
 * lengths AM-01 names side by side and what the bar weighs (L-FRM-05). Both rosters gain the one
 * key, in code-point order, and the columns digest moves with them because the surface it hashes
 * gained a table. Nothing already on either roster moved.
 *
 * Re-baselined before that for ONE ADDED table and nothing else: `placementRuns` (`placement_runs`), the runs the
 * partition reads for a beam or tie beam — one row per placement, holding the clear it measures and
 * the slab adjoining each of its two sides (L-MEA-09). Both rosters gain the one key, in code-point
 * order, and the columns digest moves with them because the surface it hashes gained a table. Nothing
 * already on either roster moved: no table left, none was renamed, and no column of an existing table
 * changed — which is the claim the digest is here to hold, and the reason it is re-stated rather than
 * derived (B-19, B-20).
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/** The checkout this suite runs against. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The schema: the module `src/core/db.ts` takes every table from. */
const SCHEMA = "src/core/db/schema.ts";

/** Where the areas keep their own tables — flat siblings, one level under the seam's directory. */
const AREA_DIR = "src/core/db";

/** Code-point order — the only order this tree sorts a roster by (L-REG-05). */
const byCodePoint = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

/** Every table the typed surface covered before AM-11 moved a line, in code-point order. */
const TABLES_BEFORE: readonly string[] = Object.freeze([
  "acts",
  "authAttempts",
  "authTokens",
  "barRows",
  "bears",
  "calibrations",
  "campaigns",
  "conditions",
  "conventionProfiles",
  "documents",
  "drawingSetMembers",
  "drawingSetRevisions",
  "drawingSets",
  "drawings",
  "expansionDeferrals",
  "files",
  "gridDeferrals",
  "grids",
  "ingests",
  "invitations",
  "levels",
  "manualMeasurements",
  "memberTypeDimensions",
  "memberTypeVariants",
  "memberTypes",
  "memberships",
  "modelCallOutcomes",
  "modelCalls",
  "modelFixtures",
  "noteClauseProposals",
  "notesReadings",
  "participantRoleWithdrawals",
  "participantRoles",
  "participants",
  "partitionRebuilds",
  "partitionViews",
  "placementOutlines",
  "placementRuns",
  "placementUnnamedPairs",
  "placements",
  "projects",
  "proposedLevels",
  "quantityLines",
  "queueItemResolutions",
  "queueItems",
  "railObservations",
  "rebarZones",
  "refusedSightings",
  "registerAttributes",
  "registerObjects",
  "registerObservations",
  "repudiatedObjects",
  "roomConfirmations",
  "roomOutlines",
  "rulesetEditions",
  "scaleAffirmations",
  "scheduleCells",
  "scheduleDeferrals",
  "schedulePrintedQuantities",
  "schedules",
  "scopeDeclarations",
  "sessions",
  "sheetDisciplines",
  "sheetRasters",
  "sheetUnderstandingDispositions",
  "siteFacts",
  "storeyHeightReadings",
  "tenantRulesetEditions",
  "tenants",
  "typicalRanges",
  "uploads",
  "userPrefs",
  "users",
  "viewAssignments",
  "viewTypeConfirmations",
  "wallOpenings",
  "wallRuns",
  "workItems",
]);

/** Every public name the schema module handed out before the split, in code-point order. */
const EXPORTS_BEFORE: readonly string[] = Object.freeze([
  "ACCEPTED_FORMATS",
  "DISPOSITIONS",
  "GRID_AXES",
  "GRID_FAMILIES",
  "MODEL_OUTCOMES",
  "RASTER_TIERS",
  "REBAR_ZONES",
  "SCAN_VERDICTS",
  "SEAM_SCHEMA",
  "SECTION_UNITS",
  "UPLOAD_CHUNK_BYTES",
  "UPLOAD_MAX_BYTES",
  "UPLOAD_STATES",
  "WORKSPACE_ROLES",
  "acts",
  "authAttempts",
  "authTokens",
  "bears",
  "calibrations",
  "campaigns",
  "conditions",
  "conventionProfiles",
  "documents",
  "drawingSetMembers",
  "drawingSetRevisions",
  "drawingSets",
  "drawings",
  "expansionDeferrals",
  "files",
  "gridDeferrals",
  "grids",
  "ingests",
  "invitations",
  "isAcceptedFormat",
  "levels",
  "manualMeasurements",
  "memberTypeDimensions",
  "memberTypeVariants",
  "memberTypes",
  "memberships",
  "modelCallOutcomes",
  "modelCalls",
  "modelFixtures",
  "participantRoleWithdrawals",
  "participantRoles",
  "participants",
  "partitionViews",
  "placementOutlines",
  "placementRuns",
  "placementUnnamedPairs",
  "placements",
  "projects",
  "proposedLevels",
  "quantityLines",
  "queueItems",
  "railObservations",
  "rebarZones",
  "refusedSightings",
  "registerAttributes",
  "registerObjects",
  "registerObservations",
  "repudiatedObjects",
  "roomConfirmations",
  "roomOutlines",
  "rulesetEditions",
  "rulesetScope",
  "scaleAffirmations",
  "scheduleCells",
  "scheduleDeferrals",
  "schedules",
  "scopeDeclarations",
  "sessions",
  "sheetDisciplines",
  "sheetRasters",
  "sheetUnderstandingDispositions",
  "storeyHeightReadings",
  "tenantRulesetEditions",
  "tenants",
  "typicalRanges",
  "uploads",
  "userPrefs",
  "users",
  "viewAssignments",
  "viewTypeConfirmations",
  "workItems",
]);

/**
 * The sha-256 over each key, its SQL table name and its column names in code-point order — the shape
 * half of the same baseline. Re-baselined with TABLES_BEFORE, and never on its own.
 *
 * Re-baselined for TWO ADDED tables and nothing else, the MANUAL area's (./schema-manual.ts,
 * db/migrations/0062_manual-measurements.sql, session 8 S1): `conditions`, a project's named recipes a
 * QS measures with (R-TO-041, I-374), and `manualMeasurements` (`manual_measurements`), what one
 * RECORD_MANUAL_MEASUREMENT act recorded against the register row it stands at — the recipe as
 * applied, the exact traced geometry with each point's basis, the view, the scale and the figure
 * (R-TO-040, I-378, I-385, I-387). Both rosters gain the two keys, in code-point order, and the columns
 * digest moves with them because the surface it hashes gained two tables. Nothing already on either
 * roster moved; the previous digest was b13158317d2befe08cc4b784cf44a3e01940220df9cec2546efc101c49452ed3.
 *
 * Re-baselined for FIVE ADDED COLUMNS on one standing table and NO table at all — `placements`
 * (./schema-takeoff-placements.ts) gains `note_key`, `note_text`, `note_from_label`, `note_to_label`
 * and `note_shape`, the plan note a placement was read with (Interpretation I-303, db/migrations/
 * 0056_member-note-and-circular-column.sql). A plan note that names a mark is evidence about that
 * MEMBER: the member it names is not one of the plan's typical, so it is not expanded by the view's
 * authored typical range but stands on the level the plan draws, or over the range its own note
 * states. It is stored on the row rather than re-read because the partition is built two ways —
 * `rebuild` reads the drawing, `reexpand` reads only these rows — and a reading living in one of them
 * would give the two a different answer for the same drawing (B-17). Every one is nullable, so not a
 * standing row moved and no backfill was owed. TABLES_BEFORE is untouched — 65 keys before and after,
 * the assertion above holds unedited — no table's SQL name moved, and no existing column of any table
 * changed; the previous digest was
 * d5bc069b60d597f717e9a2c7942ef84f88a349083c2138308691f3234e8edcce.
 *
 * Re-baselined before that for ONE ADDED TABLE and TWO ADDED COLUMNS, the ledger's outcome column and what the
 * model said of its answer (./schema-model.ts, session 4's Jev programme, L-AI-01, L-AI-02):
 * `modelCallOutcomes` — one append-only row per person's judgment of a proposed call, CONFIRMED,
 * OVERRULED, REPUDIATED or AFFIRMED, keyed to the call by the composite (tenant, call) key — and on
 * `model_calls` the nullable `question` (the closed question the call put, by name) and `judgment`
 * (the provider's own confidence and probabilities, json). The roster grew by that one key — 64
 * tables to 65 — and not one existing table's SQL name or existing column moved; the previous digest
 * was fa85b87ab493abf90c3b60c50dc6417a793f21cf10fa47913a389f074b35c3ae.
 *
 * Re-baselined before that for ONE ADDED TABLE and nothing else, `partitionRebuilds`
 * (./schema-takeoff-views.ts): the marker one drawing's partition rebuild leaves behind, keyed by
 * (tenant, ingest), so a drawing whose rebuild read no class at all is still known to have been
 * rebuilt rather than read as unpartitioned (L-CAD-08, L-REG-04). The roster grew by that one key —
 * 63 tables to 64 — and not one existing table's SQL name or column moved with it; the previous
 * digest was 9f909eb434d10e2a907f6cae8da705d0a4e0ffcfd2ab0a008fbd88e25e41cfe4.
 *
 * Re-baselined before that for ONE ADDED TABLE and nothing else, `barRows` (./schema-rebar.ts): the campaign's
 * bill of bars, keyed by content and replaced whole on every measurement (L-REG-04, L-FRM-05). The
 * roster grew by that one key — 62 tables to 63 — and not one existing table's SQL name or column
 * moved with it; the previous digest was
 * a3ca8bc39f20771fb84ebaa151e990c7b74a955a63815fab4a0e71521f3eb6b1.
 *
 * Re-baselined before that for ONE ADDED table and nothing else: `documents` (./schema-docs.ts), the
 * issued documents SEAM-DOC renders and stores — one row per issue, chained by `superseded_by`
 * (R-SPINE-040). The roster grew by that one key — 61 tables to 62 — and not one existing table's
 * SQL name or column moved with it; the previous digest was
 * a2b7fcaf4077b8db7bcb296769c806e451a3fb7405775690586442187cbe1d89.
 *
 * Re-baselined before that for FOUR COLUMN MOVES and no table at all, each one a store change the sweep's own
 * migration (db/migrations/0047_src-core-debt-sweep.sql) lands: `append_seq` joins
 * `drawing_set_revisions`, `scale_affirmations` and `storey_height_readings`, which is how those
 * three ledgers say which write came last (L-REG-04); and `calibrations` gives up `project_id`,
 * `drawing_id`, `ingest_id` and `act_id`, because a calibration is the content address of what it
 * says and a column its key does not cover names one record on a row a second record shares
 * (L-MEA-05). The roster of tables did not change — 61 keys before and after, the assertion above
 * holds unedited — and no table's SQL name moved; the previous digest was
 * 7ec5d140c545e3db8ed1ba274e6576d154f0b5a56c4ae909bf8a5bade814f6e7.
 *
 * Re-baselined before that for ONE ADDED table and nothing else: `siteFacts` (./schema-foundations.ts), the
 * project-scoped append-only ledger a person enters a SITE fact into — an existing ground level, a
 * working allowance — that no drawing states (L-MEA-06, L-FRM-04). The roster grew by that one key —
 * 60 tables to 61 — and not one existing table's SQL name or column moved with it; the previous
 * digest was 1ac7cb4dc110be065d1e878aaf436aea5bcfeea5b669446704e199f55033393e.
 *
 * Re-baselined before that for ONE ADDED table and nothing else: `placementRuns` (./schema-frame.ts), the runs
 * the frame rails read off a placement and report as their own rows (L-MEA-09). The roster grew by
 * that one key — 59 tables to 60 — and not one existing table's SQL name or column moved with it;
 * the previous digest was c2ad361648f0d3eee7ac6137fa7cf4e1f2adf5153060e6f26ed98c8f2fda679d.
 *
 * Re-baselined before that for ONE ADDED table and nothing else: `notesReadings` (./schema-takeoff-schedules.ts),
 * where `TRANSCRIBE_SHEET_NOTES` writes the figures a person read off a sheet's general notes —
 * one row per (sheet, kind, actor, source key), basis TRANSCRIBED, accepted-as-proposed or edited
 * (R-TO-034, L-QTY-01). The roster grew by that one key — 58 tables to 59 — and not one existing
 * table's SQL name or column moved with it; the previous digest was
 * 036e6374ac00feb16f865a180d71179ee1dc23d0893d076f75182d9531a42233.
 */
/* Re-baselined at integration (session 8, wave 2) for migration 0063's ADDED table schedule_printed_quantities (ARCH-3) and 0064's three ADDED trace-identity columns on ingests (trace_tool, trace_tool_version, trace_parameter_set_hash; M4P-1), after S1's conditions and manual_measurements (0062); no standing column moved or was dropped (checked against the three migrations' ALTER TABLE statements). Previous: 924641ab4c940a753c3dff37a6708f4934d9d37280ee1b54686ccc62c96a2167. */
/*
 * Re-baselined for ARCH-4's migration 0067 (s-takeoff I-592, I-593): TWO ADDED tables of the new
 * takeoff-walls area (./schema-takeoff-walls.ts) — `wall_runs`, a brick wall's axis, its WALL TYPES
 * thickness and its length, and `wall_openings`, an opening in a wall's gap — and ONE ADDED nullable
 * column on a standing table, `placements.layout_name`, the sheet a wall-lane placement was read on.
 * No standing column moved or was dropped (checked against 0067's one ALTER TABLE, an ADD COLUMN).
 * Previous: 5f170ef3ac542934fc21073fd47e21ea14f86152500b61e06f1d382f2c2bfcc8.
 */
/*
 * Re-baselined for FRM4-AD's migration 0068 (I-613): ONE ADDED table of the frame area
 * (./schema-frame.ts) — `placement_unnamed_pairs`, the pairs of edge lines a plan draws as a framed
 * member that no mark names, stored per ingest with the placements so the residue can enumerate
 * them. No standing column moved or was dropped (0068 holds one CREATE TABLE and no ALTER TABLE).
 * Previous: d7fa4c5ad9adac03a5f03cf8860a178dbf6516f7597a4e953979682b569740a1.
 */
/*
 * Re-baselined for ARCH-5's migration (0069 at integration) (s-takeoff I-643): ONE ADDED table of the new
 * takeoff-rooms area (./schema-takeoff-rooms.ts) — `room_outlines`, the rooms an architect's plan
 * encloses, with their status, reason, outline, area and the surfaces each registered. No standing
 * table or column moved or was dropped (0068 is one CREATE TABLE and its index).
 * Landed after FRM4-AD's 0068; the digest below is re-frozen over both at integration.
 */
/* Re-frozen at integration over FRM4-AD's 0068 and ARCH-5's 0069 together (two ADDED tables, placement_unnamed_pairs and room_outlines; no standing column moved). Previous: 552432fe94b491d765b8727354eda7a0df8e8c000ce8135d34db7cebad9963c1. */
/* Re-frozen at integration for N1's migration 0070: one ADDED nullable column, notes_readings.scope_class (s-schedules I-652), and its CHECK; no table joined or left, no standing column moved. Previous: f98a517c100638ebb045c24accc5d537462e1eb21761fbcfa5c167599448854c. */
/* Re-frozen for M4P-2's migration 0072: one ADDED nullable column, partition_views.page (s-drawings I-681), and its CHECK; no table joined or left, no standing column moved. Previous: 9f07016395df9ee6ca8e06956a5183bc82c23ac3380be51ddf1c222c9a5d2c6f. */
/* Re-frozen at integration (session 9, wave 3d): the migrations that landed with it add tables/columns only (the drift lane holds the rest). Previous: 1180fa16160b1434d875ace1be8893d4d86aaf2c655a59a07ac7593b060c45e3. */
const COLUMNS_DIGEST_BEFORE = "fe8df7f65a3d549e32e23f06e6940a6dca57218bc1bab1a7e8f4c5e7e641cb8d";

/** One drizzle table as this file reads one: its SQL name, and the SQL names of its columns. */
function shapeOf(table: unknown): { table: string; columns: string[] } {
  const held = table as Record<symbol, unknown>;
  const symbols = Object.getOwnPropertySymbols(held);
  const nameSymbol = symbols.find((symbol) => {
    const spelling = String(symbol);
    return spelling.includes("Name") && !spelling.includes("Original") && !spelling.includes("Schema") && !spelling.includes("Base");
  });
  const columnsSymbol = symbols.find((symbol) => String(symbol).includes("Columns") && !String(symbol).includes("Extra"));
  const columns = columnsSymbol === undefined ? {} : (held[columnsSymbol] as Record<string, { name: string }>);
  return {
    table: nameSymbol === undefined ? "?" : String(held[nameSymbol]),
    columns: Object.values(columns)
      .map((column) => column.name)
      .sort(byCodePoint),
  };
}

/** The canonical text a digest is taken over: nothing about layout, only what each table is. */
function canonical(tables: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(
    Object.keys(tables)
      .sort(byCodePoint)
      .map((key) => {
        const shape = shapeOf(tables[key]);
        return [key, shape.table, shape.columns];
      }),
  );
}

async function moduleAt(relative: string): Promise<Record<string, unknown>> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — the split does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as Record<string, unknown>;
}

/** The groups the areas publish: one `*_TABLES` per `schema-<area>.ts`, read off the disk (B-19). */
async function areaGroups(): Promise<{ file: string; group: Readonly<Record<string, unknown>> }[]> {
  const abs = join(REPO_ROOT, AREA_DIR);
  const names = readdirSync(abs).filter((name) => /^schema-[a-z-]+\.ts$/.test(name) && !name.endsWith(".test.ts"));
  expect(names.length, `${AREA_DIR} holds no \`schema-<area>.ts\` — AM-11 puts each area's tables in its own file there`).toBeGreaterThan(0);
  const found: { file: string; group: Readonly<Record<string, unknown>> }[] = [];
  for (const name of names.sort(byCodePoint)) {
    const file = `${AREA_DIR}/${name}`;
    const mod = await moduleAt(file);
    for (const exported of Object.keys(mod).sort(byCodePoint)) {
      if (exported.endsWith("_TABLES")) found.push({ file, group: mod[exported] as Readonly<Record<string, unknown>> });
    }
  }
  return found;
}

describe("AM-11: the schema is the areas, enumerated — and the typed surface did not move", () => {
  test("SEAM_SCHEMA covers exactly the tables it covered before the split", async () => {
    const mod = await moduleAt(SCHEMA);
    const seam = mod["SEAM_SCHEMA"] as Readonly<Record<string, unknown>>;
    expect(
      Object.keys(seam).sort(byCodePoint),
      "a table left the typed surface or joined it by accident — a table the drift lane can see and the seam cannot is a table nothing typed can reach (B-05)",
    ).toEqual([...TABLES_BEFORE]);
  });

  test("every table keeps its SQL name and its columns", async () => {
    const mod = await moduleAt(SCHEMA);
    const seam = mod["SEAM_SCHEMA"] as Readonly<Record<string, unknown>>;
    const digest = createHash("sha256").update(canonical(seam)).digest("hex");
    expect(
      digest,
      "a table's SQL name or a column changed on its way into an area file — the store is what the migrations built, and a move does not edit it (SEAM-TENANT, B-05)",
    ).toBe(COLUMNS_DIGEST_BEFORE);
  });

  test("the schema still hands out every public name it handed out before", async () => {
    const mod = await moduleAt(SCHEMA);
    const held = new Set(Object.keys(mod));
    const missing = EXPORTS_BEFORE.filter((name) => !held.has(name));
    expect(
      missing,
      "a name the schema published is gone — every importer of `@/core/db` reads these through it, and a star re-export drops an ambiguous name without a word (ARCH-02, B-17)",
    ).toEqual([]);
  });

  test("the areas partition the surface: no table twice, and none SEAM_SCHEMA does not cover", async () => {
    const groups = await areaGroups();
    const claimedBy = new Map<string, string>();
    const twice: string[] = [];
    for (const { file, group } of groups) {
      for (const name of Object.keys(group)) {
        const first = claimedBy.get(name);
        if (first !== undefined) twice.push(`${name}: ${first} and ${file}`);
        else claimedBy.set(name, file);
      }
    }
    expect(twice, "two areas declare one table — a table has one home, and the spread would silently pick a winner (ARCH-02, B-17)").toEqual([]);
    expect(
      [...claimedBy.keys()].sort(byCodePoint),
      "the areas together declare a different set than the seam covers — an area file `schema.ts` forgot to enumerate reads exactly like this (B-19)",
    ).toEqual([...TABLES_BEFORE]);
  });

  test("SEAM_SCHEMA holds the areas' own table objects rather than copies of them", async () => {
    const mod = await moduleAt(SCHEMA);
    const seam = mod["SEAM_SCHEMA"] as Readonly<Record<string, unknown>>;
    const copies: string[] = [];
    for (const { file, group } of await areaGroups()) {
      for (const [name, table] of Object.entries(group)) {
        if (seam[name] !== table) copies.push(`${name} (${file})`);
      }
    }
    expect(copies, "the typed surface holds something other than the very table its area declared — a second table object is a second table (SEAM-TENANT, B-17)").toEqual([]);
  });
});
