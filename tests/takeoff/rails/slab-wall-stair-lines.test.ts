/**
 * AC-1, AC-2 and AC-4 through the REAL gate — the lines a staged campaign publishes over a slab panel,
 * a slab on grade, a straight flight and a rectangular landing (L-MEA-09/AM-02, AM-06 §3/§4, L-MEA-02,
 * L-FRM-02/03, L-QTY-03).
 *
 * Nothing is simulated below the rail: the campaign is opened by the pin act over a workspace whose
 * edition cites this leaf's twelve pairs, the rows are registered through the register's own door, and
 * the offers both rails make are handed to `evaluateOffers`, which resolves the method, partitions the
 * `opening` channel against the edition's own threshold, binds the deducted sum and writes the line.
 *
 * Every figure a criterion names is compared in the canon's exact decimals — `16.875` is the rule's own
 * arithmetic over the readings the criterion states, not a transcript of a run (B-07).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  AREA_DIMENSION,
  AREA_THICK,
  DEDUCTED,
  GROUND,
  KEPT,
  OPENINGS_VARIABLE,
  RCC_CONCRETE,
  RCC_FORMWORK,
  RULE,
  RULE_VERSION,
  SLAB,
  STAIR,
  boundInDimension,
  canon,
  carried,
  closeStage,
  gateSeam,
  linesFor,
  methodOf,
  oneLine,
  railInput,
  reading,
  registerPlanObjects,
  resolved,
  said,
  setupWith,
  slabPanel,
  slabWallStairDoor,
  stageSlabWallStairCampaign,
  stairFlight,
  stairLanding,
  type BoundShape,
  type Canon,
  type OfferShape,
  type PlanDraft,
  type SlabWallStairCampaign,
  type StoreRow,
  type VerdictShape,
} from "./support/slab-wall-stair-stage";

afterAll(async () => {
  await closeStage();
});

/** The one level every row of this case stands on. */
const LEVEL = { label: "1F", ordinal: 1, height: "3" };

/** The four rows the three criteria describe, in the order they are registered. */
const DRAFTS: readonly PlanDraft[] = [
  {
    placementKey: "PANEL-1F",
    elementType: SLAB,
    mark: "S1",
    level: LEVEL.label,
    reading: slabPanel({
      area: reading("120", "m2"),
      members: resolved("3.5", "m2"),
      beamSoffit: resolved("20", "m2"),
      freeEdge: reading("12", "m"),
      thickness: reading("150", "mm"),
      openings: [reading("0.09", "m2"), reading("0.10", "m2"), reading("4", "m2")],
    }),
  },
  {
    placementKey: "GRADE-1F",
    elementType: SLAB,
    mark: "S2",
    level: LEVEL.label,
    reading: slabPanel({ bearing: GROUND, area: reading("200", "m2"), freeEdge: reading("40", "m"), thickness: reading("150", "mm") }),
  },
  {
    placementKey: "FLIGHT-1F",
    elementType: STAIR,
    mark: "FL1",
    level: LEVEL.label,
    reading: stairFlight({
      sloped: reading("2.8", "m"),
      width: reading("1.2", "m"),
      waist: reading("150", "mm"),
      going: reading("250", "mm"),
      rise: reading("1.68", "m"),
      risers: reading("10", "pcs"),
    }),
  },
  {
    placementKey: "LANDING-1F",
    elementType: STAIR,
    mark: "ML1",
    level: LEVEL.label,
    reading: stairLanding({ area: reading("2.4", "m2"), thickness: reading("150", "mm") }),
  },
];

type Run = { it: SlabWallStairCampaign; verdict: VerdictShape; keys: Record<string, string>; units: Canon };

let run: Run;
let loading: Promise<Run> | undefined;

/**
 * The case, staged once and shared. It is built INSIDE the tests rather than in a `beforeAll`, so a
 * product surface that does not exist yet fails each criterion's own assertion by name — a hook that
 * throws reports a suite that never ran, which reads as a defect in the acceptance rather than as the
 * red it is.
 */
const load = (): Promise<Run> => (loading ??= build());

/** How long a case may take to stage before it is measured. */
const STAGING_BUDGET = 300_000;

async function build(): Promise<Run> {
  const units = await canon();
  const it = await stageSlabWallStairCampaign("lines", [LEVEL]);
  const { objects, plans } = await registerPlanObjects(it, DRAFTS);
  const keys = Object.fromEntries(DRAFTS.map((draft, at) => [draft.placementKey, (objects[at] as { objectKey: string }).objectKey]));

  const door = await slabWallStairDoor();
  const setup = setupWith(it, { plans });
  const offers: OfferShape[] = [
    ...door.slabWallStairConcreteRail(railInput(it, RCC_CONCRETE, setup)).offers,
    ...door.slabWallStairFormworkRail(railInput(it, RCC_FORMWORK, setup)).offers,
  ];
  expect(offers.length, "both rails offered over the four staged rows before the gate was asked anything").toBeGreaterThan(0);

  const gate = await gateSeam();
  const verdict = await gate.evaluateOffers(it.gateScope, { offers, observations: [] });
  run = { it, verdict, keys, units };
  return run;
}

/** The one line of a kind for one of this case's rows. */
function line(placementKey: string, kind: string, what: string): StoreRow {
  return oneLine(run.it, kind, run.keys[placementKey] as string, what);
}

/** Is a line's figure exactly this decimal? */
function figures(row: StoreRow, expected: string): boolean {
  return run.units.exact(said(row, "value", "value")).eq(run.units.exact(expected));
}

describe("AC-1: the slab panel's concrete line", () => {
  test("AC-1: exactly one `rcc.concrete` line, under `rcc.slab.concrete`, of exactly 16.875 m3", async () => {
    await load();
    const row = line("PANEL-1F", RCC_CONCRETE, "the panel is measured for concrete once");
    const units = await canon();

    expect(said(row, "ruleId", "rule_id"), "derived by the slab's own concrete rule (interfaces)").toBe(RULE.slabConcrete);
    expect(said(row, "ruleVersion", "rule_version"), "at the version the campaign's edition puts in force").toBe(RULE_VERSION);
    expect(
      figures(row, "16.875"),
      `(120 − 3.5 − 4) m2 × 150 mm is 16.875 m3 — the plate less the column plan area less the one opening above the threshold (L-MEA-09); the line states ${said(row, "value", "value")}`,
    ).toBe(true);
    expect(said(row, "unit", "unit"), "stated in the canonical unit of the dimension its method measures (L-FRM-06)").toBe(units.CANONICAL_UNIT["VOLUME"]);
  }, STAGING_BUDGET);

  test("AC-1: the gate — not the rail — binds the deducted sum, as a DERIVED reading of exactly 4 m2", async () => {
    await load();
    const row = line("PANEL-1F", RCC_CONCRETE, "the panel is measured for concrete once");
    const bindings = carried<Record<string, { basis?: string; canonical?: { value: string; unit: string } }>>(row, "bindings", "bindings");
    const bound = bindings[OPENINGS_VARIABLE];

    expect(bound, `the line records \`${OPENINGS_VARIABLE}\` — the variable the gate binds the \`opening\` channel's deducted sum into (interfaces)`).toBeTruthy();
    expect(
      run.units.exact(String(bound?.canonical?.value)).eq(run.units.exact("4")),
      `bound at the sum of the DEDUCTED candidates alone — 4 m2, the two below the edition's threshold contributing nothing (L-MEA-02); it is ${JSON.stringify(bound?.canonical)}`,
    ).toBe(true);
    expect(bound?.canonical?.unit, "in the canonical unit of the variable's own dimension (L-FRM-06)").toBe(run.units.CANONICAL_UNIT["AREA"]);
  }, STAGING_BUDGET);

  test("AC-1: the line records each candidate on the side the edition's threshold put it on", async () => {
    await load();
    const row = line("PANEL-1F", RCC_CONCRETE, "the panel is measured for concrete once");
    const recorded = carried<readonly { measure: { value: string }; side: string }[]>(row, "deductions", "deductions");
    const sideOf = (area: string): string | undefined => recorded.find((candidate) => run.units.exact(candidate.measure.value).eq(run.units.exact(area)))?.side;

    expect(recorded.length, `all three openings are listed, kept as readily as deducted (L-MEA-02); the line lists ${JSON.stringify(recorded)}`).toBe(3);
    expect(sideOf("0.09"), `an opening below the edition's threshold is ignored by rule and listed — side \`${KEPT}\``).toBe(KEPT);
    expect(sideOf("0.10"), `an opening AT the threshold is kept too: the deduction applies strictly above it (L-MEA-02)`).toBe(KEPT);
    expect(sideOf("4"), `and the one strictly above it is the one taken off — side \`${DEDUCTED}\``).toBe(DEDUCTED);
  }, STAGING_BUDGET);
});

describe("AC-2: the formwork lines, soffit against edge", () => {
  test("AC-2: the framed panel publishes one `rcc.formwork` line of exactly 94.3 m2, naming L_edge and A_beams", async () => {
    await load();
    const row = line("PANEL-1F", RCC_FORMWORK, "the panel is measured for formwork once");
    const units = await canon();

    expect(said(row, "ruleId", "rule_id"), "under the framed-soffit rule (interfaces)").toBe(RULE.slabFormwork);
    expect(
      figures(row, "94.3"),
      `(120 − 3.5 − 20 − 4) m2 + 12 m × 150 mm is 94.3 m2 — the soffit net of members, beam soffits and openings, plus the free edges through the thickness (AM-06 §3); the line states ${said(row, "value", "value")}`,
    ).toBe(true);
    expect(said(row, "unit", "unit"), "stated in the canonical unit of AREA (L-FRM-06)").toBe(units.CANONICAL_UNIT["AREA"]);

    const bindings = carried<Record<string, { value: string; unit: string }>>(row, "bindings", "bindings");
    expect({ value: bindings["L_edge"]?.value, unit: bindings["L_edge"]?.unit }, "the free-edge run is recorded on the line as the named term `L_edge`, as the reading wrote it (AC-2)").toEqual({
      value: "12",
      unit: "m",
    });
    expect({ value: bindings["A_beams"]?.value, unit: bindings["A_beams"]?.unit }, "beside `A_beams`, the beam soffits the slab does not form (L-MEA-09)").toEqual({ value: "20", unit: "m2" });
  }, STAGING_BUDGET);

  test("AC-2: the slab on grade publishes one `rcc.formwork` line of exactly 6 m2 and binds no soffit area", async () => {
    await load();
    const row = line("GRADE-1F", RCC_FORMWORK, "the slab on grade is measured for formwork once");

    expect(said(row, "ruleId", "rule_id"), "under the edge-only rule — a slab on grade forms edges only (AM-06 §3)").toBe(RULE.slabEdgeFormwork);
    expect(figures(row, "6"), `40 m × 150 mm is 6 m2; the line states ${said(row, "value", "value")}`).toBe(true);

    const method = await methodOf(RULE.slabEdgeFormwork);
    const bindings = carried<Record<string, BoundShape>>(row, "bindings", "bindings");
    expect(Object.keys(bindings).sort(), `the line records exactly what ${RULE.slabEdgeFormwork} declares — no soffit area is formed, so none is bound (AC-2)`).toStrictEqual(
      method.variables.map((variable) => variable.name).sort(),
    );

    // "Binds no soffit area at all" is a claim about a DIMENSION, not about a roster: whatever the
    // edge rule comes to declare, an edge run is lengths through a thickness, so neither its
    // declaration nor its line may carry a figure measured in area (AM-06 §3, B-19).
    expect(
      method.variables.filter((variable) => variable.dimension === AREA_DIMENSION).map((variable) => variable.name),
      `${RULE.slabEdgeFormwork} declares no variable standing in ${AREA_DIMENSION} — a slab on grade forms edges only, so the rule takes lengths and a thickness and no area at all (AM-06 §3)`,
    ).toEqual([]);
    expect(
      boundInDimension(bindings, AREA_DIMENSION, run.units),
      `and the line binds nothing measured in ${AREA_DIMENSION}: the 200 m2 plate this panel bears on the ground with is a soffit nobody forms, so no area of it reaches the edge line (AC-2)`,
    ).toEqual([]);
    expect(carried<readonly unknown[]>(row, "deductions", "deductions"), "and an edge run partitions no channel at all").toEqual([]);
  }, STAGING_BUDGET);

  test("AC-2: the slab on grade has no concrete line from the edge rule — the two kinds are measured apart", async () => {
    await load();
    const concrete = linesFor(run.it, RCC_CONCRETE, run.keys["GRADE-1F"] as string);
    expect(concrete.map((row) => said(row, "ruleId", "rule_id")), "a slab on grade still measures its own plate for concrete under the slab concrete rule (L-MEA-09)").toEqual([
      RULE.slabConcrete,
    ]);
  }, STAGING_BUDGET);
});

describe("AC-4: a straight flight and a rectangular landing", () => {
  test("AC-4: the flight publishes exactly one concrete line of 0.756 m3 and one formwork line of 6.216 m2", async () => {
    await load();
    const concrete = line("FLIGHT-1F", RCC_CONCRETE, "the flight is measured for concrete once");
    const formwork = line("FLIGHT-1F", RCC_FORMWORK, "the flight is measured for formwork once");

    expect(said(concrete, "ruleId", "rule_id"), "under the flight's own concrete rule (interfaces)").toBe(RULE.flightConcrete);
    expect(
      figures(concrete, "0.756"),
      `2.8 m × 1.2 m × 150 mm plus ½ × 250 mm × 1.68 m × 1.2 m is 0.756 m3 — the waist plus the step triangles (AM-06 §4); the line states ${said(concrete, "value", "value")}`,
    ).toBe(true);

    expect(said(formwork, "ruleId", "rule_id"), "under the flight's own formwork rule (interfaces)").toBe(RULE.flightFormwork);
    expect(
      figures(formwork, "6.216"),
      `soffit 2.8 × 1.2, risers 1.68 × 1.2 and strings 2 × 2.8 × 0.15 is 6.216 m2; the line states ${said(formwork, "value", "value")}`,
    ).toBe(true);
  }, STAGING_BUDGET);

  test("AC-4: the landing publishes one AREA_THICK concrete line of 0.36 m3 and one formwork line of 2.4 m2", async () => {
    await load();
    const concrete = line("LANDING-1F", RCC_CONCRETE, "the landing is measured for concrete once");
    const formwork = line("LANDING-1F", RCC_FORMWORK, "the landing is measured for formwork once");

    expect(said(concrete, "ruleId", "rule_id"), "a rectangular landing is AREA_THICK, and says so by the rule it is offered under (R-TO-032)").toBe(RULE.landingConcrete);
    const method = await methodOf(RULE.landingConcrete);
    expect(method.kind, `${RULE.landingConcrete} measures the concrete kind`).toBe(RCC_CONCRETE);
    expect(figures(concrete, "0.36"), `2.4 m2 × 150 mm is 0.36 m3; the line states ${said(concrete, "value", "value")}`).toBe(true);

    expect(said(formwork, "ruleId", "rule_id"), "and its soffit under the landing's own formwork rule").toBe(RULE.landingFormwork);
    expect(figures(formwork, "2.4"), `a rectangular landing's soffit is its area, 2.4 m2; the line states ${said(formwork, "value", "value")}`).toBe(true);
  }, STAGING_BUDGET);

  test("AC-4: the landing's concrete offer stands in AREA_THICK geometry", async () => {
    await load();
    const door = await slabWallStairDoor();
    const { it } = run;
    const setup = setupWith(it, { plans: Object.fromEntries(it.objects.map((object, at) => [object.placementKey, (DRAFTS[at] as PlanDraft).reading])) });
    const offered = door
      .slabWallStairConcreteRail(railInput(it, RCC_CONCRETE, setup))
      .offers.filter((offer) => offer.register.objectKey === run.keys["LANDING-1F"]);

    expect(offered.length, "the landing is offered once for concrete").toBe(1);
    expect((offered[0] as OfferShape).geometry.type, "a rectangular landing is measured as an area through a thickness (L-FRM-02: AREA_THICK)").toBe(AREA_THICK);
  }, STAGING_BUDGET);
});

describe("AC-1, AC-2, AC-4: the gate refused nothing over the four rows", () => {
  test("AC-1: every offer of this batch published — a refusal here would be an offer not to contract", async () => {
    await load();
    expect(
      { refused: run.verdict.refused, refusals: run.verdict.refusals },
      "the rails' offers are to the gate's contract, so the batch publishes whole (L-MEA-08)",
    ).toEqual({ refused: 0, refusals: [] });
  }, STAGING_BUDGET);
});
