/**
 * AC-2 (second half) — the rails OFFER readings and compute nothing, and the gate publishes the
 * algebra of those readings (L-MEA-08, L-QTY-01/03, L-FRM-02, L-FRM-04, AM-06).
 *
 * One campaign is staged over the three members the criterion spells — a rect footing, a polygon
 * pile cap and a pile — with the ground level entered through the SITE-fact store and the pinned
 * edition supplying what no drawing states. Every rail of this leaf then answers over those rows, and
 * the batch goes to the gate through its one door.
 *
 * What is graded is that each offer carries READINGS: the value and the unit as written, the basis
 * that says how each was known, and the entity it was read from — and that no field of an offer is
 * a computed figure ("there is no field where a computed value could land", L-MEA-08). The figures
 * are then graded where they belong: on the published lines, against the algebra computed here in
 * the canon from the same readings, and against the method's own evaluation over the gate's
 * normalised bindings.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  BLINDING_PLAN_DEFERRED,
  BLINDING_PROJECTION_PARAMETER,
  BLINDING_RULE_ID,
  BLINDING_THICKNESS_PARAMETER,
  COMPLETE,
  DEPTH_EXTRA_PARAMETER,
  DERIVED,
  EARTHWORK_EXCAVATION,
  EARTHWORK_PLAN_DEFERRED,
  ENTERED,
  EXCAVATION_RULE_ID,
  FOOTING,
  FOUNDATIONS_VERSION,
  FOUNDATION_PRISM_POLY_RULE_ID,
  FOUNDATION_PRISM_RECT_RULE_ID,
  GROUND_LEVEL,
  MILLIMETRE,
  MILLIMETRE_SQUARED,
  OFFER_KEYS,
  PARTIAL_DECLARED,
  PCC_BLINDING,
  PILE,
  PILE_CAP,
  PILE_CONCRETE_RULE_ID,
  PILE_COUNT_RULE_ID,
  PILE_LENGTH_RULE_ID,
  PILING_BORED,
  PILING_BORING,
  PRISM_POLY,
  PRISM_RECT,
  RCC_CONCRETE,
  TRANSCRIBED,
  WORKING_ALLOWANCE_PARAMETER,
  actSource,
  canon,
  closeStage,
  editionSource,
  evaluate,
  foundationsMethod,
  gateSeam,
  publishedByCell,
  railBatchOf,
  stageFoundationsCampaign,
  type CellReading,
  type DecimalLike,
  type FoundationsStage,
  type OfferShape,
  type RailBatchShape,
  type StagedMember,
  type VerdictShape,
} from "./support/foundations-stage";

/** The three members the criterion spells, as the model states them, in millimetres. */
const FOOTING_F1: StagedMember = {
  id: "F1",
  class: FOOTING,
  mark: "F1",
  section: { l: "1500", b: "1500" },
  dimensions: { depth: "450", top: "-609.6" },
};
const CAP_PC1: StagedMember = {
  id: "PC-A1",
  class: PILE_CAP,
  mark: "PC1",
  outline: { type: PRISM_POLY, area: "2000000" },
  dimensions: { depth: "1295.4", top: "-609.6" },
};
const PILE_P1: StagedMember = { id: "P1", class: PILE, mark: "P", dimensions: { dia: "500", length: "21336" } };

/** The ground level the site states, as it is written: an elevation below datum is a reading. */
const EGL_AS_WRITTEN = "-152.4";

/** A word no field of an offer may be named: an offer carries readings, never a figure (L-MEA-08). */
const BANNED = ["value", "quantity", "volume", "figure"];

/**
 * The two offers of this stage that CANNOT be complete, and the code each defers under (L-FRM-04).
 *
 * The pit and the blinding are rect formulas — `count × (L + 2a) × (B + 2a) × …` and
 * `count × (L + 2p) × (B + 2p) × t` — and the cap staged here is drawn as a POLYGON, which yields a
 * shoelace area and no L or B at all. L-FRM-04 says those defer; L-QTY-02 says a row kept with no
 * quantity is PARTIAL_DECLARED and never COMPLETE, with every omitted component enumerated on it. So
 * the cap's own concrete (a polygon prism) is complete, and these two are kept and named.
 */
const DEFERRED: readonly { class: string; ruleId: string; kind: string; code: string }[] = [
  { class: PILE_CAP, ruleId: EXCAVATION_RULE_ID, kind: EARTHWORK_EXCAVATION, code: EARTHWORK_PLAN_DEFERRED },
  { class: PILE_CAP, ruleId: BLINDING_RULE_ID, kind: PCC_BLINDING, code: BLINDING_PLAN_DEFERRED },
];

/** The two readings a rect plan states and a polygon plan does not, in the order the clause names them. */
const RECT_PLAN_VARIABLES: readonly string[] = ["L", "B"];

/** Whether an offer is one of the two the polygon plan defers. */
const isDeferred = (offer: OfferShape): boolean => DEFERRED.some((one) => one.class === offer.class && one.ruleId === offer.ruleId);

/** π/4 · d² · length for a 500 mm pile 21.336 m long, from π itself — never from the product. */
const PILE_VOLUME = "4.189313803561989";
const PILE_TOLERANCE = "0.000000000001";

let stage: FoundationsStage;
let batch: RailBatchShape;
let verdict: VerdictShape;
let cells: Map<string, CellReading>;

let staging: Promise<void> | undefined;

/**
 * The staged campaign, measured once and awaited by every case.
 *
 * Lazy rather than a hook on purpose: a module the Builder has not written yet must fail the CASE
 * that needed it, by name — a throwing hook leaves every case skipped, and judges nothing.
 */
const staged = (): Promise<void> =>
  (staging ??= (async () => {
    stage = await stageFoundationsCampaign("fdn-offers", [FOOTING_F1, CAP_PC1, PILE_P1], [
      { fact: GROUND_LEVEL, valueAsWritten: EGL_AS_WRITTEN, unitAsWritten: MILLIMETRE, sourceNote: "S-01 general notes: existing ground level" },
    ]);
    batch = await railBatchOf(stage);
    verdict = await evaluate(stage, batch);
    cells = await publishedByCell(stage.tenantId, stage.campaignId);
  })());

afterAll(async () => {
  await closeStage();
});

/** The one offer of a (class, rule) this stage made. */
function offerOf(elementClass: string, ruleId: string): OfferShape {
  const held = batch.offers.filter((offer) => offer.class === elementClass && offer.ruleId === ruleId);
  expect(held.length, `exactly one ${elementClass} offer under ${ruleId} (the batch offered ${JSON.stringify(batch.offers.map((one) => `${one.class}:${one.ruleId}`))})`).toBe(1);
  return held[0] as OfferShape;
}

/** One published cell, asserted to have been published at all. */
function cellOf(elementClass: string, kind: string): CellReading {
  const held = cells.get(`${elementClass}|${kind}`);
  expect(held, `the campaign published ${elementClass} × ${kind} (it published ${JSON.stringify([...cells].map(([key, one]) => [key, one.sum.toString()]))})`).toBeTruthy();
  return held as CellReading;
}

/**
 * What one COMPLETE cell published, as an exact decimal.
 *
 * Completeness is asserted here rather than of every cell alike: a cell is complete because every
 * reading its rule needs was stated, and this stage deliberately stages one plan that states two of
 * them nowhere (L-QTY-02, and `DEFERRED` above).
 */
function sumOf(elementClass: string, kind: string): DecimalLike {
  const reading = cellOf(elementClass, kind);
  expect(reading.partial, `every ${elementClass} × ${kind} line is COMPLETE — every reading this rule needs was stated (L-QTY-02)`).toBe(0);
  return reading.sum;
}

describe("AC-2: the rails offer readings, and the gate publishes their algebra", () => {
  test("AC-2: every offer is to the contract's own shape, and no field of one is a figure", async () => {
    await staged();
    expect(batch.offers.length, `the five rails offered over the three staged members (the verdict was ${JSON.stringify(verdict)})`).toBeGreaterThan(0);
    for (const offer of batch.offers) {
      expect(Object.keys(offer).sort(), `an offer carries exactly the contract's own keys (${offer.class} × ${offer.ruleId}, L-MEA-08)`).toEqual([...OFFER_KEYS]);
      for (const name of [...Object.keys(offer), ...Object.keys(offer.bindings), ...Object.keys(offer.selectors)]) {
        expect(
          BANNED.includes(name.toLowerCase()),
          `no key of an offer is named \`${name}\` — an offer states what was read, and there is no field where a computed value could land (L-MEA-08)`,
        ).toBe(false);
      }
      expect(offer.geometry.calibration.length, `${offer.class} × ${offer.ruleId} stands on an affirmed calibration reference (L-QTY-03)`).toBeGreaterThan(0);
      if (isDeferred(offer)) continue;
      expect(offer.coverage, `${offer.class} × ${offer.ruleId} measured every component of its description (L-QTY-02)`).toBe(COMPLETE);
      expect(offer.omitted, "so it omits nothing").toEqual([]);
    }

    // And the two the polygon plan defers are kept and NAMED, never quietly complete: a rect formula
    // with no L and no B to read states which components it left out, and under which code (L-FRM-04,
    // L-QTY-02: "every omitted component enumerated on the row").
    for (const one of DEFERRED) {
      const offer = offerOf(one.class, one.ruleId);
      expect(
        offer.coverage,
        `${one.class} × ${one.ruleId}: a polygon plan yields a shoelace area and no L or B, so the rect formula cannot measure it and says so (L-FRM-04, L-QTY-02)`,
      ).toBe(PARTIAL_DECLARED);
      expect(
        [...offer.omitted].map((omitted) => ({ variable: omitted.variable, code: omitted.code })).sort((left, right) => (left.variable < right.variable ? -1 : 1)),
        `and it omits exactly the two readings a rect plan states — ${RECT_PLAN_VARIABLES.join(" and ")} — each under ${one.code}`,
      ).toEqual(RECT_PLAN_VARIABLES.map((variable) => ({ variable, code: one.code })).sort((left, right) => (left.variable < right.variable ? -1 : 1)));
    }
  }, 900_000);

  test("AC-2: each reading is carried as it was written, with the basis that says how it was known", async () => {
    await staged();
    const footing = offerOf(FOOTING, FOUNDATION_PRISM_RECT_RULE_ID);
    const setup = stage.setup;
    const placementKey = footing.register.objectKey.split("@")[0] as string;
    const placement = setup.placements[placementKey];
    expect(placement, "the footing's offer provenances to the placement the setup describes").toBeTruthy();

    const count = footing.bindings["count"];
    expect(count?.value, "a count is one member, read as one (L-QTY-03)").toBe("1");
    expect(count?.unit, "in the canonical unit of the COUNT dimension").toBe("pcs");
    expect(count?.source, "provenanced to the entity the placement was read from").toBe(placement?.sourceEntity);
    expect(count?.basis, "and known as the register row standing says it is known").toBe(String(stage.objects[0]?.["standing"]));

    const variant = (setup.memberTypes["33333333-3333-4333-8333-333333333333"] ?? {})[String(placement?.memberFamily)]?.[0];
    expect(variant, "the footing's family states a section").toBeTruthy();
    for (const [name, stated] of [
      ["L", variant?.sectionWidth],
      ["B", variant?.sectionDepth],
    ] as const) {
      expect(footing.bindings[name]?.value, `${name} is the section cell as the schedule wrote it`).toBe(String(stated));
      expect(footing.bindings[name]?.unit, `in the unit the schedule wrote it in`).toBe(MILLIMETRE);
      expect(footing.bindings[name]?.basis, "transcribed from a schedule (L-QTY-01)").toBe(TRANSCRIBED);
      expect(footing.bindings[name]?.source, "citing the cell it was read from").toBe(variant?.sourceKeys[0]);
    }
    expect(footing.bindings["D"]?.value, "D is the depth the family's dimensions state").toBe(variant?.dimensions["depth"]?.value);
    expect(footing.bindings["D"]?.source, "citing where that dimension was read").toBe(variant?.dimensions["depth"]?.source);

    const cap = offerOf(PILE_CAP, FOUNDATION_PRISM_POLY_RULE_ID);
    const capPlacement = setup.placements[cap.register.objectKey.split("@")[0] as string];
    expect(cap.bindings["A"]?.value, "A is the plan area the outline reader measured").toBe(capPlacement?.outline?.area.value);
    expect(cap.bindings["A"]?.unit, "in the unit that reading was taken in").toBe(MILLIMETRE_SQUARED);
    expect(cap.bindings["A"]?.source, "citing the outline it came off").toBe(capPlacement?.outline?.area.source);
    expect(cap.geometry.type, "and the cap is offered as the polygon prism it is (L-FRM-02)").toBe(PRISM_POLY);
    expect(offerOf(FOOTING, FOUNDATION_PRISM_RECT_RULE_ID).geometry.type, "while a rect-plan footing is offered as a rectangular prism").toBe(PRISM_RECT);

    const excavation = offerOf(FOOTING, EXCAVATION_RULE_ID);
    const blinding = offerOf(FOOTING, BLINDING_RULE_ID);
    for (const [binding, parameter, offer] of [
      ["a", WORKING_ALLOWANCE_PARAMETER, excavation],
      ["dx", DEPTH_EXTRA_PARAMETER, excavation],
      ["t", BLINDING_THICKNESS_PARAMETER, excavation],
      ["p", BLINDING_PROJECTION_PARAMETER, blinding],
      ["t", BLINDING_THICKNESS_PARAMETER, blinding],
    ] as const) {
      const held = offer.bindings[binding];
      expect(held?.value, `${binding} is the edition's \`${parameter}\`, as the edition writes it — a citable clause, never a default (L-MEA-06)`).toBe(
        setup.edition.parameters[parameter]?.value,
      );
      expect(held?.unit, `in the unit the edition writes it in`).toBe(setup.edition.parameters[parameter]?.unit);
      expect(held?.basis, "derived from the pinned rule set (L-QTY-01)").toBe(DERIVED);
      expect(held?.source, "citing the edition and the parameter by name").toBe(editionSource(setup.edition, parameter));
    }

    const egl = excavation.bindings["egl"];
    expect(egl?.value, "the ground level is the SITE fact as it was entered — a signed reading below datum is a reading (interfaces)").toBe(EGL_AS_WRITTEN);
    expect(egl?.unit, "in the unit it was entered in").toBe(MILLIMETRE);
    expect(egl?.basis, "entered, because no drawing carries it (L-MEA-06)").toBe(ENTERED);
    expect(egl?.source, "citing the act that entered it").toBe(actSource(stage.actId));
    expect(excavation.bindings["top"]?.value, "and the founding level is the dimension the schedule states").toBe("-609.6");
  }, 900_000);

  test("AC-2: the gate publishes the exact algebra of those readings, cell by cell", async () => {
    await staged();
    const { exact } = await canon();
    const value = (text: string): DecimalLike => exact(text);
    expect(verdict.refused, `every offer published (the gate refused ${JSON.stringify(verdict.refusals)})`).toBe(0);

    // The clauses' own arithmetic over the same readings, carried to metres here rather than read
    // off the product: 1500 mm = 1.5 m, 1.5 ft = 0.4572 m, 3 in = 0.0762 m (B-17's canon, by hand).
    const a = value("0.4572");
    const dx = value("0.1524");
    const thickness = value("0.0762");
    const projection = value("0.0762");
    const footingSide = value("1.5");
    const footingDepth = value("0.45");
    const pitSide = footingSide.add(value("2").mul(a));
    const pitDepth = value("0.4572").add(footingDepth).add(thickness).add(dx);
    const blindingSide = footingSide.add(value("2").mul(projection));

    const owed: readonly { cell: [string, string]; owed: DecimalLike; why: string }[] = [
      { cell: [FOOTING, RCC_CONCRETE], owed: footingSide.mul(footingSide).mul(footingDepth), why: "count × L × B × D (L-FRM-02)" },
      { cell: [PILE_CAP, RCC_CONCRETE], owed: value("2").mul(value("1.2954")), why: "count × A × D over the shoelace plan (L-FRM-02)" },
      { cell: [PILE, PILING_BORED], owed: value("1"), why: "N = count (R-TO-032)" },
      { cell: [PILE, PILING_BORING], owed: value("21.336"), why: "L = count × length (AM-06 §2)" },
      { cell: [FOOTING, EARTHWORK_EXCAVATION], owed: pitSide.mul(pitSide).mul(pitDepth), why: "count × (L + 2a) × (B + 2a) × ((egl − top) + D + t + dx) (L-FRM-04)" },
      { cell: [FOOTING, PCC_BLINDING], owed: blindingSide.mul(blindingSide).mul(thickness), why: "count × (L + 2p) × (B + 2p) × t (L-FRM-04)" },
    ];
    for (const one of owed) {
      const published = sumOf(one.cell[0], one.cell[1]);
      expect(published.eq(one.owed), `${one.cell[0]} × ${one.cell[1]} publishes ${one.owed.toString()} — ${one.why}; it published ${published.toString()}`).toBe(true);
    }

    // The pile's concrete carries π, so it is held against π itself rather than a rounded figure.
    const pile = sumOf(PILE, RCC_CONCRETE);
    const drift = pile.add(value(`-${PILE_VOLUME}`));
    expect(
      drift.lte(value(PILE_TOLERANCE)) && value(`-${PILE_TOLERANCE}`).lte(drift),
      `pile × rcc.concrete publishes π/4 · d² · length = ${PILE_VOLUME} m3 (it published ${pile.toString()})`,
    ).toBe(true);

    // And the two cells the polygon plan defers publish their KEPT rows, with no quantity on them and
    // the reason named — never a figure guessed from a plan the rect formula cannot read (L-QTY-04).
    for (const one of DEFERRED) {
      const cell = cellOf(one.class, one.kind);
      expect(cell.lines, `${one.class} × ${one.kind} keeps its row — a row is kept with no quantity, never dropped (L-QTY-04)`).toBeGreaterThan(0);
      expect(cell.partial, "and every one of those lines is kept with no quantity at all").toBe(cell.lines);
      expect(cell.partialCodes, `each of them naming ${one.code} (L-QTY-02)`).toEqual([one.code]);
      expect(cell.sum.eq("0"), "so the cell publishes no figure whatever — a deferral is not a zero, and nothing was measured").toBe(true);
    }
  }, 900_000);

  test("AC-2: each published figure is the method's own evaluation over the gate's normalised bindings", async () => {
    await staged();
    const gate = await gateSeam();
    const { exact } = await canon();
    const ruleOf: Readonly<Record<string, string>> = {
      [FOUNDATION_PRISM_RECT_RULE_ID]: FOUNDATION_PRISM_RECT_RULE_ID,
      [FOUNDATION_PRISM_POLY_RULE_ID]: FOUNDATION_PRISM_POLY_RULE_ID,
      [PILE_CONCRETE_RULE_ID]: PILE_CONCRETE_RULE_ID,
      [PILE_COUNT_RULE_ID]: PILE_COUNT_RULE_ID,
      [PILE_LENGTH_RULE_ID]: PILE_LENGTH_RULE_ID,
      [EXCAVATION_RULE_ID]: EXCAVATION_RULE_ID,
      [BLINDING_RULE_ID]: BLINDING_RULE_ID,
    };
    for (const offer of batch.offers) {
      expect(ruleOf[offer.ruleId], `${offer.ruleId} is one of this shard's seven rules`).toBeTruthy();
      // An offer that omits components has no figure to hold a method's evaluation against: its row is
      // kept with no quantity, which the cell case above grades instead (L-QTY-02, L-QTY-04).
      if (isDeferred(offer)) continue;
      const method = await foundationsMethod({ ruleId: offer.ruleId, version: FOUNDATIONS_VERSION });
      const normalised: Record<string, { value: string }> = {};
      for (const [name, held] of Object.entries(offer.bindings)) {
        const declared = method.variables.find((one) => one.name === name);
        expect(declared, `${offer.ruleId} declares the variable \`${name}\` its rail bound (L-MEA-08)`).toBeTruthy();
        const answer = gate.normaliseMeasure(held as never, String(declared?.dimension)) as { ok: boolean; value?: string; code?: string };
        expect(answer.ok, `the gate normalises ${name} = ${held.value} ${held.unit} (it answered ${JSON.stringify(answer)})`).toBe(true);
        normalised[name] = { value: String(answer.value) };
      }
      const owed = exact(String(method.evaluate(normalised)));
      const line = cells.get(`${offer.class}|${offer.kind}`);
      expect(line, `${offer.class} × ${offer.kind} was published`).toBeTruthy();
      expect(
        (line as CellReading).sum.eq(owed),
        `${offer.class} × ${offer.kind}'s published figure is ${offer.ruleId}'s own evaluation over the normalised readings (${owed.toString()}); it published ${(line as CellReading).sum.toString()}`,
      ).toBe(true);
    }
  }, 900_000);

  test("AC-2: every published line names the rule and the version the pinned edition puts in force", async () => {
    await staged();
    const lines = [...cells.values()].reduce((count, cell) => count + cell.lines, 0);
    expect(lines, "the campaign published one line per offer (L-QTY-04)").toBe(batch.offers.length);
    expect(verdict.published, "and the gate says so").toBe(batch.offers.length);
    expect(
      [...cells].filter(([, cell]) => cell.partial > 0).map(([key]) => key).sort(),
      "the only cells kept without a quantity are the two a polygon plan defers by name — every other reading this stage needs was stated (L-QTY-02, L-FRM-04)",
    ).toEqual(DEFERRED.map((one) => `${one.class}|${one.kind}`).sort());
  }, 900_000);
});
