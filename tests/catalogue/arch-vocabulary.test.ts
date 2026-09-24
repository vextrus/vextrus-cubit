/**
 * ARCH-2 — F-ARCH's vocabulary lands without moving a bill (AM-14 §2, AM-16(4), L-BD-08, I-540,
 * I-541).
 *
 * The opening class and the three finish kinds join the closed rosters. Two things a drafted bill
 * depends on must not move when they do, and a third must hold for the new members:
 *
 *   1. THE GROUP ORDINALS. A draft numbers its groups `S.G.I`, `G` in `ELEMENT_TYPES`-then-`KINDS`
 *      order (`numberItems`). A member inserted among the others renumbers every item behind it in
 *      every bill already drafted, so the rosters as they stood before this vocabulary are asserted
 *      to be a PREFIX of the rosters today — re-baselined, never derived, because a derivation cannot
 *      catch an insertion (B-19).
 *   2. THE BILL. The three kinds reach Finishes through the taxonomy's standing `finish` DIVISION row,
 *      so no row is added and the taxonomy's version — which every drafted document is stamped with —
 *      does not move.
 *   3. THE WORDS. The coverage grid, the certificate and the draft say a kind and a class by one rule
 *      (`inWords`, I-351); the new members read as a QS reads them.
 *
 * Nothing here opens a database (AM-10 §3).
 */
import { describe, expect, test } from "vitest";
import { ELEMENT_TYPES } from "@/core/catalogue/classes";
import { KINDS } from "@/core/catalogue/kinds";
import { descriptionOf, inWords, numberItems } from "@/core/documents/kinds/boq-draft-law";
import { plinthBoundaryOf, resolveBill } from "@/modules/takeoff/boq/resolver";

/** The element classes as they stood before F-ARCH's vocabulary, in their order. */
const CLASSES_BEFORE: readonly string[] = Object.freeze(["column", "beam", "slab", "footing", "pile_cap", "pile", "tie_beam", "shear_wall", "stair", "lintel", "brick_wall", "surface"]);

/** The kinds as they stood before F-ARCH's vocabulary, in their order. */
const KINDS_BEFORE: readonly string[] = Object.freeze([
  "rcc.concrete",
  "rcc.formwork",
  "piling.bored",
  "piling.boring",
  "earthwork.excavation",
  "pcc.blinding",
  "masonry.brickwork",
  "finish.plaster",
  "finish.paint",
  "rcc.rebar",
]);

/** F-ARCH's three finish kinds and its class. */
const ARCH_KINDS: readonly string[] = Object.freeze(["finish.flooring", "finish.tiling", "finish.skirting"]);
const OPENING = "opening";

/** A group of one line, as a section hands `numberItems` one. */
function group(klass: string, kind: string): { class: string; kind: string; items: { key: string; levelOrdinal: number }[] } {
  return { class: klass, kind, items: [{ key: `${klass}|${kind}`, levelOrdinal: 1 }] };
}

describe("ARCH-2: F-ARCH's vocabulary is appended, so no drafted bill renumbers", () => {
  test("the rosters as they stood before the vocabulary are a prefix of today's, and the new members stand after them", () => {
    expect(ELEMENT_TYPES.slice(0, CLASSES_BEFORE.length), "every class keeps its index — a class inserted among them renumbers every group behind it (AM-14 §2)").toEqual([
      ...CLASSES_BEFORE,
    ]);
    expect(KINDS.slice(0, KINDS_BEFORE.length), "every kind keeps its index, for the same reason").toEqual([...KINDS_BEFORE]);
    expect(ELEMENT_TYPES.indexOf(OPENING), "the opening class stands after every class before it").toBeGreaterThanOrEqual(CLASSES_BEFORE.length);
    for (const kind of ARCH_KINDS) {
      expect(KINDS.indexOf(kind as (typeof KINDS)[number]), `${kind} stands after every kind before it`).toBeGreaterThanOrEqual(KINDS_BEFORE.length);
    }
  });

  test("a draft's M3 groups number exactly as they did, and the new finishes number after the plaster and the paint", () => {
    const numbers = numberItems([
      {
        bill: "SUPERSTRUCTURE",
        groups: [group("brick_wall", "masonry.brickwork"), group("column", "rcc.rebar"), group("lintel", "rcc.concrete"), group("column", "rcc.concrete")],
      },
      {
        bill: "FINISHES",
        groups: [
          group("surface", "finish.skirting"),
          group("surface", "finish.paint"),
          group("surface", "finish.tiling"),
          group("surface", "finish.plaster"),
          group("surface", "finish.flooring"),
        ],
      },
    ]);
    expect(
      Object.fromEntries([...numbers.entries()].sort(([one], [other]) => (one < other ? -1 : one > other ? 1 : 0))),
      "the frame and the masonry keep their numbers; plaster and paint keep 3.1 and 3.2, and the floor finish, the tiling and the skirting follow them in the roster's order",
    ).toEqual({
      "brick_wall|masonry.brickwork": "2.4.1",
      "column|rcc.concrete": "2.1.1",
      "column|rcc.rebar": "2.2.1",
      "lintel|rcc.concrete": "2.3.1",
      "surface|finish.flooring": "3.3.1",
      "surface|finish.paint": "3.2.1",
      "surface|finish.plaster": "3.1.1",
      "surface|finish.skirting": "3.5.1",
      "surface|finish.tiling": "3.4.1",
    });
  });

  test("each new finish bills to Finishes through the standing `finish` division row, so the taxonomy moves no row", () => {
    const boundary = plinthBoundaryOf([
      { levelId: "gf", label: "GF", ordinal: 0 },
      { levelId: "1f", label: "1F", ordinal: 1 },
    ]);
    for (const kind of ARCH_KINDS) {
      const answer = resolveBill({ class: "surface", kind, levelOrdinal: 1 }, boundary);
      expect(answer.bill, `surface × ${kind} is a surface-trade item and bills to Finishes (AM-16(4): "floor and wall finishes")`).toBe("FINISHES");
      expect(answer.decidedBy, `decided by the division row the plaster and the paint's chapter already had — no group row, no taxonomy bump`).toEqual({
        row: "DIVISION",
        key: "finish",
      });
    }
  });

  test("the new members read in words the way every other kind and class does (I-351)", () => {
    expect(ARCH_KINDS.map(inWords), "the chapter drops and the trade stays").toEqual(["Flooring", "Tiling", "Skirting"]);
    expect(inWords(OPENING)).toBe("Opening");
    expect(descriptionOf("surface", "finish.tiling"), "a group is the class and the trade, as the draft prints it").toBe("Surface · Tiling");
  });
});
