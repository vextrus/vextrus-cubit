// The unit a hand reading is carried in (I-386): the canon length unit the view is drawn full size in,
// read off its affirmed scale — and the snap reach a point is judged within, which is a real length
// carried into that unit (I-387). It stands apart from `./law` because it asks the scale law's own
// metres per unit, and the act's Consequence speaks `./law`'s types — one file reaching both would
// close a cycle through the canonical-JSON home (ARCH-01).
import { SCALE_UNITS, metresPer, metresPerExact, withinTolerance, type ScaleUnit } from "../scale/law";
import { exact, type Unit } from "../units/canon";

/** The canon length unit each mapped header spelling IS — `cm` has none, so a centimetre sheet converts to nothing. */
const CANON_OF: Readonly<Partial<Record<ScaleUnit, Unit>>> = Object.freeze({ mm: "mm", m: "m", foot: "ft", inch: "in" });

/**
 * The canon length unit a view is drawn full size in, read off its affirmed scale (I-386): the unit
 * whose metres per unit both of the view's factors equal, within the edition's verification
 * tolerance. Null where no unit the gate converts is one the factors equal — a sheet drawn to a scale
 * other than full size, or in points, pixels or centimetres — so a hand figure there would be billed
 * at the wrong size (`MANUAL_UNIT_NOT_CONVERTIBLE`).
 */
export function drawnUnitOf(factors: { readonly factorX: string; readonly factorY: string }, tolerance: string): Unit | null {
  for (const spelling of SCALE_UNITS) {
    const unit = CANON_OF[spelling];
    const metres = metresPer(spelling);
    if (unit === undefined || metres === null) continue;
    if (withinTolerance(metres, factors.factorX, tolerance) && withinTolerance(metres, factors.factorY, tolerance)) return unit;
  }
  return null;
}


/**
 * How near, in real length, a snapped point must stand to what it cites to reproduce on it (I-387):
 * one micrometre. It is float noise for a viewer computing on the drawing's own doubles, and a push no
 * bill can print — never a lattice step, which on a metre drawing is 100 mm of over-measurement room.
 */
export const SNAP_REACH_METRES = "0.000001";

/**
 * That reach in the drawing units of a view drawn full size in `drawn` (I-387): 0.001 on a millimetre
 * drawing, 0.000001 on a metre one, about 0.0000033 on a foot one. `drawn` is what `drawnUnitOf`
 * answered, so it is always a unit some mapped spelling IS.
 */
export function snapReachOf(drawn: Unit): string {
  const spelling = SCALE_UNITS.find((candidate) => CANON_OF[candidate] === drawn);
  if (spelling === undefined) throw new Error(`${drawn} is no unit a view is drawn full size in, so no snap reach is stated in it (I-386, I-387)`);
  return exact(SNAP_REACH_METRES).div(metresPerExact(spelling)).toFixed();
}
