// R-TO-004, L-AI-01: the question one sheet's issue state is asked, and the entities an answer to it
// may cite. Pure and total over the artifact: the same graph and layout name make the same request,
// so the request hash a recorded answer is filed under is a fact about the drawing rather than about
// the run (L-AI-01 replays deterministically from fixtures).
//
// What CODE finds, and the model never does: the REV/DATE marks the title block states, the printed
// rows of the revision table, and the same two things for every OTHER sheet the artifact carries —
// the benchmark this sheet is read against. The model selects one of them and places the sheet on a
// spectrum; it spells no mark, no date and no key of its own (L-AI-03).
//
// The set is read out of the ARTIFACT's own layouts rather than out of a pinned manifest: a manifest
// is a stored fact about a set somebody pinned, and a request resting on one would be a fact about
// the pin instead of about the drawing — the same sheet would be asked afresh every time the set
// moved. One file, one set, one hash.
import { MODEL_QUESTIONS, canonicalJson, type ModelRequest } from "@/core/model";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { RECENCY_LEVELS, REVISION_RECENCY_MODEL } from "./law";

/** Any JSON value — what the request's content is spelled as before it is hashed. */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** The record types a revision table is printed in. Nothing else carries readable text (L-CAD-05). */
const TEXT_TYPES = ["TEXT", "MTEXT"];

/**
 * DXF's overscore/underscore/symbol escapes. They are formatting instructions, not letters, so a
 * row reading `%%uREV B` is the row reading `REV B` — the title-block grammar strips them for the
 * same reason (`@/core/sheets`'s own reading of L-CAD-05).
 */
const ESCAPE = /%%\w?/g;

/**
 * The dates a revision table prints, in the spellings a Dhaka office writes them: `05-07-2026`,
 * `05/07/26`, `2026-07-05`, `5 JUL 2026`. A row is recognised BY its date because that is the one
 * field every revision table carries, and no calendar arithmetic is done on it anywhere — the
 * pattern says a date STANDS there, never which date is later (the model reads, code does not).
 */
const DATE_PATTERNS: readonly RegExp[] = [
  /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/,
  /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/,
  /\b\d{1,2}\s*(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.?\s*,?\s*\d{2,4}\b/i,
];

/**
 * How near in the paper's own units two texts must stand to be printed on one line of a table: six
 * tenths of a text height above or below the line's own baseline, and no more than forty heights of
 * white between one word of the line and the next. Both are stated in the text's OWN height, so the
 * rule reads the same on a sheet drawn in millimetres and on one drawn in inches.
 */
const BAND_HEIGHTS = 0.6;
const GAP_HEIGHTS = 40;

/** How many other sheets of the set are put on the request, and how many lines of each. */
const SET_SHEET_CAP = 40;
const SET_LINE_CAP = 8;

/** One revision mark the title block states: the block's own key, the tag, and what it says. */
export type RevisionMark = { readonly src: string; readonly tag: string; readonly text: string };

/** One printed row of the revision table: the row as the sheet prints it, and the texts it is printed as. */
export type RevisionRow = { readonly keys: readonly string[]; readonly text: string };

/** What one sheet prints about its own issue state. */
export type SheetRevisionEvidence = { readonly marks: readonly RevisionMark[]; readonly rows: readonly RevisionRow[] };

/** What another sheet of the same set prints, as the benchmark: its words, and no keys — it is not citable here. */
export type SetSheetEvidence = { readonly layout: string; readonly marks: readonly string[]; readonly rows: readonly string[] };

/** One text standing on a sheet, as this reading needs it: what it says, and where the artifact places it. */
type SaidText = { readonly key: string; readonly text: string; readonly height: number; readonly x: number | null; readonly y: number | null };

/** A text the artifact places on the paper — the ones a printed line can be read off. */
type PlacedText = SaidText & { readonly x: number; readonly y: number };

/** What stands on one space: the texts it prints, and the revision marks its blocks state. */
type Standing = { readonly texts: SaidText[]; readonly marks: RevisionMark[] };

/**
 * What one sheet prints about its own issue state, in artifact order: the title block's REV/DATE
 * attributes first, then the printed rows of its revision table.
 *
 * A layout the inventory does not name is no sheet: reading one would answer for a layout the
 * artifact does not carry (L-CAD-05, ARCH-03), so it throws rather than answering nothing.
 */
export function revisionEvidenceOn(graph: EntityGraph, layoutName: string): SheetRevisionEvidence {
  return evidenceOf(standingBySpace(graph), graph, layoutName);
}

/**
 * What the OTHER sheets of this artifact print, as the benchmark a recency reading is taken against
 * (L-AI-03's "flag anomalies against benchmarks"). Words only: a sheet's evidence is citable on that
 * sheet's own reading and nowhere else, so nothing here carries a key an answer could cite.
 */
export function setEvidenceOn(graph: EntityGraph, layoutName: string): SetSheetEvidence[] {
  return setEvidenceFrom(standingBySpace(graph), graph, layoutName);
}

/**
 * Every key an answer about this sheet may cite: the blocks its revision marks belong to and the
 * texts its revision rows are printed as, deduped in artifact order.
 *
 * Scoped to the CANDIDATES rather than to the whole layout, which is tighter than the sheet
 * reading's scope and deliberately so: this question offers the model a closed list of candidates
 * and reads the chosen one's own keys back out, so a citation of anything else is an answer to a
 * question nobody asked (L-AI-02 resolves citations against the artifact before a proposal is made).
 */
export function revisionCitableKeysOn(graph: EntityGraph, layoutName: string): string[] {
  const evidence = revisionEvidenceOn(graph, layoutName);
  return [...new Set([...evidence.marks.map((mark) => mark.src), ...evidence.rows.flatMap((row) => row.keys)])];
}

/** Does this sheet print anything about its own issue state? The gate a caller asks before the door. */
export function carriesRevisionEvidence(graph: EntityGraph, layoutName: string): boolean {
  const evidence = revisionEvidenceOn(graph, layoutName);
  return evidence.marks.length > 0 || evidence.rows.length > 0;
}

/**
 * What the model is told it is doing. It states the spectrum, the answer's shape and the citation
 * rule, because L-AI-02 refuses an answer that is neither: an uncited reading is UNSOURCED, a
 * citation naming anything but a candidate offered here is SOURCE_UNRESOLVED, and a level outside
 * the spectrum is MALFORMED — a model that was not told so would spend tokens on answers nobody can
 * accept.
 */
const SYSTEM = [
  "You read what one sheet of a construction drawing set prints about its own issue state — the revision marks its title block states and the rows of its revision table — against what the other sheets of the same set print beside it.",
  'Answer with a JSON object of exactly {"payload": {"level": <n>, "score": <n>, "evidence": "<the words of the candidate you read this out of>"}, "sources": ["<key>"]}.',
  `\`level\` is one of the levels below, by its number; \`score\` is where between them this sheet falls, from 0 to ${RECENCY_LEVELS.length - 1}.`,
  ...RECENCY_LEVELS.map((level, index) => `${index}. ${level}`),
  "`sources` is a non-empty array of the keys of the candidate your reading rests on — a revision mark's block key, or the keys the revision row is printed as. Cite only keys that appear on this sheet in the records below.",
  "Read what the sheet prints and never the calendar: do not compute a date, do not order the set, and where the sheet states nothing, say so rather than supplying it.",
].join("\n");

/**
 * The question one sheet's issue state is asked. `params` is left absent: the request carries the
 * whole of what is asked, and a sampling knob turned per call would make two runs two requests.
 */
export function sheetRevisionRequest(graph: EntityGraph, layoutName: string): ModelRequest {
  return {
    modelId: REVISION_RECENCY_MODEL,
    system: SYSTEM,
    messages: [{ role: "user", content: canonicalJson(contentOf(graph, layoutName)) }],
    question: MODEL_QUESTIONS.sheetRevisionRecency,
  };
}

/**
 * The request's canonical content: the sheet's own evidence, the set's, and the spectrum the answer
 * is placed on. The levels ride WITH the request so the adapter composes the score's criteria from
 * them and holds no second spelling of this module's words (B-17); they are the question's meaning,
 * so a reworded level is a different request and earns its own fixture (L-AI-01).
 */
function contentOf(graph: EntityGraph, layoutName: string): JsonValue {
  // One walk of the artifact for the sheet AND its set: a sheet read per sibling would walk the
  // whole graph once per sheet, which on a 27-sheet set is the recorder's afternoon.
  const standing = standingBySpace(graph);
  const evidence = evidenceOf(standing, graph, layoutName);
  return {
    layout: layoutName,
    levels: [...RECENCY_LEVELS],
    revisionMarks: evidence.marks.map((mark) => ({ src: mark.src, tag: mark.tag, text: mark.text })),
    revisionRows: evidence.rows.map((row) => ({ keys: [...row.keys], text: row.text })),
    setRows: setEvidenceFrom(standing, graph, layoutName).map((sheet) => ({ layout: sheet.layout, marks: [...sheet.marks], rows: [...sheet.rows] })),
  };
}

/** One sheet's evidence, off a walk the caller already made. */
function evidenceOf(standing: Map<string, Standing>, graph: EntityGraph, layoutName: string): SheetRevisionEvidence {
  if (!graph.layouts.some((layout) => layout.name === layoutName)) {
    throw new Error(`the artifact's layout inventory names no ${JSON.stringify(layoutName)} — there is no sheet here to read (L-CAD-05)`);
  }
  const held = standing.get(layoutName);
  return held === undefined ? { marks: [], rows: [] } : { marks: held.marks, rows: rowsOf(held.texts) };
}

/** The set's evidence, off a walk the caller already made. */
function setEvidenceFrom(standing: Map<string, Standing>, graph: EntityGraph, layoutName: string): SetSheetEvidence[] {
  return graph.layouts
    .filter((layout) => layout.kind === "paper" && layout.name !== layoutName)
    .slice(0, SET_SHEET_CAP)
    .map((layout) => {
      const evidence = evidenceOf(standing, graph, layout.name);
      return {
        layout: layout.name,
        marks: evidence.marks.slice(0, SET_LINE_CAP).map((mark) => `${mark.tag} ${mark.text}`),
        rows: evidence.rows.slice(0, SET_LINE_CAP).map((row) => row.text),
      };
    })
    .filter((sheet) => sheet.marks.length > 0 || sheet.rows.length > 0);
}

/**
 * The artifact walked once: every space's text-bearing records, and the revision marks the blocks
 * standing on it state. A block attribute is named by the key of the block it belongs to (L-CAD-03),
 * so an attribute whose block is not an entity of this artifact stands on no sheet and is left out —
 * shown, it would be evidence the resolver could not admit.
 */
function standingBySpace(graph: EntityGraph): Map<string, Standing> {
  const by = new Map<string, Standing>();
  const spaceOf = new Map<string, string>();
  const on = (space: string): Standing => {
    const held = by.get(space) ?? { texts: [], marks: [] };
    by.set(space, held);
    return held;
  };
  for (const entity of graph.entities) {
    spaceOf.set(entity.key, entity.space);
    const text = said(entity.text ?? "");
    if (!TEXT_TYPES.includes(entity.type) || text === "") continue;
    on(entity.space).texts.push({ key: entity.key, text, height: entity.height ?? 0, x: entity.points?.[0]?.[0] ?? null, y: entity.points?.[0]?.[1] ?? null });
  }
  for (const attribute of graph.block_attributes) {
    const space = spaceOf.get(attribute.src);
    const text = said(attribute.text);
    if (space === undefined || text === "" || !isRevisionTag(attribute.tag)) continue;
    on(space).marks.push({ src: attribute.src, tag: attribute.tag.trim(), text });
  }
  return by;
}

/**
 * The printed rows of one sheet's revision table: the lines of text that carry a date.
 *
 * A line is found by the paper itself — texts sharing a baseline, split where the white between two
 * of them is wider than a table's gutter — and a line is a revision row when one of its words states
 * a date. That is the rule the table can be read by on any office's sheet: the layer it is drawn on,
 * the block it stands beside and the word "REVISIONS" above it are all one office's habit, and a
 * date is the one field every revision table prints. A dated line that is not a revision is offered
 * as a candidate all the same — the model is what tells them apart, and a candidate nobody chooses
 * costs the reading nothing (L-AI-03).
 */
function rowsOf(texts: readonly SaidText[]): RevisionRow[] {
  const rows: RevisionRow[] = [];
  // A text the artifact places nowhere cannot be read as standing on a line with anything else, so
  // it is a line of its own: a candidate where it states a date, and never grouped by guess.
  for (const text of texts) {
    if (text.x === null && dated(text.text)) rows.push({ keys: [text.key], text: text.text });
  }
  const placed = texts.filter((text): text is PlacedText => text.x !== null && text.y !== null);
  for (const band of bandsOf(placed)) {
    for (const line of linesOf(band)) {
      if (line.some((text) => dated(text.text))) rows.push({ keys: line.map((text) => text.key), text: line.map((text) => text.text).join(" ") });
    }
  }
  return rows;
}

/** The texts grouped by the baseline they share, the sheet read down the paper. */
function bandsOf(texts: readonly PlacedText[]): PlacedText[][] {
  const bands: PlacedText[][] = [];
  for (const text of [...texts].sort((a, b) => b.y - a.y || a.x - b.x)) {
    // Against the band's OWN baseline, never against its last member: a chain of texts each a
    // little below the one before would otherwise walk a band down the sheet without a break.
    const band = bands[bands.length - 1];
    const baseline = band?.[0];
    if (band !== undefined && baseline !== undefined && Math.abs(baseline.y - text.y) <= BAND_HEIGHTS * Math.max(baseline.height, text.height)) band.push(text);
    else bands.push([text]);
  }
  return bands;
}

/** One baseline's texts as the lines they print, split where the white between two of them is a gap. */
function linesOf(band: readonly PlacedText[]): PlacedText[][] {
  const lines: PlacedText[][] = [];
  for (const text of [...band].sort((a, b) => a.x - b.x)) {
    const line = lines[lines.length - 1];
    const last = line?.[line.length - 1];
    if (line !== undefined && last !== undefined && text.x - last.x <= GAP_HEIGHTS * Math.max(last.height, text.height)) line.push(text);
    else lines.push([text]);
  }
  return lines;
}

/**
 * The attribute tags a title block files its revision under: a tag opening with REV (REV, REV NO,
 * REVISION) or closing with DATE (DATE, ISSUE_DATE, REV DATE). Read off the tag rather than off a
 * layer name, because a tag is the block author's own word for the field and a layer name is an
 * office habit — `fixtures/gen/rcc6_bnbc` writes REV and DATE, the committed silent sheet writes REV
 * and ISSUE_DATE, and one rule reads both.
 */
function isRevisionTag(tag: string): boolean {
  const spelled = tag.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return spelled.startsWith("REV") || spelled.endsWith("DATE");
}

/** Does this text state a date, in any of the spellings a revision table writes one in? */
function dated(text: string): boolean {
  return DATE_PATTERNS.some((pattern) => pattern.test(text));
}

/** What a record says once its escapes are stripped; whitespace says nothing. */
function said(text: string): string {
  return text.replace(ESCAPE, "").trim();
}
