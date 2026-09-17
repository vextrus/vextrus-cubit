/**
 * AC-2(a) [debt-src-core-jy0b4z] — the lattice a placement key is quantised onto is decimal.
 *
 * L-REG-04 derives a key from what was seen, and the coordinate it carries is "the fixed one-decimal
 * string" the number rounds to, half away from zero. `Math.round(n * 10)` asks that question of the
 * BINARY double nearest the number instead: 4.35 is held as 4.3499999999999996, so the lattice point
 * a person reads off the drawing and the one the key carries are different points — and two keys that
 * disagree about one placement are two identities for one thing.
 *
 * The tree already holds the exact-decimal arithmetic the question is asked in (`exact`, the canon's
 * one home, B-17). What is judged here is the ANSWER, never the arithmetic: each case names a number
 * whose shortest decimal spelling lies exactly on a lattice boundary, and the lattice point it must
 * land on.
 */
import { describe, expect, test } from "vitest";
import { quantise } from "./keys";

/**
 * The boundary cases, as the criterion names them: a number whose shortest decimal spelling sits
 * exactly halfway between two lattice points goes AWAY from zero, and the same magnitude answers the
 * same point on both sides of zero.
 */
const HALFWAY: readonly (readonly [number, string])[] = [
  [4.35, "4.4"],
  [-4.35, "-4.4"],
  [1.15, "1.2"],
];

describe("quantise rounds on the number's shortest decimal spelling", () => {
  test.each(HALFWAY)("AC-2(a): quantise(%s) lands on %s — half away from zero, decided in decimal", (n, expected) => {
    expect(
      quantise(n),
      `${String(n)} spells a coordinate exactly halfway between two 0.1 lattice points, so it rounds away from zero; a binary round decides it by the double nearest ${String(n)} instead (L-REG-04)`,
    ).toBe(expected);
  });

  test("AC-2(a): the magnitude alone decides the lattice point — a coordinate reads the same either side of zero", () => {
    for (const [n] of HALFWAY) {
      const magnitude = Math.abs(n);
      expect(quantise(-magnitude), `${String(magnitude)} and ${String(-magnitude)} are one distance from the origin, so one lattice point answers both (L-REG-04)`).toBe(`-${quantise(magnitude)}`);
    }
  });

  test("AC-2(a): a coordinate inside the first lattice cell spells zero once, with no sign", () => {
    expect(quantise(-0.04), "-0.0 and 0.0 are the same lattice point, and two spellings of one point would be two keys for one placement (L-REG-04)").toBe("0.0");
  });

  test("AC-2(a): a non-finite coordinate still quantises to nothing at all", () => {
    for (const n of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => quantise(n), `${String(n)} is no point of a drawing, so it is a mistake in the caller rather than a lattice point (L-REG-04, ARCH-03)`).toThrow();
    }
  });
});
