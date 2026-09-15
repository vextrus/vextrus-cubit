/**
 * AC-1's GATE half: `CHANNEL_VARIABLE`, and the one binding a rail may never make (L-MEA-02, L-MEA-08,
 * L-QTY-03).
 *
 * "The gate reads deduction thresholds from the edition and partitions strictly-greater" — so the
 * DEDUCTED SUM is a figure only the gate knows, and binding it is the gate's act alone. This drives the
 * gate directly, with offers built by hand rather than by a rail, because what is graded is the
 * contract between them: an offer that hands candidates and leaves the variable alone publishes with
 * the sum bound DERIVED beside its own readings; an offer that binds the variable itself, or declares
 * it omitted, is refused OFFER_NOT_TO_CONTRACT and publishes nothing.
 *
 * Which variable a channel binds into is asked of `CHANNEL_VARIABLE` rather than spelled in the
 * assertions, so a channel added later is judged by the same law without an edit here (B-19).
 */
import { afterAll, describe, expect, test } from "vitest";
import { bindingsIn, measure, offer, type OfferShape } from "./support/gate-stage";
import {
  DEDUCTED,
  OFFER_NOT_TO_CONTRACT,
  OPENING_CHANNEL,
  OPENINGS_VARIABLE,
  RCC_CONCRETE,
  RULE,
  SLAB,
  canon,
  carried,
  channelVariable,
  closeStage,
  gateSeam,
  linesFor,
  methodOf,
  reading,
  registerPlanObjects,
  slabPanel,
  stageSlabWallStairCampaign,
  type Canon,
  type PlanDraft,
  type SlabWallStairCampaign,
} from "../rails/support/slab-wall-stair-stage";

afterAll(async () => {
  await closeStage();
});

const LEVEL = { label: "1F", ordinal: 1, height: "3" };

/** The three rows the three offers of this case stand on — one each, by the store's natural key. */
const NAMES = ["LAWFUL", "BINDS-IT", "OMITS-IT"] as const;

/** A staged slab row per offer: what the offer is measured FOR, never what it is measured from. */
const DRAFTS: readonly PlanDraft[] = NAMES.map((name) => ({
  placementKey: `CHANNEL-${name}`,
  elementType: SLAB,
  mark: "S1",
  level: LEVEL.label,
  reading: slabPanel({ area: reading("120", "m2"), freeEdge: reading("0", "m"), thickness: reading("150", "mm") }),
}));

/** The openings the gate is handed: two the edition's threshold keeps, one it takes off. */
const OPENINGS = ["0.09", "0.10", "4"];

/** The sum of the deducted candidates alone — 4 m2 — which is what the gate must bind. */
const DEDUCTED_SUM = "4";

let it: SlabWallStairCampaign;
let keys: Record<string, string>;
let units: Canon;
let loading: Promise<void> | undefined;

/**
 * The three rows, staged once and shared. They are staged INSIDE the tests rather than in a
 * `beforeAll`, so a product surface that does not exist yet fails each criterion's own assertion by
 * name — a hook that throws reports a suite that never ran, which reads as a defect in the acceptance
 * rather than as the red it is.
 */
const load = (): Promise<void> => (loading ??= build());

/** How long the case may take to stage before anything is asked of the gate. */
const STAGING_BUDGET = 300_000;

async function build(): Promise<void> {
  units = await canon();
  it = await stageSlabWallStairCampaign("channel", [LEVEL]);
  const { objects } = await registerPlanObjects(it, DRAFTS);
  keys = Object.fromEntries(NAMES.map((name, at) => [name, (objects[at] as { objectKey: string }).objectKey]));
}

/** One offer under the slab's concrete rule, with whatever a case adds to its bindings or omissions. */
function slabOffer(name: (typeof NAMES)[number], extra: { bindings?: Record<string, ReturnType<typeof measure>>; omitted?: readonly { variable: string; code: string }[] } = {}): OfferShape {
  return offer({
    objectKey: keys[name] as string,
    setRevisionId: it.setRevisionId,
    kind: RCC_CONCRETE,
    class: SLAB,
    ruleId: RULE.slabConcrete,
    geometryType: "AREA_THICK",
    calibration: "cal-channel",
    bindings: { ...bindingsIn("m2", { A: "120", A_members: "3.5" }), count: measure("1", "pcs"), t: measure("150", "mm"), ...(extra.bindings ?? {}) },
    deductions: OPENINGS.map((area) => ({ channel: OPENING_CHANNEL, measure: measure(area, "m2") })),
    ...(extra.omitted === undefined ? {} : { omitted: extra.omitted, coverage: "PARTIAL_DECLARED" }),
  });
}

describe("AC-1: the channel a method declares names the variable the gate binds", () => {
  test("AC-1: `CHANNEL_VARIABLE` maps the `opening` channel onto `openings`, and every channel it maps is a variable name", async () => {
    await load();
    const map = await channelVariable();

    expect(map[OPENING_CHANNEL], `the \`${OPENING_CHANNEL}\` channel's deducted sum is bound into \`${OPENINGS_VARIABLE}\` (interfaces)`).toBe(OPENINGS_VARIABLE);
    for (const [channel, variable] of Object.entries(map)) {
      expect(typeof variable === "string" && variable.length > 0, `the ${channel} channel names the variable it binds into — a channel bound into nothing binds nothing`).toBe(true);
    }
  }, STAGING_BUDGET);

  test("AC-1: a method that declares a channel declares the variable that channel binds into", async () => {
    await load();
    const map = await channelVariable();
    const method = await methodOf(RULE.slabConcrete);
    const declared = method.variables.map((variable) => variable.name);

    for (const channel of method.deductionChannels) {
      const variable = map[channel];
      expect(variable, `${RULE.slabConcrete} declares the ${channel} channel, so \`CHANNEL_VARIABLE\` knows where its sum goes (interfaces)`).toBeTruthy();
      expect(declared, `and ${RULE.slabConcrete} declares \`${String(variable)}\` itself — a method declaring a channel declares its variable`).toContain(variable);
      expect(
        method.variables.find((held) => held.name === variable)?.dimension,
        `stated in the dimension the channel's candidates are read in — an ${channel} is an area (interfaces)`,
      ).toBe("AREA");
    }
  }, STAGING_BUDGET);
});

describe("AC-1: the gate binds the deducted sum itself", () => {
  test("AC-1: an offer that hands candidates and binds no `openings` publishes, with the sum bound DERIVED from the object it was measured for", async () => {
    await load();
    const gate = await gateSeam();
    const verdict = await gate.evaluateOffers(it.gateScope, { offers: [slabOffer("LAWFUL")], observations: [] });
    expect({ published: verdict.published, refused: verdict.refused }, `the lawful offer publishes: ${JSON.stringify(verdict.refusals)}`).toEqual({ published: 1, refused: 0 });

    const published = linesFor(it, RCC_CONCRETE, keys["LAWFUL"] as string);
    expect(published.length, "one line for the object, of the one kind").toBe(1);
    const bound = carried<Record<string, { basis?: string; source?: string; canonical?: { value: string; unit: string } }>>(published[0] as never, "bindings", "bindings")[OPENINGS_VARIABLE];

    expect(bound, `the gate bound \`${OPENINGS_VARIABLE}\` on the line, beside the readings the offer made (interfaces)`).toBeTruthy();
    expect(
      units.exact(String(bound?.canonical?.value)).eq(units.exact(DEDUCTED_SUM)),
      `at the exact sum of the ${DEDUCTED} candidates alone — the two at or below the edition's threshold contribute nothing (L-MEA-02); it is ${JSON.stringify(bound?.canonical)}`,
    ).toBe(true);
    expect(bound?.canonical?.unit, "carried to the canonical unit of the declared variable's dimension (L-FRM-06)").toBe(units.CANONICAL_UNIT["AREA"]);
    expect(bound?.basis, "and recorded as DERIVED — nobody read it off a drawing, the gate computed it (L-QTY-01)").toBe("DERIVED");
    expect(bound?.source, "provenanced to the register object the offer was made for (L-QTY-03)").toBe(keys["LAWFUL"]);
  }, STAGING_BUDGET);

  test("AC-1: an offer that binds `openings` itself is refused OFFER_NOT_TO_CONTRACT and publishes no line", async () => {
    await load();
    const gate = await gateSeam();
    const verdict = await gate.evaluateOffers(it.gateScope, { offers: [slabOffer("BINDS-IT", { bindings: { [OPENINGS_VARIABLE]: measure("0", "m2") } })], observations: [] });

    expect(
      verdict.refusals.map((refusal) => refusal.code),
      `the deducted sum is the gate's figure: a rail that binds \`${OPENINGS_VARIABLE}\` is stating a partition it never made (interfaces)`,
    ).toEqual([OFFER_NOT_TO_CONTRACT]);
    expect(verdict.published, "and nothing publishes for it").toBe(0);
    expect(linesFor(it, RCC_CONCRETE, keys["BINDS-IT"] as string), "the store holds no line for the refused offer's object").toEqual([]);
  }, STAGING_BUDGET);

  test("AC-1: an offer that declares `openings` omitted is refused the same way — the variable is not the rail's to speak about", async () => {
    await load();
    const gate = await gateSeam();
    const verdict = await gate.evaluateOffers(it.gateScope, {
      offers: [slabOffer("OMITS-IT", { omitted: [{ variable: OPENINGS_VARIABLE, code: "STOREY_HEIGHT_UNSTATED" }] })],
      observations: [],
    });

    expect(
      verdict.refusals.map((refusal) => refusal.code),
      `an offer that omits \`${OPENINGS_VARIABLE}\` is claiming the gate's own binding was not available to it (interfaces)`,
    ).toEqual([OFFER_NOT_TO_CONTRACT]);
    expect(linesFor(it, RCC_CONCRETE, keys["OMITS-IT"] as string), "and nothing is published for it").toEqual([]);
  }, STAGING_BUDGET);
});
