// The joint at a column's top, read off the framing the partition PLACED (R6b-1; BNBC 2020 §6.4.9.2:
// joint ties "for a depth not less than that of the deepest connection").
//
// A column's confinement steel turns on one reading no schedule states: how deep the framing is that
// meets its top. The store already holds the association. A beam's run is read clear between the
// faces of the members carrying its ends, and it cites the outline of each (`supportedSpan` in
// `partition/placement/runs.ts`, stored WHOLE as `placement_runs.clear_source_keys`). So a framing
// member registered on the level above a column, whose run cites the column's own outline, frames the
// column's top joint, and its depth is what its schedule states for that level.
//
// The WHOLE citation list, never its first atom: a run cites its own two edge lines first and the
// supports after them, so `RunSetup.clear.source` (the first key, `readingSetupOf`) never names a
// column at all. `clearCitationsOf` below carries the list as the partition stored it.
//
// And a citation is read only inside its own drawing. A run cites the keys of the one artifact its
// plans were read from (`detectRuns`), and a key is a bare DXF handle (`DXF_HANDLE:984`), unique inside
// one drawing and nowhere else. A campaign reads several drawings, so a beam of drawing B may cite the
// very handle drawing A's column was placed off. Read across drawings, that beam would frame A's column,
// and a deeper one would carry the bound OVER the joint. So a framing member frames a column only where
// both were placed off the same record (`ingestId`), and a member the setup holds no placement for names
// no drawing, so its citations frame nothing.
//
// Pure. It reads the register and the setup and answers one reading per column. Nothing is stored,
// and nothing is converted except through the canon. Nothing is imported from a rail either: rails
// share only setup (L-MEA-08), so a depth is read off the member's variant through core's
// `variantCovering`, and never through the frame rail's `sectionOf`.
//
// What it answers is a BOUND, never the joint (Interpretation I-413, docs/design/s-bbs.md §0). The
// store holds the members the partition placed, not every member the drawing frames a joint with:
// TG1, the axis-y beams and CB1–4 wait on FRM-3, and the slanted EB2 and PB wait on D13. So the
// deepest depth read is a LOWER bound, and RESOLVED is not a standing this seam can answer. RESOLVED
// waits on a framing census that knows a joint's framing is whole, and "no framing seen" is never
// that. What the seam cannot read it names as unread, never as absent (I-414, L-QTY-04): the
// foundation neck and the roof stub are framed by what nobody has read yet, not by nothing.
import { isElementType, type ElementType } from "@/core/catalogue/classes";
import type { RefusalCode } from "@/core/errors";
import { variantCovering, type LevelSetup, type ReadingSetup, type RailSetup, type RegisterObjectRow } from "@/core/offers/contract";
import { convert, exact, unitNamed } from "@/core/units/canon";
import type { StoredPlacement, StoredRun } from "@/modules/takeoff/partition";
// The placement law reads marks through the notation grammar, and loading the grammar registers its
// storey reading with core's band placement (`useStoreyEquivalence`): so a schedule's band written
// "2ND TO 6TH" covers the stack's "2F" wherever this seam is asked, as it does for the rails.
import { isFramedClass } from "@/modules/takeoff/partition/placement/law";

/** The class whose top joint this seam reads. A shear wall's confinement is a wall's, not a column's. */
const COLUMN = "column" satisfies ElementType;

/** The unit every length of the bar schedule is stated in (BS 8666 is a millimetre standard). */
const MM = "mm";

/**
 * The standings a joint can take here. RESOLVED is left out on purpose, so no reading can carry it:
 * it needs a census of every member the drawing frames the joint with, which the store does not hold.
 */
export const JOINT_STANDINGS = ["BOUNDED", "UNREAD"] as const;

/** One standing of the roster above. */
export type JointStanding = (typeof JOINT_STANDINGS)[number];

/**
 * What an UNREAD joint could not read, each named for what is true of the drawing and of the store
 * (L-QTY-04): a reading says `unread: "FRAMING"`, the framing is unread, and never that there is none.
 * None of them says the joint is unframed.
 * - LEVEL: the stack holds no level above the column's, so the framing at its top stands on a level
 *   nobody registered (the model's roof stub, framed by the stair-room roof beams until LEV-2; the
 *   product's register holds no stub today, so there it is the column topping the stack).
 * - OUTLINE: the setup holds no outline for the column, so no run can be found citing it.
 * - FRAMING: the level above stands, and no framing member placed on it off the column's own drawing
 *   cites the column (the foundation neck, framed by grade beams carried on the caps; C6, framed by
 *   slanted beams; C7, the porch column).
 * - DEPTH: framing members placed on the level above cite the column, and none of their depths could
 *   be read; each is listed with the registered code it was not read under.
 *
 * These are the seam's own words, one word each, and none of them is a registered refusal code: the
 * rail that binds a joint reports its omission under a code it registers (R6b).
 */
export const JOINT_UNREAD = ["LEVEL", "OUTLINE", "FRAMING", "DEPTH"] as const;

/** One member of the roster above. */
export type JointUnread = (typeof JOINT_UNREAD)[number];

/** The register rows the seam reads: the columns it answers for and the framing it answers from. */
export type JointObject = Pick<RegisterObjectRow, "objectKey" | "placementKey" | "elementType" | "levelId">;

/**
 * One placement as the seam needs it: the record its schedules were read in, the family its mark
 * names, and the outline it was placed off (`placements.outline_key`), which a run cites to name the
 * member carrying its end. Null where the store holds no outline for it.
 */
export type JointPlacement = {
  readonly ingestId: string;
  readonly memberFamily: string | null;
  readonly outlineKey: string | null;
};

/**
 * What the seam reads. The levels and the member types are the rails' setup as it stands. The
 * placements carry the outline the rails' setup does not (`jointPlacementsOf`), and the citations are
 * every framing run's clear, cited WHOLE, keyed by the framing placement (`clearCitationsOf`).
 */
export type JointSetup = {
  readonly levels: readonly LevelSetup[];
  readonly memberTypes: RailSetup["memberTypes"];
  readonly placements: Readonly<Record<string, JointPlacement>>;
  readonly citations: Readonly<Record<string, readonly string[]>>;
};

/**
 * One framing member that meets a column's top and whose depth was read: the depth as its schedule
 * wrote it (TRANSCRIBED, cited to the schedule cell) and the canon's millimetres of it, side by side
 * (L-QTY-03).
 */
export type JointFramer = {
  readonly objectKey: string;
  readonly placementKey: string;
  readonly family: string;
  readonly depth: ReadingSetup;
  readonly depthMm: string;
};

/** One framing member that meets a column's top whose depth was NOT read, with the registered code. */
export type JointFramerUnread = {
  readonly objectKey: string;
  readonly placementKey: string;
  readonly code: RefusalCode;
};

/**
 * How one column's top joint stands.
 *
 * BOUNDED: `depthMm` is D_lo, the deepest depth read among the framing placed on the level above that
 * cites the column. The true joint depth is at least D_lo, and nothing here says it is no more.
 * `deepest` is the member it was read off, and `framing` lists every member read, in object-key order.
 * `depthUnread` lists the citing members whose depth could not be read. They leave the bound
 * standing, because a lower bound over fewer members is still a lower bound.
 *
 * UNREAD: no bound is read, and `unread` names what was not read. `levelId` is the level the framing
 * was looked for on, or null where the stack holds none.
 */
export type JointReading =
  | {
      readonly standing: "BOUNDED";
      readonly levelId: string;
      readonly depthMm: string;
      readonly deepest: JointFramer;
      readonly framing: readonly JointFramer[];
      readonly depthUnread: readonly JointFramerUnread[];
    }
  | {
      readonly standing: "UNREAD";
      readonly unread: JointUnread;
      readonly levelId: string | null;
      readonly depthUnread: readonly JointFramerUnread[];
    };

/**
 * Every framing run's clear, cited WHOLE, keyed by its placement: the edge lines it was read off, the
 * outline of each member it was cut at, and the declaration its unit stands on, as the partition
 * stored them. A run whose clear nobody read cites nothing, and is left out.
 */
export function clearCitationsOf(runs: readonly StoredRun[]): Readonly<Record<string, readonly string[]>> {
  const held: Record<string, readonly string[]> = {};
  for (const run of runs) {
    if (run.clear === null || run.clear.sourceKeys.length === 0) continue;
    held[run.placementKey] = [...run.clear.sourceKeys];
  }
  return held;
}

/**
 * Every stored placement as the seam reads it, keyed by its placement key: the ONE mapping from the
 * placement store to the seam (B-17). The outline is `placements.outline_key` as the placement stage
 * wrote it, which is the key a run cites for the member carrying its end (`supportsOf`, `faceAt`).
 */
export function jointPlacementsOf(placements: readonly StoredPlacement[]): Readonly<Record<string, JointPlacement>> {
  const held: Record<string, JointPlacement> = {};
  for (const placement of placements) {
    held[placement.placementKey] = { ingestId: placement.ingestId, memberFamily: placement.memberFamily, outlineKey: placement.outlineKey };
  }
  return held;
}

/** Code-point order, so the same register answers the same readings whatever order it arrived in. */
function byKey(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * The level a column's top meets: the next level up the stack by ORDINAL, which is physical (L-MEA-07).
 * A level is never found by its label. Undefined where the column tops the stack.
 */
function levelAbove(level: LevelSetup, levels: readonly LevelSetup[]): LevelSetup | undefined {
  let held: LevelSetup | undefined;
  for (const one of levels) {
    if (one.ordinal <= level.ordinal) continue;
    if (held === undefined || one.ordinal < held.ordinal || (one.ordinal === held.ordinal && byKey(one.levelId, held.levelId) < 0)) held = one;
  }
  return held;
}

/** A framing member's depth at the level it stands on, or the registered code it could not be read under. */
type DepthRead = { readonly ok: true; readonly framer: JointFramer } | { readonly ok: false; readonly code: RefusalCode };

/**
 * The depth one framing member's schedule states at its own level: the variant covering that level
 * (`variantCovering`, the one reading of a band), carried to millimetres by the canon.
 *
 * Each refusal is the code the frame rail reports for the same absence, because the absence is the
 * same one. The one addition is a spelling the canon does not name: `convert` throws on it, and a
 * seam that throws takes the whole campaign's measurement with it, so the recogniser is asked first.
 */
function depthOf(row: JointObject, placement: JointPlacement, level: LevelSetup, setup: JointSetup): DepthRead {
  const family = placement.memberFamily;
  const variants = family === null ? undefined : setup.memberTypes[placement.ingestId]?.[family];
  if (family === null || variants === undefined || variants.length === 0) return { ok: false, code: "MEMBER_TYPE_UNKNOWN" };
  const variant = variantCovering(variants, level, setup.levels);
  if (variant === undefined) return { ok: false, code: "SECTION_BAND_UNCOVERED" };
  // A depth read without its unit, or without the cell it was read at, is no reading a bound can stand
  // on (L-QTY-03). It is the frame rail's own refusal for the same section.
  const source = variant.sourceKeys[0];
  if (variant.sectionDepth === null || variant.sectionUnit === null || source === undefined || source.length === 0) return { ok: false, code: "SECTION_UNIT_UNSTATED" };
  const unit = unitNamed(variant.sectionUnit);
  if (unit === null) return { ok: false, code: "UNIT_UNMAPPED" };
  const value = String(variant.sectionDepth);
  const mm = convert(value, unit, MM);
  if (!mm.ok) return { ok: false, code: mm.code };
  return {
    ok: true,
    framer: {
      objectKey: row.objectKey,
      placementKey: row.placementKey,
      family,
      depth: { value, unit: variant.sectionUnit, basis: "TRANSCRIBED", source },
      depthMm: mm.value,
    },
  };
}

/** Is this register row a framing member: a class a layout plan draws as a pair of edge lines? */
function isFraming(row: JointObject): boolean {
  return isElementType(row.elementType) && isFramedClass(row.elementType);
}

/**
 * The top joint of every column row of the register, keyed by the column's object key.
 *
 * Every column row answers, BOUNDED or UNREAD by name, and no other row does. The same register
 * and setup answer the same readings whatever order the rows arrived in (L-REG-04).
 */
export function jointsOf(objects: readonly JointObject[], setup: JointSetup): Readonly<Record<string, JointReading>> {
  const ordered = [...objects].sort((left, right) => byKey(left.objectKey, right.objectKey));
  // The framing of each level, read once, in object-key order.
  const framingOn = new Map<string, JointObject[]>();
  for (const row of ordered) {
    if (row.levelId === null || !isFraming(row)) continue;
    const held = framingOn.get(row.levelId) ?? [];
    held.push(row);
    framingOn.set(row.levelId, held);
  }
  const cited = new Map(Object.entries(setup.citations).map(([placementKey, keys]) => [placementKey, new Set(keys)]));

  const joints: Record<string, JointReading> = {};
  for (const column of ordered) {
    if (column.elementType !== COLUMN) continue;
    joints[column.objectKey] = jointOf(column, setup, framingOn, cited);
  }
  return joints;
}

/** One column's top joint, read from the framing of the level above that cites its outline. */
function jointOf(column: JointObject, setup: JointSetup, framingOn: ReadonlyMap<string, readonly JointObject[]>, cited: ReadonlyMap<string, ReadonlySet<string>>): JointReading {
  // A column standing on no level of the stack (a lawful-null slot, a label the stack no longer holds)
  // has no level above it that anything can be read on, and neither has the column topping the stack
  // (L-MEA-07).
  const level = column.levelId === null ? undefined : setup.levels.find((one) => one.levelId === column.levelId);
  const above = level === undefined ? undefined : levelAbove(level, setup.levels);
  if (above === undefined) return { standing: "UNREAD", unread: "LEVEL", levelId: null, depthUnread: [] };

  const own = setup.placements[column.placementKey];
  const outline = own?.outlineKey ?? null;
  if (own === undefined || outline === null || outline.length === 0) return { standing: "UNREAD", unread: "OUTLINE", levelId: above.levelId, depthUnread: [] };

  const framing: JointFramer[] = [];
  const depthUnread: JointFramerUnread[] = [];
  for (const row of framingOn.get(above.levelId) ?? []) {
    // A citation is a key of its own drawing's artifact, and a handle is unique inside one drawing only:
    // a member placed off another record, or off none the setup holds, frames nothing of this column's.
    const placement = setup.placements[row.placementKey];
    if (placement === undefined || placement.ingestId !== own.ingestId) continue;
    if (cited.get(row.placementKey)?.has(outline) !== true) continue;
    const read = depthOf(row, placement, above, setup);
    if (read.ok) framing.push(read.framer);
    else depthUnread.push({ objectKey: row.objectKey, placementKey: row.placementKey, code: read.code });
  }

  // The deepest read, compared as exact decimals of the canon's millimetres, never as written. A tie
  // goes to the first in object-key order, so one register names one member.
  let deepest: JointFramer | undefined;
  for (const framer of framing) if (deepest === undefined || exact(framer.depthMm).gt(exact(deepest.depthMm))) deepest = framer;
  if (deepest === undefined) return { standing: "UNREAD", unread: depthUnread.length > 0 ? "DEPTH" : "FRAMING", levelId: above.levelId, depthUnread };
  return { standing: "BOUNDED", levelId: above.levelId, depthMm: deepest.depthMm, deepest, framing, depthUnread };
}
