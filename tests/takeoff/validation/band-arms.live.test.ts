// @vitest-environment node
/**
 * AC-1, AC-2 — the two band arms, run: the yardstick staged by transcription with its site facts
 * ENTERED as acts, the regression staged through the cad CLI, and both graded against their fixture's
 * own golden at ±3%/+0% (R-TO-035, L-QTY-06, AM-01, AM-06 §1).
 *
 * What a band suite claims is a claim about the PRODUCT's figures, so it is made here of the register
 * the gate published: every cell of the fixture's golden with a gradable level is graded level by
 * level, the over arm is asked of every cell (L-QTY-06 allows +0% over, and an over-measured figure is
 * never a disclosure), and the cells the criteria fix — FOOTING and SLAB concrete on F-RCC6-BNBC,
 * COLUMN concrete on F-RCC6 — must come back PASS. An UNDER cell is the ledger's record and the M3
 * exit's reading, never a red here (riskNotes, settled).
 *
 * Both fixtures are staged in ONE file, and the file sits in the DATABASE lane beside the validation
 * module's own acceptance rather than under `tests/golden/`: the band arms this increment ships are the
 * suites V-GOLDEN's 180 s ceiling is spent on (AM-10 §1), and a second staging of both fixtures does
 * not belong in that budget — one scratch database, in the lane that already opens one.
 *
 * Nothing here is transcribed: every figure comes from the fixture's own files.
 */
import { afterAll, describe, expect, test } from "vitest";
import { lit } from "../../../db/__tests__/support/live-sql";
import { closeStage, sql } from "../gate/support/gate-stage";
import { validationLaw } from "./support/validation-acceptance";
import { BNBC, BNBC_SITE, RCC6, bandStage, cadConverterVersion, canon, cellKey, siteEvidence, type BandStage, type CellLevel } from "./support/band-acceptance";

/** The act AM-06 §1 enters a site fact through, and the only one a site-fact row may cite. */
const AUTHOR_SITE_FACT = "AUTHOR_SITE_FACT";

/** The ledger AM-06's entries stand in (inc-304b's, unchanged here). */
const SITE_FACTS = "site_facts";

/** The cells AC-1 and AC-2 fix their arms on, in the product's own spellings. */
const FOOTING_CONCRETE = cellKey("footing", "rcc.concrete");
const SLAB_CONCRETE = cellKey("slab", "rcc.concrete");
const COLUMN_CONCRETE = cellKey("column", "rcc.concrete");

const PASS = "PASS";
const OVER = "OVER";

/** What `measureBand` answers: the register's own sums, keyed the way a cell's levels are keyed. */
type MeasuredBand = { sums: Map<string, string> };

/** One fixture's arm, staged and measured once for this file. */
type Arm = { band: BandStage; staged: unknown; measured: MeasuredBand };

const arms = new Map<string, Promise<Arm>>();

/**
 * Stage and measure one fixture's arm, once. Lazy rather than a hook: a module this increment has not
 * landed yet must fail the CASE that wanted it, by name — a throwing hook leaves every case skipped,
 * and judges nothing.
 */
function arm(fixtureId: string): Promise<Arm> {
  const held = arms.get(fixtureId);
  if (held !== undefined) return held;
  const opening = (async (): Promise<Arm> => {
    const band = await bandStage();
    const staged = fixtureId === BNBC ? await band.stageBnbcBand() : await band.stageRcc6Band();
    const measured = (await band.measureBand(staged)) as MeasuredBand;
    expect(measured.sums instanceof Map, `measureBand over ${fixtureId} answers \`sums\` keyed 'class|kind|level' (interfaces)`).toBe(true);
    return { band, staged, measured };
  })();
  arms.set(fixtureId, opening);
  return opening;
}

afterAll(async () => {
  await closeStage();
});

/** The levels of one cell that the register published a COMPLETE sum for — the gradable ones. */
function gradableLevels(measured: MeasuredBand, key: string, levels: readonly CellLevel[]): { level: string; golden: string; measured: string }[] {
  const found: { level: string; golden: string; measured: string }[] = [];
  for (const level of levels) {
    const sum = measured.sums.get(`${key}|${level.level}`);
    if (sum === undefined) continue;
    found.push({ level: level.level, golden: level.golden, measured: sum });
  }
  return found;
}

/** Every cell of a fixture's golden, with the levels the register can be graded at. */
async function gradedArm(fixtureId: string): Promise<{ cells: Map<string, { level: string; golden: string; measured: string }[]>; verdicts: Map<string, { verdict: string; levels: readonly { level: string; verdict: string }[] }> }> {
  const [{ band, measured }, law] = await Promise.all([arm(fixtureId), validationLaw()]);
  const cells = new Map<string, { level: string; golden: string; measured: string }[]>();
  const verdicts = new Map<string, { verdict: string; levels: readonly { level: string; verdict: string }[] }>();
  for (const [key, levels] of band.goldenCellsOf(fixtureId)) {
    const gradable = gradableLevels(measured, key, levels);
    if (gradable.length === 0) continue;
    cells.set(key, gradable);
    verdicts.set(key, law.gradeCell(gradable));
  }
  return { cells, verdicts };
}

/** Every level of every cell that measured OVER its golden, named as the band suite must name one. */
function overLevels(verdicts: Map<string, { levels: readonly { level: string; verdict: string }[] }>): string[] {
  const found: string[] = [];
  for (const [key, graded] of verdicts) {
    for (const level of graded.levels) if (level.verdict === OVER) found.push(`OVER ${key.replace("|", " ")} ${level.level}`);
  }
  return found.sort();
}

describe("AC-1: the F-RCC6-BNBC arm — transcribed, entered as acts, and inside the band", () => {
  test("AC-1: each of the fixture's six site facts is one committed act, and the ledger cites it", async () => {
    await arm(BNBC);
    const stated = Object.values(siteEvidence().facts);
    const { exact } = await canon();
    const normalise = (figure: string): string => exact(figure).toString();

    const entries = sql(`select project_id::text, fact, value_as_written, act_id::text from ${SITE_FACTS} order by project_id, fact;`).map((row) => ({
      projectId: row[0] ?? "",
      fact: row[1] ?? "",
      valueAsWritten: row[2] ?? "",
      actId: row[3] ?? "",
    }));
    expect(entries.length, `the staged band entered the site facts of ${BNBC_SITE} — earthwork is unpriceable until they stand (AM-06 §1, L-MEA-06)`).toBeGreaterThan(0);

    const actTypes = new Map(sql(`select act_id::text, type from acts;`).map((row) => [row[0] ?? "", row[1] ?? ""]));
    const projects = [...new Set(entries.map((entry) => entry.projectId))];
    for (const projectId of projects) {
      const held = entries.filter((entry) => entry.projectId === projectId);
      expect(held.length, `project ${projectId} holds one entry per fact ${BNBC_SITE} states — the six figures of the fixture's site, and no fewer (AC-1)`).toBe(stated.length);
      expect(
        held.map((entry) => actTypes.get(entry.actId) ?? "no act of this log"),
        `every entry cites an ${AUTHOR_SITE_FACT} act — a fact entered past the act seam is not an entry (AM-06 §1: "every entry is an act with a source note")`,
      ).toEqual(held.map(() => AUTHOR_SITE_FACT));
      expect(new Set(held.map((entry) => entry.actId)).size, `and ONE act per fact — never a single act carrying the six (AC-1: one ${AUTHOR_SITE_FACT} act per fact)`).toBe(held.length);
      expect(held.map((entry) => normalise(entry.valueAsWritten)).sort(), `and the figures entered are the fixture's own, transcribed from ${BNBC_SITE} and never derived (L-QTY-06)`).toEqual(
        stated.map(normalise).sort(),
      );
    }

    const authored = Number(sql(`select count(*)::text from acts where type = ${lit(AUTHOR_SITE_FACT)};`)[0]?.[0] ?? "0");
    expect(authored, `the act log holds ${stated.length} ${AUTHOR_SITE_FACT} acts for every project the band staged facts on (AC-1)`).toBe(projects.length * stated.length);
  }, 900_000);

  test("AC-1: a transcribed campaign cites the cad converter's own version, never an empty citation", async () => {
    const { band, staged } = await arm(BNBC);
    const version = band.converterVersionOf(staged);
    expect(typeof version === "string" && version.length > 0, "`converterVersionOf` answers a citation — the ledger's column is not null and not empty by law (interfaces)").toBe(true);
    expect(
      version,
      "and for a campaign no ingest read a drawing for, the citation is the cad converter's own pinned version — the instrument that WOULD have read it (riskNotes)",
    ).toBe(cadConverterVersion());
  }, 900_000);

  test("AC-1: FOOTING and SLAB concrete are within the band, and no cell of the yardstick measured over", async () => {
    const { cells, verdicts } = await gradedArm(BNBC);
    expect(cells.size, `the register published gradable levels for cells of ${BNBC}'s golden — a band over nothing proves nothing (L-QTY-06: only under COMPLETE coverage)`).toBeGreaterThan(0);

    expect(overLevels(verdicts), "no cell measured OVER its golden — L-QTY-06 allows +0% over, and an over-measured figure is never a disclosure").toEqual([]);

    for (const key of [FOOTING_CONCRETE, SLAB_CONCRETE]) {
      const graded = cells.get(key) ?? [];
      expect(graded.length, `${key} is graded at levels of ${BNBC}'s golden — the cell AC-1 fixes the arm on (its area suite proves the figures)`).toBeGreaterThan(0);
      expect(
        verdicts.get(key)?.verdict,
        `${key} is within the band at every level it was graded at: ${JSON.stringify(graded)} — ±3% under, +0% over, per class, per kind, per level (L-QTY-06, AC-1)`,
      ).toBe(PASS);
    }
  }, 900_000);
});

describe("AC-2: the F-RCC6 arm — ingested through the cad CLI, and inside the band", () => {
  test("AC-2: COLUMN concrete is within the band at every level F-RCC6's golden prints, and no cell measured over", async () => {
    const { cells, verdicts } = await gradedArm(RCC6);
    expect(cells.size, "the register published gradable levels for F-RCC6's cells — the regression arm is measured, not assumed (AM-01)").toBeGreaterThan(0);

    expect(overLevels(verdicts), "no cell of the regression fixture measured OVER its golden — the over arm fails the build (V-GOLDEN, L-QTY-06)").toEqual([]);

    const { band } = await arm(RCC6);
    const golden = band.goldenCellsOf(RCC6).get(COLUMN_CONCRETE) ?? [];
    expect(golden.length, `F-RCC6's golden prints ${COLUMN_CONCRETE} figures to grade against (AC-2)`).toBeGreaterThan(0);
    const graded = cells.get(COLUMN_CONCRETE) ?? [];
    expect(
      graded.map((level) => level.level).sort(),
      `${COLUMN_CONCRETE} is graded at EVERY level the golden prints — a level the register left incomplete is a level AC-2's band was not proved at (L-QTY-06: only under COMPLETE coverage)`,
    ).toEqual(golden.map((level) => level.level).sort());
    expect(
      verdicts.get(COLUMN_CONCRETE)?.levels.map((level) => `${level.level}:${level.verdict}`),
      `and every one of them is inside the band of the golden's own figure: ${JSON.stringify(graded)} (AC-2, L-QTY-06)`,
    ).toEqual(graded.map((level) => `${level.level}:${PASS}`));
    expect(verdicts.get(COLUMN_CONCRETE)?.verdict, "so the cell's verdict is PASS — which is what the ledger records for it (AC-2)").toBe(PASS);
  }, 900_000);
});
