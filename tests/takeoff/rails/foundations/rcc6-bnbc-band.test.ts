/**
 * AC-6 — F-RCC6-BNBC's foundations, measured through the shipped doors and reconciled with the
 * golden takeoff per (class, kind, level) (AM-01, L-QTY-02, L-QTY-06, R-TO-035).
 *
 * The campaign is real: a workspace, a project pinned to an edition citing this shard's seven
 * methods, one register object per foundation member of the fixture's own model, the SITE facts of
 * the fixture's own site file entered through `writeSiteFact` and read back through `siteFactsOf`,
 * every rail of this leaf run over those rows, and one batch handed to the gate.
 *
 * What is graded is L-QTY-06's band per cell: three per cent under the competent manual takeoff, and
 * never over it. The cells are the golden's own — derived from the file, never a list typed here —
 * and the comparand is the golden's figure read as the PRINTED figure it is (a file that writes
 * 1.012 measured something in [1.0115, 1.0125]; the yardstick is the takeoff, not the string).
 *
 * A cell whose lines are not all COMPLETE is not in the band at all: L-QTY-06 judges only under
 * COMPLETE coverage. Those cells are named instead — every BNBC pile cap is drawn as a polygon, so
 * its pit and its blinding defer by name (L-FRM-04) — and the set of them is asserted to be exactly
 * that, so a cell that quietly stopped measuring cannot hide among the deferrals.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  BLINDING_PLAN_DEFERRED,
  BNBC_FIXTURE,
  BNBC_MODEL,
  BNBC_SITE,
  EARTHWORK_EXCAVATION,
  EARTHWORK_PLAN_DEFERRED,
  FOOTING,
  GOLDEN_CLASS,
  GOLDEN_KIND,
  MILLIMETRE,
  PCC_BLINDING,
  PILE,
  PILE_CAP,
  PILING_BORED,
  PILING_BORING,
  PRISM_POLY,
  PRISM_RECT,
  RCC_CONCRETE,
  SITE_FILE_KEY,
  UNDER_TOLERANCE,
  canon,
  closeStage,
  evaluate,
  goldenCell,
  goldenFigure,
  modelMembers,
  modelSiteFacts,
  publishedByCell,
  railBatchOf,
  stageFoundationsCampaign,
  type CellReading,
  type FoundationsStage,
  type ModelMember,
  type StagedFact,
  type StagedMember,
  type VerdictShape,
} from "./support/foundations-stage";

/** How the model spells a class this leaf measures, and the product's own spelling of it. */
const CLASS_OF: Readonly<Record<string, string>> = Object.freeze({ FOOTING, PILE_CAP, PILE });

/** The five kinds a foundation cell is keyed by (test contract: `GOLDEN_KIND`). */
const KINDS: readonly string[] = [RCC_CONCRETE, PILING_BORED, PILING_BORING, EARTHWORK_EXCAVATION, PCC_BLINDING];

/** The cells the criterion names as deferred, with the code each defers under (L-FRM-04). */
const DEFERRED: Readonly<Record<string, string>> = Object.freeze({
  [`${PILE_CAP}|${EARTHWORK_EXCAVATION}`]: EARTHWORK_PLAN_DEFERRED,
  [`${PILE_CAP}|${PCC_BLINDING}`]: BLINDING_PLAN_DEFERRED,
});

/** One member of the model, as this leaf stages it — the model's own statements, in millimetres. */
function stagedFrom(member: ModelMember): StagedMember {
  const dimensions: Record<string, string> = {};
  for (const name of ["depth", "top", "dia", "length"] as const) {
    const stated = member[name];
    if (stated !== undefined) dimensions[name] = String(stated);
  }
  return {
    id: member.id,
    class: CLASS_OF[member.class] as string,
    mark: member.mark,
    source: BNBC_MODEL,
    section: member.geom === PRISM_RECT && member.l !== undefined && member.b !== undefined ? { l: String(member.l), b: String(member.b) } : undefined,
    outline:
      member.geom === PRISM_POLY && member.area !== undefined
        ? { type: PRISM_POLY, area: String(member.area) }
        : member.geom === PRISM_RECT && member.area !== undefined
          ? { type: PRISM_RECT, area: String(member.area), length: String(member.l), breadth: String(member.b) }
          : undefined,
    dimensions,
  };
}

/** The SITE facts the fixture's own site file states, as they are written (L-MEA-06). */
function factsFrom(): StagedFact[] {
  const stated = modelSiteFacts(BNBC_SITE);
  const entered: StagedFact[] = [];
  for (const [fact, key] of Object.entries(SITE_FILE_KEY)) {
    const written = stated[key];
    expect(written, `${BNBC_SITE} states ${key} — the fact ${fact} is entered from it`).toBeTruthy();
    entered.push({ fact, valueAsWritten: String(written), unitAsWritten: MILLIMETRE, sourceNote: `${BNBC_SITE}: ${key}, as the general notes state it` });
  }
  return entered;
}

let stage: FoundationsStage;
let verdict: VerdictShape;
let cells: Map<string, CellReading>;
let members: StagedMember[];

let staging: Promise<void> | undefined;

/**
 * The corpus, staged and measured once, and awaited by every case.
 *
 * Lazy rather than a hook on purpose: a module the Builder has not written yet must fail the CASE
 * that needed it, by name — a throwing hook leaves every case skipped, and judges nothing.
 */
const staged = (): Promise<void> =>
  (staging ??= (async () => {
    members = modelMembers(BNBC_MODEL)
      .filter((member) => CLASS_OF[member.class] !== undefined)
      .map(stagedFrom);
    expect(members.length, `${BNBC_MODEL} carries the foundation members this leaf measures`).toBeGreaterThan(0);
    stage = await stageFoundationsCampaign("bnbc-fdn", members, factsFrom());
    verdict = await evaluate(stage, await railBatchOf(stage));
    cells = await publishedByCell(stage.tenantId, stage.campaignId);
})());

afterAll(async () => {
  await closeStage();
});

/** Every cell of this fixture's golden that this leaf measures — the file's own rows (B-19). */
function goldenCells(): { class: string; kind: string; key: string }[] {
  const found: { class: string; kind: string; key: string }[] = [];
  for (const elementClass of Object.values(CLASS_OF)) {
    for (const kind of KINDS) {
      if (goldenCell(BNBC_FIXTURE, { class: elementClass, kind }).length > 0) found.push({ class: elementClass, kind, key: `${elementClass}|${kind}` });
    }
  }
  return found;
}

describe("AC-6: F-RCC6-BNBC's foundations stand inside L-QTY-06's band, per (class, kind, level)", () => {
  test("AC-6: the campaign measured every cell the golden carries, and offered nothing the gate refused", async () => {
    await staged();
    expect(verdict.refused, `every offer published (the gate refused ${JSON.stringify(verdict.refusals)})`).toBe(0);
    const owed = goldenCells();
    expect(owed.length, `${BNBC_FIXTURE}'s golden carries foundation cells to reconcile`).toBeGreaterThan(0);
    for (const cell of owed) {
      expect(
        cells.get(cell.key),
        `the campaign published ${cell.class} × ${cell.kind} (the golden carries it at ${GOLDEN_CLASS[cell.class]} × ${GOLDEN_KIND[cell.kind]}; the campaign published ${JSON.stringify([...cells.keys()])})`,
      ).toBeTruthy();
    }
  }, 1_800_000);

  test("AC-6: every COMPLETE cell reconciles with the golden takeoff — three per cent under, never over", async () => {
    await staged();
    const { exact } = await canon();
    for (const cell of goldenCells()) {
      const held = cells.get(cell.key) as CellReading;
      if (held.partial > 0) continue;
      const golden = goldenFigure(goldenCell(BNBC_FIXTURE, cell), exact as (value: string) => ReturnType<typeof exact>);
      const sum = held.sum;
      expect(
        golden.printed.mul(exact(UNDER_TOLERANCE)).lte(sum),
        `${cell.class} × ${cell.kind}: ${sum.toString()} is no more than three per cent under the golden ${golden.said} (L-QTY-06)`,
      ).toBe(true);
      expect(
        sum.lte(golden.printed.add(golden.halfUlp)),
        `${cell.class} × ${cell.kind}: ${sum.toString()} is not over the golden ${golden.said} — L-QTY-06 allows +0% over, and an over-measured figure is never a disclosure`,
      ).toBe(true);
    }
  }, 600_000);

  test("AC-6: exactly the polygon-plan cells are partial, and each names the code it defers under", async () => {
    await staged();
    const partial = goldenCells().filter((cell) => (cells.get(cell.key) as CellReading).partial > 0);
    expect(
      partial.map((cell) => cell.key).sort(),
      "every BNBC pile cap is drawn as a polygon, so its pit and its blinding defer — and nothing else of this fixture is partial (L-FRM-04, L-QTY-02)",
    ).toEqual(Object.keys(DEFERRED).sort());
    for (const cell of partial) {
      expect((cells.get(cell.key) as CellReading).partialCodes, `${cell.class} × ${cell.kind} defers by name, and under that name only`).toEqual([DEFERRED[cell.key]]);
    }
  }, 600_000);

  test("AC-6: a deferred cell keeps its rows and publishes no figure for them", async () => {
    await staged();
    for (const key of Object.keys(DEFERRED)) {
      const held = cells.get(key) as CellReading;
      expect(held.lines, `${key} keeps a row for every cap it deferred (L-QTY-02: the row is kept, with no quantity)`).toBeGreaterThan(0);
      expect(held.partial, "and every one of those rows is the deferral").toBe(held.lines);
      expect(held.sum.toString(), "so the cell publishes no figure at all").toBe("0");
    }
  }, 600_000);
});
