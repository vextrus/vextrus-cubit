/**
 * FND-3 — a footing's and a pile cap's formwork is their SIDE faces, measured over the one plan their
 * concrete is measured over (L-FRM-03, I-334, I-337).
 *
 * L-FRM-03 states the figure twice: "Foundation `count × 2(L+B) × depth`" over a rectangle, and
 * "Polygonal foundation/cap: side faces only, `perimeter × depth`" over any other plan. The reader
 * chooses between them by `planOf` — the plan the concrete binds — so the two kinds can never disagree
 * about what a foundation's plan is, and a polygon is formed along ITS OWN ring, never along a
 * schedule's rectangle. Nothing names a soffit or a top: a face the method cannot name is a face no
 * rail can bill.
 *
 * Pure cases, no database: a rail is a pure function of what it was handed (L-MEA-08). The same reader
 * over F-RCC6-BNBC's 26 caps, read by the shipped cad CLI, is graded against the golden's band in
 * tests/takeoff/partition/placement/bnbc-pile-caps.test.ts.
 */
import { describe, expect, test } from "vitest";
import {
  FOOTING,
  FOUNDATION_DEPTH_UNSTATED,
  FOUNDATION_FORMWORK_POLY_RULE_ID,
  FOUNDATION_FORMWORK_RECT_RULE_ID,
  FOUNDATION_PLAN_UNSTATED,
  FOUNDATIONS_RAIL_MODULE,
  FOUNDATIONS_VERSION,
  MILLIMETRE,
  MILLIMETRE_SQUARED,
  PILE,
  PILE_CAP,
  PRISM_POLY,
  RAILS_BARREL_MODULE,
  RCC_FORMWORK,
  VIEW_SCALE_UNAFFIRMED,
  canon,
  foundationsMethod,
  outline,
  placement,
  productModule,
  railInput,
  reading,
  registerRow,
  variant,
  type OfferShape,
  type OutlineSetup,
  type RailBatchShape,
  type RailInputShape,
  type RailShape,
} from "./support/foundations-contract";

/** The reader this door lands, beside its two rule ids (I-337). */
type FormworkDoor = { foundationFormworkRail: RailShape; FOUNDATION_FORMWORK_RECT_RULE_ID: string; FOUNDATION_FORMWORK_POLY_RULE_ID: string };

async function formworkDoor(): Promise<FormworkDoor> {
  const door = await productModule<Record<string, unknown>>(FOUNDATIONS_RAIL_MODULE);
  expect(typeof door["foundationFormworkRail"], `${FOUNDATIONS_RAIL_MODULE} publishes \`foundationFormworkRail\` (I-337)`).toBe("function");
  return door as unknown as FormworkDoor;
}

const INGEST = "33333333-3333-4333-8333-333333333333";
const PLACEMENT = "PLACEMENT:S-06:PC2:3000:4000";
const RING = "DXF_HANDLE:5AF";

/** A chamfered PC2 as F-RCC6-BNBC's S-06 draws it: 3.2625 m² of plan, 6960.1 mm of ring. */
const CHAMFERED: OutlineSetup = outline({
  type: PRISM_POLY,
  area: reading("3262500.0", MILLIMETRE_SQUARED, { source: RING }),
  perimeter: reading("6960.1", MILLIMETRE, { source: RING }),
});

/** One foundation, described exactly as far as the case states it. */
function inputFor(options: {
  elementType: string;
  mark: string;
  section?: { width: number; depth: number };
  plan?: OutlineSetup | null;
  depth?: string;
  affirmed?: boolean;
}): RailInputShape {
  return railInput({
    kind: RCC_FORMWORK,
    objects: [registerRow({ placementKey: PLACEMENT, elementType: options.elementType, mark: options.mark })],
    placements: { [PLACEMENT]: placement({ memberFamily: options.mark, sourceEntity: PLACEMENT, outline: options.plan ?? null }) },
    memberTypes: {
      [INGEST]: {
        [options.mark]: [
          variant({
            variantKey: options.mark,
            width: options.section?.width ?? null,
            depth: options.section?.depth ?? null,
            dimensions: options.depth === undefined ? {} : { depth: reading(options.depth, MILLIMETRE, { basis: "TRANSCRIBED", source: "DXF_HANDLE:642" }) },
          }),
        ],
      },
    },
    calibrations: options.affirmed === false ? {} : undefined,
  });
}

function onlyOffer(batch: RailBatchShape, what: string): OfferShape {
  expect(batch.offers.length, `${what}: one offer (observed ${JSON.stringify(batch.observations)})`).toBe(1);
  return batch.offers[0] as OfferShape;
}

describe("I-337: a foundation's formwork is its side faces, over the plan its concrete binds", () => {
  test("a rectangular footing is formed along 2 × (L + B) of its schedule's sides, times its depth — COMPLETE", async () => {
    const door = await formworkDoor();
    const offer = onlyOffer(door.foundationFormworkRail(inputFor({ elementType: FOOTING, mark: "F1", section: { width: 1500, depth: 1500 }, depth: "450" })), "a scheduled footing");
    expect([offer.ruleId, offer.kind, offer.class], "offered under the rectangle's rule, as formwork, of its own class (L-MEA-08)").toEqual([FOUNDATION_FORMWORK_RECT_RULE_ID, RCC_FORMWORK, FOOTING]);
    expect(Object.keys(offer.bindings).sort(), "count, the two sides and the depth — no soffit, no top (L-FRM-03)").toEqual(["B", "D", "L", "count"]);
    expect([offer.bindings["L"]?.value, offer.bindings["B"]?.value, offer.bindings["D"]?.value], "the schedule's own print").toEqual(["1500", "1500", "450"]);
    expect([offer.coverage, offer.omitted], "every reading stated").toEqual(["COMPLETE", []]);
    expect(offer.selectors, "nothing selects a formwork item: the member is the line's own class").toEqual({});
    expect(offer.deductions, "and it deducts through nothing").toEqual([]);
  });

  test("a chamfered cap is formed along its OWN ring — P measured on the view's calibration — never along its schedule's rectangle", async () => {
    const door = await formworkDoor();
    const offer = onlyOffer(
      door.foundationFormworkRail(inputFor({ elementType: PILE_CAP, mark: "PC2", section: { width: 2100, depth: 1750 }, plan: CHAMFERED, depth: "1295" })),
      "a chamfered PC2",
    );
    expect([offer.ruleId, offer.geometry.type], "the polygon's rule, over a PRISM_POLY plan").toEqual([FOUNDATION_FORMWORK_POLY_RULE_ID, PRISM_POLY]);
    expect(Object.keys(offer.bindings).sort(), "count, the ring's length and the depth — no L and no B stand beside it").toEqual(["D", "P", "count"]);
    const ring = offer.bindings["P"];
    expect([ring?.value, ring?.unit, ring?.basis, ring?.source], "P is the ring's 6960.1 mm, MEASURED and cited to the ring — the schedule's 2100 × 1750 would say 7700").toEqual([
      "6960.1",
      MILLIMETRE,
      "MEASURED",
      RING,
    ]);
    expect(ring?.calibration, "on the calibration the view stands on (L-QTY-03)").toBeTruthy();
    expect(offer.coverage, "COMPLETE").toBe("COMPLETE");
  });

  // TEST_AMENDED (session 8, FND-OWN, I-544): a pile cap's concrete is offered under its own
  // sentence, the prism less the heads its piles own (L-MEA-09) — `rcc.pile_cap.prism_*`, never the
  // footing's. The agreement graded here is unchanged: the two kinds read one plan, by one shape's rule.
  test("a cap and its concrete agree about the plan: the rule each is offered under is the same shape's", async () => {
    const door = await formworkDoor();
    const concrete = await productModule<{ foundationConcreteRail: RailShape }>(FOUNDATIONS_RAIL_MODULE);
    for (const [plan, formwork, prism] of [
      [CHAMFERED, FOUNDATION_FORMWORK_POLY_RULE_ID, "rcc.pile_cap.prism_poly"],
      [null, FOUNDATION_FORMWORK_RECT_RULE_ID, "rcc.pile_cap.prism_rect"],
    ] as const) {
      const input = inputFor({ elementType: PILE_CAP, mark: "PC2", section: { width: 2100, depth: 1750 }, plan, depth: "1295" });
      expect(onlyOffer(door.foundationFormworkRail(input), "the formwork").ruleId, `formwork over ${plan === null ? "the schedule's section" : "the ring"}`).toBe(formwork);
      expect(onlyOffer(concrete.foundationConcreteRail({ ...input, kind: "rcc.concrete" }), "the concrete").ruleId, "and the concrete over the same plan").toBe(prism);
    }
  });

  test("what the drawing did not state keeps the row and is named: a ring with no length, a plan nobody stated, a depth nobody scheduled", async () => {
    const door = await formworkDoor();
    const unmeasuredRing = outline({ type: PRISM_POLY, area: reading("3262500.0", MILLIMETRE_SQUARED) });
    const noRing = onlyOffer(door.foundationFormworkRail(inputFor({ elementType: PILE_CAP, mark: "PC2", plan: unmeasuredRing, depth: "1295" })), "a hand-staged polygon");
    expect([noRing.coverage, noRing.omitted], "a polygon whose boundary nobody read names P, and binds no rectangle in its place (L-QTY-02, L-QTY-04)").toEqual([
      "PARTIAL_DECLARED",
      [{ variable: "P", code: FOUNDATION_PLAN_UNSTATED }],
    ]);

    const noPlan = onlyOffer(door.foundationFormworkRail(inputFor({ elementType: FOOTING, mark: "F1", depth: "450" })), "a footing with no plan");
    expect(noPlan.omitted, "a plan nobody stated names both sides").toEqual([
      { variable: "L", code: FOUNDATION_PLAN_UNSTATED },
      { variable: "B", code: FOUNDATION_PLAN_UNSTATED },
    ]);

    const noDepth = onlyOffer(door.foundationFormworkRail(inputFor({ elementType: PILE_CAP, mark: "PC2", plan: CHAMFERED })), "a cap with no depth");
    expect([noDepth.coverage, noDepth.omitted], "and a depth nobody scheduled names D — F-RCC6's mixed FOOTING SCHEDULE is such a case (I-332)").toEqual([
      "PARTIAL_DECLARED",
      [{ variable: "D", code: FOUNDATION_DEPTH_UNSTATED }],
    ]);
  });

  test("a pile is bored, not formed, and an unaffirmed view is an observation — never an offer", async () => {
    const door = await formworkDoor();
    const pile = door.foundationFormworkRail(inputFor({ elementType: PILE, mark: "P", depth: "1295" }));
    expect([pile.offers, pile.observations], "no pile formwork, and nothing said about the pile at all (R-TO-032)").toEqual([[], []]);

    const unaffirmed = door.foundationFormworkRail(inputFor({ elementType: PILE_CAP, mark: "PC2", plan: CHAMFERED, depth: "1295", affirmed: false }));
    expect(unaffirmed.offers, "nothing offered off an unaffirmed view (L-QTY-03)").toEqual([]);
    expect(unaffirmed.observations.map((one) => [one.code, one.kind]), "reported against the view, under the formwork kind").toEqual([[VIEW_SCALE_UNAFFIRMED, RCC_FORMWORK]]);
  });

  test("the roster's one `rcc.formwork` rail answers the cap after the frame's own readers", async () => {
    const barrel = await productModule<{ RAILS: Record<string, RailShape | undefined> }>(RAILS_BARREL_MODULE);
    const rail = barrel.RAILS[RCC_FORMWORK];
    expect(typeof rail, "the kind is measured by one function (L-MEA-08)").toBe("function");
    const input = inputFor({ elementType: PILE_CAP, mark: "PC2", plan: CHAMFERED, depth: "1295" });
    const answered = (rail as RailShape)(input);
    expect(
      answered.offers.map((offer) => [offer.class, offer.ruleId]),
      "the composition offers the cap exactly once, under its own rule — a second reader of the same row would bill one face twice",
    ).toEqual([[PILE_CAP, FOUNDATION_FORMWORK_POLY_RULE_ID]]);
  });

  test("the figure is the method's own: count × P × D over the ring, and count × 2 × (L + B) × D over a rectangle", async () => {
    const door = await formworkDoor();
    const { exact } = await canon();
    // A millimetre reading in metres, as the gate carries it — in the canon's exact decimal, so no
    // binary double stands between the reading and the method (B-07).
    const metres = (value: string | undefined): string => exact(String(value)).mul("0.001").toString();
    const poly = onlyOffer(door.foundationFormworkRail(inputFor({ elementType: PILE_CAP, mark: "PC2", plan: CHAMFERED, depth: "1295" })), "the PC2");
    const polyMethod = await foundationsMethod({ ruleId: poly.ruleId, version: FOUNDATIONS_VERSION });
    const polyFigure = exact(String(polyMethod.evaluate({ count: { value: "1" }, P: { value: metres(poly.bindings["P"]?.value) }, D: { value: metres(poly.bindings["D"]?.value) } })));
    expect(polyFigure.eq(exact("6.9601").mul(exact("1.295"))), `6.9601 m × 1.295 m of side (it answered ${polyFigure.toString()})`).toBe(true);

    const rect = onlyOffer(door.foundationFormworkRail(inputFor({ elementType: PILE_CAP, mark: "PC5", section: { width: 3500, depth: 3500 }, depth: "1295" })), "a PC5");
    const rectMethod = await foundationsMethod({ ruleId: rect.ruleId, version: FOUNDATIONS_VERSION });
    const rectFigure = exact(
      String(
        rectMethod.evaluate({
          count: { value: "1" },
          L: { value: metres(rect.bindings["L"]?.value) },
          B: { value: metres(rect.bindings["B"]?.value) },
          D: { value: metres(rect.bindings["D"]?.value) },
        }),
      ),
    );
    expect(rectFigure.eq(exact("14").mul(exact("1.295"))), `2 × (3.5 + 3.5) m × 1.295 m (it answered ${rectFigure.toString()})`).toBe(true);
  });
});
