// What makes one ITEM of the draft, and the words it is written in (the owner's bill-shape ruling;
// s-boq I-528): a section plus a full description — the member, what the drawings state that
// selects the item, and the storey where PWD's floor rate applies — over every member line that shares
// all of it. The member lines behind an item are its details of measurement.
//
// A LEAF, on purpose: the emission, the screen's demonstration and the lanes all read it, and none of
// them may pull the model seam or the store in behind one word (ARCH-01, AS-01). Pure: data in, words
// out, no clock and no locale (L-FMT-01 is the format seam's).
//
// NOTHING HERE IS WRITTEN FREELY. The sentence an item opens with is the work-item catalogue's (or
// the one a model CHOSE from the closed catalogue, I-298); what follows it is the member's own class
// in words and the attributes the register already states — the rails' selecting attributes
// (L-MEA-06) and, for a kind whose rate book prices a thickness, the binding that states it — each as
// written, through the format seam. No value is invented and none is banded (L-MEA-06: facts, never
// bands).
import { inWords } from "@/core/documents/kinds/boq-draft-law";
import { formatUserFigure } from "@/core/format";
import { compareCanonical, readCitedKey } from "@/core/identity";
import { isDecimalFigure } from "@/core/projects";
import Decimal from "decimal.js";
import { CANONICAL_UNIT, convert, dimensionOf, exact, unitNamed } from "@/core/units/canon";

/**
 * The sections an item is priced floor by floor in (I-528): above the plinth, where PWD's
 * extra-floor added rate is billed as its own line against each floor's quantity (L-BD-04: "added-rate
 * items (extra floor …) modify a base item and bill as separate lines"; L-FRM-07: "floor escalation
 * resolves by ordinal"). Substructure is below the plinth and External stands on the site: neither
 * carries a floor rate, so an item there is one band whatever storey its members stand on.
 */
export const FLOOR_RATED_SECTIONS: readonly string[] = Object.freeze(["SUPERSTRUCTURE", "FINISHES", "ELECTRICAL", "PLUMBING"]);

/** The storey an item is banded at: the member's level label where the floor rate applies, else none. */
export function bandOf(bill: string, levelLabel: string): string {
  return FLOOR_RATED_SECTIONS.includes(bill) ? levelLabel : "";
}

/** One reading of one variable, as the rail wrote it and as the canon made it (the line's `bindings`). */
export type ReadingBinding = {
  readonly value: string;
  readonly unit: string;
  readonly canonical: { readonly value: string; readonly unit: string };
  /** What the figure rests on (`MEASURED`, `TRANSCRIBED`, `DERIVED`, …) — absent reads as not drawn. */
  readonly basis?: string;
  /** The key the figure is cited at: an entity of the drawing, an edition's parameter, an act. */
  readonly source?: string;
};

/**
 * One attribute an item's description states: its name, the value and unit AS WRITTEN (what the page
 * says), where the figure came from when the drawings do not state it (`note`, null where they do),
 * and what it is the same as — the canonical reading where the canon carried one, so a thickness
 * written `3 in` on one member and `76.2 mm` on another is one item, not two — and its note, so a
 * drawn thickness and a rule set's default are two descriptions and so two items.
 */
export type StatedAttribute = { readonly name: string; readonly value: string; readonly unit: string; readonly note: string | null; readonly same: string };

/**
 * The bases under which a figure is the DRAWING's own: read off its geometry or off its text. Only
 * these are stated bare in a description; any other figure an item rests on is said with where it
 * came from (I-533: a description states what the drawings state, and says so when it does not).
 */
const DRAWN_BASES: readonly string[] = Object.freeze(["MEASURED", "TRANSCRIBED"]);

/** How a description says a figure the drawings do not state (I-533). */
const NOT_DRAWN = "not on the drawings";
const RULE_SET_DEFAULT = "rule-set default";

/**
 * Where a described binding's figure came from, in words, where the drawings do not state it — the
 * rule set's own default where it is cited at an edition's parameter (L-MEA-01), else its basis in
 * words — or null where they do. A binding that names no basis is not taken to be drawn.
 */
function noteOf(binding: ReadingBinding): string | null {
  if (binding.basis !== undefined && DRAWN_BASES.includes(binding.basis)) return null;
  if (binding.source !== undefined && readCitedKey(binding.source).scheme === "edition") return `${RULE_SET_DEFAULT}, ${NOT_DRAWN}`;
  if (binding.basis === undefined || binding.basis === "") return NOT_DRAWN;
  return `${inWords(binding.basis).toLowerCase()}, ${NOT_DRAWN}`;
}

/**
 * The bindings a kind's description states beside the selecting attributes, by the variable and the
 * word the description says it in. Only where the rate book prices the attribute and the rail carries
 * it as a binding rather than a selector: blinding is priced by its thickness (walk-0's QS, L-BD-04's
 * "what a PWD base item includes is quantity-bearing law"). Grades arrive as selectors and need no row.
 */
const DESCRIBED_BINDINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  "pcc.blinding": Object.freeze({ t: "thickness" }),
});

/**
 * What a selecting attribute is the same as: its value in the canon's unit, where it is a decimal
 * figure in a unit the canon names — so a pile diameter written `500 mm` on one line and `0.5 m` on
 * another is one item, as a binding's canonical reading already makes a thickness one — else as it was
 * written (a grade, a word). The canon is the one door a unit is read through (L-FRM-06, B-17).
 */
function selectorSameOf(value: string, unit: string): string {
  const named = unitNamed(unit);
  if (named === null || !isDecimalFigure(value)) return `${value} ${unit}`;
  const canonical = CANONICAL_UNIT[dimensionOf(named)];
  const carried = convert(value, named, canonical);
  return carried.ok ? `${carried.value} ${canonical}` : `${value} ${unit}`;
}

/** A decimal a person can read, grouped by the one seam; anything else as it was written. */
function writtenFigure(value: string): string {
  return /^-?\d+(\.\d+)?$/u.test(value) ? formatUserFigure(value) : value;
}

/**
 * What an item's description states beyond its sentence and its member: every selecting attribute
 * the rail carried onto the line (L-MEA-06) and every binding the kind's description names — each as
 * written, in the canonical order of its name so two lines stating the same things state them alike.
 */
export function statedAttributesOf(kind: string, selectors: Readonly<Record<string, unknown>> | undefined, variables: Readonly<Record<string, ReadingBinding>> | undefined): StatedAttribute[] {
  const stated: StatedAttribute[] = [];
  for (const [name, measure] of Object.entries(selectors ?? {})) {
    if (measure === null || typeof measure !== "object") continue;
    const { value, unit } = measure as { value?: unknown; unit?: unknown };
    if (typeof value !== "string" || typeof unit !== "string" || value === "") continue;
    stated.push({ name: inWords(name).toLowerCase(), value, unit, note: null, same: selectorSameOf(value, unit) });
  }
  for (const [variable, word] of Object.entries(DESCRIBED_BINDINGS[kind] ?? {})) {
    const binding = variables?.[variable];
    if (binding === undefined) continue;
    const note = noteOf(binding);
    const same = `${binding.canonical.value} ${binding.canonical.unit}`;
    stated.push({ name: word, value: binding.value, unit: binding.unit, note, same: note === null ? same : `${same} (${note})` });
  }
  return stated.sort((one, other) => compareCanonical(one.name, other.name));
}

/** The member an item is OF, as a description says it: `columns`, `pile caps`. */
export function memberWordsOf(klass: string): string {
  return `${inWords(klass).toLowerCase()}s`;
}

/**
 * An item's full description: the sentence its group is described by, then the member and what the
 * register states that selects it — `Reinforced cement concrete cast in place, measured net of its
 * reinforcement — piles, diameter 500 mm`. The storey is the Level column's, never repeated here.
 */
export function itemDescriptionOf(sentence: string, klass: string, attributes: readonly StatedAttribute[]): string {
  const stated = attributes.map((attribute) => {
    const written = `${attribute.name} ${writtenFigure(attribute.value)} ${attribute.unit}`.trim();
    return attribute.note === null ? written : `${written} (${attribute.note})`;
  });
  return `${sentence} — ${[memberWordsOf(klass), ...stated].join(", ")}`;
}

/**
 * The identity one item is numbered under: its section, its (class, kind), its band and what its
 * description states. Two lines with the same key are one item; the key is never shown and never
 * stored, and the number derived from it is AM-14 §2's (I-528).
 */
export function itemKeyOf(bill: string, klass: string, kind: string, band: string, attributes: readonly StatedAttribute[]): string {
  const stated = attributes.map((attribute) => `${attribute.name}=${attribute.same}`).join(";");
  return [bill, klass, kind, band, stated].join("|");
}

/** The variable a formula counts members by: it is the Nos column, never a dimension. */
const COUNT = "count";

/**
 * A formula's expression without the bindings the gate renders after it: `V = count × b × (D − t)`
 * out of `V = count × b × (D − t) (count = 1 pcs, …)`. The bindings are the LAST parenthesis, and
 * only where it states them (`name = value`); an expression's own brackets are its own.
 */
function expressionOf(formula: string): string {
  const at = formula.lastIndexOf(" (");
  if (at < 0 || !formula.endsWith(")") || !formula.slice(at).includes(" = ")) return formula;
  return formula.slice(0, at);
}

/** Where a variable first stands in a formula's expression, or past its end where it stands nowhere. */
function firstUse(expression: string, name: string): number {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const found = new RegExp(`(^|[^A-Za-z0-9_])${escaped}($|[^A-Za-z0-9_])`, "u").exec(expression);
  return found === null ? Number.POSITIVE_INFINITY : found.index;
}

/** What a line with no `count` of its own counts: the one member the line is published for (I-572). */
const ONE_MEMBER = "1";

/**
 * How many members a line counts — its formula's `count`, as the canon holds it — or, where the
 * formula counts none, the ONE member the line stands for: a line is published once per register
 * object and kind, so a rebar line (whose mass counts no members) is one member's, and an empty Nos
 * cell would read as a count nobody took (I-572). Nothing where the line is not read at all.
 */
export function nosOf(variables: Readonly<Record<string, ReadingBinding>> | undefined): string | undefined {
  if (variables === undefined) return undefined;
  const count = variables[COUNT];
  return count === undefined ? ONE_MEMBER : count.canonical.value;
}

/**
 * The places a dimension is written to (I-572): a count whole, and every canonical length,
 * area, volume and mass to three — the millimetre and the gramme, the precision a bill's details of
 * measurement are read at. The register keeps the full figure; `H 0.6096 m` and `net 7.7004672 kg`
 * are what a reader cannot check against a tape or a weighbridge.
 */
function dimensionPlacesOf(unit: string): number {
  return unit === CANONICAL_UNIT.COUNT ? 0 : 3;
}

/** A dimension as the details state it: rounded once, half to even, at its unit's places (L-MEA-05). */
function dimensionFigure(value: string, unit: string): string {
  if (!isDecimalFigure(value)) return value;
  return writtenFigure(exact(value).toFixed(dimensionPlacesOf(unit), Decimal.ROUND_HALF_EVEN));
}

/**
 * What a line's formula multiplied, in the order the formula names the variables and in the units
 * the canon carried them to, each at its unit's places: `d 0.450 m · H 0.610 m`, and — for a variable the drawings did not state
 * — `t not stated` (L-QTY-02). The count is the Nos column's. Each figure goes through the format seam.
 */
export function dimensionsOf(formula: string, variables: Readonly<Record<string, ReadingBinding>>, omitted: readonly string[]): string {
  const expression = expressionOf(formula);
  const names = [...new Set([...Object.keys(variables), ...omitted])].filter((name) => name !== COUNT);
  names.sort((one, other) => {
    const [a, b] = [firstUse(expression, one), firstUse(expression, other)];
    if (a !== b) return a < b ? -1 : 1;
    return compareCanonical(one, other);
  });
  return names
    .map((name) => {
      const binding = variables[name];
      return binding === undefined ? `${name} not stated` : `${name} ${dimensionFigure(binding.canonical.value, binding.canonical.unit)} ${binding.canonical.unit}`;
    })
    .join(" · ");
}
