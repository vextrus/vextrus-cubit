/**
 * AC-5(i) — a section whose two sides disagree about their unit is no reading at all.
 *
 * `parseSizePair` takes the first unit either side states and hands back a pair as if both sides had
 * been read in it (debt-src-modules-1cufsm4), so `12" x 300MM` — a width in inches and a depth in
 * millimetres — becomes 12 × 300 of whichever unit was written first, and a member sized from it is
 * wrong by a factor of twenty-five. A disagreement is not a size, and the parser says so.
 *
 * A pure function over strings: nothing here touches a database, a model or the sheet.
 */
import { expect, test } from "vitest";
import { notationDoor } from "../support/schedules-stage";

/** The parser this criterion is about, typed as the criterion states its answer. */
type SizePairAnswer = { readonly width: number; readonly depth: number; readonly unit: string | null } | null;

async function parseSizePair(): Promise<(text: string) => SizePairAnswer> {
  const notation = await notationDoor();
  return notation.parseSizePair as unknown as (text: string) => SizePairAnswer;
}

test("AC-5(i): two sides stating different units are no size pair", async () => {
  const parse = await parseSizePair();

  expect(
    parse('12" x 300MM'),
    "a width in inches and a depth in millimetres state no one section — taking the first unit would read 12 × 300 of it",
  ).toBeNull();
});

test("AC-5(i): one side stating a unit states it for the pair", async () => {
  const parse = await parseSizePair();

  const answered = parse("300 x 450MM");

  expect(answered, "a pair one side of which states its unit is a reading").not.toBeNull();
  expect(answered?.unit, "the stated unit is the pair's unit").toBe("mm");
  expect([answered?.width, answered?.depth], "both sides are read, in the order they were written").toEqual([300, 450]);
});

test("AC-5(i): a pair that states no unit answers with none, rather than borrowing one", async () => {
  const parse = await parseSizePair();

  const answered = parse("300 x 450");

  expect(answered, "a bare pair is still a pair").not.toBeNull();
  expect(answered?.unit, "nothing was stated, so nothing is claimed — the unit is settled elsewhere").toBeNull();
  expect([answered?.width, answered?.depth], "the sides are the numbers as written").toEqual([300, 450]);
});
