// The faces a document is set in, pinned by the sha256 of their own bytes, and the repertoire a
// document is judged against (L-FMT-02, L-FMT-03, B-24, AM-08).
//
// B-24: every artefact a build session must read lives in this repository, so the three static
// instances stand under `src/ui/fonts` with their OFL text beside them. Typst embeds what it sets,
// and the hash of each file travels on the stored row — which is what makes "the same payload renders
// the same bytes" a statement anyone can check rather than a promise.
//
// Coverage is the FACE'S OWN, read out of its `cmap`. `src/core/format.ts` states a repertoire as
// static ranges, and that table is the right answer to a different question: it says what this
// product's copy is written in, ARCH-01 keeping `src/core` out of the UI's font assets. A DOCUMENT
// asks something narrower — will the face that will actually be embedded print this character — and
// the only honest answer to that is the table inside the file. The two part company exactly where it
// matters: the static ranges admit the whole Bengali block, and the vendored Latin instances map none
// of it, so a payload carrying `ক` would pass the range test and print a blank box. L-FMT-02 says a
// document never does that, so the cmap is what is asked.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { documentFontPath } from "./tree";

/** Text carrying a character no vendored face maps (L-FMT-02). */
const CHARACTER_NOT_COVERED: RefusalCode = "CHARACTER_NOT_COVERED";

/** One embedded face: its file, the hash it is pinned by, its licence and its own repertoire. */
export interface EmbeddedFont {
  /** The file name under `src/ui/fonts`, which is also the key `fontHashes` records it under. */
  readonly file: string;
  /** The sha256 of that file's bytes — what the document is pinned to (L-FMT-03, AM-08). */
  readonly sha256: string;
  /** The licence text standing beside it in the same directory (OFL). */
  readonly licence: string;
  /** Does this face map that code point to a glyph of its own? */
  covers(codePoint: number): boolean;
}

/**
 * The faces a document sets: two sans weights for the page's text, and the mono face figures and ids
 * are set in. Static instances, not variable ones — Typst takes a variable font as its default
 * instance and offers no weight axis, so a semibold that is not its own file is a semibold that
 * renders as regular.
 */
export const DOCUMENT_FONT_FILES: readonly string[] = Object.freeze([
  "spline-sans-regular.ttf",
  "spline-sans-semibold.ttf",
  "spline-sans-mono-regular.ttf",
]);

/**
 * The licence text each face is embedded under (L-FMT-03: "licence text beside"). The two sans
 * instances are one family under one OFL text; the mono face is its own family with its own.
 */
export const DOCUMENT_FONT_LICENCES: Readonly<Record<string, string>> = Object.freeze({
  "spline-sans-regular.ttf": "OFL-spline-sans.txt",
  "spline-sans-semibold.ttf": "OFL-spline-sans.txt",
  "spline-sans-mono-regular.ttf": "OFL-spline-sans-mono.txt",
});

/**
 * The family name each face is set under in a template. They are stated here, beside the files, so a
 * template names a family and never a path — and so that the pair "this file provides this family"
 * has one home (B-17).
 */
export const DOCUMENT_FONT_FAMILIES: Readonly<Record<string, string>> = Object.freeze({
  "spline-sans-regular.ttf": "Spline Sans",
  "spline-sans-semibold.ttf": "Spline Sans",
  "spline-sans-mono-regular.ttf": "Spline Sans Mono",
});

/**
 * Characters that are the SHAPE of text rather than glyphs a face could be missing. A face is not
 * required to map a line break, and refusing one would refuse every multi-line field — the same
 * judgement `src/core/format.ts` records about its own table.
 */
const LAYOUT_CONTROLS: ReadonlySet<number> = new Set([0x09, 0x0a, 0x0d]);

/**
 * The three faces, read from the tree and hashed. Memoised per process: the bytes are immutable
 * (a face moves by a toolchain increment that also re-baselines every golden), and a render that
 * re-read and re-hashed three files each time would pay for a fact that cannot change under it.
 */
let loaded: Promise<readonly EmbeddedFont[]> | undefined;
export function documentFonts(): Promise<readonly EmbeddedFont[]> {
  return (loaded ??= Promise.all(DOCUMENT_FONT_FILES.map(readFace)));
}

/** One face: its bytes hashed, and its `cmap` read so the face can answer for its own repertoire. */
async function readFace(file: string): Promise<EmbeddedFont> {
  const bytes = await readFile(join(documentFontPath(), file));
  const lookup = cmapOf(bytes);
  return Object.freeze({
    file,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    licence: DOCUMENT_FONT_LICENCES[file] ?? "",
    covers: (codePoint: number): boolean => lookup(codePoint) !== 0,
  });
}

/**
 * The text back unchanged when some vendored face maps every character of it; otherwise the
 * registered refusal, naming the first code point none of them maps (L-FMT-02).
 *
 * "Some face" and not "every face": a document sets its figures in the mono face and its prose in the
 * sans ones, so a character one of them maps is a character the document can print. Which face it is
 * set in is the template's business.
 */
export function assertCoveredByDocumentFonts(text: string, fonts: readonly EmbeddedFont[]): void {
  for (const character of text) {
    const point = character.codePointAt(0) ?? 0;
    if (LAYOUT_CONTROLS.has(point)) continue;
    if (fonts.some((face) => face.covers(point))) continue;
    throw refusal(
      CHARACTER_NOT_COVERED,
      `no vendored document face maps U+${point.toString(16).toUpperCase().padStart(4, "0")} — a document never prints a character as a blank box (L-FMT-02)`,
    );
  }
}

// ---------------------------------------------------------------------------------------------
// The `cmap` table, read from the file itself.
//
// There is no font library among this product's pins (C-06, save-exact), and the question a document
// asks of a face is small enough to answer from the format: which code points does this face map to a
// glyph of its own. Both Unicode subtable formats a modern TTF carries are read — format 4 for the
// Basic Multilingual Plane and format 12 for the full range — and a code point is resolved on demand
// rather than expanded into a set, because a document's text is short and a segment can be wide.
// ---------------------------------------------------------------------------------------------

/** What a face answers for a code point: the glyph it maps it to, or 0 for "this face has none". */
type GlyphLookup = (codePoint: number) => number;

/** A face that maps nothing — what an unreadable or tableless file answers, without throwing. */
const MAPS_NOTHING: GlyphLookup = () => 0;

/** The sfnt table directory: every table's tag and where it stands. */
function tableOffset(bytes: Buffer, tag: string): number | null {
  if (bytes.byteLength < 12) return null;
  const count = bytes.readUInt16BE(4);
  for (let index = 0; index < count; index += 1) {
    const record = 12 + index * 16;
    if (record + 16 > bytes.byteLength) return null;
    if (bytes.toString("latin1", record, record + 4) === tag) return bytes.readUInt32BE(record + 8);
  }
  return null;
}

/**
 * The face's Unicode character map, as one lookup.
 *
 * The encoding records are ranked rather than taken in file order: a full-range subtable (3/10 or
 * 0/4+) is preferred over a BMP one, because a face carrying both maps strictly more through the
 * former, and a Macintosh Roman table is never read as Unicode.
 */
function cmapOf(bytes: Buffer): GlyphLookup {
  const cmap = tableOffset(bytes, "cmap");
  if (cmap === null || cmap + 4 > bytes.byteLength) return MAPS_NOTHING;

  let best: { rank: number; at: number } | null = null;
  const records = bytes.readUInt16BE(cmap + 2);
  for (let index = 0; index < records; index += 1) {
    const record = cmap + 4 + index * 8;
    if (record + 8 > bytes.byteLength) break;
    const platform = bytes.readUInt16BE(record);
    const encoding = bytes.readUInt16BE(record + 2);
    const at = cmap + bytes.readUInt32BE(record + 4);
    const rank = rankOf(platform, encoding);
    if (rank === 0 || at + 2 > bytes.byteLength) continue;
    if (best === null || rank > best.rank) best = { rank, at };
  }
  if (best === null) return MAPS_NOTHING;

  const format = bytes.readUInt16BE(best.at);
  if (format === 4) return segmentMapping(bytes, best.at);
  if (format === 12) return segmentedCoverage(bytes, best.at);
  return MAPS_NOTHING;
}

/** How much of Unicode an encoding record promises: full range beats BMP, and non-Unicode is unread. */
function rankOf(platform: number, encoding: number): number {
  if (platform === 3 && encoding === 10) return 3;
  if (platform === 0 && encoding >= 4) return 3;
  if (platform === 3 && encoding === 1) return 2;
  if (platform === 0) return 1;
  return 0;
}

/** Format 4: the BMP as sorted segments, each mapping by a delta or through a glyph array. */
function segmentMapping(bytes: Buffer, at: number): GlyphLookup {
  const segments = bytes.readUInt16BE(at + 6) / 2;
  const endCodes = at + 14;
  const startCodes = endCodes + segments * 2 + 2;
  const deltas = startCodes + segments * 2;
  const rangeOffsets = deltas + segments * 2;
  if (rangeOffsets + segments * 2 > bytes.byteLength) return MAPS_NOTHING;

  return (codePoint: number): number => {
    if (codePoint > 0xffff) return 0;
    for (let segment = 0; segment < segments; segment += 1) {
      if (bytes.readUInt16BE(endCodes + segment * 2) < codePoint) continue;
      if (bytes.readUInt16BE(startCodes + segment * 2) > codePoint) return 0;
      const delta = bytes.readInt16BE(deltas + segment * 2);
      const rangeOffset = bytes.readUInt16BE(rangeOffsets + segment * 2);
      if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
      // The offset is counted from the slot it stands in, which is what makes the glyph array a
      // continuation of this table rather than a table of its own.
      const slot = rangeOffsets + segment * 2 + rangeOffset + (codePoint - bytes.readUInt16BE(startCodes + segment * 2)) * 2;
      if (slot + 2 > bytes.byteLength) return 0;
      const glyph = bytes.readUInt16BE(slot);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
}

/** Format 12: the full range as groups, each a run of code points onto a run of glyphs. */
function segmentedCoverage(bytes: Buffer, at: number): GlyphLookup {
  const groups = bytes.readUInt32BE(at + 12);
  const first = at + 16;
  if (first + groups * 12 > bytes.byteLength) return MAPS_NOTHING;

  return (codePoint: number): number => {
    let low = 0;
    let high = groups - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const group = first + middle * 12;
      const from = bytes.readUInt32BE(group);
      const to = bytes.readUInt32BE(group + 4);
      if (codePoint < from) high = middle - 1;
      else if (codePoint > to) low = middle + 1;
      else return bytes.readUInt32BE(group + 8) + (codePoint - from);
    }
    return 0;
  };
}
