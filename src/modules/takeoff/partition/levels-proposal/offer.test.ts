// The stored rows, offered back as ONE stack (L-MEA-07, R-UI-023, D-001): a storey stated in two
// notations was read off two marks and is stored as two rows, and it is offered as one level carrying
// both readings — while a record that holds a stack per view is still refused as no stack at all.
import { describe, expect, test } from "vitest";
import { offeredLevelsOf, type OfferedRow } from "./offer";

const SECTION = "MEMBER_SECTION:DXF_HANDLE:1D96";

/** One stored row, as the store answers it (in its order: ordinal, view, mark). */
function row(label: string, ordinal: number, markKey: string, height: readonly [string, string] | null = null, viewKey = SECTION): OfferedRow {
  return { viewKey, label, ordinal, markKey, heightAsWritten: height?.[0] ?? null, heightUnit: height?.[1] ?? null };
}

describe("D-001: the stored proposal is offered as one stack", () => {
  test("a storey read off two marks is offered once, carrying one reading per mark that states a height", () => {
    const offered = offeredLevelsOf([
      row("GF", 0, "DXF_HANDLE:1D4A"),
      row("GF", 0, "DXF_HANDLE:1D90", ["132", "in"]),
      row("1F", 1, "DXF_HANDLE:1D4C"),
      row("ROOF", 2, "DXF_HANDLE:1D58"),
    ]);
    expect(offered?.map((level) => ({ label: level.label, ordinal: level.ordinal })), "GF once, and the ordinals run 0..n−1 over levels, never over rows").toEqual([
      { label: "GF", ordinal: 0 },
      { label: "1F", ordinal: 1 },
      { label: "ROOF", ordinal: 2 },
    ]);
    expect(offered?.[0]?.readings, "GF's metric mark stated no unit and so no height; its imperial mark states 11'-0\" and is cited for it").toEqual([
      { valueAsWritten: "132", unitAsWritten: "in", sourceKey: "DXF_HANDLE:1D90" },
    ]);
    expect(offered?.[1]?.readings).toEqual([]);
  });

  test("both notations' readings travel with the level, each citing its own mark", () => {
    const offered = offeredLevelsOf([row("GF", 0, "e:metric", ["3.353", "m"]), row("GF", 0, "e:imperial", ["132", "in"]), row("1F", 1, "e:1f")]);
    expect(offered?.[0]?.readings).toEqual([
      { valueAsWritten: "3.353", unitAsWritten: "m", sourceKey: "e:metric" },
      { valueAsWritten: "132", unitAsWritten: "in", sourceKey: "e:imperial" },
    ]);
  });

  test("a record that holds a stack per view is not one stack, and is not offered", () => {
    expect(
      offeredLevelsOf([row("GF", 0, "e:a-gf", null, "SECTION:A"), row("GF", 0, "e:b-gf", null, "SECTION:B"), row("1F", 1, "e:a-1f", null, "SECTION:A")]),
      "one storey proposed by two views would be authored twice over (L-ACT-01)",
    ).toBeNull();
    expect(offeredLevelsOf([row("GF", 0, "e:gf"), row("GF", 1, "e:gf-again")]), "one label at two ordinals is no one level either").toBeNull();
  });

  test("a record with one row per level is offered exactly as it always was", () => {
    expect(offeredLevelsOf([row("GF", 0, "e:0", ["3", "m"]), row("1ST", 1, "e:1")])).toEqual([
      { label: "GF", ordinal: 0, readings: [{ valueAsWritten: "3", unitAsWritten: "m", sourceKey: "e:0" }] },
      { label: "1ST", ordinal: 1, readings: [] },
    ]);
  });
});
