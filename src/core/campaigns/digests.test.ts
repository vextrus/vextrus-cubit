/**
 * AC-2(c) [debt-src-core-1eqsjms] — the catalogue digest orders pairs, not concatenations.
 *
 * L-REG-07 has a campaign snapshot the work-item catalogue "taken as a set", so the order rows were
 * read in cannot change the digest. `byPair` decides that order on `left.join("")`, which is not an
 * order over PAIRS at all: ("ab", "c") and ("a", "bc") both spell "abc", the comparator answers 0,
 * and a stable sort then leaves them in whatever order they arrived. Two reads of one relation digest
 * differently, and the freshness gate compares a campaign's snapshot against a number that moves.
 *
 * Judged as a property of the function rather than by a frozen hex: one content, permuted, must
 * digest alike — and a content that is genuinely different must not. Nothing here transcribes a
 * digest, so a lawful change to the canonical spelling passes this file unchanged (B-19).
 *
 * The pairs are the criterion's own — spellings chosen because their concatenations collide. They are
 * cast onto the row type because the collision is a property of the STRINGS, and the catalogue's
 * closed rosters happen to hold no colliding pair today; a roster that grew one tomorrow would be
 * mis-digested by exactly this defect, which is the whole reason the comparator has to be right.
 */
import { describe, expect, test } from "vitest";
import type { BearsRow } from "../catalogue/bears";
import { BEARS } from "../catalogue/bears";
import { catalogueDigest } from "./digests";

/** A (class, kind) pair, as the digest reads one — spelled freely, because the defect is about strings. */
const pair = (className: string, kind: string): BearsRow => ({ class: className, kind }) as unknown as BearsRow;

/** The two pairs whose naive concatenations collide: "ab" + "c" and "a" + "bc" are one string. */
const AB_C = pair("ab", "c");
const A_BC = pair("a", "bc");

describe("catalogueDigest orders (class, kind) pairs class-then-kind", () => {
  test("AC-2(c): two rows whose concatenations collide digest the same in either order", () => {
    expect(
      catalogueDigest([AB_C, A_BC]),
      'the catalogue is taken as a SET, so the order the rows were read in cannot move the digest — ("ab","c") and ("a","bc") both spell "abc" under a concatenating comparator, which orders neither (L-REG-07)',
    ).toBe(catalogueDigest([A_BC, AB_C]));
  });

  test("AC-2(c): and that digest is not the digest of one of them alone", () => {
    const both = catalogueDigest([AB_C, A_BC]);
    expect(both, "a pair added or removed changes the digest, or the freshness gate sees nothing move when the catalogue does (L-REG-07)").not.toBe(catalogueDigest([A_BC]));
    expect(both).not.toBe(catalogueDigest([AB_C]));
  });

  test("AC-2(c): the shipped catalogue digests the same however its rows arrive", () => {
    // The property over the product's own roster: reversed, and with a row repeated, the answer is
    // one digest — a set has no order and no multiplicity.
    const shipped = catalogueDigest(BEARS);
    expect(catalogueDigest([...BEARS].reverse()), "the shipped catalogue read backwards is the same catalogue").toBe(shipped);
    expect(catalogueDigest([...BEARS, ...BEARS]), "a row read twice is one row of the set").toBe(shipped);
  });
});
