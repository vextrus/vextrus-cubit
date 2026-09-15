/**
 * AC-1 and AC-2's RAIL half — what the two rails offer over one slab panel (L-MEA-08, L-MEA-09/AM-02,
 * AM-06 §3, L-MEA-02, L-FRM-03).
 *
 * A rail "is a pure function returning `{ offers, observations }`" that reaches no store and no clock,
 * so what is graded here is the offer itself: the rule it names, the geometry it stands in, the
 * candidates it hands the gate for the `opening` channel, and — the half a line alone could not show —
 * the variable it must NOT bind, because the gate's own binding of the deducted sum is what AC-1 makes
 * the contract (an offer that binds `openings` itself is refused OFFER_NOT_TO_CONTRACT).
 *
 * The declared variables are read from the method the registry resolves, never transcribed here: what
 * "binds no soffit area at all" means is the edge rule's OWN declaration, so a rule that later gains a
 * variable is judged against its new declaration rather than against today's list (B-19).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  AREA_THICK,
  CALIBRATION_KEY,
  GROUND,
  OPENING_CHANNEL,
  OPENINGS_VARIABLE,
  RCC_CONCRETE,
  RCC_FORMWORK,
  RULE,
  SLAB,
  canon,
  closeStage,
  methodOf,
  railInput,
  railsRoster,
  reading,
  registerPlanObjects,
  resolved,
  setupWith,
  slabPanel,
  slabWallStairDoor,
  slabsRails,
  stageSlabWallStairCampaign,
  type OfferShape,
  type PlanDraft,
  type RailSetupShape,
  type SlabWallStairCampaign,
} from "./support/slab-wall-stair-stage";

afterAll(async () => {
  await closeStage();
});

/** The one level AC-1's panel stands on. */
const LEVEL = { label: "1F", ordinal: 1, height: "3" };

/** The three openings AC-1 states, two below the edition's 0.1 m2 threshold and one far above it. */
const OPENINGS = ["0.09", "0.10", "4"];

/** AC-1's panel, and AC-2's slab-on-grade sibling beside it. */
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
      openings: OPENINGS.map((area) => reading(area, "m2")),
    }),
  },
  {
    placementKey: "GRADE-1F",
    elementType: SLAB,
    mark: "S2",
    level: LEVEL.label,
    reading: slabPanel({ bearing: GROUND, area: reading("200", "m2"), freeEdge: reading("40", "m"), thickness: reading("150", "mm") }),
  },
];

type Staged = { it: SlabWallStairCampaign; setup: RailSetupShape; panel: string; grade: string };

let staging: Promise<Staged> | undefined;

const stage = (): Promise<Staged> =>
  (staging ??= (async () => {
    const it = await stageSlabWallStairCampaign("offers", [LEVEL]);
    const { objects, plans } = await registerPlanObjects(it, DRAFTS);
    return { it, setup: setupWith(it, { plans }), panel: (objects[0] as { objectKey: string }).objectKey, grade: (objects[1] as { objectKey: string }).objectKey };
  })());

/** Every offer one rail made for one register object. */
async function offersFor(kind: string, objectKey: string): Promise<OfferShape[]> {
  const { it, setup } = await stage();
  const door = await slabWallStairDoor();
  const rail = kind === RCC_CONCRETE ? door.slabWallStairConcreteRail : door.slabWallStairFormworkRail;
  return [...rail(railInput(it, kind, setup)).offers].filter((offer) => offer.register.objectKey === objectKey);
}

describe("AC-1: the slab panel, as the concrete rail offers it", () => {
  test("AC-1: one AREA_THICK offer under `rcc.slab.concrete`, standing on the register row and the affirmed calibration", async () => {
    const { panel } = await stage();
    const offered = await offersFor(RCC_CONCRETE, panel);

    expect(offered.length, "one slab panel on one level is one concrete offer — a rail expands per (row, level), never per drawing (L-FRM-02)").toBe(1);
    const offer = offered[0] as OfferShape;
    expect(offer.ruleId, "offered under the slab's own concrete rule, and naming a rule rather than a version (interfaces)").toBe(RULE.slabConcrete);
    expect(offer.kind, "of the kind this rail measures (L-MEA-08)").toBe(RCC_CONCRETE);
    expect(offer.class, "for the class the register row stands in").toBe(SLAB);
    expect(offer.geometry.type, "a slab plate is measured as an area through a thickness (L-FRM-02)").toBe(AREA_THICK);
    expect(offer.geometry.calibration, "and stands on the affirmed calibration of the view its placement was read in (L-QTY-03)").toBe(CALIBRATION_KEY);
  });

  test("AC-1: one `opening` candidate per opening the reading states — the rail partitions none of them", async () => {
    const { panel } = await stage();
    const offer = (await offersFor(RCC_CONCRETE, panel))[0] as OfferShape;

    expect(
      offer.deductions.map((candidate) => candidate.channel),
      `every opening the reading states is handed to the gate as an \`${OPENING_CHANNEL}\` candidate — the threshold is the edition's, not the rail's (L-MEA-02)`,
    ).toEqual(OPENINGS.map(() => OPENING_CHANNEL));
    const units = await canon();
    expect(
      offer.deductions.map((candidate) => units.exact(candidate.measure.value).toString()).sort(),
      "and each candidate carries the opening it was read as, below the threshold as readily as above it (L-MEA-02: below-threshold openings are ignored by rule and LISTED)",
    ).toEqual(OPENINGS.map((area) => units.exact(area).toString()).sort());
  });

  test("AC-1: the offer binds every declared variable but `openings` — the deducted sum is the gate's to bind", async () => {
    const { panel } = await stage();
    const offer = (await offersFor(RCC_CONCRETE, panel))[0] as OfferShape;
    const method = await methodOf(RULE.slabConcrete);

    expect(
      method.deductionChannels,
      `${RULE.slabConcrete} declares the ${OPENING_CHANNEL} channel — a method that declares a channel declares its variable too (interfaces)`,
    ).toContain(OPENING_CHANNEL);
    expect(
      method.variables.map((variable) => variable.name),
      `and declares \`${OPENINGS_VARIABLE}\`, which is where the gate binds the channel's deducted sum`,
    ).toContain(OPENINGS_VARIABLE);

    expect(
      Object.keys(offer.bindings).includes(OPENINGS_VARIABLE),
      `the rail binds no \`${OPENINGS_VARIABLE}\`: the gate binds the deducted sum itself, and an offer that binds it is refused OFFER_NOT_TO_CONTRACT (interfaces)`,
    ).toBe(false);
    expect(
      method.variables.map((variable) => variable.name).filter((name) => name !== OPENINGS_VARIABLE && !Object.keys(offer.bindings).includes(name)),
      "and binds every other variable the method declares — a COMPLETE row leaves nothing out (L-QTY-02)",
    ).toEqual([]);
  });
});

describe("AC-2: the formwork rail, soffit against edge", () => {
  test("AC-2: a framed panel is offered under `rcc.slab.formwork`, binding the free-edge run and the beam soffits", async () => {
    const { panel } = await stage();
    const offered = await offersFor(RCC_FORMWORK, panel);

    expect(offered.length, "a framed panel's soffit is one formwork offer (AM-06 §3)").toBe(1);
    const offer = offered[0] as OfferShape;
    expect(offer.ruleId, "under the framed-soffit rule (interfaces)").toBe(RULE.slabFormwork);
    expect(offer.kind, "of the formwork kind (L-MEA-08)").toBe(RCC_FORMWORK);
    const units = await canon();
    expect(units.exact(String(offer.bindings["L_edge"]?.value)).eq(units.exact("12")), "binding the free edges the reading states as `L_edge` (AC-2)").toBe(true);
    expect(units.exact(String(offer.bindings["A_beams"]?.value)).eq(units.exact("20")), "and the beam soffits it stands over as `A_beams` — the beam owns that face (L-MEA-09)").toBe(true);
  });

  test("AC-2: a slab on grade forms edges only — offered under `rcc.slab.edge-formwork`, binding no soffit area at all", async () => {
    const { grade } = await stage();
    const offered = await offersFor(RCC_FORMWORK, grade);

    expect(offered.length, "a slab on grade is still one formwork offer — its edges (AM-06 §3)").toBe(1);
    const offer = offered[0] as OfferShape;
    expect(offer.ruleId, "under the edge-only rule, never the soffit rule (interfaces)").toBe(RULE.slabEdgeFormwork);

    const method = await methodOf(RULE.slabEdgeFormwork);
    expect(
      Object.keys(offer.bindings).sort(),
      `the offer binds exactly what ${RULE.slabEdgeFormwork} declares — ground bears the slab, so no soffit area is formed and none is bound (AC-2)`,
    ).toStrictEqual(method.variables.map((variable) => variable.name).sort());
    expect(offer.deductions, "and an edge run has no opening channel to partition at all (interfaces)").toEqual([]);
  });
});

describe("AC-1, AC-2: the roster the measure job runs answers both kinds through this area", () => {
  test("AC-1: `SLABS_RAILS` names this area's two kinds, and the barrel answers both", async () => {
    const door = await slabWallStairDoor();
    const area = await slabsRails();
    const rails = await railsRoster();

    expect(area[RCC_CONCRETE], `${RCC_CONCRETE} is measured by this area's concrete rail (interfaces)`).toBe(door.slabWallStairConcreteRail);
    expect(area[RCC_FORMWORK], `${RCC_FORMWORK} is measured by this area's formwork rail (interfaces)`).toBe(door.slabWallStairFormworkRail);
    for (const kind of [RCC_CONCRETE, RCC_FORMWORK]) {
      expect(typeof rails[kind], `\`RAILS\` answers ${kind} — a rail is selected per quantity kind (L-MEA-08)`).toBe("function");
    }
  });
});
