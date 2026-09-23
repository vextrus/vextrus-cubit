// The draft's emission: a campaign's published lines, placed by the taxonomy and written at the
// precision a document states them to (R-TO-053, L-BD-08, AM-14, L-MEA-05, L-QTY-04).
//
// IT READS AND NEVER RE-MEASURES. The rails published these figures at full precision and storey by
// storey (L-MEA-09); this file groups them, rounds a COPY of each for the page, and writes back
// nothing. A draft that re-derived a quantity would be a second measurement of the same building.
//
// ROUNDING IS HALF-EVEN, ONCE, AT THE EDGE (L-MEA-05's decimal habit). The register keeps the value
// it published; the payload carries the figure a reader reads. The two are different facts about one
// line, and the only place they part company is here.
//
// A SUBTOTAL ADDS WHAT THE PAGE SHOWS. The per-unit figures are summed from the ROUNDED lines, so a
// reader who adds the column with a pencil gets the number printed under it — and never a figure
// that is right to the store and wrong to the page.
import Decimal from "decimal.js";
import { WORK_ITEM_CATALOGUE } from "@/core/catalogue/catalogue";
import { ELEMENT_TYPES, type ElementType } from "@/core/catalogue/classes";
import { KINDS, type Kind } from "@/core/catalogue/kinds";
import {
  BOQ_DRAFT_TITLE,
  descriptionOf,
  placesForUnit,
  placesOf,
  type BoqDraftGroup,
  type BoqDraftLine,
  type BoqDraftPayload,
  type BoqDraftSection,
} from "@/core/documents/kinds/boq-draft";
import { compareCanonical } from "@/core/identity";
import { exact } from "@/core/units/canon";
import { groupKeyOf, type GroupDescriptions } from "./description-basis";
import { plinthBoundaryOf, resolveBill, type StackLevel } from "./resolver";
import { BILLS, BILL_LABELS, BILL_TAXONOMY, UNCLASSIFIED, UNCLASSIFIED_LABEL, type Bill } from "./taxonomy";

/** The coverage a draft states over itself: what L-QTY-07's statement leaves standing. */
export const COMPLETE = "COMPLETE";
export const INCOMPLETE = "INCOMPLETE";

/** One published line of the campaign, as the register hands it over. */
export type BoqReadingLine = {
  readonly lineId: string;
  readonly objectKey: string;
  readonly class: ElementType;
  readonly kind: Kind;
  readonly levelId: string | null;
  /** The figure as it was published, at the register's own full precision (B-07, I-25). */
  readonly value: string | null;
  readonly unit: string;
  readonly quantityBasis: string;
  readonly selectionBasis: string;
  readonly coverage: string;
  /**
   * The registered codes the line gave for what it could not measure, in the order it gave them
   * (L-QTY-02). Read only where the line states no figure: it is why the page says `Not measured`,
   * and a page that said it without the why would be silent where R-UI-020 forbids silence.
   */
  readonly omitted?: readonly string[];
};

/**
 * One row of what the campaign did not measure, as the residue's measurement statement prints it —
 * a kind, on a class or none, over a run of levels, under a registered cause (L-QTY-07, I-451).
 */
export type BoqNotMeasured = {
  readonly class: string | null;
  readonly kind: string;
  readonly levels: string;
  readonly cause: string;
};

/** One reading of one campaign: the stack it stands on and every line it published. */
export type BoqReading = {
  readonly project: string;
  readonly campaignId: string;
  readonly setRevisionId: string;
  readonly levels: readonly StackLevel[];
  readonly lines: readonly BoqReadingLine[];
  /** Whether the coverage statement is empty — computed where the residue is, never re-derived here. */
  readonly coverageComplete: boolean;
  /**
   * What a model proposed each (class · kind) group is billed under, where one stands (L-BD-01,
   * L-AI-02). Absent, or absent for a group, is the ordinary case: the plain description the
   * emission has always written stands, and the emission asks nobody anything.
   */
  readonly descriptions?: GroupDescriptions;
  /**
   * The measurement statement — what this campaign published no line for, and why — as the residue
   * computed it (I-451). The draft carries it whole, so the paper that leaves the office says what
   * it leaves out; absent reads as nothing stated, which is the reading a caller without a residue
   * has.
   */
  readonly notMeasured?: readonly BoqNotMeasured[];
};

/** One line on its way into a section, with what the resolver said about it kept beside it. */
type Placed = {
  readonly line: BoqDraftLine;
  readonly class: ElementType;
  readonly kind: Kind;
  readonly bill: Bill | typeof UNCLASSIFIED;
  readonly reason: string | null;
};

/** A published figure as a document writes it: half to even at the kind's stated places (L-MEA-05). */
function atDocumentPrecision(value: string, kind: Kind): string {
  return exact(value).toFixed(placesOf(kind), Decimal.ROUND_HALF_EVEN);
}

/** The sum of figures already written, exactly and per unit — a page's own arithmetic (B-07). */
function sumAt(values: readonly string[], places: number): string {
  return values.reduce((carried, value) => carried.plus(exact(value)), exact("0")).toFixed(places, Decimal.ROUND_HALF_EVEN);
}

/** The figures a run of lines states — a line that declared what it could not measure states none. */
function figuresOf(lines: readonly BoqDraftLine[]): string[] {
  return lines.map((line) => line.quantity).filter((quantity): quantity is string => quantity !== null);
}

/**
 * One foot per unit, in the order the units first appear, over the lines that state a figure — and
 * NO foot for a unit no line states a figure in. The sum of nothing is not a zero anybody measured:
 * `Measured-scope subtotal 0.000 kg` read as "no steel", and the page now says `Not measured` for
 * that unit instead (L-QTY-04, I-450).
 */
function subtotalsOf(groups: readonly BoqDraftGroup[]): { unit: string; value: string }[] {
  const units: string[] = [];
  for (const group of groups) if (!units.includes(group.unit)) units.push(group.unit);
  return units.flatMap((unit) => {
    const figures = figuresOf(groups.filter((group) => group.unit === unit).flatMap((group) => group.lines));
    return figures.length === 0 ? [] : [{ unit, value: sumAt(figures, placesForUnit(groups, unit)) }];
  });
}

/**
 * The draft payload one reading emits (test contract: `boqDraftPayloadOf`).
 *
 * Sections stand in `BILLS` order and a section holding no line is not emitted at all; groups stand
 * in the catalogue's order; lines are read DOWN THE BUILDING, which is the order `numberItems`
 * numbers them in, so the numbers a page prints run in the order the page prints them.
 */
export function boqDraftPayloadOf(reading: BoqReading): BoqDraftPayload {
  const boundary = plinthBoundaryOf(reading.levels);
  const levels = new Map(reading.levels.map((level) => [level.levelId, level]));

  const placed: Placed[] = reading.lines.map((line) => {
    const level = line.levelId === null ? undefined : levels.get(line.levelId);
    const resolution = resolveBill({ class: line.class, kind: line.kind, levelOrdinal: level?.ordinal ?? null }, boundary);
    return {
      class: line.class,
      kind: line.kind,
      bill: resolution.bill,
      reason: resolution.reason,
      line: {
        lineId: line.lineId,
        objectKey: line.objectKey,
        level: level?.label ?? "",
        levelOrdinal: level?.ordinal ?? null,
        // A line that declared what it could not measure states NO figure — never a zero, which
        // would be a quantity nobody measured (L-QTY-04).
        quantity: line.value === null ? null : atDocumentPrecision(line.value, line.kind),
        unit: line.unit,
        coverage: line.coverage,
        quantityBasis: line.quantityBasis,
        selectionBasis: line.selectionBasis,
        decidedBy: `${resolution.decidedBy.row}:${resolution.decidedBy.key}`,
        // …and says why, by the codes it gave: the page writes them as words (I-450).
        ...omittedOf(line),
      },
    };
  });

  const sections: BoqDraftSection[] = [];
  for (const bill of BILLS) {
    const held = placed.filter((entry) => entry.bill === bill);
    if (held.length === 0) continue;
    const groups = groupsOf(held, reading.descriptions);
    sections.push({ bill, label: BILL_LABELS[bill], groups, subtotals: subtotalsOf(groups) });
  }

  // Kept, labelled, reason stated, never dropped (L-BD-08). It stands after the six and is no
  // section of them: a line the taxonomy could not place is a VISIBLE gap in the draft.
  const unclassified = placed
    .filter((entry) => entry.bill === UNCLASSIFIED)
    .sort((one, other) => (one.line.levelOrdinal ?? 0) - (other.line.levelOrdinal ?? 0) || compareCanonical(one.line.objectKey, other.line.objectKey))
    .map((entry) => ({ ...entry.line, class: entry.class, kind: entry.kind, reason: entry.reason ?? "" }));

  const complete = reading.coverageComplete && reading.lines.every((line) => line.coverage === COMPLETE) && unclassified.length === 0;

  return {
    title: BOQ_DRAFT_TITLE,
    project: reading.project,
    campaignId: reading.campaignId,
    setRevisionId: reading.setRevisionId,
    taxonomyVersion: BILL_TAXONOMY.version,
    coverage: complete ? COMPLETE : INCOMPLETE,
    sections,
    unclassified: { label: UNCLASSIFIED_LABEL, lines: unclassified },
    // What the campaign published no line for, carried whole — a draft that measured half the
    // structure and said nothing about the other half would be the partial faulty estimate this
    // product is built against (L-QTY-04, L-QTY-07, I-451).
    notMeasured: (reading.notMeasured ?? []).map((row) => ({ class: row.class, kind: row.kind, levels: row.levels, cause: row.cause })),
  };
}

/**
 * The codes a line with no figure gave, once each, as the payload carries them — or nothing, on a
 * line that states a figure or gave no code (the schema asks for at least one where the key stands).
 */
function omittedOf(line: BoqReadingLine): { omitted?: string[] } {
  if (line.value !== null) return {};
  const codes = [...new Set(line.omitted ?? [])];
  return codes.length === 0 ? {} : { omitted: codes };
}

/**
 * The groups of one section, in the catalogue's order, each with its lines in reading order.
 *
 * A group's description is the one a model CHOSE from the closed catalogue where a reading stands
 * for it, and the plain `Class · Kind` the document has always written where none does (L-BD-01,
 * I-298). One description reaches the screen and the PDF, because there is one emission of it
 * (I-269, I-271).
 */
function groupsOf(held: readonly Placed[], descriptions: GroupDescriptions | undefined): BoqDraftGroup[] {
  const pairs = new Map<string, Placed[]>();
  for (const entry of held) {
    const key = `${entry.class}\u0000${entry.kind}`;
    const carried = pairs.get(key);
    if (carried === undefined) pairs.set(key, [entry]);
    else carried.push(entry);
  }

  const groups = [...pairs.values()].map((entries) => {
    const first = entries[0] as Placed;
    const lines = entries
      .map((entry) => entry.line)
      .sort((one, other) => (one.levelOrdinal ?? 0) - (other.levelOrdinal ?? 0) || compareCanonical(one.objectKey, other.objectKey));
    const unit = WORK_ITEM_CATALOGUE[first.kind].canonicalUnit;
    const group: BoqDraftGroup = {
      class: first.class,
      kind: first.kind,
      description: descriptions?.get(groupKeyOf(first.class, first.kind))?.text ?? descriptionOf(first.class, first.kind),
      unit,
      lines,
      // A group none of whose lines states a figure carries NO subtotal: the sum of nothing is not a
      // zero anybody measured, and the page says `Not measured` for it instead (I-450).
      subtotals: figuresOf(lines).length === 0 ? [] : [{ unit, value: sumAt(figuresOf(lines), placesOf(first.kind)) }],
    };
    return group;
  });

  // The catalogue's own order, which is the order `numberItems` reads a section's groups in: a page
  // whose groups ran one way and whose numbers ran another would be one numbering shown twice.
  return groups.sort((one, other) => ELEMENT_TYPES.indexOf(one.class as ElementType) - ELEMENT_TYPES.indexOf(other.class as ElementType) || KINDS.indexOf(one.kind as Kind) - KINDS.indexOf(other.kind as Kind));
}
