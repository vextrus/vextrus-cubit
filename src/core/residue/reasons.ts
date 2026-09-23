// Why an unmeasured cell stands unmeasured when nobody declared why, and what a partly measured
// cell's lines left out (s-coverage I-480, I-483).
//
// L-QTY-05 fixes the CAUSE: a cell with no published line and no human act over it stands under
// NOT_ESTABLISHED, the writerless fall-through, and a rail's report is evidence and never a cause.
// What this file adds is the evidence a reader is owed beside that cause — the one reading of the
// campaign that says WHY — so a certificate never prints that nothing explains an absence. Every
// reason is read, never guessed: the report a rail made for the cell; the drawings declaring a class
// nothing placed; a campaign no run was ever carried over; a pair the run reads elsewhere and never
// here; a pair the run does not read at all.
//
// Pure: it reads what `resolveResidue` already holds, so the grid, the inspector and the certificate
// answer from one reading (B-17, B-19).
import { REFUSALS } from "../errors";
import { compareCanonical } from "../identity";
import { UNPLACED, type PartialDeclaration, type PartialOmission, type ResidueLine, type ResidueObservation, type Sighting } from "./law";

/** The reasons the campaign itself answers, read from the one register (Q-07, R-SPINE-062). */
const NOT_MEASURED_YET = REFUSALS.COVERAGE_NOT_MEASURED_YET.code;
const CLASS_NOT_PLACED = REFUSALS.COVERAGE_CLASS_NOT_PLACED.code;
const MEMBERS_NOT_REACHED = REFUSALS.COVERAGE_MEMBERS_NOT_REACHED.code;
const KIND_NOT_READ = REFUSALS.COVERAGE_KIND_NOT_READ.code;

/** The coverage a line bears its quantity under (L-QTY-02); anything else declared an omission. */
const COMPLETE = "COMPLETE";

/** What one unmeasured cell's reason is read from. */
export type ReasonInput = {
  readonly kind: string;
  readonly class: string;
  /** The sightings the cell stands on. */
  readonly sightings: readonly Sighting[];
  /** The rails' reports about what the cell did not publish. */
  readonly observations: readonly ResidueObservation[];
  /** Whether any measure run has been carried over the campaign. */
  readonly measured: boolean;
  /** Whether the run published or reported anything for this (class, kind) anywhere in the campaign. */
  readonly pairRead: boolean;
};

/** A reason, and the views it names — each caption once, in canonical order. */
export type CellReason = { readonly reason: string; readonly views: readonly string[] };

/** Each distinct value once, in canonical order. */
function distinct(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareCanonical);
}

/** Whether a code is one the register holds — the only codes a reason may be (Q-07, R-SPINE-062). */
function registered(code: string): boolean {
  return Object.hasOwn(REFUSALS, code);
}

/** The registered code one report was made under, or null where it carries none the register holds. */
function codeOf(observation: ResidueObservation): string | null {
  const code = observation.code ?? observation.reason;
  return registered(code) ? code : null;
}

/**
 * The registered code a cell's reports name most, ties broken canonically — the one a reader should
 * act on first — or null where no report carries one. A report under a code the register does not
 * hold stays evidence in the inspector, as the rail spelled it, and is never a reason: every reason
 * is a registered sentence a certificate can print.
 */
function mostReported(observations: readonly ResidueObservation[]): string | null {
  const counted = new Map<string, number>();
  for (const observation of observations) {
    const code = codeOf(observation);
    if (code !== null) counted.set(code, (counted.get(code) ?? 0) + 1);
  }
  return [...counted.entries()].sort((left, right) => right[1] - left[1] || compareCanonical(left[0], right[0]))[0]?.[0] ?? null;
}

/**
 * Why one NOT_ESTABLISHED cell stands unmeasured, in the order the questions are asked: what a rail
 * reported for it; the drawings declaring a class no member of which was placed; a campaign never
 * measured; a pair read elsewhere and not here; a pair not read at all. Total — every cell gets one.
 */
export function cellReasonOf(cell: ReasonInput): CellReason {
  const reported = mostReported(cell.observations);
  if (reported !== null) {
    const views = cell.observations.filter((observation) => codeOf(observation) === reported).map((observation) => observation.view ?? "");
    return { reason: reported, views: distinct(views.filter((view) => view !== "")) };
  }
  if (cell.sightings.length > 0 && cell.sightings.every((sighting) => sighting.declared === true)) {
    return { reason: CLASS_NOT_PLACED, views: distinct(cell.sightings.map((sighting) => sighting.caption ?? "").filter((caption) => caption !== "")) };
  }
  if (!cell.measured) return { reason: NOT_MEASURED_YET, views: [] };
  if (cell.pairRead) return { reason: MEMBERS_NOT_REACHED, views: [] };
  return { reason: KIND_NOT_READ, views: [] };
}

/**
 * What a published cell's lines left out, or null where every line bears its quantity (L-QTY-02). A
 * line read without a coverage (a reading older than the field) is read as bearing one — nothing is
 * declared partial that no line declared.
 */
export function partialOf(lines: readonly ResidueLine[]): PartialDeclaration | null {
  const declared = lines.filter((line) => line.coverage !== undefined && line.coverage !== COMPLETE);
  if (declared.length === 0) return null;
  const members = new Set(declared.map((line) => line.objectKey ?? line.lineId)).size;
  const byCode = new Map<string, { variables: Set<string>; lines: Set<string> }>();
  for (const line of declared) {
    for (const omission of line.omitted ?? []) {
      const held = byCode.get(omission.code) ?? { variables: new Set<string>(), lines: new Set<string>() };
      held.variables.add(omission.variable);
      held.lines.add(line.lineId);
      byCode.set(omission.code, held);
    }
  }
  const omitted: PartialOmission[] = [...byCode.entries()]
    .map(([code, held]) => ({ code, variables: [...held.variables].sort(compareCanonical), lines: held.lines.size }))
    .sort((left, right) => right.lines - left.lines || compareCanonical(left.code, right.code));
  return { lines: declared.length, members, omitted };
}

/**
 * Where a level-less cell's members stand (I-482): the lawful-null slot a register row
 * names (`FOUNDATION`), or `UNPLACED` where every sighting is the drawings' declaration and nothing
 * was placed at all — else null, and the column says it stands on no level.
 */
export function slotOf(levelId: string | null, sightings: readonly Sighting[]): string | null {
  if (levelId !== null) return null;
  const slotted = sightings.find((sighting) => typeof sighting.levelSlot === "string" && sighting.levelSlot !== "")?.levelSlot;
  if (slotted !== undefined && slotted !== null) return slotted;
  return sightings.length > 0 && sightings.every((sighting) => sighting.declared === true) ? UNPLACED : null;
}
