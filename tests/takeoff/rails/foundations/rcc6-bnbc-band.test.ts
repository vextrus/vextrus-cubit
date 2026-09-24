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
 *
 * TEST_AMENDED (session 8, FND-OWN review, I-544, I-547): a pile cap's concrete is the prism
 * less the heads the piles it stands on own (L-MEA-09: pile › pile cap), and a cap whose piles nobody
 * read keeps its row naming `CAP_PILES_UNREAD` rather than the whole prism over them (L-QTY-04). The
 * members here are the model's, so the junction is the model's too: each cap's own `piles`, and the
 * head height its elevations state — the piles' cut-off (`levels.PILE_CUT`, −1828.8) against the cap's
 * soffit (its `top` less its `depth`, −609.6 − 1295.4), 76.2 mm — STAGED through `stageCapJunctions`,
 * since no reader of the drawing states it yet. The cap concrete cell is then the model's prisms less
 * 89 heads, graded against that algebra and inside the band as every COMPLETE cell is.
 *
 * TEST_AMENDED (R0 Rev C, K18, W-30): the lift pit is PC5's recess, and R0's golden nets its void out
 * of the cap cell (122.500 m³, was 128.821 over the prisms less nothing). The model states the void
 * (`recess`, mm³) and its sides (`recess_faces`, mm²) but not the three sides W-30 builds them from —
 * the pit's interior 2493.2 × 2188.4 and the cap top to the pit floor, 914.4 — so those are staged
 * beside the heads, TRANSCRIBED from W-30, and held to the model's two statements exactly before
 * FND-RECESS's sentence (I-546) is let net them. The cell is the prisms less the heads and the void.
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
  modelLevels,
  modelMembers,
  modelSiteFacts,
  publishedByCell,
  railBatchOf,
  stageCapJunctions,
  stageFoundationsCampaign,
  type CellReading,
  type FoundationsStage,
  type ModelMember,
  type StagedCapJunction,
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

/** Where the model states the piles' cut-off, and the head height each cap's own elevations put it at. */
const PILE_CUT = "PILE_CUT";

/**
 * PC5's recess by its sides, as R0's W-30 (fixtures/gen/rcc6_bnbc/DECISIONS.md) builds the model's
 * void from them: the pit's interior and the cap's top to the pit's floor, in millimetres. The model
 * states only their products, so each cap with a void is held to them (`recess`, `recess_faces`).
 */
const RECESS_SIDES_W30 = { length: "2493.2", breadth: "2188.4", depth: "914.4" } as const;
const RECESS_SOURCE = "fixtures/gen/rcc6_bnbc/DECISIONS.md#W-30";

/**
 * The piles each cap stands on and how far their heads stand into it, as the model states them: the
 * cap's own `piles`, and the cut-off against its soffit — `PILE_CUT − (top − depth)` (I-544).
 */
async function junctionsFrom(model: readonly ModelMember[]): Promise<Record<string, StagedCapJunction>> {
  const { exact } = await canon();
  const cut = modelLevels(BNBC_MODEL)[PILE_CUT];
  expect(cut, `${BNBC_MODEL} states the piles' cut-off`).toBeTruthy();
  const junctions: Record<string, StagedCapJunction> = {};
  for (const cap of model.filter((member) => CLASS_OF[member.class] === PILE_CAP)) {
    expect(cap.piles !== undefined && cap.top !== undefined && cap.depth !== undefined, `${cap.id} states its piles, its top and its depth`).toBe(true);
    const head = exact(String(cut)).sub(exact(String(cap.top)).sub(exact(String(cap.depth))));
    const staged = { piles: cap.piles ?? [], head: { value: head.toString(), unit: MILLIMETRE, source: `${BNBC_MODEL}#levels.${PILE_CUT}` } };
    if (exact(cap.recess ?? "0").eq(exact("0"))) {
      junctions[cap.id] = staged;
      continue;
    }
    const [l, b, d] = [exact(RECESS_SIDES_W30.length), exact(RECESS_SIDES_W30.breadth), exact(RECESS_SIDES_W30.depth)];
    expect(l.mul(b).mul(d).eq(exact(String(cap.recess))), `${cap.id}'s void ${String(cap.recess)} mm³ is W-30's ${RECESS_SIDES_W30.length} × ${RECESS_SIDES_W30.breadth} × ${RECESS_SIDES_W30.depth}`).toBe(true);
    expect(exact("2").mul(l.add(b)).mul(d).eq(exact(String(cap.recess_faces))), `and its sides ${String(cap.recess_faces)} mm² are 2 × (l + b) × d`).toBe(true);
    const side = (value: string, name: string) => ({ value, unit: MILLIMETRE, source: `${RECESS_SOURCE}.${name}` });
    junctions[cap.id] = { ...staged, recess: { length: side(RECESS_SIDES_W30.length, "length"), breadth: side(RECESS_SIDES_W30.breadth, "breadth"), depth: side(RECESS_SIDES_W30.depth, "depth") } };
  }
  return junctions;
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
    const model = modelMembers(BNBC_MODEL).filter((member) => CLASS_OF[member.class] !== undefined);
    members = model.map(stagedFrom);
    expect(members.length, `${BNBC_MODEL} carries the foundation members this leaf measures`).toBeGreaterThan(0);
    stage = await stageFoundationsCampaign("bnbc-fdn", members, factsFrom());
    stageCapJunctions(stage, members, await junctionsFrom(model));
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

  test("AC-6: the pile caps' concrete is the model's prisms less the 89 heads its piles own and PC5's recess — never the prisms whole (L-MEA-09)", async () => {
    await staged();
    const { exact } = await canon();
    const held = cells.get(`${PILE_CAP}|${RCC_CONCRETE}`) as CellReading;
    expect(held.partial, "every cap's piles and heads are stated, so every line publishes").toBe(0);
    const caps = modelMembers(BNBC_MODEL).filter((member) => CLASS_OF[member.class] === PILE_CAP);
    const piles = caps.reduce((sum, cap) => sum + (cap.piles?.length ?? 0), 0);
    expect(piles, "the model's 26 caps stand on its 89 piles").toBe(89);
    // mm² × mm → m³; π/4 · d² · e with d = 0.5 m and e = 0.0762 m, the heads the piles own.
    const prisms = caps.reduce((sum, cap) => sum.add(exact(String(cap.area)).mul(exact(String(cap.depth)))), exact("0")).mul(exact("1e-9"));
    const heads = exact(String(piles)).mul(exact("3.14159265358979323846")).mul(exact("0.25")).mul(exact("0.0762")).mul(exact("0.25"));
    // TEST_AMENDED (R0 K18, W-30): and less the void the model states in PC5 (mm³ → m³), the only cap with one.
    const voids = caps.reduce((sum, cap) => sum.add(exact(cap.recess ?? "0")), exact("0")).mul(exact("1e-9"));
    expect(caps.filter((cap) => !exact(cap.recess ?? "0").eq(exact("0"))).map((cap) => cap.mark), "one cap holds a recess").toEqual(["PC5"]);
    const drift = held.sum.sub(prisms.sub(heads).sub(voids));
    expect(drift.lte(exact("1e-12")) && exact("-1e-12").lte(drift), `${held.sum.toString()} m³ is the prisms ${prisms.toString()} less 89 × π/4 × 0.5² × 0.0762 (${heads.toString()}) and PC5's recess (${voids.toString()})`).toBe(true);
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
