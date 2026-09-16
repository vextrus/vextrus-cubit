// BS 8666's cutting lengths — the surface that BILLS (AM-03(c), AM-03(d)).
//
// One GENERIC form governs every shape: Σlegs − Σ bends·(0.5r + d). A shape declares its legs and
// its bends and nothing else, so shape 51 — three 90° bends and two 135° — comes out at
// 2(A+B) + 2C − 2.5r − 5d by derivation rather than by a per-code formula somebody typed, and a
// per-code formula that disagreed with the generic one could not exist to disagree.
//
// THE RAW LENGTH IS NEVER ROUNDED (AM-03(c)). `cuttingLengthOf` answers the exact decimal, fractional
// millimetres and all; `roundedCuttingLengthOf` is the ONE rounded surface — up to the next 25 mm,
// never down, because a site cannot cut a bar shorter than the detail asks for. The IS 2502 additive
// figure is a FIELD OF ITS OWN (`isAdditiveLengthOf`): recorded beside the raw, never billed, and
// never substituted for it.

import { exact } from "@/core/units/canon";
import type { ResolverMethod } from "../law";
import { DETAILING_BNBC2020_BD, bendRadiusOf, type DetailingEdition } from "./detailing-bnbc2020-bd";

/**
 * The edition a cutting length is read under where a caller names none.
 *
 * BS 8666 fixes the FORM; the bend radius and the IS allowances the form is evaluated with are
 * detailing DATA, and this tree details under one edition. A caller that details under another
 * passes it — the default is the edition of record, never a second copy of its figures (B-17).
 */
const EDITION_OF_RECORD: DetailingEdition = (DETAILING_BNBC2020_BD.resolve as () => DetailingEdition)();

/** The letters BS 8666 letters a shape's legs with, in order. */
export type LegLetter = "A" | "B" | "C" | "D" | "E" | "F";

/** The angles a bend of these shapes turns through. */
export type BendAngle = 45 | 90 | 135 | 180;

/** How many bends of one angle a shape carries. */
export type ShapeBends = { readonly angle: BendAngle; readonly count: number };

/** The shapes this tree details in: BS 8666's own codes, plus the three the site's marks spell. */
export const SHAPE_CODES = ["00", "11", "21", "51", "SP", "CT", "CRK"] as const;

/** One shape code, drawn from the closed roster above. */
export type ShapeCode = (typeof SHAPE_CODES)[number];

/** One shape: the legs it is dimensioned by, the bends it turns, and the legs that are hooks. */
export type Shape = {
  readonly legs: readonly LegLetter[];
  readonly bends: readonly ShapeBends[];
  readonly hookLegs: readonly LegLetter[];
};

/**
 * The shape table, as DATA: legs and bends, and nothing computed.
 *
 * `00` is a straight bar and `SP` a spiral turn — neither is bent, so neither takes a deduction.
 * `11` is one 90° bend, `21` two; `51` is a closed link — four sides and two 135° hook legs, three
 * 90° corners and two 135° hooks; `CT` is an open tie and `CRK` a cranked bar with four 45° kinks.
 */
export const SHAPES: Readonly<Record<ShapeCode, Shape>> = Object.freeze({
  "00": { legs: ["A"], bends: [], hookLegs: [] },
  "11": { legs: ["A", "B"], bends: [{ angle: 90, count: 1 }], hookLegs: ["B"] },
  "21": { legs: ["A", "B", "C"], bends: [{ angle: 90, count: 2 }], hookLegs: ["A", "C"] },
  "51": {
    legs: ["A", "B", "C", "D", "E", "F"],
    bends: [
      { angle: 90, count: 3 },
      { angle: 135, count: 2 },
    ],
    hookLegs: ["E", "F"],
  },
  SP: { legs: ["A"], bends: [], hookLegs: [] },
  CT: { legs: ["A", "B", "C"], bends: [{ angle: 135, count: 2 }], hookLegs: ["B", "C"] },
  CRK: { legs: ["A", "B", "C"], bends: [{ angle: 45, count: 4 }], hookLegs: [] },
} as const satisfies Record<ShapeCode, Shape>);

/** Is this a shape this tree details in? */
export function isShapeCode(value: unknown): value is ShapeCode {
  return typeof value === "string" && (SHAPE_CODES as readonly string[]).includes(value);
}

/** What a caller asks for a cutting length: the shape, the bar, and the legs the detail dimensions. */
export type CuttingProbe = {
  readonly shape: ShapeCode;
  readonly diameterMm: number;
  readonly legsMm: readonly string[];
};

/**
 * BS 8666's generic cutting length: the legs added up, less one deduction per bend.
 *
 * Each bend takes (0.5r + d): the leg dimensions are measured to the outside of the bar and the bend
 * turns inside them, so what the two legs claim between them overstates the steel by that much. This
 * is the ONE form — every code of the table is it, with that code's own legs and bends (AM-03(d)).
 */
export function genericCuttingLength(legsMm: readonly string[], bends: readonly ShapeBends[], rMm: number, dMm: number): string {
  const deduction = exact(rMm).mul(exact("0.5")).add(exact(dMm));
  let length = exact(0);
  for (const leg of legsMm) length = length.add(exact(leg));
  for (const bend of bends) length = length.sub(deduction.mul(exact(bend.count)));
  return length.toString();
}

/**
 * The raw cutting length of one bar, exact and UNROUNDED (AM-03(c)). A detail dimensioned at
 * 2843.2 mm cuts at 3083.2 mm and is recorded so: the rounding is a separate surface, applied once.
 */
export function cuttingLengthOf(probe: CuttingProbe, edition: DetailingEdition = EDITION_OF_RECORD): string {
  return genericCuttingLength(probe.legsMm, SHAPES[probe.shape].bends, bendRadiusOf(edition, probe.diameterMm), probe.diameterMm);
}

/**
 * The ONE rounded surface: the raw length taken UP to the next multiple of the edition's rounding
 * step (25 mm or less, AM-03(c)). Never down — a bar rounded down is a bar the site cannot cut.
 */
export function roundedCuttingLengthOf(rawMm: string, roundingMm = 25): string {
  const step = exact(roundingMm);
  return exact(rawMm).div(step).ceil().mul(step).toString();
}

/**
 * The IS 2502 ADDITIVE figure, recorded beside the raw length and never billed (AM-03(c)).
 *
 * The site's convention adds its hook allowances to the member dimension and deducts per bend, where
 * BS 8666 adds the dimensioned legs and deducts the bends. The two agree on most marks and part
 * company on some — a closed link comes out 20 mm shorter here — which is exactly why the figure is
 * a field of its own and never asserted equal to the raw one.
 */
export function isAdditiveLengthOf(probe: CuttingProbe, edition: DetailingEdition = EDITION_OF_RECORD): string {
  const d = exact(probe.diameterMm);
  const legs = probe.legsMm.map((leg) => exact(leg));
  const allowance = edition.isAdditive.allowance;
  const deduction = edition.isAdditive.deduction;
  const leg = (at: number): ReturnType<typeof exact> => legs[at] ?? exact(0);
  const hook90 = d.mul(exact(allowance[90]));
  const hook135 = d.mul(exact(allowance[135]));
  switch (probe.shape) {
    case "00":
    case "SP":
      return leg(0).toString();
    case "11": {
      // The site writes one 90° hook as 12d whatever the detail dimensions it at; where the detail
      // already states 12d the two are the same figure, and where it states something else the
      // allowance governs the convention's own arithmetic.
      const hooked = leg(1).eq(hook90) ? hook90 : leg(1);
      return leg(0).add(hooked).sub(d.mul(exact(deduction[90]))).toString();
    }
    case "21":
      return leg(1).add(hook90.mul(exact(2))).sub(d.mul(exact(deduction[90])).mul(exact(2))).toString();
    case "51":
      return leg(0)
        .add(leg(1))
        .mul(exact(2))
        .add(hook135.mul(exact(2)))
        .sub(d.mul(exact(deduction[90])).mul(exact(3)))
        .sub(d.mul(exact(deduction[135])).mul(exact(2)))
        .toString();
    case "CT":
      return leg(0).add(hook135.mul(exact(2))).sub(d.mul(exact(deduction[135])).mul(exact(2))).toString();
    case "CRK":
      return leg(0).add(leg(1).mul(exact(2))).sub(d.mul(exact(deduction[45])).mul(exact(4))).toString();
  }
}

/**
 * The pair that cuts a bar (L-MEA-01). It resolves to the module's own answers so an edition citing
 * `rcc.rebar.cutting_length@1` is citing code the manifest hashes whole.
 */
export const CUTTING_LENGTH_BS8666: ResolverMethod = Object.freeze({
  role: "resolver",
  ruleId: "rcc.rebar.cutting_length",
  version: "1",
  resolve: (edition: DetailingEdition, probe: CuttingProbe): { readonly rawMm: string; readonly roundedMm: string; readonly isAdditiveMm: string } => {
    const rawMm = cuttingLengthOf(probe, edition);
    return { rawMm, roundedMm: roundedCuttingLengthOf(rawMm, edition.roundingMm), isAdditiveMm: isAdditiveLengthOf(probe, edition) };
  },
});
