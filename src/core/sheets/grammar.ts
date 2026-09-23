// R-TO-004's title-block read: "title-block read via a deterministic grammar first". L-AI-03 prefers
// a grammar where the text is vector, and an EntityGraph's text IS vector — so this is the whole
// proposal path this increment ships, and every sheet it cannot read says so as basis `NONE` rather
// than being handed to a model nobody has replayed yet.
//
// Pure: it reads an artifact and returns a value. No store, no clock, no configuration — the same
// graph proposes the same sheet forever, which is what makes the proposal checkable rather than
// believable (L-ACT-01's reading of machine authorship).
import type { EntityGraph } from "../entitygraph/schema";
import type { Discipline, SheetProposal } from "./law";

/** The record types a title block is written in. Nothing else carries readable text (L-CAD-05). */
const TEXT_TYPES = ["TEXT", "MTEXT"];

/**
 * DXF's overscore/underscore/symbol escapes. They are formatting instructions, not letters, so they
 * are removed before the text is read: a title reading `%%uFOUNDATION PLAN` is the same sheet as one
 * reading `FOUNDATION PLAN`.
 */
const ESCAPE = /%%\w?/g;

/** A sheet number as a title block writes one: a discipline prefix, a number, an optional revision. */
const SHEET_NUMBER = /^[A-Z]{1,3}-\d{2,4}[A-Z]?$/;

/** The other way a title block numbers a sheet: its position in the set. */
const SHEET_OF = /\bSHEET\s+(\d+)\s+OF\s+(\d+)\b/i;

/**
 * A title block's own identification line: the sheet's number and then its title, on ONE text —
 * `S-01  GENERAL NOTES (1 OF 2)` (I-364). Where a block writes its sheet this way the line is the
 * answer, whatever else on the sheet is set larger: the stock stamp, the project's name and every
 * view caption are taller than it on F-RCC6-BNBC, and none of them is the sheet's name.
 */
const NUMBERED_TITLE = /^([A-Z]{1,3}-\d{2,4}[A-Z]?)\s+(.+)$/;

/** A sheet number that opens with one discipline designator and a hyphen — `S-01`, `A-101` (I-365). */
const DESIGNATOR = /^([A-Z])-/;

/**
 * The disciplines a designator letter names — the CAD convention every structural set is drawn in,
 * read off a layer's own prefix and, on a numbered title line, off the sheet number (I-365).
 */
const LAYER_PREFIX: Readonly<Record<string, Discipline>> = Object.freeze({
  S: "STRUCTURAL",
  A: "ARCHITECTURAL",
  M: "MEP",
  E: "MEP",
  P: "MEP",
  C: "CIVIL",
});

/**
 * The disciplines a title's own words name, tried in this order where the layer says nothing. Each
 * entry is one discipline and the fragments that mean it; a title matching none is `OTHER`, which is
 * a proposal a person confirms rather than a guess dressed as knowledge (L-REG-03 fails closed).
 */
const TITLE_KEYWORDS: readonly (readonly [Discipline, readonly string[]])[] = [
  ["STRUCTURAL", ["STRUCT", "FOUNDATION", "COLUMN", "BEAM", "FOOTING", "SLAB", "REINF"]],
  ["ARCHITECTURAL", ["ARCH", "ELEVATION", "FINISH", "DOOR", "WINDOW"]],
  ["MEP", ["MEP", "PLUMB", "ELECTR", "HVAC", "DRAIN"]],
  ["CIVIL", ["CIVIL", "ROAD", "GRADING", "SITE"]],
];

/** One text of one sheet, as the grammar reads it. */
type SheetText = { key: string; text: string; height: number; layer: string };

/**
 * Every text the artifact puts on one layout, in artifact order — the grammar's whole input.
 *
 * A text that says nothing once its escapes are stripped is not one of them: a blank or whitespace
 * entity is a placeholder the drawing left behind, and reading a title out of it would publish an
 * empty heading claiming the block was read (R-TO-004 proposes a title, or no basis at all).
 */
function textsOn(graph: EntityGraph, layoutName: string): SheetText[] {
  return graph.entities
    .filter((entity) => TEXT_TYPES.includes(entity.type) && entity.space === layoutName && entity.text !== undefined)
    .map((entity) => ({
      key: entity.key,
      text: (entity.text ?? "").replace(ESCAPE, "").trim(),
      height: entity.height ?? 0,
      layer: entity.layer,
    }))
    .filter((text) => text.text !== "");
}

/**
 * The texts EVERY paper layout of the record carries word for word — the project's name, a stock
 * stamp, a revision table. They are the set's words and no one sheet's, so no sheet is named or
 * numbered by them (I-364). Only where the record holds two sheets or more: on a lone sheet every
 * word it carries stands "on every sheet", and a rule that emptied it would read nothing.
 *
 * One pass over the artifact, whatever the number of layouts, and the same stripping `textsOn`
 * applies, so a text and its escaped twin are one text here as they are everywhere else.
 */
function standingTexts(graph: EntityGraph): ReadonlySet<string> {
  const sheets = graph.layouts.filter((layout) => layout.kind === "paper").map((layout) => layout.name);
  if (sheets.length < 2) return new Set();

  const said = new Map<string, Set<string>>(sheets.map((name) => [name, new Set<string>()]));
  for (const entity of graph.entities) {
    if (!TEXT_TYPES.includes(entity.type) || entity.text === undefined) continue;
    const own = said.get(entity.space);
    const text = entity.text.replace(ESCAPE, "").trim();
    if (own !== undefined && text !== "") own.add(text);
  }

  const [first, ...rest] = [...said.values()];
  return new Set([...(first ?? [])].filter((text) => rest.every((own) => own.has(text))));
}

/** The text a title block sets largest — the sheet's own name. Ties go to the artifact's own order. */
function tallest<T extends { readonly height: number }>(texts: readonly T[]): T | null {
  let found: T | null = null;
  for (const text of texts) {
    if (found === null || text.height > found.height) found = text;
  }
  return found;
}

/** The number the title block states, by the two spellings a title block uses, or null. */
function numberOn(texts: readonly SheetText[]): string | null {
  for (const text of texts) {
    if (SHEET_NUMBER.test(text.text.trim())) return text.text.trim();
  }
  for (const text of texts) {
    const said = SHEET_OF.exec(text.text);
    if (said?.[1] !== undefined) return said[1];
  }
  return null;
}

/**
 * The number a layout's own name opens with — `S-10 COLUMN LAYOUT PLAN` names S-10 — or null. The
 * drawing's author wrote it, and it is the address the viewer opens the sheet by, so it decides
 * which numbered line is this sheet's own and stands in for a number the block does not state
 * (I-364). It never supplies a title: the name's punctuation is what a layout name may hold (a DXF
 * layout carries no `/`), and the block's own words are the better spelling.
 */
function numberOfName(layoutName: string): string | null {
  const name = layoutName.trim();
  if (SHEET_NUMBER.test(name)) return name;
  return NUMBERED_TITLE.exec(name)?.[1] ?? null;
}

/** One title block line that states a number and a title together, split into the two (I-364). */
type NumberedLine = { readonly text: SheetText; readonly height: number; readonly number: string; readonly title: string };

/**
 * The line that names this sheet by number and title together, or null. Where the layout's own name
 * carries a number only a line stating THAT number is the sheet's — a cover's drawing index, or a
 * caption that happens to be spelled like a sheet id, states others — and where it carries none, the
 * tallest such line, ties to the artifact's own order, as every other reading of this block goes.
 */
function numberedLine(texts: readonly SheetText[], layoutName: string): NumberedLine | null {
  const lines: NumberedLine[] = [];
  for (const text of texts) {
    const said = NUMBERED_TITLE.exec(text.text);
    if (said?.[1] === undefined || said[2] === undefined) continue;
    lines.push({ text, height: text.height, number: said[1], title: said[2].trim() });
  }
  const named = numberOfName(layoutName);
  return tallest(named === null ? lines : lines.filter((line) => line.number === named));
}

/**
 * The discipline the sheet proposes. On a numbered title line, the number's own designator first —
 * `S-01` is a structural sheet by the set's own numbering, whatever layer the line was drawn on
 * (I-365). Then the layer its title stands on — a structural title block is drawn on a structural
 * layer, which is a fact about the drawing rather than about its prose — then the title's own words,
 * then `OTHER`.
 */
function disciplineOf(title: SheetText, number: string | null = null): Discipline {
  const designated = LAYER_PREFIX[DESIGNATOR.exec(number ?? "")?.[1] ?? ""];
  if (designated !== undefined) return designated;

  const prefix = LAYER_PREFIX[title.layer.charAt(0).toUpperCase()];
  if (prefix !== undefined) return prefix;

  const said = title.text.toUpperCase();
  for (const [discipline, keywords] of TITLE_KEYWORDS) {
    if (keywords.some((keyword) => said.includes(keyword))) return discipline;
  }
  return "OTHER";
}

/**
 * What one layout's title block proposes (R-TO-004). `cited` names every text the grammar read, not
 * merely the one it took the title from: the evidence for a proposal is the block it was read out of,
 * and a reader checking it has to be able to see what else stood there (L-AI-03's cited entities).
 *
 * The block is read in the order it states itself (I-364): a line stating the sheet's number and
 * title together is taken whole; failing one, the tallest text is the title and the number is the
 * block's own `S-01` or `SHEET n OF m`, else the one the layout's name opens with. Neither reading
 * takes a text every sheet of the record carries — unless nothing else stands on the sheet, where
 * the sheet is named by what it does carry rather than by nothing.
 *
 * A layout with no text at all is named by itself and proposed at no basis — the honest answer, and
 * the one the model leg of R-TO-004 will replace where it lands.
 */
export function readTitleBlock(graph: EntityGraph, layoutName: string): SheetProposal {
  const texts = textsOn(graph, layoutName);
  const standing = standingTexts(graph);
  const own = texts.filter((text) => !standing.has(text.text));
  const read = own.length > 0 ? own : texts;

  const title = tallest(read);
  if (title === null) return { number: null, title: layoutName, discipline: "OTHER", basis: "NONE", cited: [] };
  const cited = texts.map((text) => text.key);

  const line = numberedLine(read, layoutName);
  if (line !== null) {
    return { number: line.number, title: line.title, discipline: disciplineOf(line.text, line.number), basis: "GRAMMAR", cited };
  }

  return {
    number: numberOn(read) ?? numberOfName(layoutName),
    title: title.text,
    discipline: disciplineOf(title),
    basis: "GRAMMAR",
    cited,
  };
}
