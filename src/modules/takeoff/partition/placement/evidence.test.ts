// What code finds about one placed outline before a model is asked anything (L-QTY-04, L-AI-03).
//
// The question this evidence is asked under reasons over numbers alone, so a number nobody found is
// the one thing that must never appear in it: a silent schedule reads as null, an outline nothing
// drew is left out of the asking altogether, and a plan with no spacing scales nothing. Judged over
// a drawing spelled here rather than over a fixture, so the reading is graded and not the drawing.
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { viewKey as identityViewKey } from "@/core/identity";
import type { DetectedGrid } from "../grid/detect";
import { VIEW_TYPE, partitionViewKey } from "../views/law";
import { outlineEvidenceOf } from "./evidence";
import type { FamilyNamed, PlacementRow } from "./rows";
import type { PlacementShares } from "./shares";

/** The two plans' caption anchors; the grid keys its axes by the partition's spelling of them. */
const ANCHOR = "DXF_HANDLE:1";
const OTHER_ANCHOR = "DXF_HANDLE:2";
const VIEW_KEY = partitionViewKey(VIEW_TYPE.LAYOUT_PLAN, ANCHOR);
const OTHER_VIEW = partitionViewKey(VIEW_TYPE.LAYOUT_PLAN, OTHER_ANCHOR);
const LAYER = "S-COL";
const CHANNELS = { rgb: [0, 0, 0], source: "explicit" };
const SPACING = 10;

/** The seed platform edition's own four shares — the figures every lane's pinned edition states. */
const SHARES: PlacementShares = { containmentMerge: "0.08", nearAnchor: "0.9", footprintMin: "0.6", footprintMax: "2.5" };

/** A closed rectangle of the drawing, centred where the plan drew the member. */
function outline(key: string, centre: readonly [number, number], width: number, height: number): Record<string, unknown> {
  const [x, y] = centre;
  const points = [
    [x - width / 2, y - height / 2],
    [x + width / 2, y - height / 2],
    [x + width / 2, y + height / 2],
    [x - width / 2, y + height / 2],
  ];
  return { key, type: "LWPOLYLINE", space: "Model", layer: LAYER, colour: CHANNELS, points, closed: true, area: width * height };
}

/** A member mark standing on the plan. */
function mark(key: string, said: string, at: readonly [number, number]): Record<string, unknown> {
  return { key, type: "TEXT", space: "Model", layer: LAYER, colour: CHANNELS, text: said, height: 1, points: [[at[0], at[1]]] };
}

/**
 * One row as the placement stage places one — the stage's own answer, taken as it stands: keyed by
 * L-REG-04's identity key (`v:`-prefixed, `@/core/identity`), which is NOT the partition's view key
 * the grid keys its axes by. The reading must bridge the two, so the staging spells them apart.
 */
function placed(mark: string, outlineKey: string, markKey: string, anchor = ANCHOR): PlacementRow {
  const view = { viewClass: VIEW_TYPE.LAYOUT_PLAN, captionAnchorSourceKey: anchor };
  const viewKey = identityViewKey(view);
  return {
    viewKey,
    view,
    placementKey: `${viewKey}|${mark}|${outlineKey}`,
    mark,
    markText: mark,
    elementType: "column",
    x: 0,
    y: 0,
    gridLetter: null,
    gridNumeral: null,
    outlineKey,
    markKey,
    memberFamily: mark,
  } as unknown as PlacementRow;
}

/** One axis of the backbone — all this reading takes from the grid is the spacing its shares scale by. */
function axis(viewKey: string, minSpacing: number): Record<string, unknown> {
  return { viewKey, family: "letter", label: "A", axis: "x", position: 0, bubbleKey: "b:1", labelKey: "l:1", minSpacing };
}

function grid(...axes: Record<string, unknown>[]): DetectedGrid {
  return { views: 1, axes, deferrals: [] } as unknown as DetectedGrid;
}

function graphOf(entities: readonly Record<string, unknown>[]): EntityGraph {
  return { entities, derived: [], block_attributes: [] } as unknown as EntityGraph;
}

/** A plan of four alike columns, each drawn at the section its schedule states, with its mark beside it. */
const PLAN = {
  entities: [
    outline("o:1", [0, 0], 1.5, 1.25),
    mark("m:1", "C4", [0.3, 0.2]),
    outline("o:2", [100, 0], 1.5, 1.25),
    mark("m:2", "C4", [100.3, 0.2]),
    outline("o:3", [0, 100], 1.5, 1.25),
    mark("m:3", "C4", [0.3, 100.2]),
    outline("o:4", [100, 100], 1.5, 1.25),
    mark("m:4", "C4", [100.3, 100.2]),
  ],
  placements: [placed("C4", "o:1", "m:1"), placed("C4", "o:2", "m:2"), placed("C4", "o:3", "m:3"), placed("C4", "o:4", "m:4")],
};

/** The schedules' own section for C4, in the schedules' units — a drawing drawn at 1 unit to 1. */
const FAMILIES: readonly FamilyNamed[] = [{ family: "C4", variants: [{ sectionWidth: 1.25, sectionDepth: 1.5 }] }];

function evidenceOf(families: readonly FamilyNamed[] = FAMILIES, detected: DetectedGrid | null = grid(axis(VIEW_KEY, SPACING))) {
  return outlineEvidenceOf({ graph: graphOf(PLAN.entities), grid: detected, shares: SHARES, families, placements: PLAN.placements });
}

describe("what one outline is judged over", () => {
  test("the outline's own box, the plan's median, the near-anchor pair and the edition's band — every one of them found", () => {
    const evidence = evidenceOf();
    expect(evidence).toHaveLength(4);
    const [first] = evidence;
    expect(first).toMatchObject({
      mark: "C4",
      class: "column",
      outlineKey: "o:1",
      markKey: "m:1",
      outlineLongest: 1.5,
      outlineShorter: 1.25,
      planMedianLongest: 1.5,
      gridSpacing: SPACING,
      footprintMin: 0.6,
      footprintMax: 2.5,
    });
    expect(first?.outlineArea).toBeCloseTo(1.875, 10);
    expect(first?.nearAnchorReach, "the reach is the edition's share of this plan's own spacing (L-MEA-01)").toBeCloseTo(0.9 * SPACING, 10);
    expect(first?.nearAnchorDistance, "how far the naming mark stands from the outline's centre").toBeCloseTo(Math.hypot(0.3, 0.2), 10);
    // Every field a probability is reasoned over is a finite number the code found.
    for (const held of evidence) {
      for (const figure of [held.outlineLongest, held.outlineShorter, held.outlineArea, held.planMedianLongest, held.nearAnchorDistance, held.nearAnchorReach, held.gridSpacing, held.footprintMin, held.footprintMax]) {
        expect(Number.isFinite(figure)).toBe(true);
      }
    }
  });

  test("the stated section is carried into the drawing's own units, at the scale the plan and the schedule agree on", () => {
    // The plan draws C4 at 1.5 × 1.25 and the schedule states 1.5 × 1.25: the drawing states itself
    // at one unit to one, so the stated sides arrive unchanged.
    const [first] = evidenceOf();
    expect(first?.statedLongest).toBeCloseTo(1.5, 10);
    expect(first?.statedShorter).toBeCloseTo(1.25, 10);

    // The same plan drawn at ten units to one of the schedule's says so itself: the scale is read
    // off the agreement, so the stated section is carried to what the plan drew.
    const tenth: readonly FamilyNamed[] = [{ family: "C4", variants: [{ sectionWidth: 0.125, sectionDepth: 0.15 }] }];
    const [scaled] = evidenceOf(tenth);
    expect(scaled?.statedLongest).toBeCloseTo(1.5, 10);
    expect(scaled?.statedShorter).toBeCloseTo(1.25, 10);
  });

  test("a schedule that stated nothing reads as silence, never as a number nobody read (L-MEA-07)", () => {
    const silent = evidenceOf([{ family: "C4", variants: [] }]);
    expect(silent).toHaveLength(4);
    for (const held of silent) {
      expect(held.statedLongest).toBeNull();
      expect(held.statedShorter).toBeNull();
    }
    const oneSided = evidenceOf([{ family: "C4", variants: [{ sectionWidth: null, sectionDepth: 1.5 }] }]);
    expect(oneSided[0]?.statedLongest).toBeCloseTo(1.5, 10);
    expect(oneSided[0]?.statedShorter, "a side the schedule did not state is not invented from the one it did").toBeNull();
  });

  test("a banded family is judged against the band it could be drawn to, and the pair is one band's own two sides", () => {
    const banded: readonly FamilyNamed[] = [
      { family: "C4", variants: [{ sectionWidth: 0.5, sectionDepth: 0.75, bandText: "5F-ROOF" }, { sectionWidth: 1.25, sectionDepth: 1.5, bandText: "GF-4F" }] },
    ];
    const [first] = evidenceOf(banded);
    expect(first?.statedLongest).toBeCloseTo(1.5, 10);
    expect(first?.statedShorter, "the shorter side travels with the band the longest came from").toBeCloseTo(1.25, 10);
  });
});

describe("what is not asked about at all", () => {
  test("a placement whose outline is no closed ring of this artifact — a member drawn as a pair of edge lines", () => {
    const framed = outlineEvidenceOf({
      graph: graphOf(PLAN.entities),
      grid: grid(axis(VIEW_KEY, SPACING)),
      shares: SHARES,
      families: FAMILIES,
      placements: [...PLAN.placements, placed("B1", "line:1", "m:1")],
    });
    expect(framed.map((held) => held.outlineKey), "a beam has no footprint to judge against a section").toEqual(["o:1", "o:2", "o:3", "o:4"]);
  });

  test("a plan the grid stage could not georeference: a share of no spacing is no distance (L-MEA-01)", () => {
    expect(evidenceOf(FAMILIES, null)).toEqual([]);
    expect(evidenceOf(FAMILIES, grid(axis(OTHER_VIEW, SPACING))), "and the spacing of another plan is not this plan's").toEqual([]);
  });

  test("a placement whose mark entity the artifact does not carry", () => {
    const orphan = outlineEvidenceOf({
      graph: graphOf(PLAN.entities),
      grid: grid(axis(VIEW_KEY, SPACING)),
      shares: SHARES,
      families: FAMILIES,
      placements: [placed("C4", "o:1", "m:404")],
    });
    expect(orphan).toEqual([]);
  });
});

describe("the median is the plan's own", () => {
  test("each plan is judged against the members IT places, never against another plan's", () => {
    const entities = [
      ...PLAN.entities,
      outline("o:5", [0, 0], 6, 6),
      mark("m:5", "F1", [0.3, 0.2]),
      outline("o:6", [50, 0], 6, 6),
      mark("m:6", "F1", [50.3, 0.2]),
    ];
    const evidence = outlineEvidenceOf({
      graph: graphOf(entities),
      grid: grid(axis(VIEW_KEY, SPACING), axis(OTHER_VIEW, SPACING * 2)),
      shares: SHARES,
      families: FAMILIES,
      placements: [...PLAN.placements, placed("F1", "o:5", "m:5", OTHER_ANCHOR), placed("F1", "o:6", "m:6", OTHER_ANCHOR)],
    });
    const byKey = new Map(evidence.map((held) => [held.outlineKey, held]));
    expect(byKey.get("o:1")?.planMedianLongest).toBeCloseTo(1.5, 10);
    expect(byKey.get("o:5")?.planMedianLongest).toBeCloseTo(6, 10);
    expect(byKey.get("o:5")?.gridSpacing).toBe(SPACING * 2);
  });
});

describe("the two spellings of a view are bridged, never compared (B-17)", () => {
  test("a row keyed by L-REG-04's identity key finds the spacing the grid filed under the partition's key", () => {
    // The staging must hold the seam as the product does — the row's key is NOT the axis's key —
    // or every case above would pass by keying both sides the same way and prove nothing about the
    // reading a recorded drawing gets (F-RCC6 listed 0 of its 72 outlines while they matched).
    const row = placed("C4", "o:1", "m:1");
    expect(row.viewKey, "the placement stage's own key carries the identity prefix").not.toBe(VIEW_KEY);
    expect(row.viewKey.endsWith(VIEW_KEY), "and the partition's key is what stands behind it").toBe(true);
    expect(evidenceOf().map((held) => held.gridSpacing), "every outline of the plan reads the plan's spacing").toEqual([SPACING, SPACING, SPACING, SPACING]);
  });
});
