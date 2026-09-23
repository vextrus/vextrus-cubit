// A reading a rail is handed cites the atom it was read from, or it is not handed over at all
// (L-QTY-03, L-CAD-03).
import { describe, expect, it } from "vitest";
import type { MemberVariant, StoredOutline } from "@/modules/takeoff/partition";
import { memberFamiliesSetupOf, outlineSetupOf, readingSetupOf } from "./setup";

describe("readingSetupOf", () => {
  const reading = { value: "3200", unit: "mm" as const, basis: "DERIVED" as const, sourceKeys: ["ent-9", "ent-10"] };

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

// I-333: the plan a ring encloses is handed to the rails as the ring read it — MEASURED, in the unit
// it was read in, cited to the ring — and a polygon keeps having no sides.
describe("outlineSetupOf", () => {
  const stored: StoredOutline = {
    placementKey: "v:LAYOUT_PLAN:DXF_HANDLE:202C|PC2|4572.0,-199775.0",
    sourceKey: "DXF_HANDLE:5AF",
    unitSourceKey: "DXF_HANDLE:1F3E",
    geometry: "PRISM_POLY",
    unit: "mm",
    areaUnit: "mm2",
    area: "3262500.0",
    perimeter: "6960.1",
    length: null,
    breadth: null,
  };

  it("carries a polygon's area and perimeter, measured and cited to its ring, and no sides", () => {
    expect(outlineSetupOf(stored)).toEqual({
      type: "PRISM_POLY",
      area: { value: "3262500.0", unit: "mm2", basis: "MEASURED", source: "DXF_HANDLE:5AF" },
      length: null,
      breadth: null,
      perimeter: { value: "6960.1", unit: "mm", basis: "MEASURED", source: "DXF_HANDLE:5AF" },
    });
  });

  it("carries a rectangle's own two sides in the length unit", () => {
    const rect = outlineSetupOf({ ...stored, geometry: "PRISM_RECT", length: "2000.0", breadth: "1000.0", area: "2000000.0" });
    expect([rect.type, rect.length?.value, rect.length?.unit, rect.breadth?.value]).toEqual(["PRISM_RECT", "2000.0", "mm", "1000.0"]);
  });
});

// I-331: a family two schedules of one record name binds nothing — a disagreement is declared, never
// resolved in table order (L-REG-03) — and every other family binds as it always did.
describe("memberFamiliesSetupOf", () => {
  const variant = (sectionWidth: number): MemberVariant => ({
    variantKey: "SIZE",
    bandText: "SIZE",
    bandFrom: null,
    bandTo: null,
    sectionText: `${sectionWidth}x${sectionWidth}`,
    sectionWidth,
    sectionDepth: sectionWidth,
    sectionUnit: "mm",
    sourceKeys: [`cell-${sectionWidth}`],
    zones: [],
  });

  it("hands a family named once its variants, and a family named twice none at all", () => {
    const held = memberFamiliesSetupOf([
      { family: "PC1", variants: [variant(2000)] },
      { family: "PC3", variants: [variant(2000)] },
      { family: "PC3", variants: [] },
    ]);
    expect(held["PC1"]?.map((one) => one.sectionWidth), "named once: bound").toEqual([2000]);
    expect(held["PC3"], "named by two schedules: MEMBER_TYPE_UNKNOWN on every member, rather than whichever was read last").toEqual([]);
  });
});
