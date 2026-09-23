/**
 * s-takeoff I-350 — the register's lines stand in the order a quantity surveyor reads them.
 *
 * One campaign publishes at one instant, so the store's `published_at, line_id` order was the order of
 * the line ids: in F-RCC6-BNBC's M3 run the Foundation · Pile group read P27 Bored, P50 Concrete, P4
 * Boring, P38 Bored … — one pile's three lines scattered across 267 rows while the tree beside them
 * listed P1 … P89. The reading now sorts its lines by level (the foundation, then the stack by its
 * ordinal, then whatever the stack does not place), class, mark in natural order, and kind. The rule
 * is pure and lives in one home (`register-ui/order.ts`), the tree's mark order with it, so it is
 * judged here without a database; the reading's use of it is the one `sort` in `server.ts`.
 */
import { describe, expect, test } from "vitest";
import { levelRank, markOrder, readingOrder, type LineRank } from "../../../src/modules/takeoff/register-ui/order";

const ORDINALS: ReadonlyMap<string, number> = new Map([
  ["level-gf", 0],
  ["level-1f", 1],
  ["level-2f", 2],
]);

function line(over: Partial<LineRank> & { readonly lineId: string }): LineRank {
  return { rank: 0, level: "GF", class: "column", mark: "C1", kind: "rcc.concrete", ...over };
}

const pile = (mark: string, kind: string, lineId: string): LineRank =>
  line({ rank: levelRank({ levelId: null, levelSlot: "FOUNDATION" }, ORDINALS), level: "FOUNDATION", class: "pile", mark, kind, lineId });

describe("I-350: the register reads level by level, member by member", () => {
  test("one pile's three lines stand together, and the piles read P4, P27, P50 — never in line-id order", () => {
    // The line ids are uuids in the store; here they are chosen to sort AGAINST the reading order, so
    // a sort that fell through to the id would be caught.
    const published = [
      pile("P27", "piling.bored", "a1"),
      pile("P50", "rcc.concrete", "a2"),
      pile("P4", "piling.boring", "a3"),
      pile("P27", "rcc.concrete", "a4"),
      pile("P4", "piling.bored", "a5"),
      pile("P50", "piling.bored", "a6"),
      pile("P4", "rcc.concrete", "a7"),
      pile("P27", "piling.boring", "a8"),
      pile("P50", "piling.boring", "a9"),
    ];
    const read = [...published].sort(readingOrder).map((held) => `${held.mark} ${held.kind}`);
    expect(read).toEqual([
      "P4 piling.bored",
      "P4 piling.boring",
      "P4 rcc.concrete",
      "P27 piling.bored",
      "P27 piling.boring",
      "P27 rcc.concrete",
      "P50 piling.bored",
      "P50 piling.boring",
      "P50 rcc.concrete",
    ]);
  });

  test("the foundation stands below the stack, the stack reads by its ordinal, and what it does not place reads last", () => {
    const published = [
      line({ lineId: "z1", rank: levelRank({ levelId: "level-2f", levelSlot: null }, ORDINALS), level: "2F" }),
      line({ lineId: "z2", rank: levelRank({ levelId: null, levelSlot: "UNRESOLVED" }, ORDINALS), level: "UNRESOLVED" }),
      line({ lineId: "z3", rank: levelRank({ levelId: "level-gf", levelSlot: null }, ORDINALS), level: "GF" }),
      line({ lineId: "z4", rank: levelRank({ levelId: null, levelSlot: "FOUNDATION" }, ORDINALS), level: "FOUNDATION", class: "pile_cap" }),
      line({ lineId: "z5", rank: levelRank({ levelId: "level-1f", levelSlot: null }, ORDINALS), level: "1F" }),
      line({ lineId: "z6", rank: levelRank({ levelId: null, levelSlot: "FOUNDATION" }, ORDINALS), level: "FOUNDATION", class: "pile" }),
      line({ lineId: "z7", rank: levelRank(undefined, ORDINALS), level: "" }),
    ];
    const read = [...published].sort(readingOrder).map((held) => `${held.level}·${held.class}`);
    expect(read, "Foundation · Pile before Foundation · Pile cap, then GF, 1F, 2F, then the unplaced").toEqual([
      "FOUNDATION·pile",
      "FOUNDATION·pile_cap",
      "GF·column",
      "1F·column",
      "2F·column",
      "·column",
      "UNRESOLVED·column",
    ]);
  });

  test("a level the stack no longer holds is ranked with the unplaced, never ahead of the stack", () => {
    expect(levelRank({ levelId: "level-gone", levelSlot: null }, ORDINALS)).toBe(Number.POSITIVE_INFINITY);
  });

  test("the order is total: two lines alike in every reading fact are still placed by their id", () => {
    const [first, second] = [line({ lineId: "b" }), line({ lineId: "a" })];
    expect([first, second].sort(readingOrder).map((held) => held.lineId)).toEqual(["a", "b"]);
  });

  test("marks read in natural order, the tree's rule and the grid's the same function", () => {
    // `P02` and `P2` are one value in two spellings: they read together, the code point order breaking
    // the tie so the order is still total.
    expect(["P10", "P1", "P2", "C1A", "C1", "P02"].sort(markOrder)).toEqual(["C1", "C1A", "P1", "P02", "P2", "P10"]);
  });
});
