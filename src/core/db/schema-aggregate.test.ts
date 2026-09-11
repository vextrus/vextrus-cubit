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
  "bears",
  "calibrations",
  "campaigns",
  "conventionProfiles",
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
  "memberTypeVariants",
  "memberTypes",
  "memberships",
  "modelCalls",
  "modelFixtures",
  "participantRoleWithdrawals",
  "participantRoles",
  "participants",
  "partitionViews",
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
  "rulesetEditions",
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

/** Every public name the schema module handed out before the split, in code-point order. */
const EXPORTS_BEFORE: readonly string[] = Object.freeze([
  "ACCEPTED_FORMATS",
  "DISPOSITIONS",
  "GRID_AXES",
  "GRID_FAMILIES",
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
  "conventionProfiles",
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
  "memberTypeVariants",
  "memberTypes",
  "memberships",
  "modelCalls",
  "modelFixtures",
  "participantRoleWithdrawals",
  "participantRoles",
  "participants",
  "partitionViews",
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
 */
const COLUMNS_DIGEST_BEFORE = "036e6374ac00feb16f865a180d71179ee1dc23d0893d076f75182d9531a42233";

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
