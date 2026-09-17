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
import { UNITS } from "../../units/canon";
import { figure } from "../figures";
import { BOQ_DRAFT, BOQ_SECTIONS, MEASURED_SCOPE_SUBTOTAL, descriptionOf, inWords, numberItems, placesForUnit, placesOf } from "./boq-draft-law";
import { kindTemplate, type DocumentKind } from "./law";

export {
  BOQ_DRAFT,
  BOQ_DRAFT_TITLE,
  BOQ_SECTIONS,
  DRAFT_BANNER,
  MEASURED_SCOPE_SUBTOTAL,
  descriptionOf,
  inWords,
  numberItems,
  placesForUnit,
  placesOf,
  type BoqSection,
  type NumberableGroup,
  type NumberableLine,
  type NumberableSection,
} from "./boq-draft-law";

/* ------------------------------------------------------------------ the payload, parsed once */

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

/* ------------------------------------------------------- the payload, as the template reads it */

/**
 * One line as the template receives it. The figure crosses `figure()` here, so a quantity that is
 * not at its kind's stated precision is refused before anything is staged rather than rounded into
 * agreement (L-FMT-02) — and a line that declared what it could not measure states no figure at all,
 * never a zero (L-QTY-04).
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
    unit: line.unit,
    coverage: line.coverage,
  };
}

/** One foot of a group or a section: a figure per unit, at the precision the group is written to. */
function presentedSubtotals(subtotals: readonly { unit: string; value: string }[], kind: string): Record<string, unknown>[] {
  return subtotals.map((held) => ({ value: figure(held.value, placesOf(kind)), unit: held.unit }));
}

/**
 * The payload as the template receives it: plain JSON, every figure already written, every item
 * number already derived, and nothing left for the template to decide.
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
      groups: section.groups.map((group) => ({
        description: group.description,
        unit: group.unit,
        subtotals: presentedSubtotals(group.subtotals, group.kind),
        lines: group.lines.map((line) => presentedLine(line, group, items.get(line.lineId) ?? "")),
      })),
      // A section's foot is stated per unit and under the one label L-QTY-07 allows while the
      // coverage is incomplete. There is no figure for the project: a draft that added its sections
      // together would state a quantity nobody measured over a scope nobody covered (L-QTY-04).
      subtotals: section.subtotals.map((held) => ({ value: figure(held.value, placesForUnit(section.groups, held.unit)), unit: held.unit })),
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
        unit: line.unit,
      })),
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
