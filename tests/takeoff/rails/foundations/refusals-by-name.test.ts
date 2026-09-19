/**
 * AC-8 — every code of the foundations shard, answered by name (L-QTY-04, Q-07, L-MEA-08).
 *
 * "Every member of every reason enum is exercised by name in a test or deferred by name" — so each
 * of the ten codes this shard registers is DRIVEN here: a pure rail input (or a site-fact write) is
 * built that leaves exactly the reading that code is about unstated, and the code is read off what
 * the rail answered. Nothing is asserted about the figures; the algebra is graded elsewhere.
 *
 * The two codes the rails report as OBSERVATIONS rather than omissions — an unaffirmed view and a
 * member type nothing scheduled — are driven the same way and read off the observations, exactly as
 * the column rail reports them.
 */
import { describe, expect, test } from "vitest";
import {
  BLINDING_PLAN_DEFERRED,
  BLINDING_THICKNESS,
  DEPTH_EXTRA,
  EARTHWORK_PLAN_DEFERRED,
  FOOTING,
  FOUNDATIONS_ERRORS_MODULE,
  FOUNDATION_DEPTH_UNSTATED,
  FOUNDATION_PLAN_UNSTATED,
  FOUNDING_LEVEL_UNSTATED,
  GROUND_LEVEL,
  GROUND_LEVEL_UNSTATED,
  MEMBER_TYPE_UNKNOWN,
  MILLIMETRE,
  MILLIMETRE_SQUARED,
  PCC_BLINDING,
  PILE,
  PILE_CAP,
  PILE_DIAMETER_UNSTATED,
  PILE_LENGTH_UNSTATED,
  PILING_BORING,
  PRISM_POLY,
  RCC_CONCRETE,
  SITE_FACT_SOURCE_UNSTATED,
  SITE_FACT_UNKNOWN,
  VIEW_SCALE_UNAFFIRMED,
  EARTHWORK_EXCAVATION,
  foundationsRailDoor,
  outline,
  placement,
  productModule,
  railInput,
  reading,
  refusalCodeOf,
  refusalRegister,
  registerRow,
  siteFact,
  siteFactsLaw,
  variant,
  type RailBatchShape,
  type RailInputShape,
  type RailShape,
} from "./support/foundations-contract";

/**
 * TEST_AMENDED (inc-sweep-src-modules-2, AC-3(d)): the shard gains EARTHWORK_PARAMETER_UNSTATED —
 * the code an allowance, a depth extra, a projection or a thickness neither the site nor the edition
 * states is now omitted under. GROUND_LEVEL_UNSTATED keeps its own copy and its own case below
 * (Q-07, debt-src-modules-t9z401).
 */
const EARTHWORK_PARAMETER_UNSTATED = "EARTHWORK_PARAMETER_UNSTATED";

/**
 * TEST_AMENDED (inc-304b-site-facts-panel, AC-4): the shard gains WATER_TABLE_UNSTATED — the code a
 * project whose water table nobody has entered defers the earthwork below it under (L-MEA-06,
 * AM-06 §1). No rail reads it yet; the project's Site facts panel is its consumer, and the deferral
 * map that renders it is exercised by name in tests/takeoff/site-facts-ui/deferrals.test.ts.
 */
const WATER_TABLE_UNSTATED = "WATER_TABLE_UNSTATED";

/** The codes this shard registers (AC-8, interfaces). */
const REGISTERED: readonly string[] = [
  PILE_LENGTH_UNSTATED,
  PILE_DIAMETER_UNSTATED,
  FOUNDATION_DEPTH_UNSTATED,
  FOUNDATION_PLAN_UNSTATED,
  FOUNDING_LEVEL_UNSTATED,
  GROUND_LEVEL_UNSTATED,
  EARTHWORK_PLAN_DEFERRED,
  BLINDING_PLAN_DEFERRED,
  SITE_FACT_UNKNOWN,
  SITE_FACT_SOURCE_UNSTATED,
  EARTHWORK_PARAMETER_UNSTATED,
  WATER_TABLE_UNSTATED,
];

/** The ones a rail answers, plus the two it reports as observations (AC-8). */
const RAIL_CODES: readonly string[] = [
  VIEW_SCALE_UNAFFIRMED,
  MEMBER_TYPE_UNKNOWN,
  PILE_LENGTH_UNSTATED,
  PILE_DIAMETER_UNSTATED,
  FOUNDATION_DEPTH_UNSTATED,
  FOUNDATION_PLAN_UNSTATED,
  FOUNDING_LEVEL_UNSTATED,
  GROUND_LEVEL_UNSTATED,
  EARTHWORK_PLAN_DEFERRED,
  BLINDING_PLAN_DEFERRED,
  EARTHWORK_PARAMETER_UNSTATED,
];

/** The severities and surfaces a registered entry carries (interfaces). */
const ERROR = "error";
const WARNING = "warning";
const INLINE = "inline";

const INGEST = "33333333-3333-4333-8333-333333333333";
const PLACEMENT = "PLACEMENT:S-04:F1:3000:4000";
const FAMILY = "F1";

/** One case's input: a footing, a cap or a pile, described exactly as far as the case states it. */
function inputFor(options: {
  kind: string;
  elementType: string;
  mark?: string;
  section?: { width: number; depth: number };
  outlineType?: string;
  dimensions?: Record<string, string>;
  siteFacts?: Record<string, ReturnType<typeof siteFact>>;
  affirmed?: boolean;
  scheduled?: boolean;
}): RailInputShape {
  const mark = options.mark ?? FAMILY;
  const input = railInput({
    kind: options.kind,
    objects: [registerRow({ placementKey: PLACEMENT, elementType: options.elementType, mark })],
    placements: {
      [PLACEMENT]: placement({
        memberFamily: options.scheduled === false ? null : mark,
        sourceEntity: PLACEMENT,
        outline:
          options.outlineType === undefined
            ? null
            : outline({
                type: options.outlineType,
                area: reading("2000000", MILLIMETRE_SQUARED),
                length: options.outlineType === PRISM_POLY ? null : reading("1500", MILLIMETRE),
                breadth: options.outlineType === PRISM_POLY ? null : reading("1500", MILLIMETRE),
              }),
      }),
    },
    memberTypes:
      options.scheduled === false
        ? {}
        : {
            [INGEST]: {
              [mark]: [
                variant({
                  variantKey: mark,
                  width: options.section?.width ?? null,
                  depth: options.section?.depth ?? null,
                  dimensions: Object.fromEntries(Object.entries(options.dimensions ?? {}).map(([name, value]) => [name, reading(value, MILLIMETRE)])),
                }),
              ],
            },
          },
    calibrations: options.affirmed === false ? {} : undefined,
    siteFacts: options.siteFacts,
  });
  return input;
}

/** Every code one batch reported — an omission on a kept row, or an observation beside it. */
function codesOf(batch: RailBatchShape): string[] {
  const codes = new Set<string>();
  for (const offer of batch.offers) for (const omitted of offer.omitted) codes.add(omitted.code);
  for (const observation of batch.observations) codes.add(observation.code);
  return [...codes].sort();
}

/** The ground level, entered — so a case about something else is not also a case about the egl. */
const EGL = { [GROUND_LEVEL]: siteFact({ value: "-152.4", canonicalMetres: "-0.1524" }) };

/** A footing stated whole, less whatever the case takes away. */
const WHOLE_FOOTING = { width: 1500, depth: 1500 };
const WHOLE_DIMENSIONS = { depth: "450", top: "-609.6" };

describe("AC-8: every code of the foundations shard is answered by name", () => {
  test("AC-8: the area registers exactly its ten codes, each with a message, a remedy, a severity and a surface", async () => {
    const area = await productModule<{ FOUNDATIONS_REFUSALS: Record<string, { message: string; remedy: string; severity: string; surface: string }> }>(
      FOUNDATIONS_ERRORS_MODULE,
    );
    const register = await refusalRegister();
    expect(Object.keys(area.FOUNDATIONS_REFUSALS).sort(), `${FOUNDATIONS_ERRORS_MODULE} registers exactly this shard's codes (AC-8, AM-11)`).toEqual([...REGISTERED].sort());
    for (const [code, entry] of Object.entries(area.FOUNDATIONS_REFUSALS)) {
      expect(entry.message.length, `${code} says what happened`).toBeGreaterThan(0);
      expect(entry.remedy.length, `${code} says what to do about it`).toBeGreaterThan(0);
      expect([ERROR, WARNING], `${code}'s severity is one the register admits`).toContain(entry.severity);
      expect(entry.surface, `${code} is shown where the reading it is about is (interfaces)`).toBe(INLINE);
      expect(register[code], `${code} stands in the closed taxonomy the barrel assembles — the register is the one home (Q-07, ARCH-02)`).toBeTruthy();
    }
    const door = await foundationsRailDoor();
    expect([...door.FOUNDATIONS_RAIL_CODES].sort(), "and the rails' own roster names the eight they answer, plus the two they report as observations (AC-8)").toEqual(
      [...RAIL_CODES].sort(),
    );
  });

  test("AC-8: a pile with no scheduled length, and one with no diameter, are kept and say which reading is missing", async () => {
    const door = await foundationsRailDoor();
    const noLength = inputFor({ kind: PILING_BORING, elementType: PILE, mark: "P", dimensions: { dia: "500" } });
    expect(codesOf(door.pileLengthRail(noLength)), "a pile whose schedule states no length says so by name (AM-06 §2)").toContain(PILE_LENGTH_UNSTATED);

    const noDiameter = inputFor({ kind: RCC_CONCRETE, elementType: PILE, mark: "P", dimensions: { length: "21336" } });
    expect(codesOf(door.foundationConcreteRail(noDiameter)), "and a pile whose schedule states no diameter says that").toContain(PILE_DIAMETER_UNSTATED);
  });

  test("AC-8: a foundation with no depth, and one with no plan at all, are kept and say which reading is missing", async () => {
    const door = await foundationsRailDoor();
    const noDepth = inputFor({ kind: RCC_CONCRETE, elementType: FOOTING, section: WHOLE_FOOTING });
    expect(codesOf(door.foundationConcreteRail(noDepth)), "a footing whose schedule states no depth is kept, and names the reading (L-QTY-02)").toContain(FOUNDATION_DEPTH_UNSTATED);

    const noPlan = inputFor({ kind: RCC_CONCRETE, elementType: FOOTING, dimensions: WHOLE_DIMENSIONS });
    expect(codesOf(door.foundationConcreteRail(noPlan)), "and one with neither a section nor an outline names its plan").toContain(FOUNDATION_PLAN_UNSTATED);
  });

  test("AC-8: an excavation with no founding level, and one with no ground level, each name what is unstated", async () => {
    const door = await foundationsRailDoor();
    const noTop = inputFor({ kind: EARTHWORK_EXCAVATION, elementType: FOOTING, section: WHOLE_FOOTING, dimensions: { depth: "450" }, siteFacts: EGL });
    expect(codesOf(door.excavationRail(noTop)), "an excavation whose member states no founding level names it (L-FRM-04)").toContain(FOUNDING_LEVEL_UNSTATED);

    const noEgl = inputFor({ kind: EARTHWORK_EXCAVATION, elementType: FOOTING, section: WHOLE_FOOTING, dimensions: WHOLE_DIMENSIONS });
    expect(
      codesOf(door.excavationRail(noEgl)),
      "and one with no GROUND_LEVEL entered keeps its row under its own code — earthwork is unpriceable from drawings alone (L-MEA-06)",
    ).toContain(GROUND_LEVEL_UNSTATED);
  });

  test("AC-8: a polygon plan defers its pit and its blinding, each by name", async () => {
    const door = await foundationsRailDoor();
    const polygon = {
      elementType: PILE_CAP,
      mark: "PC1",
      outlineType: PRISM_POLY,
      dimensions: WHOLE_DIMENSIONS,
      siteFacts: EGL,
    };
    expect(codesOf(door.excavationRail(inputFor({ ...polygon, kind: EARTHWORK_EXCAVATION }))), "a polygon pit defers (L-FRM-04)").toContain(EARTHWORK_PLAN_DEFERRED);
    expect(codesOf(door.blindingRail(inputFor({ ...polygon, kind: PCC_BLINDING }))), "and so does the blinding under it (L-FRM-04)").toContain(BLINDING_PLAN_DEFERRED);
  });

  test("AC-8: an unaffirmed view and an unscheduled member type are observations, not offers", async () => {
    const door = await foundationsRailDoor();
    const rails: readonly RailShape[] = [door.foundationConcreteRail, door.pileCountRail, door.pileLengthRail, door.excavationRail, door.blindingRail];
    const unaffirmed = inputFor({ kind: RCC_CONCRETE, elementType: FOOTING, section: WHOLE_FOOTING, dimensions: WHOLE_DIMENSIONS, siteFacts: EGL, affirmed: false });
    const batch = door.foundationConcreteRail(unaffirmed);
    expect(batch.observations.map((one) => one.code), "a view whose scale nobody affirmed is reported, exactly as the column rail reports it (L-MEA-05)").toContain(VIEW_SCALE_UNAFFIRMED);
    expect(batch.offers, "and nothing is offered off it — an unaffirmed reading is not a reading (L-QTY-03)").toEqual([]);

    const unscheduled = inputFor({ kind: RCC_CONCRETE, elementType: FOOTING, siteFacts: EGL, scheduled: false });
    const said = door.foundationConcreteRail(unscheduled);
    expect(said.observations.map((one) => one.code), "a member type nothing scheduled is reported by name").toContain(MEMBER_TYPE_UNKNOWN);

    // Every rail answers a batch for every one of these inputs — a rail that threw would take the
    // whole campaign with it (L-MEA-08: a rail is a pure function of what it was handed).
    for (const rail of rails) {
      for (const input of [unaffirmed, unscheduled]) {
        const answered = rail({ ...input, kind: input.kind });
        expect(Array.isArray(answered.offers) && Array.isArray(answered.observations), "a rail answers offers and observations, always").toBe(true);
      }
    }
  });

  test("AC-8: the two site-fact codes are answered by the write itself", async () => {
    const law = await siteFactsLaw();
    expect(
      await refusalCodeOf(() => law.siteFactWrite({ fact: "SOIL_BEARING", valueAsWritten: "150", unitAsWritten: MILLIMETRE, sourceNote: "a borelog" }), "a fact outside the enum"),
      "a fact the closed enum does not hold is refused by name",
    ).toBe(SITE_FACT_UNKNOWN);
    expect(
      await refusalCodeOf(
        () => law.siteFactWrite({ fact: BLINDING_THICKNESS, valueAsWritten: "76.2", unitAsWritten: MILLIMETRE, sourceNote: "" }),
        "an entry with no source note",
      ),
      "and an entry that says nothing about where it came from is refused by name (AM-06 §1)",
    ).toBe(SITE_FACT_SOURCE_UNSTATED);
    expect(law.isSiteFact(DEPTH_EXTRA), "the enum holds the depth extra a site may override").toBe(true);
  });
});
