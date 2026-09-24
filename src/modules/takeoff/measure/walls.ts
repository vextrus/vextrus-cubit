// The `walls{}` seam, filled (s-takeoff I-594): what the brickwork rail is handed for each brick
// wall the partition placed off an architect's plan — its length, its thickness, the openings its
// plan's schedule states in it, and what stops it before a reading is bound.
//
// Pure: handed what the stores hold for ONE drawing, it reads nothing and converts nothing that is not
// the canon's own exact arithmetic. The rail computes nothing (L-MEA-08); the gate deducts.
//
// What each reading is, and where it came from:
//   · the LENGTH its faces run, MEASURED off the plan on the placement lattice, cited to a face line;
//   · the THICKNESS its WALL TYPES row states, TRANSCRIBED as written, cited to the cell (I-508);
//   · the HEIGHT: none. A wall rises from its slab to the soffit over its centreline — a beam's, a
//     sunken panel's drop wall, or the slab's — and nothing an architect's set draws states which
//     stands over a wall; the storey height alone would bill a beam's depth of brick under every beam
//     (L-QTY-04). So the height is read nowhere yet, the rail keeps the row and names it
//     (WALL_HEIGHT_UNSTATED), and a wall's brickwork waits on the structure over it (I-594);
//   · each OPENING standing in it: the row of its plan's opening schedule that states it for these
//     floors, its face area w × h carried into square metres by the canon's exact factors, one per
//     placement, over the floors the row claims (L-MEA-02: the schedule the authority, the placement
//     the count). A row whose size states no unit is carried with no area, and the rail refuses it.
import type { BandStatement, OpeningSetup, ReadingSetup, WallSetup } from "@/core/offers/contract";
import { PRINTED_QUANTITY_REFUSAL_CODES, type RefusalCode } from "@/core/errors";
import { exact, factorOf, isUnit } from "@/core/units/canon";
import { scheduledRowOf, type MemberFamily, type StoredWall, type StoredWallOpening } from "@/modules/takeoff/partition";

/** The unit an opening's face area is carried in: the canon's own square metre (L-FRM-06). */
const SQUARE_METRE = "m2";

/** The unit a count is carried in. */
const PIECES = "pcs";

/** One placement counts one opening (L-MEA-02: the placement is the count, the schedule the size). */
const ONE = "1";

/** The codes a wall is stopped under here, each a registered refusal (Q-07). */
const OPENING_UNPLACED: RefusalCode = "OPENING_UNPLACED";
const OPENING_UNSCHEDULED: RefusalCode = "OPENING_UNSCHEDULED";
const WALL_LINTEL_UNDEDUCTED: RefusalCode = "WALL_LINTEL_UNDEDUCTED";

/** One view of the drawing as this reads one: its partition key, the address placements name it by, its caption. */
export type WallView = { readonly viewKey: string; readonly address: string; readonly caption: string };

/** What one drawing's stores hold for its walls. */
export type WallStores = {
  readonly walls: readonly StoredWall[];
  readonly openings: readonly StoredWallOpening[];
  readonly families: readonly MemberFamily[];
  readonly views: readonly WallView[];
};

/** A stored reading as a rail is handed one: its first citation is the atom it goes back to (L-QTY-03). */
function reading(value: string, unit: string, basis: ReadingSetup["basis"], sources: readonly string[]): ReadingSetup | null {
  const source = sources[0];
  return source === undefined || source.length === 0 ? null : { value, unit, basis, source };
}

/**
 * The face area a schedule row states, in square metres: its width and its height, each carried from
 * the unit the row was written in by the canon's exact factor — or null where the row states no unit
 * a figure could be carried from (`LD`'s `900 X 2100`, s-schedules I-506).
 */
function areaOf(row: NonNullable<ReturnType<typeof scheduledRowOf>>): ReadingSetup | null {
  const unit = row.sectionUnit ?? null;
  if (row.sectionWidth === null || row.sectionDepth === null || unit === null || !isUnit(unit)) return null;
  const metres = factorOf(unit);
  const area = exact(row.sectionWidth).times(metres).times(exact(row.sectionDepth).times(metres));
  return reading(area.toFixed(), SQUARE_METRE, "TRANSCRIBED", row.sourceKeys ?? []);
}

/** The floors a schedule row claims, or null where it claims none (L-MEA-02's floor group). */
function floorsOf(row: NonNullable<ReturnType<typeof scheduledRowOf>>): BandStatement | null {
  const from = row.bandFrom ?? null;
  const to = row.bandTo ?? null;
  return from === null && to === null ? null : { from, to };
}

/**
 * Every brick wall of one drawing, as the brickwork rail is handed it, by its placement key.
 *
 * A plan's schedule row that PRINTS more of an opening than the plan places stops every wall of that
 * plan: the openings it does not place may stand in any of them, and a wall measured past one would
 * bill it as brick (L-MEA-02 with L-QTY-04 — a hard block, never a disclosure). An opening standing in
 * a wall that no row of its plan's schedule states stops that wall, and so does one whose row the
 * schedules stage declared in disagreement with its plan (s-schedules I-507: nothing is measured off
 * the mark until a person states which is right).
 */
export function wallSetupsOf(stores: WallStores): Record<string, WallSetup> {
  const byAddress = new Map(stores.views.map((view) => [view.address, view]));
  const held: Record<string, WallSetup> = {};
  for (const wall of stores.walls) {
    const view = byAddress.get(wall.viewKey);
    const plan = view === undefined ? null : { viewKey: view.viewKey, caption: view.caption };
    const blocked: { code: RefusalCode; sourceEntity: string }[] = [];

    // The plan's census: every row of an opening schedule checked against THIS plan, set against what
    // the plan places of its mark.
    if (plan !== null) {
      for (const family of stores.families) {
        for (const variant of family.variants) {
          const printed = variant.printed;
          if (printed === undefined || printed.planKey !== plan.viewKey) continue;
          const placed = stores.openings.filter((opening) => opening.viewKey === wall.viewKey && opening.mark === family.family).length;
          if (placed < printed.printed) blocked.push({ code: OPENING_UNPLACED, sourceEntity: printed.sourceKeys[0] ?? family.sourceKeys[0] ?? "" });
        }
      }
    }

    const openings: OpeningSetup[] = [];
    for (const opening of stores.openings.filter((one) => one.hostPlacementKey === wall.placementKey)) {
      const row = plan === null ? null : scheduledRowOf(opening.mark, plan, stores.families);
      if (row === null) {
        blocked.push({ code: OPENING_UNSCHEDULED, sourceEntity: opening.tagKey });
        continue;
      }
      // The schedules stage's own declared outcome for the row, read off its closed roster (Q-07).
      const refusal = PRINTED_QUANTITY_REFUSAL_CODES.find((code) => code === row.printed?.refusal);
      if (refusal !== undefined) blocked.push({ code: refusal, sourceEntity: row.printed?.sourceKeys[0] ?? opening.tagKey });
      openings.push({
        mark: opening.mark,
        area: areaOf(row),
        count: { value: ONE, unit: PIECES, basis: "MEASURED", source: opening.placementKey },
        floors: floorsOf(row),
        source: row.sourceKeys?.[0] ?? opening.tagKey,
      });
      // An opening in a brick wall carries a lintel over it, and nothing this revision states is
      // deducted for it: `masonry.brick_wall.volume@1` deducts openings and no lintel, and the lintel
      // schedule is read into no wall. Measured, the wall would bill the lintel's concrete as brick
      // (L-QTY-04; F-ARCH's declared residue, "the wall must refuse rather than bill them as brick").
      blocked.push({ code: WALL_LINTEL_UNDEDUCTED, sourceEntity: opening.placementKey });
    }

    held[wall.placementKey] = {
      length: reading(wall.lengthValue, wall.lengthUnit, "MEASURED", wall.lengthSourceKeys),
      height: null,
      thickness: reading(wall.thicknessValue, wall.thicknessUnit, "TRANSCRIBED", wall.thicknessSourceKeys),
      openings,
      ...(blocked.length === 0 ? {} : { blocked }),
    };
  }
  return held;
}
