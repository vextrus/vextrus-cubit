/**
 * One storey, spelled two ways (L-MEA-07, L-QTY-01; the M3 drawing's column schedule).
 *
 * F-RCC6-BNBC bands its column sections "GF TO 2ND" and "3RD & 4TH" on S-11 while its building section
 * marks the same storeys "2F" and "3F", so a placement that compared the spellings letter by letter
 * covered no column with any band. `sameStorey` is the grammar's one reading of when two spellings
 * name one storey, and it is registered with core's band placement at this module's load — so the
 * placement is proved here through core's own door, over a stack labelled the way the drawing's
 * section labels one.
 */
import { describe, expect, test } from "vitest";
import { placedBy } from "@/core/offers/contract";
import { sameStorey } from "@/modules/takeoff/partition/notation";

describe("sameStorey: the grammar's reading of one storey spelled two ways", () => {
  test("an ordinal word and a floor label with the same count are one storey", () => {
    expect(sameStorey("3RD", "3F")).toBe(true);
    expect(sameStorey("3F", "3RD")).toBe(true);
    expect(sameStorey("1ST FLOOR", "1F")).toBe(true);
    expect(sameStorey("2ND", "2F")).toBe(true);
    expect(sameStorey("6TH", "6F")).toBe(true);
  });

  test("the named levels meet their own spellings and nothing else", () => {
    expect(sameStorey("GF", "GROUND")).toBe(true);
    expect(sameStorey("GF", "GRD")).toBe(true);
    expect(sameStorey("ROOF", "RF")).toBe(true);
    expect(sameStorey("GF", "1F")).toBe(false);
    expect(sameStorey("ROOF", "6F")).toBe(false);
  });

  test("different counts are different storeys, and a word the grammar cannot read meets only itself", () => {
    expect(sameStorey("2ND", "3F")).toBe(false);
    expect(sameStorey("4TH", "3RD")).toBe(false);
    expect(sameStorey("SRR", "ROOF")).toBe(false);
    expect(sameStorey("SRR", "SRR")).toBe(true);
    expect(sameStorey("srr", "SRR")).toBe(true);
  });
});

describe("core's band placement places a band's ends by that reading once the grammar is loaded", () => {
  /** The stack as the drawing's section marks it — and as F-RCC6-BNBC's proposed stack stands. */
  const STACK = [
    { label: "GF", ordinal: 0 },
    { label: "1F", ordinal: 1 },
    { label: "2F", ordinal: 2 },
    { label: "3F", ordinal: 3 },
    { label: "4F", ordinal: 4 },
    { label: "ROOF", ordinal: 5 },
  ];

  test("the column schedule's band words place on the section's floor labels", () => {
    const place = placedBy(STACK);
    expect(place("GF"), "a label the stack carries verbatim places by itself").toBe(0);
    expect(place("2ND"), "the band's ordinal word places on the floor label with its count").toBe(2);
    expect(place("3RD")).toBe(3);
    expect(place("4TH")).toBe(4);
    expect(place("ROOF")).toBe(5);
    expect(place("SRR"), "a storey the stack does not carry places nowhere — the band stays unjudgeable, never guessed").toBeUndefined();
    expect(place("7TH"), "and a count the stack does not reach places nowhere").toBeUndefined();
  });
});
