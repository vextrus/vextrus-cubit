// The `boq-draft` document kind: the unpriced draft of a campaign's published lines, as the owner
// ruled a bill is shaped — one item per description, the member lines behind it as its details of
// measurement, and a closing page that says what the draft leaves out (R-TO-053, A-BOQ-PDF, AM-05,
// AM-14 §2; s-boq I-528, I-451).
//
// IT IS A DRAFT AND SAYS SO ON EVERY PAGE. Before M7 nothing here is signed, so the frame prints
// `DRAFT — UNSIGNED` on every leaf and the document carries no surveyor, no credential and no
// certificate — and it is never called by the name the law reserves for the signed thing (AM-05).
// Its front page states the project IN WORDS — client, site, the drawing set and its revision, the
// day it was issued — and the checking record a draft circulates with, blank (I-530,
// I-531). No surrogate id and no raw enum stands anywhere a reader reads.
//
// AN ITEM IS ROUNDED ONCE. The emission sums an item's member lines at the register's own precision
// and rounds the sum once; the member lines are each rounded once on their own. The kind states both
// and adds neither (L-FMT-02, I-528).
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
import { formatUserFigure } from "../../format";
import { UNITS } from "../../units/canon";
import { figure } from "../figures";
import {
  BOQ_DRAFT,
  BOQ_SECTIONS,
  CHECKING_FIELDS,
  CHECKING_LABELS,
  COVERAGE_WORDS,
  DETAILS_HEADING,
  FRONT_LABELS,
  LINE_REASONS_HEADING,
  NOT_MEASURED,
  NOT_MEASURED_HEADING,
  NOT_MEASURED_SCOPE_HEADING,
  NOT_STATED,
  ROUNDING_NOTE,
  descriptionOf,
  groupQualifier,
  inWords,
  notMeasuredAbout,
  numberItems,
  placesOf,
  reasonsInWords,
  taxonomyInWords,
} from "./boq-draft-law";
import { kindTemplate, type DocumentKind } from "./law";

export {
  BOQ_DRAFT,
  BOQ_DRAFT_TITLE,
  BOQ_SECTIONS,
  DETAILS_HEADING,
  DRAFT_BANNER,
  LINE_REASONS_HEADING,
  NOT_MEASURED,
  NOT_MEASURED_HEADING,
  NOT_MEASURED_SCOPE_HEADING,
  compareItems,
  descriptionOf,
  groupQualifier,
  inWords,
  notMeasuredAbout,
  notMeasuredWords,
  numberItems,
  placesForUnit,
  placesOf,
  reasonsInWords,
  setRevisionInWords,
  taxonomyInWords,
  withLevel,
  type BoqSection,
  type NumberableGroup,
  type NumberableItem,
  type NumberableSection,
} from "./boq-draft-law";

/* ------------------------------------------------------------------ the payload, parsed once */

/**
 * A registered code as a payload carries one — `SLAB_THICKNESS_UNSTATED`, `NOT_ESTABLISHED` — and
 * never its words: the words are the kind's to write, once, where the page is set (L-FMT-03).
 */
const registeredCode = z.string().regex(/^[A-Z][A-Z0-9_]*$/u);

/** A day as a document states one, already through the format seam: `24 Sep 2026` (L-FMT-01). */
const documentDay = z.string().regex(/^\d{2} [A-Z][a-z]{2} \d{4}$/u);

/**
 * One MEMBER line of the draft: a published register line, as its item's details of measurement
 * print it (I-528). It carries NO item number: a number handed in would be a second home for
 * a fact the catalogue order and the level stack already decide, and the schema is strict, so a line
 * that carried `item` or `itemNumber` is refused rather than quietly stripped (AM-14 §2, L-FMT-03).
 */
const draftLine = z
  .object({
    lineId: z.string().min(1),
    objectKey: z.string().min(1),
    /** The level's own label, as a reader reads it — never the surrogate's id (I-25). */
    level: z.string(),
    /** Where that level stands in the stack: what "up the building" means when items are ordered. */
    levelOrdinal: z.number().int().nullable().optional(),
    /** The register's lawful-null slot the member stands in where it stands on no level (L-REG-04). */
    slot: z.string().min(1).optional(),
    /** A decimal string (B-07) — the member's own register figure, rounded once — or nothing at all. */
    quantity: z.string().min(1).nullable(),
    unit: z.enum(UNITS as [string, ...string[]]),
    coverage: z.string().min(1),
    quantityBasis: z.string().min(1),
    selectionBasis: z.string().min(1),
    /** Which row of the taxonomy placed this line, as the resolver recorded it (L-BD-08). */
    decidedBy: z.string(),
    /**
     * The registered codes a line that states no figure gave for what it could not measure, in the
     * order it gave them (L-QTY-02). The page says them as words, so a line with no figure is never
     * silent about why (I-450). Absent on a line that states one.
     */
    omitted: z.array(registeredCode).min(1).readonly().optional(),
    /** The member's mark, as the register filed it (`PC1`) — how a checker finds it on the plan. */
    mark: z.string().optional(),
    /** The grid intersection its placement reads nearest, `C/2` — read off the grid, never invented. */
    grid: z.string().optional(),
    /** How many of the member the line counts (its formula's `count`), already a decimal string. */
    nos: z.string().min(1).optional(),
    /** The dimensions its formula multiplied, in words and through the format seam (`L 2 m · B 1 m`). */
    dimensions: z.string().optional(),
    /** The sheet its evidence stands on, by the number its title block states (`S-06`). */
    sheet: z.string().optional(),
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

/**
 * One ITEM of the draft: a section plus a full description at one level band — the owner's ruling —
 * and the figure the register's sum of its member lines comes to, rounded ONCE (I-528,
 * I-529). `key` is the item's identity for numbering and for nothing else; the number itself
 * is derived and stored nowhere (AM-14 §2).
 */
const draftItem = z
  .object({
    key: z.string().min(1),
    description: z.string().min(1),
    /** What the Level column states: the band's label, or the member levels' labels where unbanded. */
    level: z.string(),
    /** The lawful-null slot where every member stands on no level of the stack (`FOUNDATION`). */
    slot: z.string().min(1).optional(),
    levelOrdinal: z.number().int().nullable().optional(),
    /** The register's sum over the members that state a figure, rounded once — or nothing at all. */
    quantity: z.string().min(1).nullable(),
    unit: z.enum(UNITS as [string, ...string[]]),
    /** COMPLETE only where every member line is; the weakest of the members' bases (L-QTY-01). */
    coverage: z.string().min(1),
    quantityBasis: z.string().min(1),
    selectionBasis: z.string().min(1),
    lines: z.array(draftLine).min(1),
  })
  .strict();

/**
 * One (class, kind) group of a section: the trade heading its items stand under. `description` is
 * the SENTENCE the group's items are described by — the work-item catalogue's, or the one a model
 * chose from the closed catalogue (L-BD-01, I-298) — and every item of the group opens with it. No
 * quantity is stated for a group: a group may hold several descriptions, and no quantity subtotal
 * crosses descriptions (I-529).
 */
const draftGroup = z
  .object({
    class: z.enum(ELEMENT_TYPES as unknown as [string, ...string[]]),
    kind: z.enum(KINDS as unknown as [string, ...string[]]),
    description: z.string().min(1),
    unit: z.enum(UNITS as [string, ...string[]]),
    items: z.array(draftItem).min(1),
  })
  .strict();

/** One section of the draft. A section holding no line is not emitted at all (scope). */
const draftSection = z
  .object({
    bill: z.enum(BOQ_SECTIONS as unknown as [string, ...string[]]),
    label: z.string().min(1),
    groups: z.array(draftGroup).min(1),
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

/**
 * What the front page states about the project, IN WORDS (I-530): nothing here is an id. A
 * question the project holds no answer to is `null`, and the page says `Not stated` for it rather
 * than inventing one; `issued` is the day the ISSUE stamped, and a reading that was never issued
 * carries none.
 */
const frontMatter = z
  .object({
    client: z.string().min(1).nullable(),
    site: z.string().min(1).nullable(),
    /** The pinned drawing set, as `setRevisionInWords` says it: name, revision, the day it was pinned. */
    drawingSet: z.string().min(1).nullable(),
    /** The drawings that revision pins, by the names they were uploaded under. */
    drawings: z.array(z.string().min(1)),
    issued: documentDay.nullable(),
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
    /** The project in words, for the front page. Absent reads as nothing known about it. */
    front: frontMatter.optional(),
    sections: z.array(draftSection),
    unclassified: z.object({ label: z.string().min(1), lines: z.array(unplacedLine) }).strict(),
    /** What this draft did not measure, stated rather than implied (I-451). Absent reads as none. */
    notMeasured: z.array(notMeasuredRow).optional(),
  })
  .strict();

/** The draft payload, as the schema reads it. */
export type BoqDraftPayload = z.output<typeof boqDraftPayloadSchema>;

/** One member line of a payload, as the schema reads it. */
export type BoqDraftLine = z.output<typeof draftLine>;

/** One item of a payload, as the schema reads it. */
export type BoqDraftItem = z.output<typeof draftItem>;

/** One group of a payload, as the schema reads it. */
export type BoqDraftGroup = z.output<typeof draftGroup>;

/** One section of a payload, as the schema reads it. */
export type BoqDraftSection = z.output<typeof draftSection>;

/** The front page's facts, as the schema reads them. */
export type BoqDraftFront = z.output<typeof frontMatter>;

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

/**
 * The scope no line of this draft was published for, as words a reader reads (I-451): what it
 * is, over which levels, and why — the cause in the registry's own sentence. The PDF's closing block
 * and the workbook's `Not measured` sheet both read it, so the two faces state one boundary.
 */
export function notMeasuredScopeOf(payload: Pick<BoqDraftPayload, "notMeasured">): { readonly about: string; readonly levels: string; readonly why: string }[] {
  return (payload.notMeasured ?? []).map((row) => ({ about: notMeasuredAbout(row), levels: row.levels, why: registeredSentence(row.cause) ?? inWords(row.cause) }));
}

/** Every member line a payload holds, placed or not, in the order the draft prints them. */
export function draftLinesOf(payload: Pick<BoqDraftPayload, "sections" | "unclassified">): BoqDraftLine[] {
  return [...payload.sections.flatMap((section) => section.groups.flatMap((group) => group.items.flatMap((item) => item.lines))), ...payload.unclassified.lines];
}

/**
 * Every reason a line of this draft states no figure, once each, in the order the draft first gives
 * it: the words its item prints, beside the registry's own sentence for them (L-QTY-02, I-451). The
 * item stays short enough to read down a column; the sentence stands here, once.
 */
export function lineReasonsOf(payload: Pick<BoqDraftPayload, "sections" | "unclassified">): { readonly reason: string; readonly meaning: string }[] {
  const codes = [...new Set(draftLinesOf(payload).flatMap((line) => (line.quantity === null ? (line.omitted ?? []) : [])))];
  return codes.map((code) => ({ reason: inWords(code), meaning: registeredSentence(code) ?? "" }));
}

/**
 * What an item's figure is qualified by (I-450 at the item's grain): how many of its member lines
 * state a figure, and why the rest do not. Empty where every member states one.
 */
export function itemQualifierOf(item: Pick<BoqDraftItem, "lines">): string {
  const measured = item.lines.filter((line) => line.quantity !== null).length;
  const reasons = item.lines.flatMap((line) => (line.quantity === null ? (line.omitted ?? []) : []));
  return groupQualifier(measured, item.lines.length, reasons);
}

/* ------------------------------------------------------- the payload, as the template reads it */

/** Where a line or an item stands, as the page says it: its level's label, else its slot in words. */
function standingWords(held: { readonly level: string; readonly slot?: string }): string {
  if (held.level !== "") return held.level;
  return held.slot === undefined ? "" : inWords(held.slot);
}

/**
 * Whether what `standingWords` says is a WORD (a lawful-null slot said in words) rather than a level's
 * label. A label is model data and sets in the figure face; a slot is an enum said in words and keeps
 * the body face, as the screen keeps it (I-355(b), R-UI-085).
 */
function isSlotWords(held: { readonly level: string; readonly slot?: string }): boolean {
  return held.level === "" && held.slot !== undefined;
}

/**
 * One item as the template receives it. The figure crosses `figure()` here, so a quantity that is
 * not at its kind's stated precision is refused before anything is staged rather than rounded into
 * agreement (L-FMT-02) — and an item none of whose members states a figure states no figure at all,
 * never a zero (L-QTY-04): it says `Not measured`, and its qualifier says why (I-450).
 */
function presentedItem(item: BoqDraftItem, kind: string, number: string): Record<string, unknown> {
  // Whether an item states a figure is read off its MEMBER LINES (I-450(d)): a payload that carried
  // a figure over members none of which states one still prints the words, never that figure.
  const stated = item.quantity !== null && item.lines.some((line) => line.quantity !== null);
  return {
    item: number,
    description: item.description,
    qualifier: itemQualifierOf(item),
    level: standingWords(item),
    levelIsWord: isSlotWords(item),
    quantity: stated ? figure(item.quantity as string, placesOf(kind)) : "",
    notMeasured: stated ? "" : NOT_MEASURED,
    unit: item.unit,
  };
}

/**
 * One member line as the details of measurement print it: the mark and grid a checker finds it by on
 * the plan, where it stands, how many, what the formula multiplied, its own figure rounded once, the
 * basis the figure rests on in words, and the sheet its evidence stands on (I-528).
 */
function presentedDetail(line: BoqDraftLine, kind: string): Record<string, unknown> {
  return {
    mark: line.mark ?? "",
    grid: line.grid ?? "",
    level: standingWords(line),
    levelIsWord: isSlotWords(line),
    nos: line.nos === undefined ? "" : formatUserFigure(line.nos),
    dimensions: line.dimensions ?? "",
    quantity: line.quantity === null ? "" : figure(line.quantity, placesOf(kind)),
    notMeasured: line.quantity === null ? NOT_MEASURED : "",
    reasons: line.quantity === null ? reasonsInWords(line.omitted ?? []) : "",
    unit: line.unit,
    basis: inWords(line.quantityBasis),
    sheet: line.sheet ?? "",
  };
}

/** The front page's facts as label and value pairs, every value in words (I-530). */
function frontRowsOf(draft: BoqDraftPayload): { readonly label: string; readonly value: string }[] {
  const front = draft.front;
  const drawings = front?.drawings ?? [];
  return [
    { label: FRONT_LABELS.project, value: draft.project },
    { label: FRONT_LABELS.client, value: front?.client ?? NOT_STATED },
    { label: FRONT_LABELS.site, value: front?.site ?? NOT_STATED },
    { label: FRONT_LABELS.drawingSet, value: front?.drawingSet ?? NOT_STATED },
    { label: FRONT_LABELS.drawings, value: drawings.length === 0 ? NOT_STATED : drawings.join(", ") },
    // The day the issue went out — and no row at all on a reading nobody issued: a working export is
    // not an issue, and `Not stated` would read as a fact nobody knew (I-530).
    ...(front?.issued === null || front?.issued === undefined ? [] : [{ label: FRONT_LABELS.issued, value: front.issued }]),
    { label: FRONT_LABELS.taxonomy, value: taxonomyInWords(draft.taxonomyVersion) },
    { label: FRONT_LABELS.measurement, value: draft.coverage === "COMPLETE" ? COVERAGE_WORDS.COMPLETE : COVERAGE_WORDS.INCOMPLETE },
  ];
}

/**
 * What every page's foot says the paper IS: the project, the draft, and the day it was issued — so a
 * page read on its own still says what it is a page of (I-530). Never an id.
 */
function footerOf(draft: BoqDraftPayload): string {
  const issued = draft.front?.issued ?? null;
  return [draft.project, draft.title, ...(issued === null ? [] : [`issued ${issued}`])].join(" · ");
}

/**
 * The payload as the template receives it: plain JSON, every figure already written, every item
 * number already derived, every reason already in words, and nothing left for the template to decide.
 */
function present(payload: unknown): Record<string, unknown> {
  const draft = payload as BoqDraftPayload;
  const numbers = numberItems(draft.sections);

  const sections = draft.sections.map((section) => ({
    ordinal: (BOQ_SECTIONS as readonly string[]).indexOf(section.bill) + 1,
    label: section.label,
    // A section states no quantity of its own and no foot: its groups hold unlike items, and no
    // quantity subtotal crosses descriptions (I-529). Each item is the figure (L-QTY-07).
    groups: section.groups.map((group) => ({
      heading: descriptionOf(group.class, group.kind),
      items: group.items.map((item) => presentedItem(item, group.kind, numbers.get(item.key) ?? "")),
    })),
  }));

  // The appendix: every item again, by its number, with the member lines it was summed from.
  const details = draft.sections.flatMap((section) =>
    section.groups.flatMap((group) =>
      group.items.map((item) => ({
        item: numbers.get(item.key) ?? "",
        description: item.description,
        level: standingWords(item),
        rows: item.lines.map((line) => presentedDetail(line, group.kind)),
      })),
    ),
  );

  return {
    title: draft.title,
    project: draft.project,
    front: { rows: frontRowsOf(draft), checking: CHECKING_LABELS, fields: CHECKING_FIELDS },
    footer: footerOf(draft),
    sections,
    // Kept, labelled, reason stated, never dropped (L-BD-08). An unplaced line carries no item
    // number: it stands outside the six sections, and a number would make it a seventh (I-267).
    unclassified: {
      label: draft.unclassified.label,
      lines: draft.unclassified.lines.map((line) => ({
        reason: inWords(line.reason),
        description: descriptionOf(line.class, line.kind),
        level: standingWords(line),
        quantity: line.quantity === null ? "" : figure(line.quantity, placesOf(line.kind)),
        notMeasured: line.quantity === null ? NOT_MEASURED : "",
        reasons: line.quantity === null ? reasonsInWords(line.omitted ?? []) : "",
        unit: line.unit,
      })),
    },
    // What the draft leaves out, stated on its own closing page (I-451): the scope no line was
    // published for, and each reason a line states no figure in the registry's own sentence. Both
    // empty on a draft that left nothing out, and the template then prints no page at all.
    notMeasured: {
      heading: NOT_MEASURED_HEADING,
      scopeHeading: NOT_MEASURED_SCOPE_HEADING,
      scope: notMeasuredScopeOf(draft),
      reasonsHeading: LINE_REASONS_HEADING,
      reasons: lineReasonsOf(draft),
    },
    details: { heading: DETAILS_HEADING, note: ROUNDING_NOTE, items: details },
  };
}

/** The kind itself, as the barrel enumerates it (AM-11: the barrel never re-declares this). */
export const BOQ_DRAFT_KIND: DocumentKind = Object.freeze({
  kind: BOQ_DRAFT,
  payloadSchema: boqDraftPayloadSchema,
  template: kindTemplate("boq-draft.typ"),
  present,
});
