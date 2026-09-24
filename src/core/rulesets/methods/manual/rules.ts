// Which rule a hand measurement is offered under, and where each variable of that rule comes from
// (R-TO-040, R-TO-041, s-measure I-374 and I-539).
//
// A condition names a geometry, a class and one or more kinds (I-374); a measurement taken under it
// reaches the gate as one offer per kind, and an offer names a rule and never a version — which
// version is in force is the pinned edition's to say (L-MEA-08). This file is the one home of the
// first half of that: for each (geometry, class, kind) a hand measurement may be offered under, the
// rule it names, and for each variable that rule declares, whether the trace, the multiplier, the
// condition's reading, the edition or the gate supplies it. The act snapshots the rule id it read
// here (I-374), the chest lists what may be authored from it, and the offer builder binds by it — so
// none of the three spells a rule id of its own (B-17).
//
// Only what may be offered TODAY is here: a pairing this file does not hold is a hand measurement the
// product refuses to offer rather than guesses at. Each kind's decision — a twin, a reuse of the
// machine's own pair, or not yet and why — is recorded in `docs/design/s-measure.md` (I-539), and a
// row lands here with the slice that proves it end to end.
//
// This is not a method and is in no method's closure: it decides which rule is ASKED for, never what
// a rule computes, so editing it moves no figure a standing pair answers (L-MEA-01).
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import { CHANNEL_THRESHOLD, CHANNEL_VARIABLE } from "@/core/gate/deductions";
import { THRESHOLD_VARIABLE, type DeductionChannel } from "@/core/offers/law";
import { type ManualGeometry } from "@/core/manual/law";
import { MANUAL_BLINDING_METHOD } from "./blinding";

// The manual geometry roster's one home is S1's `src/core/manual/law.ts` (I-539, ARCH-02): read from
// there and re-exported for this area's readers, never restated.
export { MANUAL_GEOMETRIES, type ManualGeometry } from "@/core/manual/law";

/**
 * Where a hand measurement takes one variable its rule declares from.
 * - `trace`: the geometry itself — a ring's area, a run's length, the number of points counted;
 * - `multiplier`: how many like items the one trace stands for — 1, or a typical's ×n (R-TO-040);
 * - `recipe`: a reading the condition states (ENTERED) or a drawing note the card binds
 *   (TRANSCRIBED), never a default (L-MEA-06, I-374);
 * - `edition`: a parameter of the pinned edition, bound DERIVED — the threshold in force, which
 *   L-MEA-02 has land in the line's variables;
 * - `gate`: a channel's deducted sum, which only the gate binds (L-MEA-02, L-MEA-08). The offer
 *   carries that channel's candidates instead.
 */
export type ManualSupply =
  | { readonly from: "trace" }
  | { readonly from: "multiplier" }
  | { readonly from: "recipe" }
  | { readonly from: "edition"; readonly parameter: string }
  | { readonly from: "gate"; readonly channel: DeductionChannel };

/** One pairing a hand measurement may be offered under. */
export type ManualRule = {
  readonly geometry: ManualGeometry;
  readonly class: ElementType;
  readonly kind: Kind;
  /** The rule the offer names; the version is the pinned edition's (L-MEA-08). */
  readonly ruleId: string;
  /** Every variable the rule declares, and what supplies it — no more and no fewer. */
  readonly supply: Readonly<Record<string, ManualSupply>>;
};

const TRACE: ManualSupply = Object.freeze({ from: "trace" as const });
const MULTIPLIER: ManualSupply = Object.freeze({ from: "multiplier" as const });
const RECIPE: ManualSupply = Object.freeze({ from: "recipe" as const });

/**
 * The variables a method's deduction channels fill, each keyed by the variable the gate binds that
 * channel's sum into, and — for the one channel the edition partitions — the threshold in force.
 * Read off the gate's own maps (`CHANNEL_VARIABLE`, `CHANNEL_THRESHOLD`), so this roster never spells
 * a channel's variable or parameter a second time (B-17).
 */
export function channelSupplies(channels: readonly DeductionChannel[]): Record<string, ManualSupply> {
  const supplies: Record<string, ManualSupply> = {};
  const thresholds: string[] = [];
  for (const channel of channels) {
    supplies[CHANNEL_VARIABLE[channel]] = Object.freeze({ from: "gate" as const, channel });
    const parameter = CHANNEL_THRESHOLD[channel];
    if (parameter !== null) thresholds.push(parameter);
  }
  // One `threshold` variable is all a method declares: two partitioned channels on one method would
  // need two, and that is a new method shape rather than a roster row.
  if (thresholds.length > 1) throw new Error(`channels ${channels.join(", ")} name ${thresholds.length} thresholds; a manual method declares one (L-MEA-02)`);
  const [threshold] = thresholds;
  if (threshold !== undefined) supplies[THRESHOLD_VARIABLE] = Object.freeze({ from: "edition" as const, parameter: threshold });
  return supplies;
}

/**
 * Every pairing a hand measurement may be offered under today.
 *
 * - A slab's blinding, traced as a ring: `pcc.blinding.area`, the twin (I-388). The ring is the area;
 *   the cut-outs the QS traces as openings are partitioned by the edition's threshold, the members
 *   standing through the ring come off whole (I-389), and the thickness is the condition's or the
 *   note's (for S-08, "75 THK BLINDING UNDER", I-393). Only the slab's: a pile cap's blinding owes
 *   the piles standing through it, which nothing offers from a hand trace yet, and a footing's waits
 *   for a proof that walks one (I-539).
 */
export const MANUAL_RULES: readonly ManualRule[] = Object.freeze([
  Object.freeze({
    geometry: "POLYGON",
    class: "slab",
    kind: "pcc.blinding",
    ruleId: MANUAL_BLINDING_METHOD.ruleId,
    supply: Object.freeze({
      count: MULTIPLIER,
      A: TRACE,
      t: RECIPE,
      ...channelSupplies(["opening", "junction"]),
    }),
  }),
] satisfies readonly ManualRule[]);

/** The pairing a hand measurement of this geometry, class and kind is offered under, or nothing. */
export function manualRuleOf(geometry: ManualGeometry, klass: ElementType, kind: Kind): ManualRule | undefined {
  return MANUAL_RULES.find((rule) => rule.geometry === geometry && rule.class === klass && rule.kind === kind);
}
