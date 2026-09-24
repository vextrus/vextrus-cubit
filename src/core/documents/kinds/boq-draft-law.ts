// The draft BOQ's law: the closed set of sections it can print, the words it prints them with, and
// AM-14 §2's item number (L-BD-08, R-TO-053).
//
// WHY IT IS ITS OWN FILE. Both faces of a draft must read ONE roster and call ONE numbering — the
// screen that shows it and the presenter that prints it — and `src/core` is the one layer a module, a
// server door and the document seam can all reach (ARCH-01, B-17). The kind beside it cannot be that
// home: a `DocumentKind` names the template standing next to it, which resolves the checkout through
// `node:fs`, so a screen that imported the kind for its roster would pull a process boundary into the
// browser's own module graph (AS-01). This file holds what every layer may read — data and pure
// functions, no seam, no path, no I/O — and `./boq-draft.ts` re-publishes it beside the schema.
import { WORK_ITEM_CATALOGUE } from "../../catalogue/catalogue";
import { ELEMENT_TYPES } from "../../catalogue/classes";
import { KINDS } from "../../catalogue/kinds";
import { formatDate, formatUserFigure } from "../../format";
import { compareCanonical } from "../../identity";

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

/* ------------------------------------------------- where no figure stands, the words say so */

/**
 * What a document says where no figure stands — a line that declared what it could not measure, a
 * group none of whose lines states one, a foot over a unit nothing was measured in. A zero there
 * would be a quantity nobody measured: `Column · Rebar 0.000 kg` reads as "no steel in the columns"
 * (L-QTY-04, R-UI-020, I-450).
 */
export const NOT_MEASURED = "Not measured";

/** The heading of the block a draft closes with: what it leaves out, stated (L-QTY-07, I-451). */
export const NOT_MEASURED_HEADING = "Not measured in this draft";

/** The first part of that block: the kinds, classes and levels no line was published for. */
export const NOT_MEASURED_SCOPE_HEADING = "Scope no line was published for";

/** The second part: each reason a line states no figure, once, in the registry's own sentence. */
export const LINE_REASONS_HEADING = "Why a line states no figure";

/**
 * A line's omitted codes as the page says them: each once, in the order the line states them, as
 * words — the same rule `inWords` reads every key by, so `SLAB_THICKNESS_UNSTATED` is `slab thickness
 * unstated` wherever a draft prints it. The registry's full sentence for each stands once, in the
 * closing block, rather than on every line (L-QTY-02, I-450).
 */
export function reasonsInWords(codes: readonly string[]): string {
  return [...new Set(codes)].map((code) => inWords(code).toLowerCase()).join("; ");
}

/** What the Quantity cell of a line with no figure says: `Not measured — <its reasons in words>`. */
export function notMeasuredWords(codes: readonly string[]): string {
  const reasons = reasonsInWords(codes);
  return reasons === "" ? NOT_MEASURED : `${NOT_MEASURED} — ${reasons}`;
}

/** A count as a page writes it — through the one format seam, like every other number (L-FMT-01). */
function counted(value: number): string {
  return formatUserFigure(String(value));
}

/**
 * What an item's figure is qualified by where not every member line behind it states one (I-450,
 * carried from the group to the item by I-528): how many of its lines were measured, how many
 * were not and why — `12 of 26 measured; 14 not measured — blinding plan deferred`, or `None of 208
 * measured — …` where no line was. Empty where every line states a figure: an unqualified figure is
 * then the whole of the item.
 */
export function groupQualifier(measured: number, held: number, codes: readonly string[]): string {
  if (measured >= held) return "";
  const reasons = reasonsInWords(codes);
  const why = reasons === "" ? "" : ` — ${reasons}`;
  if (measured === 0) return `None of ${counted(held)} measured${why}`;
  return `${counted(measured)} of ${counted(held)} measured; ${counted(held - measured)} not measured${why}`;
}

/* ------------------------------------------------------------ AM-14 §2's item number, derived */

/**
 * What numbering needs of an item: the identity it is numbered under, and the storey it stands on.
 * An item is ONE description at one level band (the owner's bill-shape ruling, s-boq I-528):
 * the member lines behind it are its details of measurement and carry no number of their own.
 */
export type NumberableItem = { readonly key: string; readonly levelOrdinal?: number | null };

/** What numbering needs of a group: the (class, kind) pair the catalogue orders it by. */
export type NumberableGroup = { readonly class: string; readonly kind: string; readonly items: readonly NumberableItem[] };

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
 * Where an item stands in reading order: the foundation's lawful-null slot (no ordinal) below every
 * storey, then the stack from its lowest level up — the order a bill is read in, and the order the
 * emission prints its items in (one derivation, I-269).
 */
function levelRankOf(ordinal: number | null | undefined): number {
  return ordinal === null || ordinal === undefined ? Number.NEGATIVE_INFINITY : ordinal;
}

/**
 * The order the items of one group are read in: lower storey first, and — where two items share a
 * storey — the canonical order of their keys (L-REG-05's code-unit sort, never a locale's). Exported
 * because the emission prints items in this order and numbering numbers them in it: one comparator,
 * or a page whose items ran one way and whose numbers ran another (B-17).
 */
export function compareItems(one: NumberableItem, other: NumberableItem): number {
  const [a, b] = [levelRankOf(one.levelOrdinal), levelRankOf(other.levelOrdinal)];
  if (a !== b) return a < b ? -1 : 1;
  return compareCanonical(one.key, other.key);
}

/**
 * Every item's number, keyed by the item's `key`: `S.G.I`.
 *
 * `S` is the section's ordinal among the SIX — the number a reader can quote across two projects —
 * and not its position among the sections this draft happens to hold, so a campaign that published
 * nothing into Substructure still opens its Superstructure at 2. `G` is the (class, kind) group's
 * ordinal in `ELEMENT_TYPES`-then-`KINDS` order, counting only the groups the section holds. `I` is
 * the item's ordinal inside its group, read up the building from the foundation (`compareItems`).
 *
 * A section outside the roster — the kept `UNCLASSIFIED` block — has no `S` and is not numbered at
 * all: an item number belongs to a numbered item, and numbering the unplaced would be a seventh
 * section by the back door (I-267).
 *
 * Pure: the same sections answer the same map, whatever order the arrays happen to hold. A line
 * measured tomorrow may add an item and renumber the items around it, and takes nobody's identity
 * away — which is why nothing in this product keys on an item number (AM-14 §2).
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
      [...group.items].sort(compareItems).forEach((item, itemIndex) => {
        numbers.set(item.key, `${sectionOrdinal}.${groupIndex + 1}.${itemIndex + 1}`);
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
 * mixed unit never quietly loses a digit. Exported because the emission writes the figure and the
 * presenter checks it: one rule, or the two would refuse each other (L-FMT-02, B-17).
 */
export function placesForUnit(groups: readonly { readonly kind: string; readonly unit: string }[], unit: string): number {
  const held = groups.filter((group) => group.unit === unit).map((group) => placesOf(group.kind));
  return held.length === 0 ? 0 : Math.max(...held);
}

/**
 * What a row of the measurement statement is ABOUT, as the page says it: the class and the kind, or
 * the kind alone where no class bears it (I-451). One rule for the PDF's closing block, the
 * workbook's sheet and the screen's own closing section, so the three faces say one boundary.
 */
export function notMeasuredAbout(row: { readonly class: string | null; readonly kind: string }): string {
  return row.class === null ? inWords(row.kind) : descriptionOf(row.class, row.kind);
}

/* ------------------------------------------------------------- the draft's front page, in words */

/** The appendix a draft carries behind its items: each member line an item was summed from. */
export const DETAILS_HEADING = "Details of measurement";

/**
 * The one sentence that says how the two figures on this paper relate (I-528): an item is the
 * register's own sum of its members, rounded ONCE, and each member line is its own register value
 * rounded once — so a figure on either page is the register's, and neither is a sum of the other's
 * printed figures.
 */
export const ROUNDING_NOTE =
  "Each item states the register's sum of its members, rounded once to the places its kind is written to. Each member line in the details of measurement states its own register figure, rounded once the same way.";

/**
 * What a document's front page says where the project holds no answer to one of its questions —
 * the ONE phrase: the draft BOQ and the bar schedule both read it here, so the two papers of one
 * project never disagree about the same blank (I-690). The project's details (the edit door
 * on the projects home) are where a person states the client and the site.
 */
export const NOT_STATED = "Not stated";

/** What the front page says about the draft's measurement, complete or not (L-QTY-04, I-451). */
export const COVERAGE_WORDS: Readonly<Record<"COMPLETE" | "INCOMPLETE", string>> = Object.freeze({
  COMPLETE: "Complete: every class the drawings show was measured",
  INCOMPLETE: `Incomplete: what this draft leaves out is listed under ${NOT_MEASURED_HEADING}`,
});

/** The front page's labels, in the order it states them. */
export const FRONT_LABELS = Object.freeze({
  project: "Project",
  client: "Client",
  site: "Site",
  drawingSet: "Drawing set",
  drawings: "Drawings",
  issued: "Issued",
  taxonomy: "Sections",
  measurement: "Measurement",
});

/**
 * The checking record a draft circulates with: who prepared it and who checked it, each a blank a
 * person fills by hand. It names nobody and signs nothing — the draft stays DRAFT — UNSIGNED on
 * every page and names no responsible surveyor (AM-05 (2), I-531).
 */
export const CHECKING_LABELS: readonly string[] = Object.freeze(["Prepared by", "Checked by"]);

/**
 * What stands under each checking blank: the three things a checker writes — the name, the hand and
 * the day (I-692). The signature line is ruled paper for the checker's own hand, as the bar
 * schedule's sign-off box has it; the product signs nothing (AM-05 (2)).
 */
export const CHECKING_FIELDS: readonly string[] = Object.freeze(["Name", "Signature", "Date"]);

/* ------------------------------------------------ the drawing register and the measurement notes */

/**
 * The drawing register a draft states on its front page (I-689): each sheet the bill's lines
 * were measured on, by the number and title its title block states and the revision its title block
 * marks, in sheet-number order.
 */
export const REGISTER_HEADING = "Drawings measured";

/** The register's column heads, in the order it prints them. */
export const REGISTER_HEADS: readonly string[] = Object.freeze(["Sheet", "Title", "Rev"]);

/** What the register's revision cell says where a sheet's title block marks no revision. */
export const REVISION_NOT_MARKED = "Not marked";

/** The notes a draft opens on, before its first item (I-691). */
export const MEASUREMENT_NOTES_HEADING = "Measurement notes";

/**
 * The method note: the method of measurement, and the rule-set edition in force by its own name and
 * version (L-MEA-01). A draft whose payload names no edition says so rather than naming one.
 */
export function methodNote(edition: { readonly name: string; readonly version: string } | null): string {
  const method = edition === null ? "the rule-set edition in force, which this draft does not name" : `the rule-set edition ${edition.name}, version ${edition.version}`;
  return `Quantities are measured net from the drawings listed above, by the method of measurement of ${method}: its deductions, its thresholds and its rules at junctions.`;
}

/**
 * What each basis a figure can rest on means, in L-QTY-01's own order of recourse. The notes state
 * only the bases this draft's lines rest on, each once.
 */
export const BASIS_MEANINGS: Readonly<Record<string, string>> = Object.freeze({
  MEASURED: "read off the drawing's geometry; checked by measuring it again",
  TRANSCRIBED: "read from a figure the drawings state in words or in a schedule; checked by reading it again",
  DERIVED: "computed by a named rule of the method from measured or stated figures",
  IMPORTED: "taken from a file brought in from outside the drawings",
  ENTERED: "entered by a person, as a recorded act",
  INTERPRETED: "traced from a scanned image; reproducible, but no drawn geometry stands behind it",
  DEFAULTED: "supplied by the rule-set edition where the drawings are silent; nobody measured it",
});

/** How the notes introduce the bases: the Basis column of the details of measurement reads them. */
export const BASIS_NOTE = "The Basis column of the details of measurement says where each figure came from:";

/** What `Not measured` means wherever the draft prints it (I-450, I-451, L-QTY-04). */
export const NOT_MEASURED_NOTE = `${NOT_MEASURED} means the draft states no figure for that item or line and nothing can be priced against it. It is never a zero: the reason stands beside it, and everything the draft leaves out is listed under ${NOT_MEASURED_HEADING}.`;

/**
 * The taxonomy a draft was sectioned under, as a reader says it: its EDITION as a date (L-FMT-01) —
 * `bill-taxonomy/2026-09-16` is the taxonomy of 16 Sep 2026, and the edition is what tells one
 * taxonomy from the next (I-355, I-530). A version written without an ISO edition is stated as
 * it stands.
 */
export function taxonomyInWords(version: string): string {
  const edition = /(\d{4})-(\d{2})-(\d{2})$/u.exec(version);
  if (edition === null) return version;
  const [, year, month, day] = edition;
  return `By the taxonomy of ${formatDate({ year: Number(year), month: Number(month), day: Number(day) })}`;
}

/**
 * A drawing set's pinned revision as a reader says it: the set's own name, which revision of it this
 * is, and the day it was pinned — never the revision's surrogate id (R-UI-082, I-530).
 */
export function setRevisionInWords(set: { readonly name: string; readonly ordinal: number; readonly pinnedOn: string }): string {
  return `${set.name}, revision ${counted(set.ordinal)}, pinned ${set.pinnedOn}`;
}

/**
 * An item's description with the storey it is priced at, for a face that has no Level column of its
 * own (the workbook's section sheets): `… — columns, at GF`. Where the item stands at no band the
 * description is the whole of it.
 */
export function withLevel(description: string, level: string): string {
  return level === "" ? description : `${description}, at ${level}`;
}
