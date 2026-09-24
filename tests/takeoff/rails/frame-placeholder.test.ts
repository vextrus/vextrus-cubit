/**
 * A frame rail reports a member standing under a placeholder and never sizes it (Interpretation
 * I-461; L-FRM-02, L-REG-04, L-QTY-04, L-MEA-08, I-367, I-368).
 *
 * WHY. FRM-3 placed S-13's `LB1`. The first-floor long sections (S-16) do not detail it and the typical
 * ones (S-17) band it `2ND TO 6TH`, so the resolver stands it on no level and its `@unregistered:1ST`
 * placeholder from the pin is never carried (I-367). The frame rail then asked `variantCovering` for
 * its section with no level — the arm written for the FOUNDATION slot, which answers a family's one
 * row — and bound S-17's 250 × 375 on a member whose word is 1ST: two PARTIAL lines on a placeholder
 * key, a section the drawing states for other floors, and J-000's `placeholder_lines` at 2 where
 * I-368's invariant holds it at 0. A level no band covers defers (L-FRM-02).
 *
 * WHAT MAY NOT MOVE. The FOUNDATION slot keeps its arm: a member beneath every storey takes its
 * family's one row. A member on a level of the stack is sized by the band covering that level, as it
 * always was. The UNRESOLVED slot is reported, by every rail, under `TYPICAL_RANGE_UNSTATED` against
 * its view (I-667); the gate still refuses an offer on it by the same code (I-368,
 * `refusal-arms.test.ts`), but no frame rail makes one.
 *
 * Pure: the rails are handed exactly what a loader would hand them, and no database is opened.
 */
import { describe, expect, test } from "vitest";
import {
  BEAM_CLASS,
  INGEST_ID,
  LEVEL_ID,
  RCC_CONCRETE,
  RCC_FORMWORK,
  TIE_BEAM_CLASS,
  affirmedCalibration,
  frameRailDoor,
  frameRailInput,
  levelStanding,
  placementSetup,
  registerRow,
  run,
  variant,
  type FrameRailDoor,
  type FrameRailShape,
  type RailBatchShape,
  type VariantSetup,
  VIEW_KEY,
} from "./support/frame-rail-stage";

/** The code a member no band covers the level of is reported under (L-FRM-02). */
const SECTION_BAND_UNCOVERED = "SECTION_BAND_UNCOVERED";

/** The code a member a bare typical caption left on no storey is reported under (L-CAD-07). */
const TYPICAL_RANGE_UNSTATED = "TYPICAL_RANGE_UNSTATED";

/** The member this suite sizes: S-13's LB1, as the drawing letters it, and the family S-17 states. */
const PLACEMENT = "PLACEMENT:S-13:LB1:4200:9100";
const FAMILY = "LB1";

/** The word S-13's caption names its storey in, which the stack spells `1F` (I-366). */
const CAPTION_WORD = "1ST";

/** The stack a person confirms: GF, then 1F..6F, each by the surrogate the register keys a level on. */
const STACK = ["GF", "1F", "2F", "3F", "4F", "5F", "6F"].map((label, ordinal) => levelStanding({ levelId: `level-${label}`, label, ordinal }));

/** S-17's one row for LB1: the typical floors it details, and nothing below them. */
const TYPICAL_ONLY: VariantSetup = variant({ variantKey: FAMILY, width: 250, depth: 375, bandFrom: "2F", bandTo: "6F" });

/** The same family stated with no band at all — a row that covers every level. */
const UNBANDED: VariantSetup = variant({ variantKey: FAMILY, width: 250, depth: 375 });

/** The four rails that size a member along a run, each with the class it reads (L-MEA-09). */
const RUN_RAILS: readonly { readonly name: keyof FrameRailDoor; readonly class: string; readonly kind: string }[] = [
  { name: "beamConcreteRail", class: BEAM_CLASS, kind: RCC_CONCRETE },
  { name: "beamFormworkRail", class: BEAM_CLASS, kind: RCC_FORMWORK },
  { name: "tieBeamConcreteRail", class: TIE_BEAM_CLASS, kind: RCC_CONCRETE },
  { name: "tieBeamFormworkRail", class: TIE_BEAM_CLASS, kind: RCC_FORMWORK },
];

/** Where a row stands, in each of the three forms a register row states it in, or on a surrogate. */
type Standing = { readonly levelId: string } | { readonly slot: "FOUNDATION" | "UNRESOLVED" } | { readonly placeholder: string };

/** One register row of `elementType` standing where `at` says, keyed as the store keys it (L-REG-04). */
function rowAt(elementType: string, at: Standing): Record<string, unknown> {
  const base = registerRow({ placementKey: PLACEMENT, elementType, mark: FAMILY, levelId: LEVEL_ID });
  if ("levelId" in at) return { ...base, objectKey: `${PLACEMENT}@${at.levelId}`, levelId: at.levelId, levelSlot: null, levelLabel: null };
  if ("slot" in at) return { ...base, objectKey: `${PLACEMENT}@${at.slot}`, levelId: null, levelSlot: at.slot, levelLabel: null };
  return { ...base, objectKey: `${PLACEMENT}@unregistered:${at.placeholder}`, levelId: null, levelSlot: null, levelLabel: at.placeholder };
}

/** What one rail answers for the one row, its run read and its view affirmed — only the section can stop it. */
function answered(rail: FrameRailShape, kind: string, row: Record<string, unknown>, variants: readonly VariantSetup[]): RailBatchShape {
  return rail(
    frameRailInput({
      kind,
      objects: [row],
      placements: { [PLACEMENT]: placementSetup({ placementKey: PLACEMENT, memberFamily: FAMILY }) },
      memberTypes: { [INGEST_ID]: { [FAMILY]: variants } },
      levels: STACK,
      calibrations: affirmedCalibration(),
      runs: { [PLACEMENT]: run({ clear: "3375", sides: ["125", "125"] }) },
    }),
  );
}

describe("I-461: a member under a placeholder is reported, never sized", () => {
  test("LB1 under `@unregistered:1ST`, its one schedule row banded 2F..6F: every run rail observes SECTION_BAND_UNCOVERED and offers nothing", async () => {
    const door = await frameRailDoor();
    for (const one of RUN_RAILS) {
      const row = rowAt(one.class, { placeholder: CAPTION_WORD });
      const batch = answered(door[one.name] as FrameRailShape, one.kind, row, [TYPICAL_ONLY]);
      expect(batch.offers, `${one.name}: no offer on a placeholder — the level-less arm would bind the band 2F..6F on a member whose word is 1ST (L-FRM-02)`).toEqual([]);
      expect(batch.observations, `${one.name}: the row is reported by name, on its own key, where the residue reads it (L-MEA-08, L-QTY-04)`).toEqual([
        { class: one.class, kind: one.kind, code: SECTION_BAND_UNCOVERED, objectKey: String(row["objectKey"]), sourceEntity: PLACEMENT },
      ]);
    }
  });

  test("and where the family's one row states no band at all: still reported — a line on the placeholder stands on a key the carry moves (I-368)", async () => {
    const door = await frameRailDoor();
    const row = rowAt(BEAM_CLASS, { placeholder: CAPTION_WORD });
    const batch = answered(door.beamConcreteRail, RCC_CONCRETE, row, [UNBANDED]);
    expect(batch.offers, "a placeholder is never sized, whatever its schedule bands").toEqual([]);
    expect(batch.observations.map((seen) => seen.code), "and says why, once").toEqual([SECTION_BAND_UNCOVERED]);
  });

  test("what may not move: on a level the band covers the member is sized by it, and on one it does not it defers", async () => {
    const door = await frameRailDoor();
    const covered = answered(door.beamConcreteRail, RCC_CONCRETE, rowAt(BEAM_CLASS, { levelId: "level-2F" }), [TYPICAL_ONLY]);
    expect(covered.offers.map((offer) => [offer.bindings["b"]?.value, offer.bindings["D"]?.value]), "on 2F, S-17's 250 × 375 (L-FRM-02)").toEqual([["250", "375"]]);
    expect(covered.observations, "and nothing to report").toEqual([]);

    const below = answered(door.beamConcreteRail, RCC_CONCRETE, rowAt(BEAM_CLASS, { levelId: "level-1F" }), [TYPICAL_ONLY]);
    expect(below.offers, "on 1F, a level the band does not reach, nothing is sized").toEqual([]);
    expect(below.observations.map((seen) => seen.code), "and the rail says so under the same code the placeholder is reported under").toEqual([SECTION_BAND_UNCOVERED]);
  });

  // TEST_AMENDED (I-667): the UNRESOLVED slot no longer keeps its offer. The gate refused it by
  // name, but a gate refusal is counted in the job's step and stored nowhere a reader looks, so a
  // bare typical caption's beams published nothing and said nothing (walk-2 BD-3). Every rail now
  // reports such a row against its view, under the Bible's own code, and offers nothing.
  test("what may not move: the FOUNDATION slot keeps its level-less arm; the UNRESOLVED slot is reported against its view under TYPICAL_RANGE_UNSTATED (I-368, I-667)", async () => {
    const door = await frameRailDoor();
    const foundation = answered(door.tieBeamConcreteRail, RCC_CONCRETE, rowAt(TIE_BEAM_CLASS, { slot: "FOUNDATION" }), [TYPICAL_ONLY]);
    expect(
      foundation.offers.map((offer) => [offer.bindings["b"]?.value, offer.bindings["D"]?.value]),
      "a member beneath every storey takes its family's one row: no band ranges over the foundation (L-REG-02)",
    ).toEqual([["250", "375"]]);

    for (const one of RUN_RAILS) {
      const row = rowAt(one.class, { slot: "UNRESOLVED" });
      for (const variants of [[UNBANDED], [TYPICAL_ONLY]]) {
        const bare = answered(door[one.name] as FrameRailShape, one.kind, row, variants);
        expect(bare.offers, `${one.name}: a bare typical caption's member stands on no storey, so nothing is sized — whether its family is banded or not`).toEqual([]);
        expect(bare.observations, `${one.name}: it is reported against THE VIEW, whose range of floors a reader has to go and state — never as an uncovered band (L-CAD-07)`).toEqual([
          { class: one.class, kind: one.kind, code: TYPICAL_RANGE_UNSTATED, objectKey: String(row["objectKey"]), sourceEntity: VIEW_KEY },
        ]);
      }
    }
  });
});
