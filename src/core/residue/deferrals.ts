// What a measure run could not measure for want of what the QS sets up before measuring, said by name
// (L-MEA-05's "declared, never silent", L-MEA-07, s-coverage I-484): the views the members
// were placed in that no affirmation names — "no scale of record on COLUMN LAYOUT PLAN" — and the
// storeys members stand on whose height nobody has stated or whose readings disagree.
//
// It judges nothing. The scale deferrals are the rails' own reports, grouped by the view each one
// names — a rail cannot mint a calibration it does not hold and reports the view instead (L-MEA-08) —
// and the height deferrals are the stack's own standing, read at the one pairing of a standing with
// its code (`STOREY_HEIGHT_ABSENCE`). Pure, so the measure run's own report, the register's
// deferred-and-refused region and a test all read the same answer (B-17).
import { REFUSALS } from "../errors";
import { compareCanonical } from "../identity";
import { STOREY_HEIGHT_ABSENCE, type StoreyHeightStandingName } from "../levels/law";

/** The code a rail reports a member under when the view it was placed in has no scale of record. */
const VIEW_SCALE_UNAFFIRMED = REFUSALS.VIEW_SCALE_UNAFFIRMED.code;

/**
 * The classes a storey height is read FOR: the verticals, which measure floor-to-floor through the
 * joint (L-MEA-09) — a column and a shear wall, the two classes `heightOf` is asked for. A storey only
 * beams stand on (a roof) owes no height to anything measured, and naming it would be noise.
 */
const VERTICAL_CLASSES: ReadonlySet<string> = new Set(["column", "shear_wall"]);

/**
 * The codes a line leaves its storey height out under — the levels law's two absences, the agreed
 * height nothing cites (`heightOf`'s three answers short of a reading), and the storey run a
 * vertical's bars stand over (the same height, as the rebar rail reports it).
 */
const HEIGHT_CODES: ReadonlySet<string> = new Set([
  REFUSALS.STOREY_HEIGHT_UNSTATED.code,
  REFUSALS.STOREY_HEIGHT_CONTESTED.code,
  REFUSALS.STOREY_HEIGHT_UNCITED.code,
  REFUSALS.REBAR_STOREY_RUN_UNSTATED.code,
]);

/** What a run's deferrals are read from: its reports, the stack as it stands, and the members on it. */
export type RunDeferralInput = {
  readonly observations: readonly {
    readonly class: string;
    readonly code: string;
    readonly objectKey?: string | null;
    readonly sourceEntity?: string | null;
    /** The caption of the view the report names, where the reader resolved one. */
    readonly view?: string | null;
  }[];
  readonly levels: readonly { readonly levelId: string; readonly label: string; readonly ordinal: number; readonly standing: StoreyHeightStandingName }[];
  readonly objects: readonly { readonly objectKey: string; readonly levelId: string | null; readonly elementType: string }[];
  /**
   * What the run offered or published for its members, with the codes each line left a component out
   * under. A storey whose verticals were measured and wanted no height was not deferred for want of
   * one, whatever the stack says of it now. Absent reads as none.
   */
  readonly lines?: readonly { readonly objectKey: string; readonly omitted: readonly string[] }[];
  /** The caption each view address is said by, where the reader holds the manifest's views. */
  readonly captions?: ReadonlyMap<string, string>;
};

/** A view no affirmation names, with the classes and how many members were placed in it. */
export type ScaleDeferral = {
  readonly code: typeof VIEW_SCALE_UNAFFIRMED;
  /** The view's L-REG-04 address, as the rails reported it. */
  readonly view: string;
  /** The view's caption, where the reader holds it — what a QS knows the view by. */
  readonly caption: string | null;
  readonly classes: readonly string[];
  readonly members: number;
};

/** A storey members stand on whose height stands at none, with the code its standing is reported under. */
export type HeightDeferral = {
  readonly code: "STOREY_HEIGHT_UNSTATED" | "STOREY_HEIGHT_CONTESTED";
  readonly levelId: string;
  readonly label: string;
  readonly classes: readonly string[];
  readonly members: number;
};

/** One deferral a run names. */
export type RunDeferral = ScaleDeferral | HeightDeferral;

/** Each distinct value once, in canonical order. */
function distinct(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareCanonical);
}

/**
 * The run's deferrals by name: first every view with no scale of record, in the order a reader knows
 * them by (the caption, else the address), then every storey whose height stands at none, bottom-up.
 * A view no member was reported against, and a storey no vertical stands on, defers nothing.
 */
export function runDeferralsOf(input: RunDeferralInput): RunDeferral[] {
  const byView = new Map<string, { classes: string[]; members: Set<string>; caption: string | null }>();
  for (const observation of input.observations) {
    if (observation.code !== VIEW_SCALE_UNAFFIRMED) continue;
    const view = observation.sourceEntity ?? "";
    if (view === "") continue;
    const held = byView.get(view) ?? { classes: [], members: new Set<string>(), caption: null };
    held.classes.push(observation.class);
    held.members.add(observation.objectKey ?? `${observation.class}\u0000${view}`);
    byView.set(view, { ...held, caption: held.caption ?? observation.view ?? input.captions?.get(view) ?? null });
  }
  const scale: ScaleDeferral[] = [...byView.entries()]
    .map(([view, held]) => ({ code: VIEW_SCALE_UNAFFIRMED, view, caption: held.caption, classes: distinct(held.classes), members: held.members.size }))
    .sort((left, right) => compareCanonical(left.caption ?? left.view, right.caption ?? right.view) || compareCanonical(left.view, right.view));

  // What the run's lines say about heights: the members it offered or published anything for, and
  // those one of whose lines left a storey-height component out.
  const lines = input.lines ?? [];
  const lined = new Set(lines.map((line) => line.objectKey));
  const wanting = new Set(lines.filter((line) => line.omitted.some((code) => HEIGHT_CODES.has(code))).map((line) => line.objectKey));

  const heights: HeightDeferral[] = [];
  for (const level of [...input.levels].sort((left, right) => left.ordinal - right.ordinal)) {
    const code = STOREY_HEIGHT_ABSENCE[level.standing];
    if (code !== "STOREY_HEIGHT_UNSTATED" && code !== "STOREY_HEIGHT_CONTESTED") continue;
    const standing = input.objects.filter((object) => object.levelId === level.levelId && VERTICAL_CLASSES.has(object.elementType));
    if (standing.length === 0) continue;
    // Deferred for want of a height where a line of its verticals left the height out, or where the
    // run could offer nothing for any of them; a storey whose verticals were measured and wanted no
    // height was measured by one, whatever the stack says of it now.
    const deferredHere = standing.some((object) => wanting.has(object.objectKey)) || !standing.some((object) => lined.has(object.objectKey));
    if (!deferredHere) continue;
    heights.push({ code, levelId: level.levelId, label: level.label, classes: distinct(standing.map((object) => object.elementType)), members: standing.length });
  }

  return [...scale, ...heights];
}
