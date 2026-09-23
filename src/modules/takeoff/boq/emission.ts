// The draft's emission: a campaign's published lines, placed by the taxonomy and written as the owner
// ruled a bill is shaped — one ITEM per description at one level band, each the register's own sum of
// its member lines rounded once, with the member lines behind it as its details of measurement
// (R-TO-053, L-BD-08, AM-14, L-MEA-05, L-QTY-04; s-boq I-528, I-529).
//
// IT READS AND NEVER RE-MEASURES. The rails published these figures at full precision and storey by
// storey (L-MEA-09); this file groups them, sums a COPY of the members' figures for each item, rounds
// each thing once for the page, and writes back nothing. A draft that re-derived a quantity would be a
// second measurement of the same building.
//
// ROUNDING IS HALF-EVEN, ONCE, AT THE EDGE (L-MEA-05's decimal habit, L-QTY-07's "documents round the
// quantity before extension"). An item's figure is the sum of its members' REGISTER values, rounded
// once — so it ties to the Trace to the last printed place (93.893 m³ of column concrete, where a sum
// of rounded lines said 93.904). A member line's own figure is its register value, rounded once. No
// figure on the page is a sum of other printed figures, and no quantity is added across descriptions:
// a group and a section state none (I-529).
import Decimal from "decimal.js";
import { WORK_ITEM_CATALOGUE } from "@/core/catalogue/catalogue";
import { ELEMENT_TYPES, type ElementType } from "@/core/catalogue/classes";
import { KINDS, type Kind } from "@/core/catalogue/kinds";
import {
  BOQ_DRAFT_TITLE,
  compareItems,
  placesOf,
  type BoqDraftFront,
  type BoqDraftGroup,
  type BoqDraftItem,
  type BoqDraftLine,
  type BoqDraftPayload,
  type BoqDraftSection,
} from "@/core/documents/kinds/boq-draft";
import { compareCanonical } from "@/core/identity";
import { weakestBasis, type QuantityBasis } from "@/core/offers/law";
import { exact } from "@/core/units/canon";
import { markOrder } from "@/modules/takeoff/register-ui/order";
import { groupKeyOf, type GroupDescriptions } from "./description-basis";
import { bandOf, dimensionsOf, itemDescriptionOf, itemKeyOf, nosOf, statedAttributesOf, type ReadingBinding } from "./items";
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
  /* --- what the details of measurement print, and what selects the item (I-528) --- */
  /** The mark the register filed the member under (`PC1`). */
  readonly mark?: string | null;
  /** The lawful-null slot the member stands in where it stands on no level (`FOUNDATION`). */
  readonly slot?: string | null;
  /** The grid intersection its placement reads nearest (`C/2`), where the plan's grid states one. */
  readonly grid?: string | null;
  /** The sheet its evidence stands on, by its title block's number (`S-06`). */
  readonly sheet?: string | null;
  /** The formula the figure was computed by, as the gate rendered it. */
  readonly formula?: string;
  /** What each variable of that formula was read as. */
  readonly variables?: Readonly<Record<string, ReadingBinding>>;
  /** The variables the drawings did not state (L-QTY-02), by name. */
  readonly omittedVariables?: readonly string[];
  /** What the drawings state that SELECTS this line's item, as the rail carried it (L-MEA-06). */
  readonly selectors?: Readonly<Record<string, unknown>>;
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
   * L-AI-02). Absent, or absent for a group, is the ordinary case: the catalogue's own sentence
   * stands, and the emission asks nobody anything.
   */
  readonly descriptions?: GroupDescriptions;
  /**
   * The measurement statement — what this campaign published no line for, and why — as the residue
   * computed it (I-451). The draft carries it whole, so the paper that leaves the office says what
   * it leaves out; absent reads as nothing stated, which is the reading a caller without a residue
   * has.
   */
  readonly notMeasured?: readonly BoqNotMeasured[];
  /** The project in words, for the document's front page (I-530). Absent reads as unknown. */
  readonly front?: BoqDraftFront;
};

/** One line on its way into a section, with what the resolver and the item law said about it. */
type Placed = {
  readonly member: BoqDraftLine;
  readonly value: string | null;
  readonly class: ElementType;
  readonly kind: Kind;
  readonly bill: Bill | typeof UNCLASSIFIED;
  readonly reason: string | null;
  readonly mark: string;
  readonly band: string;
  readonly itemKey: string;
  readonly attributes: ReturnType<typeof statedAttributesOf>;
};

/** A published figure as a document writes it: half to even at the kind's stated places (L-MEA-05). */
function atDocumentPrecision(value: string, kind: Kind): string {
  return exact(value).toFixed(placesOf(kind), Decimal.ROUND_HALF_EVEN);
}

/**
 * An item's figure: the members' REGISTER values added exactly, then rounded ONCE to the kind's
 * places — or nothing where no member states a figure. The sum of nothing is not a zero anybody
 * measured (L-QTY-04, I-450), and a sum of already-rounded figures would not tie to the Trace
 * (I-528).
 */
export function itemQuantityOf(values: readonly (string | null)[], kind: Kind): string | null {
  const stated = values.filter((value): value is string => value !== null);
  if (stated.length === 0) return null;
  return stated.reduce((carried, value) => carried.plus(exact(value)), exact("0")).toFixed(placesOf(kind), Decimal.ROUND_HALF_EVEN);
}

/** Where a member stands in reading order: the foundation's slot first, then the stack upwards. */
function rankOf(ordinal: number | null | undefined): number {
  return ordinal === null || ordinal === undefined ? Number.NEGATIVE_INFINITY : ordinal;
}

/** The order an item's members are read in: storey, then the mark as a surveyor counts it, then key. */
function compareMembers(one: Placed, other: Placed): number {
  const [a, b] = [rankOf(one.member.levelOrdinal), rankOf(other.member.levelOrdinal)];
  if (a !== b) return a < b ? -1 : 1;
  return markOrder(one.mark, other.mark) || compareCanonical(one.member.objectKey, other.member.objectKey);
}

/**
 * The draft payload one reading emits (test contract: `boqDraftPayloadOf`).
 *
 * Sections stand in `BILLS` order and a section holding no line is not emitted at all; groups stand
 * in the catalogue's order; items are read up the building from the foundation (`compareItems`, the
 * order `numberItems` numbers them in), so the numbers a page prints run in the order it prints them.
 */
export function boqDraftPayloadOf(reading: BoqReading): BoqDraftPayload {
  const boundary = plinthBoundaryOf(reading.levels);
  const levels = new Map(reading.levels.map((level) => [level.levelId, level]));

  const placed: Placed[] = reading.lines.map((line) => {
    const level = line.levelId === null ? undefined : levels.get(line.levelId);
    const resolution = resolveBill({ class: line.class, kind: line.kind, levelOrdinal: level?.ordinal ?? null }, boundary);
    const band = bandOf(resolution.bill, level?.label ?? "");
    const attributes = statedAttributesOf(line.kind, line.selectors, line.variables);
    return {
      class: line.class,
      kind: line.kind,
      bill: resolution.bill,
      reason: resolution.reason,
      value: line.value,
      mark: line.mark ?? "",
      band,
      attributes,
      itemKey: itemKeyOf(resolution.bill, line.class, line.kind, band, attributes),
      member: {
        lineId: line.lineId,
        objectKey: line.objectKey,
        level: level?.label ?? "",
        levelOrdinal: level?.ordinal ?? null,
        ...(level === undefined && typeof line.slot === "string" && line.slot !== "" ? { slot: line.slot } : {}),
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
        ...detailsOf(line),
      },
    };
  });

  const sections: BoqDraftSection[] = [];
  for (const bill of BILLS) {
    const held = placed.filter((entry) => entry.bill === bill);
    if (held.length === 0) continue;
    sections.push({ bill, label: BILL_LABELS[bill], groups: groupsOf(held, reading.descriptions, levels) });
  }

  // Kept, labelled, reason stated, never dropped (L-BD-08). It stands after the six and is no
  // section of them: a line the taxonomy could not place is a VISIBLE gap in the draft.
  const unclassified = placed
    .filter((entry) => entry.bill === UNCLASSIFIED)
    .sort((one, other) => (one.member.levelOrdinal ?? 0) - (other.member.levelOrdinal ?? 0) || compareCanonical(one.member.objectKey, other.member.objectKey))
    .map((entry) => ({ ...entry.member, class: entry.class, kind: entry.kind, reason: entry.reason ?? "" }));

  const complete = reading.coverageComplete && reading.lines.every((line) => line.coverage === COMPLETE) && unclassified.length === 0;

  return {
    title: BOQ_DRAFT_TITLE,
    project: reading.project,
    campaignId: reading.campaignId,
    setRevisionId: reading.setRevisionId,
    taxonomyVersion: BILL_TAXONOMY.version,
    coverage: complete ? COMPLETE : INCOMPLETE,
    ...(reading.front === undefined ? {} : { front: reading.front }),
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
 * What the details of measurement print about one member line, where the register states it: the
 * mark and grid a checker finds it by, how many, what the formula multiplied and the sheet its
 * evidence stands on (I-528). A fact nobody read is absent, never guessed.
 */
function detailsOf(line: BoqReadingLine): Pick<BoqDraftLine, "mark" | "grid" | "nos" | "dimensions" | "sheet"> {
  const nos = nosOf(line.variables);
  const dimensions = line.variables === undefined && line.omittedVariables === undefined ? "" : dimensionsOf(line.formula ?? "", line.variables ?? {}, line.omittedVariables ?? []);
  return {
    ...(typeof line.mark === "string" && line.mark !== "" ? { mark: line.mark } : {}),
    ...(typeof line.grid === "string" && line.grid !== "" ? { grid: line.grid } : {}),
    ...(nos === undefined ? {} : { nos }),
    ...(dimensions === "" ? {} : { dimensions }),
    ...(typeof line.sheet === "string" && line.sheet !== "" ? { sheet: line.sheet } : {}),
  };
}

/**
 * The groups of one section, in the catalogue's order, each holding its items in reading order.
 *
 * A group's sentence is the one a model CHOSE from the closed catalogue where a reading stands for
 * it, and the work-item catalogue's own sentence where none does (L-BD-01, I-298); every item of the
 * group opens with it. One sentence reaches the screen and the PDF, because there is one emission of
 * it (I-269, I-271).
 */
function groupsOf(held: readonly Placed[], descriptions: GroupDescriptions | undefined, levels: ReadonlyMap<string, StackLevel>): BoqDraftGroup[] {
  const pairs = new Map<string, Placed[]>();
  for (const entry of held) {
    const key = `${entry.class} ${entry.kind}`;
    const carried = pairs.get(key);
    if (carried === undefined) pairs.set(key, [entry]);
    else carried.push(entry);
  }

  const groups = [...pairs.values()].map((entries) => {
    const first = entries[0] as Placed;
    const sentence = descriptions?.get(groupKeyOf(first.class, first.kind))?.text ?? WORK_ITEM_CATALOGUE[first.kind].description;
    const unit = WORK_ITEM_CATALOGUE[first.kind].canonicalUnit;
    const group: BoqDraftGroup = {
      class: first.class,
      kind: first.kind,
      description: sentence,
      unit,
      items: itemsOf(entries, sentence, unit, levels).sort(compareItems),
    };
    return group;
  });

  // The catalogue's own order, which is the order `numberItems` reads a section's groups in: a page
  // whose groups ran one way and whose numbers ran another would be one numbering shown twice.
  return groups.sort((one, other) => ELEMENT_TYPES.indexOf(one.class as ElementType) - ELEMENT_TYPES.indexOf(other.class as ElementType) || KINDS.indexOf(one.kind as Kind) - KINDS.indexOf(other.kind as Kind));
}

/**
 * The items of one group: every member line sharing a description and a band is one item, whose
 * figure is their register sum rounded once and whose bases and coverage are the weakest of theirs
 * (L-QTY-01's weakest-wins roll-up) — COMPLETE only where every member is (I-528).
 */
function itemsOf(entries: readonly Placed[], sentence: string, unit: string, levels: ReadonlyMap<string, StackLevel>): BoqDraftItem[] {
  const byKey = new Map<string, Placed[]>();
  for (const entry of entries) {
    const carried = byKey.get(entry.itemKey);
    if (carried === undefined) byKey.set(entry.itemKey, [entry]);
    else carried.push(entry);
  }

  return [...byKey.values()].map((members) => {
    const sorted = [...members].sort(compareMembers);
    const first = sorted[0] as Placed;
    const lines = sorted.map((entry) => entry.member);
    const labels = [...new Set(lines.map((line) => line.level).filter((label) => label !== ""))];
    const slots = [...new Set(lines.flatMap((line) => (line.slot === undefined ? [] : [line.slot])))];
    const ordinals = lines.flatMap((line) => (line.levelOrdinal === null || line.levelOrdinal === undefined ? [] : [line.levelOrdinal]));
    const band = first.band === "" ? undefined : [...levels.values()].find((level) => level.label === first.band);
    const unmeasured = lines.find((line) => line.coverage !== COMPLETE);
    return {
      key: first.itemKey,
      description: itemDescriptionOf(sentence, first.class, first.attributes),
      level: first.band !== "" ? first.band : labels.join(", "),
      ...(labels.length === 0 && slots.length > 0 ? { slot: slots[0] as string } : {}),
      levelOrdinal: band?.ordinal ?? (ordinals.length === 0 ? null : Math.min(...ordinals)),
      quantity: itemQuantityOf(
        sorted.map((entry) => entry.value),
        first.kind,
      ),
      unit,
      coverage: unmeasured === undefined ? COMPLETE : unmeasured.coverage,
      quantityBasis: weakestBasis(lines.map((line) => line.quantityBasis as QuantityBasis)),
      selectionBasis: weakestBasis(lines.map((line) => line.selectionBasis as QuantityBasis)),
      lines,
    };
  });
}
