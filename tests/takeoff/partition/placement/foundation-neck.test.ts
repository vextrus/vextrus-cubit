/**
 * I-338 — a vertical member continues down to the foundation NECK a person entered beneath the
 * ground storey, and there it carries the section of the band that covers the ground storey
 * (L-MEA-01: "vertical members measure full storey height floor-to-floor"; T-NOT-RANGE-GF3: "the FDN
 * neck belongs to band GF TO 2ND").
 *
 * Two halves of one fact, each asked where it is decided: which storeys a member STANDS on is the
 * expansion resolver's (`resolveExpansion`), and which schedule row SIZES it there is the offers
 * contract's (`variantCovering`); `foundationNeckOf` is where both read what the neck is (B-17).
 *
 * Pure: the resolver and the contract read no store, so every stack, plan and note below is handed in
 * whole, drawn here to the rule this file states. F-RCC6-BNBC's own reading of the rule — 26 necks,
 * the porch C7 among them and the floating C5 not — is graded over the shipped cad CLI in
 * `./bnbc-foundation-neck.test.ts`.
 */
import { describe, expect, test } from "vitest";
import { foundationNeckOf, variantCovering, type LevelSetup, type MemberVariantSetup } from "@/core/offers/contract";
import { resolveExpansion, type ExpansionRow, type StackedLevel } from "@/modules/takeoff/partition/expansion/resolve";
import type { PlacementNote, PlacementRow } from "@/modules/takeoff/partition/placement/rows";

/** The view every member below is drawn in, and the key the grammar derives for it. */
const VIEW = { viewClass: "LAYOUT_PLAN", captionAnchorSourceKey: "DXF_HANDLE:20B6" } as const;
const VIEW_KEY = `v:${VIEW.viewClass}:${VIEW.captionAnchorSourceKey}`;

/** A stack of storeys, foot first, each at the ordinal it is listed at — plus whatever a case adds. */
function stack(entries: readonly (readonly [string, number])[]): StackedLevel[] {
  return entries.map(([label, ordinal]) => ({ levelId: `level-${label}`, label, ordinal }));
}

/** F-RCC6-BNBC's stack once a person has entered the neck beneath GF (ordinal −1). */
const WITH_NECK = stack([
  ["FDN", -1],
  ["GF", 0],
  ["1F", 1],
  ["2F", 2],
]);

/** The same building as a stack with no neck entered — F-RCC6's, and every stack nobody told of one. */
const WITHOUT_NECK = stack([
  ["GF", 0],
  ["1F", 1],
  ["2F", 2],
]);

/** One member, as the placement stage leaves one — a column unless the case says otherwise. */
function placed(mark: string, x: number, options: { elementType?: string; note?: PlacementNote | null } = {}): PlacementRow {
  return {
    viewKey: VIEW_KEY,
    view: VIEW,
    placementKey: `${VIEW_KEY}|${mark}|${x}.0,0.0`,
    mark,
    markText: mark,
    elementType: (options.elementType ?? "column") as PlacementRow["elementType"],
    x,
    y: 0,
    gridLetter: "A",
    gridNumeral: String(x),
    outlineKey: `DXF_HANDLE:${mark}${x}O`,
    markKey: `DXF_HANDLE:${mark}${x}M`,
    memberFamily: mark,
    note: options.note ?? null,
  };
}

/** The levels each member stands on, by label, with the standing it stands at on each. */
function standing(rows: readonly ExpansionRow[], levels: readonly StackedLevel[]): Record<string, string[]> {
  const label = new Map(levels.map((level) => [level.levelId, level.label]));
  const held: Record<string, string[]> = {};
  for (const row of rows) {
    const at = "levelId" in row.level ? (label.get(row.level.levelId) ?? row.level.levelId) : JSON.stringify(row.level);
    (held[`${row.placement.mark}@${row.placement.x}`] ??= []).push(`${at}:${row.standing}`);
  }
  for (const list of Object.values(held)) list.sort();
  return held;
}

/** One plan typical of GF..2F, resolved over a stack, with the members a case places on it. */
function resolvedOver(levels: readonly StackedLevel[], placements: readonly PlacementRow[], from = "GF"): Record<string, string[]> {
  const answer = resolveExpansion({
    placements,
    views: [{ caption: "COLUMN LAYOUT PLAN", view: VIEW }],
    levels,
    ranges: [{ viewKey: VIEW_KEY, fromLevelId: `level-${from}`, toLevelId: "level-2F" }],
  });
  return standing(answer.rows, levels);
}

describe("I-338: the neck a vertical continues down to", () => {
  test("a column of a plan typical of GF..2F also stands on the FDN neck beneath GF — DERIVED, since nothing drew it there", () => {
    expect(resolvedOver(WITH_NECK, [placed("C1", 1)]), "GF is the storey the plan draws; 1F and 2F its typical; FDN the member continued").toEqual({
      "C1@1": ["1F:DERIVED", "2F:DERIVED", "FDN:DERIVED", "GF:MEASURED"],
    });
  });

  test("a stack nobody entered a neck in moves nothing — F-RCC6's own stack among them", () => {
    expect(resolvedOver(WITHOUT_NECK, [placed("C1", 1)])).toEqual({ "C1@1": ["1F:DERIVED", "2F:DERIVED", "GF:MEASURED"] });
  });

  test("a noted member bound to GF alone keeps its neck; one whose note starts it at 1F has none", () => {
    const porch: PlacementNote = { sourceKey: "DXF_HANDLE:9BA", text: "C7 %%C450 PORCH COLUMN", band: null, shape: "ROUND" };
    const floating: PlacementNote = { sourceKey: "DXF_HANDLE:9BC", text: "C5 FLOATING COLUMN OVER TG1 (STARTS AT 1F)", band: { from: "1F", to: null }, shape: null };
    expect(resolvedOver(WITH_NECK, [placed("C7", 7, { note: porch }), placed("C5", 5, { note: floating })]), "the note says which storeys of the PLAN a member stands on; the neck is no storey of the plan").toEqual({
      "C7@7": ["FDN:DERIVED", "GF:MEASURED"],
      "C5@5": ["1F:MEASURED", "2F:DERIVED"],
    });
  });

  test("a plan whose range starts above GF continues nothing, and a beam is never continued", () => {
    expect(resolvedOver(WITH_NECK, [placed("C1", 1)], "1F"), "the member's lowest storey is 1F").toEqual({ "C1@1": ["1F:MEASURED", "2F:DERIVED"] });
    expect(resolvedOver(WITH_NECK, [placed("B1", 2, { elementType: "beam" })]), "a beam is not a vertical: it spans, it does not run down to the cap").toEqual({
      "B1@2": ["1F:DERIVED", "2F:DERIVED", "GF:MEASURED"],
    });
  });

  test("the neck is the foundation standing IMMEDIATELY beneath GF: a basement between them is a storey of its own", () => {
    const basement = stack([
      ["FDN", -2],
      ["BSMT", -1],
      ["GF", 0],
      ["1F", 1],
      ["2F", 2],
    ]);
    expect(foundationNeckOf(basement), "nothing is the neck").toBeNull();
    expect(resolvedOver(basement, [placed("C1", 1)])).toEqual({ "C1@1": ["1F:DERIVED", "2F:DERIVED", "GF:MEASURED"] });
    expect(foundationNeckOf(WITH_NECK)?.neck.label, "and with none between, FDN is").toBe("FDN");
    expect(foundationNeckOf(stack([["FOUNDATION", -1], ["GF", 0]]))?.neck.label, "spelled as the grammar reads the storey").toBe("FOUNDATION");
    expect(foundationNeckOf(stack([["LOWER", -1], ["GF", 0]])), "while a level a person named something else is not assumed to be one").toBeNull();
  });
});

/** One schedule row of a column family: its band and its section (L-FRM-02). */
function row(variantKey: string, bandFrom: string | null, bandTo: string | null, width: number, depth: number): MemberVariantSetup {
  return { variantKey, bandFrom, bandTo, sectionText: `${String(width)}x${String(depth)}`, sectionWidth: width, sectionDepth: depth, sectionUnit: "mm", sourceKeys: ["DXF_HANDLE:9C6"], dimensions: {} } as unknown as MemberVariantSetup;
}

/** The stack the contract reads, as the measure setup hands it: every level with no height stated. */
function setupLevels(levels: readonly StackedLevel[]): LevelSetup[] {
  return levels.map((level) => ({ ...level, height: { standing: "NONE", value: null, unit: null, basis: null, sourceKey: null } }) as unknown as LevelSetup);
}

/** F-RCC6-BNBC's C1 as S-11 bands it (T-NOT-RANGE-GF3). */
const C1_BANDS: readonly MemberVariantSetup[] = [row("GF-2ND", "GF", "2ND", 400, 400), row("3RD-4TH", "3RD", "4TH", 350, 350)];

describe("I-338: the neck takes the section of the band that covers the ground storey", () => {
  test("GF TO 2ND sizes the FDN neck where no row states the foundation", () => {
    const levels = setupLevels(WITH_NECK);
    const fdn = levels.find((level) => level.label === "FDN");
    expect(variantCovering(C1_BANDS, fdn, levels)?.variantKey, "the ground storey's own row, continued down").toBe("GF-2ND");
  });

  test("a row that DOES state the foundation is what is read for it, and the unbanded row before any continuation", () => {
    const levels = setupLevels(WITH_NECK);
    const fdn = levels.find((level) => level.label === "FDN");
    expect(variantCovering([...C1_BANDS, row("FDN-GF", "FDN", "FDN", 450, 450)], fdn, levels)?.variantKey, "the schedule's own statement of the neck").toBe("FDN-GF");
    expect(variantCovering([...C1_BANDS, row("OPEN", null, null, 500, 500)], fdn, levels)?.variantKey, "an unbanded row covers every level, the neck among them").toBe("OPEN");
  });

  test("no continuation where there is no neck, or where no band covers the ground storey", () => {
    const levels = setupLevels(WITH_NECK);
    const fdn = levels.find((level) => level.label === "FDN");
    expect(variantCovering([row("1F-2F", "1F", "2F", 300, 300)], fdn, levels), "a band starting at 1F says nothing about the ground storey, so nothing about its neck").toBeUndefined();
    const basement = setupLevels(stack([["FDN", -2], ["BSMT", -1], ["GF", 0], ["1F", 1], ["2F", 2]]));
    expect(variantCovering(C1_BANDS, basement.find((level) => level.label === "FDN"), basement), "a foundation beneath a basement is no neck of the ground storey's members").toBeUndefined();
    expect(variantCovering(C1_BANDS, basement.find((level) => level.label === "BSMT"), basement), "and a basement is a storey its schedule has to band").toBeUndefined();
  });
});
