/**
 * AC-2: the placement constants are content-scaled shares of the view's own minimum grid spacing,
 * read off the project's pinned rule-set edition (L-MEA-01, L-CAD-07).
 *
 * The artifact draws its four cases as shares of the spacing it is gridded on — two outlines a
 * twentieth of a bay apart, a mark just inside the near-anchor reach and one just outside it, and an
 * outline three bays long. What the shares ARE is never spelled here: they are read off the pin, and
 * the drawing's own distances are asserted to straddle them, so an edition authored with other
 * values moves the expectation with it rather than silently making the case vacuous (B-19).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  DRAWN_FAR_ANCHOR,
  DRAWN_LONG_OUTLINE,
  DRAWN_MERGE_GAP,
  DRAWN_NEAR_ANCHOR,
  NARROWED_NEAR_ANCHOR,
  PLACEMENT_STAGE,
  SCENARIO,
  SHARE_NAMES,
  closeStage,
  detectDoor,
  evidenceOf,
  field,
  gridRows,
  marksOf,
  ordered,
  placedMembersOf,
  placementRows,
  placementsAnswered,
  pinnedSharesOf,
  runPlacementPartition,
  stagePlacementIngest,
  stagePlacementProject,
  stepDetail,
  type PlacementStage,
  type StagedPlacementIngest,
  type StepRecord,
} from "../support/placement-stage";

let stage: PlacementStage;
let staged: StagedPlacementIngest;
let steps: StepRecord[];
let shares: Record<string, string>;

beforeAll(async () => {
  stage = await stagePlacementProject("shares");
  staged = await stagePlacementIngest(stage, SCENARIO.SHARES, 0x22);
  steps = await runPlacementPartition(stage, staged, "shares");
  shares = await pinnedSharesOf(stage);
}, 300_000);

afterAll(async () => {
  await closeStage();
});

/** The minimum grid spacing the view was really georeferenced at — the drawing's own statement. */
function minSpacingOfView(): number {
  const rows = gridRows(stage.person.tenantId, staged.ingestId);
  expect(rows.length, "the plan georeferenced: the shares scale by a spacing the drawing states (L-CAD-07)").toBeGreaterThan(0);
  const spacings = new Set(rows.map((row) => Number(field(row, "minSpacing", "min_spacing"))));
  expect(spacings.size, "one view, one minimum spacing").toBe(1);
  return [...spacings][0] as number;
}

describe("AC-2: content-scaled shares from the pinned edition", () => {
  test("AC-2: the placement step's detail carries the pinned edition's four shares", () => {
    const detail = stepDetail(steps, PLACEMENT_STAGE);
    const reported = detail["shares"] as Record<string, unknown> | undefined;
    expect(reported, `the placement step reports the shares it measured under: ${JSON.stringify(detail)}`).toBeTruthy();
    expect(Object.fromEntries(SHARE_NAMES.map((name) => [name, String((reported ?? {})[name])])), "each share is the decimal string of its own edition parameter (L-MEA-01)").toEqual(shares);
  });

  test("AC-2: the four cases the drawing draws are decided by those shares", () => {
    const spacing = minSpacingOfView();
    // The drawing's own distances, in shares of the spacing it states — asserted to straddle the pin,
    // so this case decides something whatever the edition says.
    expect(Number(shares["containmentMerge"]), `two outlines ${DRAWN_MERGE_GAP} of a bay apart are inside the merge share`).toBeGreaterThan(DRAWN_MERGE_GAP);
    expect(Number(shares["nearAnchor"]), `a mark ${DRAWN_NEAR_ANCHOR} of a bay from its outline is inside the near-anchor share`).toBeGreaterThan(DRAWN_NEAR_ANCHOR);
    expect(Number(shares["nearAnchor"]), `a mark ${DRAWN_FAR_ANCHOR} of a bay from its outline is outside it`).toBeLessThan(DRAWN_FAR_ANCHOR);
    expect(Number(shares["footprintMax"]), `an outline ${DRAWN_LONG_OUTLINE} bays long is outside the footprint band`).toBeLessThan(DRAWN_LONG_OUTLINE);
    expect(spacing, "the spacing the shares scale by is the one the artifact was gridded on").toBeCloseTo(staged.artifact.minSpacing, 6);

    const rows = placementRows(stage.person.tenantId, staged.ingestId);
    const expected = placedMembersOf(staged.artifact).map((member) => member.mark);
    expect(ordered(marksOf(rows)), `the merged pair places once, the near mark places, and the far mark and the long outline do not`).toEqual(ordered(expected));
    expect(rows.length, "one placement per placed member, and no others").toBe(expected.length);

    const detail = stepDetail(steps, PLACEMENT_STAGE);
    expect(Number(detail["placements"]), "the step reports the placements it stored").toBe(rows.length);
  });

  test("AC-2: the pure detector under a narrowed near-anchor share no longer places C4", async () => {
    const detector = await detectDoor();
    const evidence = await evidenceOf(staged.artifact, shares);
    const asPinned = marksOf(placementsAnswered(detector.detectPlacements(evidence)));
    const near = placedMembersOf(staged.artifact).find((member) => member.markText === "c-4.");
    expect(near, "the artifact drew the mark whose anchor the narrowed share no longer reaches").toBeTruthy();
    const mark = (near as { mark: string }).mark;
    expect(asPinned, `under the pinned shares the near mark places as ${mark}`).toContain(mark);

    const narrowed = detector.detectPlacements({ ...evidence, shares: { ...shares, nearAnchor: NARROWED_NEAR_ANCHOR } });
    expect(marksOf(placementsAnswered(narrowed)), `a near-anchor share of ${NARROWED_NEAR_ANCHOR} no longer reaches that mark's outline`).not.toContain(mark);
  });
});
