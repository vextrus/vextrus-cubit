// @vitest-environment node
/**
 * AC-1, AC-2 — the two band arms, run: the yardstick staged by transcription with its site facts
 * ENTERED as acts, the regression INGESTED through the cad CLI, every kind `RAILS` answers measured,
 * the register's own sums graded against each fixture's golden at ±3%/+0%, and every graded cell
 * recorded in the validation ledger (R-TO-035, L-QTY-06, AM-01, AM-06 §1).
 *
 * What a band suite cannot fake once these cases stand: `sums` is the published register's own sums,
 * group for group, scoped to the campaigns the arm opened — so a band that measures every kind and then
 * drops the levels that embarrass it, or that answers a figure no published line adds up to, reds here.
 * Every kind of the golden that `RAILS` answers must actually have been run, and every level of such a
 * cell must be graded or declared ungradable by name — silence is how a band loses a kind. And the
 * grader's verdict for every cell must stand in the ledger, one row per cell, which is where the M3 exit
 * reads it. The over arm is asked of every cell (L-QTY-06 allows +0% over); an UNDER cell is the
 * ledger's record, never a red here (riskNotes, settled).
 *
 * Both arms are staged in ONE file over one scratch database, and every register read is scoped to its
 * own arm's campaigns. It sits in the DATABASE lane, not in V-GOLDEN: that lane's 180 s ceiling belongs
 * to the band suites AC-1 and AC-2 name (AM-10 §1), whose own collection is graded in band-cells.test.ts.
 */
import { afterAll, describe, expect, test } from "vitest";
import { lit } from "../../../db/__tests__/support/live-sql";
import { closeStage, sql } from "../gate/support/gate-stage";
import { BNBC, BNBC_SITE, RCC6, cadConverterVersion, canon, cellKey, siteEvidence } from "./support/band-acceptance";
import { PASS, goldenCells, gradedCells, overLevels, recordAndReadBack, reconcileKindsRun, reconcileWithRegister, stagedArm } from "./support/band-arm";
import { ingestsOfCampaigns, publishedDrawings } from "./support/register-read";

/** The act AM-06 §1 enters a site fact through, and the only one a site-fact row may cite. */
const AUTHOR_SITE_FACT = "AUTHOR_SITE_FACT";

/** The ledger AM-06's entries stand in (inc-304b's, unchanged here). */
const SITE_FACTS = "site_facts";

/** The cells AC-1 and AC-2 fix their arms on, in the product's own spellings. */
const FOOTING_CONCRETE = cellKey("footing", "rcc.concrete");
const SLAB_CONCRETE = cellKey("slab", "rcc.concrete");
const COLUMN_CONCRETE = cellKey("column", "rcc.concrete");

afterAll(async () => {
  await closeStage();
});

/** The verdict the ledger read back for a cell, out of the rows the door answered. */
function ledgerVerdict(rows: readonly Record<string, unknown>[], cell: string): string {
  return String(rows.find((row) => cellKey(String(row["class"] ?? ""), String(row["kind"] ?? "")) === cell)?.["verdict"] ?? "");
}

describe("AC-1: the F-RCC6-BNBC arm — transcribed, entered as acts, measured, graded and recorded", () => {
  test("AC-1: each of the fixture's six site facts is one committed act, and the ledger cites it", async () => {
    await stagedArm(BNBC);
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
    const { band, staged } = await stagedArm(BNBC);
    const version = band.converterVersionOf(staged);
    expect(typeof version === "string" && version.length > 0, "`converterVersionOf` answers a citation — the ledger's column is not null and not empty by law (interfaces)").toBe(true);
    expect(
      version,
      "and for a campaign no ingest read a drawing for, the citation is the cad converter's own pinned version — the instrument that WOULD have read it (riskNotes)",
    ).toBe(cadConverterVersion());
  }, 900_000);

  test("AC-1: the band's sums are the published register's own sums, group for group", async () => {
    await reconcileWithRegister(BNBC);
  }, 900_000);

  test("AC-1: every kind RAILS answers over this golden was run, and every level of such a cell is graded or declared", async () => {
    await reconcileKindsRun(BNBC);
  }, 900_000);

  test("AC-1: FOOTING and SLAB concrete are within the band, and no cell of the yardstick measured over", async () => {
    const { readings, verdicts } = await gradedCells(BNBC);
    expect(readings.size, `the register published gradable levels for cells of ${BNBC}'s golden — a band over nothing proves nothing (L-QTY-06: only under COMPLETE coverage)`).toBeGreaterThan(0);
    expect(overLevels(verdicts), "no cell measured OVER its golden — L-QTY-06 allows +0% over, and an over-measured figure is never a disclosure").toEqual([]);

    for (const cell of [FOOTING_CONCRETE, SLAB_CONCRETE]) {
      const graded = readings.get(cell) ?? [];
      expect(graded.length, `${cell} is graded at levels of ${BNBC}'s golden — the cell AC-1 fixes the arm on (its area suite proves the figures)`).toBeGreaterThan(0);
      expect(
        verdicts.get(cell)?.verdict,
        `${cell} is within the band at every level it was graded at: ${JSON.stringify(graded)} — ±3% under, +0% over, per class, per kind, per level (L-QTY-06, AC-1)`,
      ).toBe(PASS);
    }
  }, 900_000);

  test("AC-1: every graded cell is recorded once in the ledger, and FOOTING and SLAB concrete read back PASS", async () => {
    const { rows, verdicts } = await recordAndReadBack(BNBC);
    for (const cell of [FOOTING_CONCRETE, SLAB_CONCRETE]) {
      expect(verdicts.get(cell)?.verdict, `${cell} was graded PASS over this arm (AC-1)`).toBe(PASS);
      expect(ledgerVerdict(rows, cell), `and the ledger reads back PASS for ${cell} — a cell is validated only on a live PASS (R-TO-035, AC-1)`).toBe(PASS);
    }
  }, 900_000);
});

describe("AC-2: the F-RCC6 arm — ingested through the cad CLI, measured, graded and recorded", () => {
  test("AC-2: the corpus was INGESTED, and the observations cite that ingest's own extractor version", async () => {
    const { band, staged, campaigns } = await stagedArm(RCC6);
    const ingested = ingestsOfCampaigns(campaigns);
    expect(
      ingested.length,
      "an ingest stands for the drawing this arm's lines were read from — F-RCC6 is measured through the cad-CLI ingest path the tree already drives, and a campaign whose lines cite no ingested drawing was transcribed (AC-2, AM-01)",
    ).toBeGreaterThan(0);
    for (const record of ingested) {
      expect(record.toolVersion.length, `the ingest of ${record.drawingId} records the version of the tool that read it (interfaces)`).toBeGreaterThan(0);
    }

    expect(
      ingested.map((record) => record.toolVersion),
      `\`converterVersionOf\` cites the INGEST's own \`extractor_tool_version\` for an ingested campaign — not a pin read off a file, which is only what a TRANSCRIBED campaign may cite (riskNotes); it answered ${JSON.stringify(band.converterVersionOf(staged))}`,
    ).toContain(band.converterVersionOf(staged));

    const drawings = publishedDrawings(campaigns);
    expect(drawings.size, "this arm's register published lines").toBeGreaterThan(0);
    const ingestedDrawings = new Set(ingested.map((record) => record.drawingId));
    expect(
      [...drawings].filter((drawing) => !ingestedDrawings.has(drawing)).sort(),
      "and every published line was read from a drawing an ingest read — a line citing a drawing nobody ingested was measured off an authored member, which is the transcription AC-2 forbids on this arm",
    ).toEqual([]);
  }, 900_000);

  test("AC-2: the band's sums are the published register's own sums, group for group", async () => {
    await reconcileWithRegister(RCC6);
  }, 900_000);

  test("AC-2: every kind RAILS answers over this golden was run, and every level of such a cell is graded or declared", async () => {
    await reconcileKindsRun(RCC6);
  }, 900_000);

  test("AC-2: COLUMN concrete is within the band at every level F-RCC6's golden prints, and no cell measured over", async () => {
    const { readings, verdicts } = await gradedCells(RCC6);
    expect(readings.size, "the register published gradable levels for F-RCC6's cells — the regression arm is measured, not assumed (AM-01)").toBeGreaterThan(0);
    expect(overLevels(verdicts), "no cell of the regression fixture measured OVER its golden — the over arm fails the build (V-GOLDEN, L-QTY-06)").toEqual([]);

    const golden = (await goldenCells(RCC6)).get(COLUMN_CONCRETE) ?? [];
    expect(golden.length, `F-RCC6's golden prints ${COLUMN_CONCRETE} figures to grade against (AC-2)`).toBeGreaterThan(0);
    const graded = readings.get(COLUMN_CONCRETE) ?? [];
    expect(
      graded.map((level) => level.level).sort(),
      `${COLUMN_CONCRETE} is graded at EVERY level the golden prints — a level the register left incomplete is a level AC-2's band was not proved at (L-QTY-06: only under COMPLETE coverage)`,
    ).toEqual(golden.map((level) => level.level).sort());
    expect(
      verdicts.get(COLUMN_CONCRETE)?.levels.map((level) => `${level.level}:${level.verdict}`),
      `and every one of them is inside the band of the golden's own figure: ${JSON.stringify(graded)} (AC-2, L-QTY-06)`,
    ).toEqual(graded.map((level) => `${level.level}:${PASS}`));
    expect(verdicts.get(COLUMN_CONCRETE)?.verdict, "so the cell's verdict is PASS (AC-2)").toBe(PASS);
  }, 900_000);

  test("AC-2: every graded cell of this arm is recorded once, and COLUMN concrete reads back PASS", async () => {
    const { rows, verdicts } = await recordAndReadBack(RCC6);
    expect(verdicts.get(COLUMN_CONCRETE)?.verdict, `${COLUMN_CONCRETE} was graded PASS over this arm (AC-2)`).toBe(PASS);
    expect(
      ledgerVerdict(rows, COLUMN_CONCRETE),
      `and the ledger reads back PASS for ${COLUMN_CONCRETE} — a cell is validated only on a live PASS whose citations are the instruments in force (R-TO-035, AC-2)`,
    ).toBe(PASS);
  }, 900_000);
});
