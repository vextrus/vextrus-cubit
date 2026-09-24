// The openings an architect's plan draws in its walls (L-MEA-02, R-TO-036): a GAP in a wall, closed
// by a jamb at each end, with the opening's tag standing beside it — `D2` in its circle on the side
// the leaf swings into, `W1` inside the room for a window (F-ARCH, the Edison sets).
//
// L-MEA-02: "the opening schedule is the authority; adjacency is a declared cross-check". So an
// opening is placed where its TAG names it and the plan's own schedule states it, and the gap is the
// check: a gap as wide as the schedule's row says the opening is, at the drawn scale and to half the
// place the row printed it to. A gap of another width is not that opening, and the tag places
// nothing — which the placement census then declares, because a schedule row with fewer placements
// than it prints is a hard block on every wall of those floors (I-591). A row that states no unit
// for its size (`LD 900 X 2100`) cannot be set against the plan at all; its tag is placed by the
// gap it stands beside, the check stands unmade, and the wall it stands in refuses the area nobody can
// read (OPENING_NOT_AREABLE) rather than deducting it (s-schedules I-506).
//
// Pure: no store, no clock, no model (L-REG-04).
import type { ElementType } from "@/core/catalogue/classes";
import { exact, factorOf, isUnit } from "@/core/units/canon";
import { normaliseMark, sameStorey } from "../notation";
import type { Said } from "../placement/edge-pairs";
import { classOfMark, levelRunsOf } from "../placement/law";
import type { DrawnUnit, FamilyNamed } from "../placement/rows";
import { halfUnitOf } from "../placement/runs";

/** The class a tag names, written as the member of the catalogue's roster it is. */
const OPENING = "opening" satisfies ElementType;

/** One tag of an opening standing on a plan: what it says, in the comparison form. */
export type OpeningTag = Said & { readonly mark: string };

/** The tags of a plan's texts that name an opening (`../placement/law`'s class of the mark). */
export function openingTagsOf(said: readonly Said[]): OpeningTag[] {
  return said.flatMap((one) => (classOfMark(one.text) === OPENING ? [{ ...one, mark: normaliseMark(one.text) }] : []));
}

/**
 * What the plan's own schedule states of one mark's width: a width in drawing units with the half-place
 * it was printed to, a width stated in no unit (the check cannot be made), or no row at all.
 */
export type ScheduledWidth =
  | { readonly kind: "stated"; readonly drawn: number; readonly halfUnit: number; readonly sourceKeys: readonly string[] }
  | { readonly kind: "unitless" }
  | { readonly kind: "unscheduled" };

/** A plan as the schedule is set against it: its partition key and the caption naming its floors. */
export type PlanOfFloors = { readonly viewKey: string; readonly caption: string };

/**
 * The row of an opening schedule that states a mark for THIS plan's floors, or null where none or two
 * do. The schedules stage already said which plan each printed row was checked against
 * (`printed.planKey`, s-schedules I-507); a row that printed no quantity is matched by its floors
 * instead — its band is a run of storeys this plan's caption states (I-409's one reading of a caption).
 */
export function scheduledRowOf(mark: string, plan: PlanOfFloors, families: readonly FamilyNamed[]): NonNullable<FamilyNamed["variants"]>[number] | null {
  const runs = levelRunsOf(plan.caption);
  const rows = families
    .filter((family) => family.family === mark)
    .flatMap((family) => family.variants ?? [])
    .filter((variant) => {
      if (variant.printed !== undefined && variant.printed.planKey !== null) return variant.printed.planKey === plan.viewKey;
      const from = variant.bandFrom ?? null;
      const to = variant.bandTo ?? null;
      return from !== null && to !== null && runs.some((run) => sameStorey(run.from, from) && sameStorey(run.to, to));
    });
  return rows.length === 1 ? (rows[0] ?? null) : null;
}

/**
 * The width a plan's schedule states for one mark, at the drawn scale — the figure's own unit carried
 * through the canon's exact factors into the unit the drawing's geometry is read in (L-FRM-06, B-07).
 */
export function scheduledWidthOf(mark: string, plan: PlanOfFloors, families: readonly FamilyNamed[], unit: DrawnUnit): ScheduledWidth {
  const row = scheduledRowOf(mark, plan, families);
  if (row === null || row.sectionWidth === null || !(row.sectionWidth > 0)) return { kind: "unscheduled" };
  const stated = row.sectionUnit ?? null;
  if (stated === null || !isUnit(stated)) return { kind: "unitless" };
  const scale = exact(factorOf(stated)).dividedBy(factorOf(unit.unit));
  return {
    kind: "stated",
    drawn: exact(row.sectionWidth).times(scale).toNumber(),
    halfUnit: exact(halfUnitOf(row.sectionWidth)).times(scale).toNumber(),
    sourceKeys: row.sourceKeys ?? [],
  };
}

/** A gap in a wall an opening may stand in: where it runs along its wall, and how far off it a tag stands. */
export type OpeningGap = { readonly id: number; readonly width: number };

/** One tag's claim on one gap: how far the tag stands from it. */
export type TagClaim = { readonly tag: OpeningTag; readonly gap: OpeningGap; readonly distance: number };

/**
 * Which gap each tag names (I-591): the nearest gap it stands beside whose width is the width the
 * plan's schedule states for its mark — each tag names one gap and each gap holds one opening, the
 * nearest claims first and ties to the lower tag key, so one drawing places one way every time
 * (L-REG-04). A tag whose schedule states no unit names the nearest gap it stands beside, unchecked; a
 * tag no row of the plan's schedule states names one too, and the wall it stands in refuses it by name.
 */
export function assignedGaps(claims: readonly TagClaim[], widthOf: (mark: string) => ScheduledWidth): Map<string, TagClaim> {
  const admitted = claims.filter((claim) => {
    const width = widthOf(claim.tag.mark);
    return width.kind !== "stated" || Math.abs(claim.gap.width - width.drawn) <= width.halfUnit;
  });
  const ordered = [...admitted].sort((left, right) => left.distance - right.distance || (left.tag.key < right.tag.key ? -1 : left.tag.key > right.tag.key ? 1 : 0) || left.gap.id - right.gap.id);
  const byTag = new Map<string, TagClaim>();
  const taken = new Set<number>();
  for (const claim of ordered) {
    if (byTag.has(claim.tag.key) || taken.has(claim.gap.id)) continue;
    byTag.set(claim.tag.key, claim);
    taken.add(claim.gap.id);
  }
  return byTag;
}
