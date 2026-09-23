// The `boq-draft` document kind: the unpriced draft of a campaign's published lines, grouped into
// L-BD-08's sections (R-TO-053, A-BOQ-PDF, AM-05, AM-14 §2).
//
// IT IS A DRAFT AND SAYS SO ON EVERY PAGE. Before M7 nothing here is signed, so the frame prints
// `DRAFT — UNSIGNED` on every leaf and the document carries no surveyor, no credential and no
// certificate — and it is never called by the name the law reserves for the signed thing (AM-05).
//
// THE ITEM NUMBER IS DERIVED AND STORED NOWHERE (AM-14 §2), and the section roster is one roster
// read by two readers. Both live in `./boq-draft-law.ts` — the pure law beside this kind — because a
// `DocumentKind` names its template, and a template resolves through `node:fs`: a screen that reached
// this file for the roster would pull a process boundary into the browser's graph (ARCH-01, AS-01).
// This file re-publishes every one of those names, so a reader of the kind still finds them here.
import { z } from "zod";
import { ELEMENT_TYPES } from "../../catalogue/classes";
import { KINDS } from "../../catalogue/kinds";
import { REFUSALS, type RefusalEntry } from "../../errors";
import { UNITS } from "../../units/canon";
import { figure } from "../figures";
import {
  BOQ_DRAFT,
  BOQ_SECTIONS,
  LINE_REASONS_HEADING,
  MEASURED_SCOPE_SUBTOTAL,
  NOT_MEASURED,
  NOT_MEASURED_HEADING,
  NOT_MEASURED_SCOPE_HEADING,
  descriptionOf,
  groupQualifier,
  inWords,
  numberItems,
  placesForUnit,
  placesOf,
  reasonsInWords,
} from "./boq-draft-law";
import { kindTemplate, type DocumentKind } from "./law";

export {
  BOQ_DRAFT,
  BOQ_DRAFT_TITLE,
  BOQ_SECTIONS,
  DRAFT_BANNER,
  LINE_REASONS_HEADING,
  MEASURED_SCOPE_SUBTOTAL,
  NOT_MEASURED,
  NOT_MEASURED_HEADING,
  NOT_MEASURED_SCOPE_HEADING,
  descriptionOf,
  groupQualifier,
  inWords,
  notMeasuredWords,
  numberItems,
  placesForUnit,
  placesOf,
  reasonsInWords,
  type BoqSection,
  type NumberableGroup,
  type NumberableLine,
  type NumberableSection,
} from "./boq-draft-law";

/* ------------------------------------------------------------------ the payload, parsed once */

/**
 * A registered code as a payload carries one — `SLAB_THICKNESS_UNSTATED`, `NOT_ESTABLISHED` — and
 * never its words: the words are the kind's to write, once, where the page is set (L-FMT-03).
 */
const registeredCode = z.string().regex(/^[A-Z][A-Z0-9_]*$/u);

/**
 * One line of the draft. It carries NO item number: a number handed in would be a second home for a
 * fact the catalogue order and the level stack already decide, and the schema is strict, so a line
 * that carried `item` or `itemNumber` is refused rather than quietly stripped (AM-14 §2, L-FMT-03).
 */
const draftLine = z
  .object({
    lineId: z.string().min(1),
    objectKey: z.string().min(1),
    /** The level's own label, as a reader reads it — never the surrogate's id (I-25). */
    level: z.string(),
    /** Where that level stands in the stack: what "down the building" means when lines are numbered. */
    levelOrdinal: z.number().int().nullable().optional(),
    /** A decimal string (B-07), or nothing at all where the line declared what it could not measure. */
    quantity: z.string().min(1).nullable(),
    unit: z.enum(UNITS as [string, ...string[]]),
    coverage: z.string().min(1),
    quantityBasis: z.string().min(1),
    selectionBasis: z.string().min(1),
    /** Which row of the taxonomy placed this line, as the resolver recorded it (L-BD-08). */
    decidedBy: z.string(),
    /**
     * The registered codes a line that states no figure gave for what it could not measure, in the
     * order it gave them (L-QTY-02). The page says them as words in the line's Quantity cell, so a
     * line with no figure is never silent about why (I-450). Absent on a line that states one.
     */
    omitted: z.array(registeredCode).min(1).readonly().optional(),
  })
  .strict();

/**
 * A line the taxonomy could not place: kept, labelled, and carrying the reason it was not placed
 * (L-BD-08). It names its own class and kind because no group holds it — and a figure still has to
 * be written at its kind's precision, whatever the taxonomy could not decide about it.
 */
const unplacedLine = draftLine
  .extend({
    class: z.enum(ELEMENT_TYPES as unknown as [string, ...string[]]),
    kind: z.enum(KINDS as unknown as [string, ...string[]]),
    reason: z.string().min(1),
  })
  .strict();

/** One figure of a foot, stated per unit — cubic metres and square metres are never added together. */
const subtotal = z.object({ unit: z.enum(UNITS as [string, ...string[]]), value: z.string().min(1) }).strict();

/** One (class, kind) group of a section, with the lines it holds and its own per-unit subtotals. */
const draftGroup = z
  .object({
    class: z.enum(ELEMENT_TYPES as unknown as [string, ...string[]]),
    kind: z.enum(KINDS as unknown as [string, ...string[]]),
    description: z.string().min(1),
    unit: z.enum(UNITS as [string, ...string[]]),
    lines: z.array(draftLine).min(1),
    subtotals: z.array(subtotal),
  })
  .strict();

/** One section of the draft. A section holding no line is not emitted at all (scope). */
const draftSection = z
  .object({
    bill: z.enum(BOQ_SECTIONS as unknown as [string, ...string[]]),
    label: z.string().min(1),
    groups: z.array(draftGroup).min(1),
    subtotals: z.array(subtotal),
  })
  .strict();

/**
 * One row of what the draft did not measure: the measurement boundary the residue states — a kind,
 * on a class (or on none, where no class bears it), over a run of levels, and the registered cause
 * it stands unmeasured under (L-QTY-05, L-QTY-07, I-451). Never a count: "how many" is not a
 * boundary.
 */
const notMeasuredRow = z
  .object({
    class: z.string().min(1).nullable(),
    kind: z.string().min(1),
    /** The run of levels the row states, collapsed as the statement prints it: `""`, `GF` or `GF–3F`. */
    levels: z.string(),
    cause: registeredCode,
  })
  .strict();

/** What the draft is rendered from. Unknown keys are refused: a payload is a statement, not a bag. */
export const boqDraftPayloadSchema = z
  .object({
    title: z.string().min(1),
    project: z.string().min(1),
    campaignId: z.string().min(1),
    setRevisionId: z.string().min(1),
    /** The taxonomy this draft was made under; an issued document never follows a later one. */
    taxonomyVersion: z.string().min(1),
    coverage: z.string().min(1),
    sections: z.array(draftSection),
    unclassified: z.object({ label: z.string().min(1), lines: z.array(unplacedLine) }).strict(),
    /** What this draft did not measure, stated rather than implied (I-451). Absent reads as none. */
    notMeasured: z.array(notMeasuredRow).optional(),
  })
  .strict();

/** The draft payload, as the schema reads it. */
export type BoqDraftPayload = z.output<typeof boqDraftPayloadSchema>;

/** One line of a payload, as the schema reads it. */
export type BoqDraftLine = z.output<typeof draftLine>;

/** One group of a payload, as the schema reads it. */
export type BoqDraftGroup = z.output<typeof draftGroup>;

/** One section of a payload, as the schema reads it. */
export type BoqDraftSection = z.output<typeof draftSection>;

/** One row of what a payload did not measure, as the schema reads it. */
export type BoqNotMeasuredRow = z.output<typeof notMeasuredRow>;

/* ------------------------------------------------------- what the draft leaves out, in words */

/**
 * The registry's own sentence for a code, or `null` where the registry holds none — a code the
 * registry does not hold is said in its words and nothing more, never in a sentence invented for it
 * (R-UI-082, R-SPINE-062).
 */
function registeredSentence(code: string): string | null {
  if (!Object.hasOwn(REFUSALS, code)) return null;
  return (REFUSALS as Readonly<Record<string, RefusalEntry>>)[code]?.message ?? null;
}

/** What a boundary row is about, as the page says it: the class and the kind, or the kind alone. */
function aboutOf(row: { readonly class: string | null; readonly kind: string }): string {
  return row.class === null ? inWords(row.kind) : descriptionOf(row.class, row.kind);
}

/**
 * The scope no line of this draft was published for, as words a reader reads (I-451): what it
 * is, over which levels, and why — the cause in the registry's own sentence. The PDF's closing block
 * and the workbook's `Not measured` sheet both read it, so the two faces state one boundary.
 */
export function notMeasuredScopeOf(payload: Pick<BoqDraftPayload, "notMeasured">): { readonly about: string; readonly levels: string; readonly why: string }[] {
  return (payload.notMeasured ?? []).map((row) => ({ about: aboutOf(row), levels: row.levels, why: registeredSentence(row.cause) ?? inWords(row.cause) }));
}

/**
 * Every reason a line of this draft states no figure, once each, in the order the draft first gives
 * it: the words its Quantity cell prints, beside the registry's own sentence for them (L-QTY-02,
 * I-451). The cell stays short enough to read down a column; the sentence stands here, once.
 */
export function lineReasonsOf(payload: Pick<BoqDraftPayload, "sections" | "unclassified">): { readonly reason: string; readonly meaning: string }[] {
  const lines = [...payload.sections.flatMap((section) => section.groups.flatMap((group) => group.lines)), ...payload.unclassified.lines];
  const codes = [...new Set(lines.flatMap((line) => (line.quantity === null ? (line.omitted ?? []) : [])))];
  return codes.map((code) => ({ reason: inWords(code), meaning: registeredSentence(code) ?? "" }));
}

/* ------------------------------------------------------- the payload, as the template reads it */

/**
 * What a line with no figure says, split where the page sets it (I-450): `Not measured` in its
 * Quantity cell, and its reasons in words on the same row, beside the description — where the wide
 * column holds them on one line that a 28 mm figure column would wrap three times. A line that
 * states a figure says neither.
 */
function unmeasuredOf(line: BoqDraftLine): { readonly notMeasured: string; readonly reasons: string } {
  if (line.quantity !== null) return { notMeasured: "", reasons: "" };
  return { notMeasured: NOT_MEASURED, reasons: reasonsInWords(line.omitted ?? []) };
}

/**
 * One line as the template receives it. The figure crosses `figure()` here, so a quantity that is
 * not at its kind's stated precision is refused before anything is staged rather than rounded into
 * agreement (L-FMT-02) — and a line that declared what it could not measure states no figure at all,
 * never a zero (L-QTY-04): it says `Not measured` and why, in words (I-450).
 */
function presentedLine(line: BoqDraftLine, group: { readonly kind: string; readonly description: string }, item: string): Record<string, unknown> {
  const kind = group.kind;
  return {
    item,
    // The item's own description, repeated down its group: a bill line is read across, and a reader
    // who quotes one line quotes what it is FOR as well as how much of it there is (L-BD-01).
    description: group.description,
    level: line.level,
    quantity: line.quantity === null ? "" : figure(line.quantity, placesOf(kind)),
    ...unmeasuredOf(line),
    unit: line.unit,
    coverage: line.coverage,
  };
}

/**
 * One group as the template receives it: its figure where any line states one, `Not measured` where
 * none does — never the zero an empty sum comes to — and, where not every line states a figure, the
 * qualification that says how many did and why the rest did not (I-450). Whether a line states a
 * figure is read off the LINES, so a subtotal a payload carried over nothing still prints no zero.
 */
function presentedGroup(group: BoqDraftGroup, items: ReadonlyMap<string, string>): Record<string, unknown> {
  const measured = group.lines.filter((line) => line.quantity !== null).length;
  const reasons = group.lines.flatMap((line) => (line.quantity === null ? (line.omitted ?? []) : []));
  return {
    description: group.description,
    unit: group.unit,
    figure: measured === 0 ? "" : group.subtotals.map((held) => figure(held.value, placesOf(group.kind))).join(" "),
    notMeasured: measured === 0 ? NOT_MEASURED : "",
    qualifier: groupQualifier(measured, group.lines.length, reasons),
    lines: group.lines.map((line) => presentedLine(line, group, items.get(line.lineId) ?? "")),
  };
}

/**
 * A section's foot: one row per unit its groups stand in, in the order they first stand in it — the
 * figure over what was measured in that unit, or `Not measured` where no line in it states one
 * (I-450). Cubic metres and square metres are never added together (L-QTY-04).
 */
function presentedFoot(section: BoqDraftSection): Record<string, unknown>[] {
  const units = [...new Set(section.groups.map((group) => group.unit))];
  return units.map((unit) => {
    const measured = section.groups.some((group) => group.unit === unit && group.lines.some((line) => line.quantity !== null));
    const held = section.subtotals.find((subtotal) => subtotal.unit === unit);
    if (!measured || held === undefined) return { value: "", notMeasured: NOT_MEASURED, unit };
    return { value: figure(held.value, placesForUnit(section.groups, unit)), notMeasured: "", unit };
  });
}

/**
 * The payload as the template receives it: plain JSON, every figure already written, every item
 * number already derived, every reason already in words, and nothing left for the template to decide.
 */
function present(payload: unknown): Record<string, unknown> {
  const draft = payload as BoqDraftPayload;
  const items = numberItems(draft.sections);

  return {
    title: draft.title,
    project: draft.project,
    campaignId: draft.campaignId,
    setRevisionId: draft.setRevisionId,
    taxonomyVersion: draft.taxonomyVersion,
    coverage: draft.coverage,
    subtotalLabel: MEASURED_SCOPE_SUBTOTAL,
    sections: draft.sections.map((section) => ({
      ordinal: (BOQ_SECTIONS as readonly string[]).indexOf(section.bill) + 1,
      label: section.label,
      groups: section.groups.map((group) => presentedGroup(group, items)),
      // A section's foot is stated per unit and under the one label L-QTY-07 allows while the
      // coverage is incomplete. There is no figure for the project: a draft that added its sections
      // together would state a quantity nobody measured over a scope nobody covered (L-QTY-04).
      subtotals: presentedFoot(section),
    })),
    // Kept, labelled, reason stated, never dropped (L-BD-08). An unplaced line carries no item
    // number: it stands outside the six sections, and a number would make it a seventh (I-267).
    unclassified: {
      label: draft.unclassified.label,
      lines: draft.unclassified.lines.map((line) => ({
        reason: inWords(line.reason),
        description: descriptionOf(line.class, line.kind),
        level: line.level,
        quantity: line.quantity === null ? "" : figure(line.quantity, placesOf(line.kind)),
        ...unmeasuredOf(line),
        unit: line.unit,
      })),
    },
    // What the draft leaves out, stated where it closes (I-451): the scope no line was published
    // for, and each reason a line states no figure in the registry's own sentence. Both empty on a
    // draft that left nothing out, and the template then prints no block at all.
    notMeasured: {
      heading: NOT_MEASURED_HEADING,
      scopeHeading: NOT_MEASURED_SCOPE_HEADING,
      scope: notMeasuredScopeOf(draft),
      reasonsHeading: LINE_REASONS_HEADING,
      reasons: lineReasonsOf(draft),
    },
  };
}

/** The kind itself, as the barrel enumerates it (AM-11: the barrel never re-declares this). */
export const BOQ_DRAFT_KIND: DocumentKind = Object.freeze({
  kind: BOQ_DRAFT,
  payloadSchema: boqDraftPayloadSchema,
  template: kindTemplate("boq-draft.typ"),
  present,
});
