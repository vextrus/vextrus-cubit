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
import { formatUserFigure } from "../../format";
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

/** The one label a section's foot may carry while coverage is incomplete (L-QTY-04, L-QTY-07). */
export const MEASURED_SCOPE_SUBTOTAL = "Measured-scope subtotal";

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
 * What a group's figure is qualified by where not every line of it states one (I-450): how many
 * of its lines were measured, how many were not and why — `12 of 26 measured; 14 not measured —
 * blinding plan deferred`, or `None of 208 measured — …` where no line was. Empty where every line
 * states a figure: an unqualified figure is then the whole of the group.
 */
export function groupQualifier(measured: number, held: number, codes: readonly string[]): string {
  if (measured >= held) return "";
  const reasons = reasonsInWords(codes);
  const why = reasons === "" ? "" : ` — ${reasons}`;
  if (measured === 0) return `None of ${counted(held)} measured${why}`;
  return `${counted(measured)} of ${counted(held)} measured; ${counted(held - measured)} not measured${why}`;
}

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
 * mixed unit never quietly loses a digit. Exported because the emission writes the figure and the
 * presenter checks it: one rule, or the two would refuse each other (L-FMT-02, B-17).
 */
export function placesForUnit(groups: readonly { readonly kind: string; readonly unit: string }[], unit: string): number {
  const held = groups.filter((group) => group.unit === unit).map((group) => placesOf(group.kind));
  return held.length === 0 ? 0 : Math.max(...held);
}
