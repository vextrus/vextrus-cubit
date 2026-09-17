// The `boq-draft` document kind: the unpriced draft of a campaign's published lines, grouped into
// L-BD-08's sections (R-TO-053, A-BOQ-PDF, AM-05, AM-14 §2).
//
// IT IS A DRAFT AND SAYS SO ON EVERY PAGE. Before M7 nothing here is signed, so the frame prints
// `DRAFT — UNSIGNED` on every leaf and the document carries no surveyor, no credential and no
// certificate — and it is never called by the name the law reserves for the signed thing (AM-05).
//
// THE ITEM NUMBER IS DERIVED HERE AND STORED NOWHERE (AM-14 §2). `numberItems` stands in this file
// because BOTH faces of the draft must call ONE derivation — the screen that shows it and the
// presenter that prints it — and `src/core` is the one layer a module, a server door and this seam
// can all reach (ARCH-01, B-17). `src/modules/takeoff/boq/numbering.ts` publishes it to the takeoff
// module under the name the interfaces give it, and re-implements nothing.
//
// The section roster is here for the same reason: it is the closed set of sections a draft can
// print, read by this kind's schema and re-published by the takeoff module's taxonomy as `BILLS`,
// so the taxonomy that PLACES a line and the document that prints it cannot hold two rosters.
import { z } from "zod";
import { ELEMENT_TYPES } from "../../catalogue/classes";
import { KINDS } from "../../catalogue/kinds";
import { WORK_ITEM_CATALOGUE } from "../../catalogue/catalogue";
import { compareCanonical } from "../../identity";
import { UNITS } from "../../units/canon";
import { figure } from "../figures";
import { kindTemplate, type DocumentKind } from "./law";

/** What this kind is asked for by, and the key the barrel files it under. */
export const BOQ_DRAFT = "boq-draft";

/** What the document calls itself where a payload states no title of its own. */
export const BOQ_DRAFT_TITLE = "Draft BOQ — unpriced";

/**
 * L-BD-08's six sections (L244), in the clause's own order (AM-16). The closed set a draft can print
 * and the roster `src/modules/takeoff/boq/taxonomy.ts` publishes as `BILLS` — one roster, two readers.
 */
export const BOQ_SECTIONS = ["SUBSTRUCTURE", "SUPERSTRUCTURE", "FINISHES", "ELECTRICAL", "PLUMBING", "EXTERNAL"] as const;

/** One section of a draft, drawn from the closed roster above. */
export type BoqSection = (typeof BOQ_SECTIONS)[number];

/** The banner this document carries on every page while no signature exists (A-BOQ-PDF, AM-05). */
export const DRAFT_BANNER = "DRAFT — UNSIGNED";

/** The one label a section's foot may carry while coverage is incomplete (L-QTY-04, L-QTY-07). */
export const MEASURED_SCOPE_SUBTOTAL = "Measured-scope subtotal";

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

/* ------------------------------------------------------------ AM-14 §2's item number, derived */

/** What numbering needs of a line: its identity, its key, and the storey it stands on. */
export type NumberableLine = { readonly lineId: string; readonly objectKey: string; readonly levelOrdinal?: number | null };

/** What numbering needs of a group: the (class, kind) pair the catalogue orders it by. */
export type NumberableGroup = { readonly class: string; readonly kind: string; readonly lines: readonly NumberableLine[] };

/** What numbering needs of a section: which section it is, and the groups it holds. */
export type NumberableSection = { readonly bill: string; readonly groups: readonly NumberableGroup[] };

/**
 * Where a class or a kind stands in its closed roster. A name no roster holds sorts last rather than
 * first: an unknown pair is a defect of the data, and a defect that took position 1 would renumber
 * every well-formed group behind it.
 */
function rosterIndex(roster: readonly string[], value: string): number {
  const at = roster.indexOf(value);
  return at === -1 ? roster.length : at;
}

/**
 * Every line's item number, keyed by `lineId`: `S.G.I`.
 *
 * `S` is the section's ordinal among the SIX — the number a reader can quote across two projects —
 * and not its position among the sections this draft happens to hold, so a campaign that published
 * nothing into Substructure still opens its Superstructure at 2. `G` is the (class, kind) group's
 * ordinal in `ELEMENT_TYPES`-then-`KINDS` order, counting only the groups the section holds. `I` is
 * the line's ordinal inside its group, read DOWN THE BUILDING first and, where two lines share a
 * storey, in the canonical order of the object key (L-REG-05's code-unit sort, never a locale's).
 *
 * A section outside the roster — the kept `UNCLASSIFIED` block — has no `S` and is not numbered at
 * all: an item number belongs to a numbered line, and numbering the unplaced would be a seventh
 * section by the back door (I-267).
 *
 * Pure: the same sections answer the same map, whatever order the arrays happen to hold. A line
 * measured tomorrow renumbers the lines around it and takes nobody's identity away — which is why
 * nothing in this product keys on an item number.
 */
export function numberItems(sections: readonly NumberableSection[]): ReadonlyMap<string, string> {
  const numbers = new Map<string, string>();
  for (const section of sections) {
    const sectionOrdinal = (BOQ_SECTIONS as readonly string[]).indexOf(section.bill) + 1;
    if (sectionOrdinal === 0) continue;
    const groups = [...section.groups].sort(
      (one, other) => rosterIndex(ELEMENT_TYPES, one.class) - rosterIndex(ELEMENT_TYPES, other.class) || rosterIndex(KINDS, one.kind) - rosterIndex(KINDS, other.kind),
    );
    groups.forEach((group, groupIndex) => {
      const lines = [...group.lines].sort((one, other) => (one.levelOrdinal ?? 0) - (other.levelOrdinal ?? 0) || compareCanonical(one.objectKey, other.objectKey));
      lines.forEach((line, lineIndex) => {
        numbers.set(line.lineId, `${sectionOrdinal}.${groupIndex + 1}.${lineIndex + 1}`);
      });
    });
  }
  return numbers;
}

/* ------------------------------------------------------------------------ what the page shows */

/**
 * A key as a page says it: `rcc.concrete` → `Concrete`, `brick_wall` → `Brick wall`,
 * `NO_TAXONOMY_ROW` → `No taxonomy row`. One rule and no roster to keep in step — the same rule the
 * screen's own `EnumLabel` reads a key by, so the two faces of a draft say a key the same way.
 *
 * The chapter is dropped from a kind because the class beside it already names the trade's subject:
 * `Column · Concrete` reads as a bill item, `Column · Rcc.concrete` reads as a database row.
 */
export function inWords(value: string): string {
  const words = value.slice(value.indexOf(".") + 1).replace(/_/gu, " ").toLowerCase();
  return `${words.slice(0, 1).toUpperCase()}${words.slice(1)}`;
}

/** What a (class, kind) group is called on the page: the class and the trade, in that order. */
export function descriptionOf(klass: string, kind: string): string {
  return `${inWords(klass)} · ${inWords(kind)}`;
}

/** The places a kind's figures are written to (L-MEA-04's catalogue, L-FMT-02's per-kind precision). */
export function placesOf(kind: string): number {
  return WORK_ITEM_CATALOGUE[kind as keyof typeof WORK_ITEM_CATALOGUE].documentPrecision;
}

/**
 * The places a foot in one unit is written to: the widest any group standing in that unit is written
 * to, so a section that adds three-place concrete to three-place brickwork states three places and a
 * mixed unit never quietly loses a digit. Exported because the emission writes the figure and this
 * presenter checks it: one rule, or the two would refuse each other (L-FMT-02, B-17).
 */
export function placesForUnit(groups: readonly { readonly kind: string; readonly unit: string }[], unit: string): number {
  const held = groups.filter((group) => group.unit === unit).map((group) => placesOf(group.kind));
  return held.length === 0 ? 0 : Math.max(...held);
}

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
