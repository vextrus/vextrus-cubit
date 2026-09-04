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

/** The disciplines a layer's own prefix names — the CAD convention every structural set is drawn in. */
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

/** The text a title block sets largest — the sheet's own name. Ties go to the artifact's own order. */
function tallest(texts: readonly SheetText[]): SheetText | null {
  let found: SheetText | null = null;
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
 * The discipline the sheet proposes: the layer its title stands on first — a structural title block
 * is drawn on a structural layer, which is a fact about the drawing rather than about its prose —
 * then the title's own words, then `OTHER`.
 */
function disciplineOf(title: SheetText): Discipline {
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
 * A layout with no text at all is named by itself and proposed at no basis — the honest answer, and
 * the one the model leg of R-TO-004 will replace where it lands.
 */
export function readTitleBlock(graph: EntityGraph, layoutName: string): SheetProposal {
  const texts = textsOn(graph, layoutName);
  const title = tallest(texts);
  if (title === null) return { number: null, title: layoutName, discipline: "OTHER", basis: "NONE", cited: [] };

  return {
    number: numberOn(texts),
    title: title.text,
    discipline: disciplineOf(title),
    basis: "GRAMMAR",
    cited: texts.map((text) => text.key),
  };
}
