// A reading a rail is handed cites the atom it was read from, or it is not handed over at all
// (L-QTY-03, L-CAD-03).
import { describe, expect, it } from "vitest";
import { readingSetupOf } from "./setup";

describe("readingSetupOf", () => {
  const reading = { value: "3200", unit: "mm", basis: "DERIVED" as const, sourceKeys: ["ent-9", "ent-10"] };

  it("carries the first cited entity as the source", () => {
    expect(readingSetupOf(reading)).toEqual({ value: "3200", unit: "mm", basis: "DERIVED", source: "ent-9" });
  });

  it("answers null where the partition read no reading at all", () => {
    expect(readingSetupOf(null)).toBeNull();
  });

  it("answers null where the reading cites nothing rather than minting an empty source", () => {
    expect(readingSetupOf({ ...reading, sourceKeys: [] })).toBeNull();
    expect(readingSetupOf({ ...reading, sourceKeys: [""] })).toBeNull();
  });
});
