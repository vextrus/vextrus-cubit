// @vitest-environment node
/**
 * AC-3 — the validation ledger exists AS DATA: appended through one door, cited in full, and read back
 * forever (R-TO-035, V-GOLDEN, L-QTY-06).
 *
 * V-GOLDEN's "records validation observations" is a claim about a TABLE, not about a log line: a cell
 * is validated only on a live PASS whose citations are the instruments that were in force when it was
 * measured, so every row carries the rule-set edition, its digest, the method hash, the converter
 * version and a closed provenance, and the ledger keeps every row it was ever handed. This drives the
 * module's own door on a live database — the table is observed by what the door writes to it and reads
 * back out of it, never by reading the migration's text.
 *
 * The ledger's OUTLIVED reading (a citation that left force) and its append-only belts are graded by
 * the held-out set; what stands here is the door, the citations and the refusal an unadmitted
 * provenance earns by name.
 */
import { afterAll, describe, expect, test } from "vitest";
import { lit } from "../../../db/__tests__/support/live-sql";
import { closeStage, createProjectThroughDoor, enrol, openSheetsStage, sql, type Person } from "../gate/support/gate-stage";
import {
  DB_ROSTER_MODULE,
  DB_SCHEMA_VALIDATION_MODULE,
  ERRORS_MODULE,
  SCHEMA_VALIDATION_MODULE,
  VALIDATION_OBSERVATIONS,
  VALIDATION_PROVENANCE_UNKNOWN,
  VECTOR,
  productModule,
  recordedAtMs,
  refusalCodeOf,
  said,
  saidText,
  validationDoor,
  type ObservationInput,
  type Scope,
} from "./support/validation-acceptance";

/** The fixture these staged observations are about (AM-01's yardstick). */
const FIXTURE = "rcc6-bnbc";

/** The two cells this criterion appends, in the product's own spellings. */
const FOOTING_CONCRETE = { engine: VECTOR, class: "footing", kind: "rcc.concrete" };
const SLAB_CONCRETE = { engine: VECTOR, class: "slab", kind: "rcc.concrete" };

/** Two readings of the same cell, taken under instruments that differ by their edition digest. */
const FIRST_DIGEST = "d1e7c0a5f3b24689a1c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2c4e6f8a0b2c4";
const SECOND_DIGEST = "e2f8d1b6a4c35790b2d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3d5e7f9a1b3d5";

/** The method hash and converter version a reading cites, and the provenance its golden was authored by. */
const METHOD_HASH = "9f2b1c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809";
const CONVERTER_VERSION = "0.1.0";
const HAND_FROM_AUTHORED_SOURCE = "HAND_FROM_AUTHORED_SOURCE";

/** A provenance nobody registered — prose where the law admits a closed roster (L-QTY-04). */
const NOT_A_PROVENANCE = "SOMEBODY_SAID_SO";

/** One graded level, as the band lane hands the ledger one (FOOTING at FDN, the fixture's own figure). */
const FDN_LEVEL = { level: "FDN", golden: "1.012", measured: "1.012", verdict: "PASS" };

type Stage = { scope: Scope };

let staging: Promise<Stage> | undefined;

/**
 * One workspace and one project, made through the shipped doors. Lazy and memoised: a throwing hook
 * would leave every case skipped, and judge nothing.
 */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    await openSheetsStage();
    const person: Person = await enrol("validation-ledger");
    const projectId = await createProjectThroughDoor(person, "Validation ledger");
    return { scope: { tenantId: person.tenantId, projectId } };
  })());

afterAll(async () => {
  await closeStage();
});

/** One observation, cited in full — the shape `recordObservation` is handed (interfaces). */
function observation(cell: { engine: string; class: string; kind: string }, overrides: Partial<ObservationInput> = {}): ObservationInput {
  return {
    ...cell,
    fixtureId: FIXTURE,
    verdict: "PASS",
    rulesetEdition: "IS1200_IN@1.0.0",
    editionDigest: FIRST_DIGEST,
    methodHash: METHOD_HASH,
    converterVersion: CONVERTER_VERSION,
    provenance: HAND_FROM_AUTHORED_SOURCE,
    levels: [FDN_LEVEL],
    ...overrides,
  };
}

describe("AC-3: the validation ledger is appended, cited and read back", () => {
  test("AC-3: a recorded observation carries every citation, and the ledger answers every row it was handed", async () => {
    const { scope } = await staged();
    const door = await validationDoor();
    const before = (await door.observationsOf(scope)).length;

    const first = await door.recordObservation(scope, observation(FOOTING_CONCRETE));
    expect(typeof first.observationId === "string" && first.observationId.length > 0, "`recordObservation` answers the row it appended (interfaces)").toBe(true);
    const second = await door.recordObservation(scope, observation(SLAB_CONCRETE, { verdict: "UNDER", levels: [{ ...FDN_LEVEL, measured: "0.94", verdict: "UNDER" }] }));
    const third = await door.recordObservation(scope, observation(FOOTING_CONCRETE, { editionDigest: SECOND_DIGEST }));

    const held = await door.observationsOf(scope);
    const ids = held.map((row) => saidText(row, "observationId", "observation_id"));
    for (const appended of [first, second, third]) {
      expect(ids, `every row ever recorded is answered — the ledger is readable forever and never deleted (R-TO-035); ${appended.observationId} is missing`).toContain(appended.observationId);
    }
    expect(ids.length, "and a second reading of one cell is a SECOND ROW — an observation keyed (engine, class, kind) is appended, never overwritten (AC-3)").toBe(before + 3);

    const stamps = held.map((row) => recordedAtMs(row));
    expect(
      stamps.every((stamp, index) => index === 0 || (stamps[index - 1] ?? 0) <= stamp),
      `the rows come back in \`recorded_at\` order — the ledger reads as it was written (AC-3); it answered ${JSON.stringify(stamps)}`,
    ).toBe(true);

    const cited = held.find((row) => saidText(row, "observationId", "observation_id") === first.observationId) ?? {};
    const input = observation(FOOTING_CONCRETE);
    for (const [camel, snake, expected] of [
      ["engine", "engine", input.engine],
      ["class", "class", input.class],
      ["kind", "kind", input.kind],
      ["verdict", "verdict", input.verdict],
      ["fixtureId", "fixture_id", input.fixtureId],
      ["rulesetEdition", "ruleset_edition", input.rulesetEdition],
      ["editionDigest", "edition_digest", input.editionDigest],
      ["methodHash", "method_hash", input.methodHash],
      ["converterVersion", "converter_version", input.converterVersion],
      ["provenance", "provenance", input.provenance],
    ] as const) {
      expect(saidText(cited, camel, snake), `the row cites \`${snake}\` as it was recorded — a validated cell names the instruments in force (R-TO-035, AC-3)`).toBe(expected);
    }
    expect(
      said(cited, "levels", "levels"),
      "and it carries the levels it was graded at, each with its golden, its measured figure and its verdict (L-QTY-06: per class, per kind, per level)",
    ).toEqual([FDN_LEVEL]);
  }, 900_000);

  test("AC-3: a provenance the ledger does not admit is refused by name, and nothing is appended", async () => {
    const { scope } = await staged();
    const door = await validationDoor();
    const before = (await door.observationsOf(scope)).length;

    expect(
      await refusalCodeOf(() => door.recordObservation(scope, observation(FOOTING_CONCRETE, { provenance: NOT_A_PROVENANCE })), "an observation citing a provenance nobody registered"),
      `a provenance outside \`VALIDATION_PROVENANCES\` is ${VALIDATION_PROVENANCE_UNKNOWN} — how a yardstick was authored is a closed roster, never prose (L-QTY-06, L-QTY-04)`,
    ).toBe(VALIDATION_PROVENANCE_UNKNOWN);

    const registry = await productModule<{ REFUSALS: Record<string, { message?: string; remedy?: string; severity?: string; surface?: string } | undefined> }>("src/core/errors.ts");
    const entry = registry.REFUSALS[VALIDATION_PROVENANCE_UNKNOWN];
    expect(entry, `${ERRORS_MODULE} carries ${VALIDATION_PROVENANCE_UNKNOWN} — the area's register is spread into the barrel and never re-declared (AM-11)`).toBeTruthy();
    for (const part of ["message", "remedy", "severity", "surface"] as const) {
      expect(typeof entry?.[part], `and the entry states its ${part}, like every other refusal of the register (L-AI-01)`).toBe("string");
    }

    expect((await door.observationsOf(scope)).length, "a refused observation leaves the ledger where it stood — a row is appended only after the citation is admitted").toBe(before);
  }, 900_000);

  test("AC-3: the ledger stands in the migrated database, tenant-scoped, and the seam enumerates it", async () => {
    const { scope } = await staged();
    const door = await validationDoor();
    await door.recordObservation(scope, observation(FOOTING_CONCRETE));

    const columns = sql(`select column_name from information_schema.columns where table_schema = 'public' and table_name = ${lit(VALIDATION_OBSERVATIONS)} order by column_name;`).map(
      (row) => row[0] ?? "",
    );
    expect(columns.length, `public.${VALIDATION_OBSERVATIONS} stands in the database the product's own migration lane built (AC-3)`).toBeGreaterThan(0);
    expect(columns, `and it carries the columns a citation is made of (AC-3)`).toEqual(
      expect.arrayContaining(["tenant_id", "project_id", "engine", "class", "kind", "verdict", "ruleset_edition", "edition_digest", "method_hash", "converter_version", "provenance", "levels", "recorded_at"]),
    );

    const schema = await productModule<{ VALIDATION_TABLES?: Record<string, unknown>; validationObservations?: unknown }>("src/core/db/schema-validation.ts");
    expect(schema.VALIDATION_TABLES?.["validationObservations"], `${SCHEMA_VALIDATION_MODULE} publishes \`validationObservations\` in \`VALIDATION_TABLES\` — a new area is one spread line (AM-11)`).toBeTruthy();
    const reexport = await productModule<{ validationObservations?: unknown }>("db/schema/validation.ts");
    expect(reexport.validationObservations, `${DB_SCHEMA_VALIDATION_MODULE} re-exports the table, which is how the drift lane sees it (interfaces)`).toBeTruthy();
    const roster = await productModule<{ validationObservations?: unknown }>("src/core/db.ts");
    expect(roster.validationObservations, `${DB_ROSTER_MODULE} names the table in its roster, so the module reaches it through the one seam (SEAM-TENANT)`).toBeTruthy();
  }, 900_000);
});
