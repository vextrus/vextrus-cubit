// The one ownership rule (L-REG-03, L-MEA-09, L-CAD-07): a plan that DREW a mark on a storey owns the
// storey's instances of it against a plan typical of that storey — by mark and storey, never by grid
// reference — and where it draws FEWER than the typical plan derives there, the surplus is reported
// rather than yielded blind (L-QTY-02).
import { describe, expect, test } from "vitest";
import { viewKey, type ViewRef } from "@/core/identity";
import type { PlacementRow } from "../placement/rows";
import { VIEW_TYPE } from "../views/law";
import { resolveExpansion, type AuthoredRange, type StackedLevel } from "./resolve";

const TYPICAL: ViewRef = { viewClass: VIEW_TYPE.LAYOUT_PLAN, captionAnchorSourceKey: "DXF_HANDLE:1" };
const ROOF_PLAN: ViewRef = { viewClass: VIEW_TYPE.LAYOUT_PLAN, captionAnchorSourceKey: "DXF_HANDLE:2" };
const LEVELS: readonly StackedLevel[] = [
  { levelId: "l5", label: "5F", ordinal: 5 },
  { levelId: "lr", label: "ROOF", ordinal: 6 },
];
/** The typical plan runs 5F..ROOF; the roof plan is OF the roof alone. */
const RANGES: readonly AuthoredRange[] = [
  { viewKey: viewKey(TYPICAL), fromLevelId: "l5", toLevelId: "lr" },
  { viewKey: viewKey(ROOF_PLAN), fromLevelId: "lr", toLevelId: "lr" },
];

/** One beam placement, lettered by its own view's backbone. */
function beam(view: ViewRef, x: number, letter: string): PlacementRow {
  return {
    viewKey: viewKey(view),
    view,
    placementKey: `${viewKey(view)}|B1|${x}`,
    mark: "B1",
    markText: "B1",
    elementType: "beam",
    x,
    y: 0,
    gridLetter: letter,
    gridNumeral: "1",
    outlineKey: `o${x}`,
    markKey: `m${x}`,
    memberFamily: null,
    note: null,
  };
}

/** Each kept row as `<view anchor>:<level>:<standing>`, sorted. */
function kept(placements: readonly PlacementRow[]): string[] {
  const resolved = resolveExpansion({ placements, views: [{ caption: "", view: TYPICAL }, { caption: "", view: ROOF_PLAN }], levels: LEVELS, ranges: RANGES });
  return resolved.rows.map((row) => `${row.placement.view.captionAnchorSourceKey}:${"levelId" in row.level ? row.level.levelId : "?"}:${row.standing}:${row.placement.gridLetter}`).sort();
}

describe("the drawn plan owns its storey by mark, and a surplus is reported rather than yielded blind", () => {
  test("a roof plan drawing as many of a mark as the typical plan derives on the roof owns them all, however each lettered them", () => {
    // F-RCC6's shape: the two plans read different backbones, so no derived row stands at a drawn
    // member's grid reference — and every one of them is still the same beam, drawn on the roof.
    const placements = [beam(TYPICAL, 0, "A"), beam(TYPICAL, 4000, "B"), beam(ROOF_PLAN, 0, "C"), beam(ROOF_PLAN, 4000, "D")];
    expect(kept(placements), "the roof is the roof plan's; the typical plan keeps 5F").toEqual(
      ["DXF_HANDLE:1:l5:MEASURED:A", "DXF_HANDLE:1:l5:MEASURED:B", "DXF_HANDLE:2:lr:MEASURED:C", "DXF_HANDLE:2:lr:MEASURED:D"].sort(),
    );
    const resolved = resolveExpansion({ placements, views: [{ caption: "", view: TYPICAL }, { caption: "", view: ROOF_PLAN }], levels: LEVELS, ranges: RANGES });
    expect(resolved.yields, "one decision, accounted for in full").toEqual([
      { viewKey: viewKey(TYPICAL), mark: "B1", level: { levelId: "lr" }, derived: 2, drawn: 2, yielded: 2, surplus: 0 },
    ]);
  });

  test("a roof plan drawing FEWER reports the surplus, and yields only the derived row its drawn member stands on", () => {
    const placements = [beam(TYPICAL, 0, "A"), beam(TYPICAL, 4000, "B"), beam(TYPICAL, 8000, "C"), beam(ROOF_PLAN, 0, "A")];
    const resolved = resolveExpansion({ placements, views: [{ caption: "", view: TYPICAL }, { caption: "", view: ROOF_PLAN }], levels: LEVELS, ranges: RANGES });
    expect(resolved.yields, "the surplus is said, with its count").toEqual([
      { viewKey: viewKey(TYPICAL), mark: "B1", level: { levelId: "lr" }, derived: 3, drawn: 1, yielded: 1, surplus: 2 },
    ]);
    expect(kept(placements).filter((row) => row.includes(":lr:")), "no member the roof plan never showed is dropped with no word said").toEqual(
      ["DXF_HANDLE:1:lr:DERIVED:B", "DXF_HANDLE:1:lr:DERIVED:C", "DXF_HANDLE:2:lr:MEASURED:A"].sort(),
    );
  });

  test("the answer does not depend on the order the evidence arrives in", () => {
    const placements = [beam(TYPICAL, 0, "A"), beam(TYPICAL, 4000, "B"), beam(ROOF_PLAN, 0, "C"), beam(ROOF_PLAN, 4000, "D"), beam(TYPICAL, 8000, "E")];
    expect(kept([...placements].reverse()), "one drawing, one answer (AC-8)").toEqual(kept(placements));
  });
});
