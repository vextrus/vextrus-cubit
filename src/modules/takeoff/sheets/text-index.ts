// R-SPINE-052's first cut: the words a drawing's sheets show, indexed once per artifact, and the
// project-wide reading the ⌘K palette asks as a person types (docs/design/command-palette.md
// I-473…f). One index per content hash, so the palette today and a viewer find bar or Ask
// tomorrow read the same words the same way (B-17).
//
// WHAT IS INDEXED (I-474). The text a sheet shows as words, each under the source key a viewer
// selects it by:
// - an original TEXT or MTEXT entity, under its own key;
// - a block attribute (the ATTRIB a reference carries — a title block's sheet title, a grid bubble's
//   letter), under its reference's key: an attribute is no entity of its own (L-CAD-03);
// - derived text a block reference or a dimension painted, under the key of the original that
//   painted it, which is also the key the viewer holds that paint by.
// A record whose words repeat under one key — a title block paints `DATE` twice, an attribute and
// the paint of the same reference can say the same thing — is one entry, not two. An attribute
// DEFINITION is not what a sheet says (it is the template a reference fills), so it is not indexed.
//
// HOW IT READS (I-473). An MTEXT is cut into its paragraphs with its codes stripped
// (`mtextLines`, core's one home of what an MTEXT code is), every `%%` code is resolved
// (`normaliseNotation`), and runs of spaces read as one. A paragraph's WORDS are its whole runs of
// letters and digits, upper-cased: "C3" is a word and "PC3" another, so asking for one never answers
// the other. A query matches where its words stand, in order and next to each other, inside one
// paragraph.
//
// WHERE A TEXT STANDS is core's one reading (`sheetOfKey`, VD-1): on the paper sheet it was drawn on,
// or — drawn in model space — on the one sheet whose windows frame it, else on model space itself.
//
// WHY A SEPARATE CACHE. `artifactAt` keeps four validated graphs, and a real set holds more drawings
// than that: a search that walked every artifact as a person types would re-read and re-validate the
// oldest on every keystroke. The index is small beside its graph, so it is kept by content hash on
// its own bound, and a search over a set of any size reads each artifact once.
import { forTenant } from "@/core/db";
import { artifactAt } from "@/core/entitygraph/artifact";
import { mtextLines, normaliseNotation } from "@/core/entitygraph/notation";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { projectDrawingsOf } from "@/core/sheets";
import { framesOfGraph, modelSheetOf, sheetLabelOf, sheetOfKey, sheetsOfGraph, spacesOfGraph } from "@/core/sheets/frames";
import type { Storage } from "@/core/storage";
import { appStorage } from "@/core/storage/app";

/* ------------------------------------------------------------------------------ the reading */

/** The one type whose text is a block of paragraphs carrying inline codes (T-MTEXT-CODES). */
const MTEXT = "MTEXT";

/** The drawn types whose text a sheet shows as words. An attribute arrives in its own list. */
const WORDED_TYPES: ReadonlySet<string> = new Set(["TEXT", MTEXT]);

/** A word: a whole run of letters and digits (I-473). */
const WORD = /[\p{L}\p{N}]+/gu;

/** A run of whitespace, which a reader reads as one space. */
const SPACING = /\s+/gu;

/** The words of a text, upper-cased, in order. The one spelling the index and a query share. */
export function wordsOf(text: string): string[] {
  return text.toUpperCase().match(WORD) ?? [];
}

/** Each word of a text with where it stands in it, for the one paragraph a hit is shown by. */
function spansOf(text: string): { word: string; start: number; end: number }[] {
  return [...text.toUpperCase().matchAll(WORD)].map((match) => ({ word: match[0], start: match.index, end: match.index + match[0].length }));
}

/** The paragraphs a text says, as a reader reads them: codes resolved, spacing collapsed, blanks gone. */
export function paragraphsOf(type: string, raw: string): string[] {
  const lines = type === MTEXT ? mtextLines(raw) : [raw];
  return lines.map((line) => normaliseNotation(line).replace(SPACING, " ").trim()).filter((line) => line !== "");
}

/** One indexed text: the key it is selected by, what it says, and the sheet it stands on. */
export type IndexedText = {
  /** The source key a viewer selects it by: its own, or that of the original that carries it. */
  readonly key: string;
  /** What it says, one paragraph per line it is drawn in. */
  readonly paragraphs: readonly string[];
  /** Each paragraph's words, in the index's one spelling. */
  readonly words: readonly (readonly string[])[];
  /** The layout it stands on (core's `sheetOfKey`), or null where the record names no sheet at all. */
  readonly layoutName: string | null;
  /** How a reader names that sheet: its number, else its layout's name; null for model space. */
  readonly sheetLabel: string | null;
  /** Where that sheet stands in the drawing's order: its sheets in the inventory's order, model space last. */
  readonly sheetRank: number;
};

/** A drawing's words, indexed: the entries in the artifact's order, and where each word is said. */
export type TextIndex = {
  readonly entries: readonly IndexedText[];
  /** Each word, and the entries that say it — ascending, each once. */
  readonly postings: ReadonlyMap<string, readonly number[]>;
};

/** A record of the artifact that says something, before it is placed. */
type Said = { readonly key: string; readonly type: string; readonly text: string };

/** Every record of the artifact that says something, under the key it is selected by, in the artifact's order. */
function saidOf(graph: EntityGraph): Said[] {
  const said: Said[] = [];
  for (const entity of graph.entities) {
    if (entity.text !== undefined && WORDED_TYPES.has(entity.type)) said.push({ key: entity.key, type: entity.type, text: entity.text });
  }
  for (const attribute of graph.block_attributes) said.push({ key: attribute.src, type: "ATTRIB", text: attribute.text });
  for (const record of graph.derived) {
    if (record.text !== undefined && WORDED_TYPES.has(record.type)) said.push({ key: record.src, type: record.type, text: record.text });
  }
  return said;
}

/**
 * One drawing's words, indexed (pure). Each text is placed on its sheet by core's one resolver and
 * named by core's one reading of a sheet's number; a key that says the same thing twice is one entry.
 */
export function textIndexOf(graph: EntityGraph): TextIndex {
  const spaces = spacesOfGraph(graph);
  const sheets = sheetsOfGraph(graph);
  const frames = framesOfGraph(graph);
  const modelSheet = modelSheetOf(sheets);
  const rankOf = new Map(sheets.map((sheet, at) => [sheet.layoutName, sheet.layoutName === modelSheet ? sheets.length : at]));

  const entries: IndexedText[] = [];
  const postings = new Map<string, number[]>();
  const seen = new Set<string>();
  const placed = new Map<string, { layoutName: string | null; sheetLabel: string | null; sheetRank: number }>();

  for (const one of saidOf(graph)) {
    const paragraphs = paragraphsOf(one.type, one.text);
    if (paragraphs.length === 0) continue;
    const identity = `${one.key}\u0000${paragraphs.join("\n")}`;
    if (seen.has(identity)) continue;
    seen.add(identity);

    let where = placed.get(one.key);
    if (where === undefined) {
      const layoutName = sheetOfKey(one.key, spaces, sheets, frames);
      where = {
        layoutName,
        sheetLabel: layoutName === null ? null : sheetLabelOf(graph, layoutName),
        sheetRank: layoutName === null ? sheets.length + 1 : (rankOf.get(layoutName) ?? sheets.length + 1),
      };
      placed.set(one.key, where);
    }

    const words = paragraphs.map((paragraph) => wordsOf(paragraph));
    const at = entries.length;
    entries.push({ key: one.key, paragraphs, words, ...where });
    for (const word of new Set(words.flat())) {
      const held = postings.get(word);
      if (held === undefined) postings.set(word, [at]);
      else held.push(at);
    }
  }
  return { entries, postings };
}

/** Where the asked words stand in one paragraph, in order and adjacent — the first such run, or none. */
function runIn(words: readonly string[], asked: readonly string[]): number {
  for (let at = 0; at + asked.length <= words.length; at += 1) {
    let all = true;
    for (let step = 0; step < asked.length; step += 1) {
      if (words[at + step] !== asked[step]) {
        all = false;
        break;
      }
    }
    if (all) return at;
  }
  return -1;
}

/**
 * How much of a paragraph a hit shows, in characters, and how much of it before the words asked for.
 * A palette row is one line: a clause of the general notes runs to hundreds of characters, and the
 * words a person asked for would otherwise stand past the row's ellipsis where no one can read them.
 */
const SHOWN = 72;
const LEAD = 24;

/** The piece of a paragraph a hit shows: the words asked for with some of what surrounds them. */
export type Excerpt = { readonly text: string; readonly clippedStart: boolean; readonly clippedEnd: boolean };

/** A paragraph cut to what a row can show, around the characters `[start, end)`, at word boundaries. */
export function excerptOf(paragraph: string, start: number, end: number): Excerpt {
  if (paragraph.length <= SHOWN) return { text: paragraph, clippedStart: false, clippedEnd: false };
  let from = Math.max(0, Math.min(start - LEAD, paragraph.length - SHOWN));
  if (from > 0) {
    const space = paragraph.indexOf(" ", from);
    from = space === -1 || space >= start ? from : space + 1;
  }
  let to = Math.min(paragraph.length, Math.max(from + SHOWN, end));
  if (to < paragraph.length) {
    const space = paragraph.lastIndexOf(" ", to);
    to = space >= end ? space : to;
  }
  return { text: paragraph.slice(from, to).trim(), clippedStart: from > 0, clippedEnd: to < paragraph.length };
}

/** One key a query found in one drawing's index, by the one of its texts that stands for it. */
export type TextMatch = {
  readonly entry: IndexedText;
  /** The entry's place in the artifact's order. */
  readonly ordinal: number;
  readonly excerpt: Excerpt;
  /** Whether the paragraph says exactly what was asked and nothing more. */
  readonly exact: boolean;
};

/**
 * Every key of one index whose text the query's words stand in, in order and adjacent, inside one
 * paragraph — ONE match per key, in the artifact's order. A query that holds no word asks for nothing
 * and finds nothing.
 *
 * One per key, because a key is what a find opens (I-474): a title block's reference paints
 * `SHEET TITLE` and `SHEET NO.` under its one key, and two answers to it would be two ways to the one
 * selection — two rows reading alike that lead to the same place, and a key the palette could not
 * tell apart. Of a key's texts, the one that says exactly what was asked stands for it, else the
 * first drawn.
 */
export function findInIndex(index: TextIndex, query: string): TextMatch[] {
  const asked = wordsOf(query);
  const first = asked[0];
  if (first === undefined) return [];
  const byKey = new Map<string, TextMatch>();
  for (const ordinal of index.postings.get(first) ?? []) {
    const entry = index.entries[ordinal] as IndexedText;
    const held = byKey.get(entry.key);
    if (held?.exact === true) continue;
    for (const [at, words] of entry.words.entries()) {
      const run = runIn(words, asked);
      if (run === -1) continue;
      const exact = words.length === asked.length;
      if (held === undefined || exact) {
        const paragraph = entry.paragraphs[at] as string;
        const spans = spansOf(paragraph);
        const start = spans[run]?.start ?? 0;
        const end = spans[run + asked.length - 1]?.end ?? paragraph.length;
        byKey.set(entry.key, { entry, ordinal, excerpt: excerptOf(paragraph, start, end), exact });
      }
      break;
    }
  }
  return [...byKey.values()].sort((left, right) => left.ordinal - right.ordinal);
}

/* ---------------------------------------------------------------------------------- the cache */

/**
 * How many indexes one process keeps. An index is a small fraction of its graph — the words and a
 * key per text — so it is kept for many more drawings than the graphs are: enough for a set, and
 * the sets a person moves between in a sitting.
 */
const KEPT = 32;

/** The one home of the cache in this process, anchored as `artifactAt`'s is, for the same reason. */
const ANCHOR = Symbol.for("vextrus.cubit.takeoff.sheets.text-index");

type Held = {
  readonly kept: Map<string, TextIndex>;
  readonly flights: Map<string, Promise<TextIndex>>;
  builds: number;
  hits: number;
};

function held(): Held {
  const anchored = globalThis as unknown as Record<symbol, Held | undefined>;
  const already = anchored[ANCHOR];
  if (already !== undefined) return already;
  const made: Held = { kept: new Map(), flights: new Map(), builds: 0, hits: 0 };
  anchored[ANCHOR] = made;
  return made;
}

/** Keep this index under its address, the least recently asked retiring first when the cache is full. */
function keep(store: Held, address: string, index: TextIndex): TextIndex {
  store.kept.delete(address);
  store.kept.set(address, index);
  while (store.kept.size > KEPT) {
    const oldest = store.kept.keys().next();
    if (oldest.done === true) break;
    store.kept.delete(oldest.value);
  }
  return index;
}

/**
 * The index of the artifact at one content hash — built once from the validated graph and answered
 * from the hash thereafter, with no second read of the artifact. The address carries the tenant for
 * the reason `artifactAt`'s does: an object is a tenant's, and a cache is no way around that.
 */
export async function textIndexAt(tenantId: string, artifactSha256: string, storage: Storage, whose: string): Promise<TextIndex> {
  const store = held();
  const address = `${tenantId}/${artifactSha256}`;
  const already = store.kept.get(address);
  if (already !== undefined) {
    store.hits += 1;
    return keep(store, address, already);
  }
  const flying = store.flights.get(address);
  if (flying !== undefined) {
    store.hits += 1;
    return await flying;
  }
  const building = (async () => {
    const index = textIndexOf(await artifactAt(tenantId, artifactSha256, storage, whose));
    store.builds += 1;
    return keep(store, address, index);
  })();
  store.flights.set(address, building);
  try {
    return await building;
  } finally {
    store.flights.delete(address);
  }
}

/** What the cache has done, for the suites that prove a second search reads no artifact. */
export function textIndexTally(): { readonly builds: number; readonly hits: number; readonly kept: number } {
  const store = held();
  return { builds: store.builds, hits: store.hits, kept: store.kept.size };
}

/** Forget every index and reset the tally — a suite's own setup, never a caller's. */
export function forgetTextIndexes(): void {
  const store = held();
  store.kept.clear();
  store.flights.clear();
  store.builds = 0;
  store.hits = 0;
}

/* ------------------------------------------------------------------------- a project's words */

/** Which project's sheets are searched, in whose workspace. */
export type SheetTextScope = { readonly tenantId: string; readonly projectId: string };

/** One text a project's sheets show, as a search answers it. */
export type SheetTextHit = {
  readonly drawingId: string;
  /** The drawing's stored name, as the person who uploaded it named it. */
  readonly drawingName: string;
  readonly layoutName: string | null;
  readonly sheetLabel: string | null;
  /** The key the viewer selects: the text's own, or the original's that carries it. */
  readonly sourceKey: string;
  readonly excerpt: Excerpt;
  readonly exact: boolean;
};

/** What a project search is handed: the store the artifacts are read from, where a suite needs its own. */
export type SheetTextDeps = { readonly storage?: Storage };

/**
 * The texts of a project's sheets that say what was asked, at most `limit` of them: every drawing's
 * CURRENT record — the one the viewer opens — read through its index. A text that says exactly what
 * was asked stands first; then the project's drawings in their own order, each drawing's sheets in
 * its inventory's order with model space last, and a sheet's texts in the order they were drawn.
 * One hit per drawing and key (`findInIndex` answers a key once), so no two hits open the same thing.
 */
export async function sheetTextHitsOf(scope: SheetTextScope, query: string, limit: number, deps: SheetTextDeps = {}): Promise<SheetTextHit[]> {
  if (wordsOf(query).length === 0 || limit <= 0) return [];
  const drawings = await forTenant({ tenantId: scope.tenantId }).transaction((tx) => projectDrawingsOf(tx, scope));
  const storage = deps.storage ?? appStorage();

  const found: { hit: SheetTextHit; rank: readonly number[] }[] = [];
  for (const [drawingRank, drawing] of drawings.entries()) {
    const record = drawing.record;
    if (record === null) continue;
    const index = await textIndexAt(scope.tenantId, record.artifactSha256, storage, `ingest ${record.ingestId}`);
    for (const match of findInIndex(index, query)) {
      found.push({
        hit: {
          drawingId: drawing.drawingId,
          drawingName: drawing.name,
          layoutName: match.entry.layoutName,
          sheetLabel: match.entry.sheetLabel,
          sourceKey: match.entry.key,
          excerpt: match.excerpt,
          exact: match.exact,
        },
        rank: [match.exact ? 0 : 1, drawingRank, match.entry.sheetRank, match.ordinal],
      });
    }
  }
  found.sort((left, right) => compareRanks(left.rank, right.rank));
  return found.slice(0, limit).map((one) => one.hit);
}

/** Two ranks compared place by place. */
function compareRanks(left: readonly number[], right: readonly number[]): number {
  for (let at = 0; at < left.length; at += 1) {
    const difference = (left[at] ?? 0) - (right[at] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
