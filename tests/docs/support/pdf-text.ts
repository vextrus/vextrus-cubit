/**
 * What a reader gets out of a rendered PDF: its text and the faces it embedded (V-DOCS).
 *
 * A document lane that asserted on the .typ source would prove the template was written, never that
 * the document SAYS anything — so the lane reads the artefact itself. No package does this: the
 * toolchain is pinned save-exact and a PDF reader is not among the pins (C-06), so the two questions
 * V-DOCS asks — "does the text extract" and "which faces are embedded" — are answered here with
 * node:zlib and the file format itself.
 *
 * What is read, in the order a PDF makes it available:
 *  - every `N 0 obj … endobj` in the file, plus every object inside an object stream (`/Type/ObjStm`),
 *    because a modern producer writes most dictionaries compressed and a reader that skips them sees
 *    an almost empty file;
 *  - each page's `/Resources /Font` map, so a show operator is decoded by the face it was set in —
 *    a subset font's codes are its own, and one global table would read the mono face's figures
 *    through the sans face's map;
 *  - each font's `/ToUnicode` CMap (`beginbfchar` / `beginbfrange`), which is what makes the bytes of
 *    a subsetted, Identity-H encoded font legible at all.
 *
 * Runs inside one text object are concatenated, because a producer splits a line at every kerning
 * pair and joining those with spaces would spell `Docu ment`. A TJ adjustment wide enough to be a
 * word gap becomes one space, and separate text objects and pages are separated too — so the text
 * reads in the order it is set, and a caller asserting a phrase can normalise whitespace and find it.
 */
import { inflateSync } from "node:zlib";

/** A PDF object as it stands after decompression: its number and its raw bytes (dict plus stream). */
type PdfObject = { readonly num: number; readonly body: Buffer; readonly stream: Buffer | null };

/** The width of a show-string's codes, and what each code says in Unicode. */
type FontMap = { readonly bytes: 1 | 2; readonly codes: Map<number, string> };

/** A TJ adjustment at least this wide (thousandths of an em, negative moves forward) is a word gap. */
const WORD_GAP = 180;

/** Every `N 0 obj … endobj` the file spells directly, before any object stream is opened. */
function topLevelObjects(pdf: Buffer): PdfObject[] {
  const found: PdfObject[] = [];
  const header = /(\d+)\s+(\d+)\s+obj\b/g;
  const text = pdf.toString("latin1");
  let match: RegExpExecArray | null;
  while ((match = header.exec(text)) !== null) {
    const from = header.lastIndex;
    const end = text.indexOf("endobj", from);
    if (end === -1) continue;
    const body = pdf.subarray(from, end);
    found.push({ num: Number(match[1]), body, stream: streamOf(body) });
  }
  return found;
}

/** The bytes between `stream` and `endstream`, inflated when the dictionary says they are deflated. */
function streamOf(body: Buffer): Buffer | null {
  const text = body.toString("latin1");
  const at = text.indexOf("stream");
  if (at === -1) return null;
  // `stream` is followed by CRLF or LF, and by nothing else the format admits.
  let from = at + "stream".length;
  if (text.charAt(from) === "\r") from += 1;
  if (text.charAt(from) === "\n") from += 1;
  const end = text.indexOf("endstream", from);
  if (end === -1) return null;
  const raw = body.subarray(from, end);
  if (!/\/Filter\s*\/FlateDecode|\/Filter\s*\[\s*\/FlateDecode/.test(text.slice(0, at))) return raw;
  try {
    return inflateSync(raw);
  } catch {
    // A stream this reader cannot open is not the lane's answer to give: it is skipped, and the
    // caller's assertion fails on the text that is missing rather than on an exception here.
    return null;
  }
}

/** Every object of the file, including the ones packed inside object streams. */
function allObjects(pdf: Buffer): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>();
  for (const object of topLevelObjects(pdf)) objects.set(object.num, object);
  for (const object of [...objects.values()]) {
    const dict = object.body.toString("latin1");
    if (!/\/Type\s*\/ObjStm/.test(dict) || object.stream === null) continue;
    const count = Number(/\/N\s+(\d+)/.exec(dict)?.[1] ?? "0");
    const first = Number(/\/First\s+(\d+)/.exec(dict)?.[1] ?? "0");
    const packed = object.stream;
    const header = packed.subarray(0, first).toString("latin1").trim().split(/\s+/u).map(Number);
    for (let index = 0; index < count; index += 1) {
      const num = header[index * 2];
      const offset = header[index * 2 + 1];
      if (num === undefined || offset === undefined) continue;
      const nextOffset = header[index * 2 + 3];
      const to = nextOffset === undefined ? packed.length : first + nextOffset;
      const body = packed.subarray(first + offset, to);
      objects.set(num, { num, body, stream: null });
    }
  }
  return objects;
}

/** The object a `12 0 R` reference names, or null when the file holds no such object. */
function referenced(objects: Map<number, PdfObject>, reference: string | undefined): PdfObject | null {
  const num = Number(/(\d+)\s+\d+\s+R/.exec(reference ?? "")?.[1] ?? NaN);
  return Number.isNaN(num) ? null : (objects.get(num) ?? null);
}

/** A hex string of a CMap (`<0041>`) as the number it holds, and the text a destination spells. */
function hexNumber(hex: string): number {
  return Number.parseInt(hex, 16);
}

/** A UTF-16BE destination as the text it stands for; a multi-code destination keeps all of it. */
function hexText(hex: string): string {
  let text = "";
  for (let at = 0; at + 3 < hex.length; at += 4) text += String.fromCharCode(Number.parseInt(hex.slice(at, at + 4), 16));
  return text;
}

/** One font's `/ToUnicode` CMap: the code width it declares and every code it maps. */
function toUnicode(cmap: string): FontMap {
  const codes = new Map<number, string>();
  const range = /begincodespacerange([\s\S]*?)endcodespacerange/.exec(cmap)?.[1] ?? "";
  const firstCode = /<([0-9A-Fa-f]+)>/.exec(range)?.[1] ?? "00";
  const bytes: 1 | 2 = firstCode.length > 2 ? 2 : 1;

  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of (block[1] ?? "").matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      codes.set(hexNumber(pair[1] ?? "0"), hexText(pair[2] ?? ""));
    }
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const body = block[1] ?? "";
    for (const span of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const from = hexNumber(span[1] ?? "0");
      const to = hexNumber(span[2] ?? "0");
      const base = span[3] ?? "";
      for (let code = from; code <= to && code - from < 0x10000; code += 1) {
        const shifted = (hexNumber(base.slice(-4)) + (code - from)).toString(16).padStart(4, "0");
        codes.set(code, hexText(`${base.slice(0, -4)}${shifted}`));
      }
    }
    for (const span of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g)) {
      const from = hexNumber(span[1] ?? "0");
      const destinations = [...(span[3] ?? "").matchAll(/<([0-9A-Fa-f]*)>/g)];
      destinations.forEach((destination, index) => codes.set(from + index, hexText(destination[1] ?? "")));
    }
  }
  return { bytes, codes };
}

/** The `/Font` dictionary of a page's resources: the name a `Tf` names, and the face it stands for. */
function fontsOfPage(objects: Map<number, PdfObject>, page: string): Map<string, FontMap> {
  const fonts = new Map<string, FontMap>();
  const resources = /\/Resources\s*(\d+\s+\d+\s+R)/.exec(page);
  const dict = resources === null ? page : (referenced(objects, resources[1])?.body.toString("latin1") ?? "");
  const fontDict = /\/Font\s*<<([\s\S]*?)>>/.exec(dict)?.[1] ?? (() => {
    const indirect = /\/Font\s*(\d+\s+\d+\s+R)/.exec(dict);
    return referenced(objects, indirect?.[1])?.body.toString("latin1") ?? "";
  })();

  for (const entry of fontDict.matchAll(/\/([^\s/<>[\]]+)\s+(\d+\s+\d+\s+R)/g)) {
    const font = referenced(objects, entry[2]);
    if (font === null) continue;
    const map = mapOfFont(objects, font);
    if (map !== null) fonts.set(entry[1] ?? "", map);
  }
  return fonts;
}

/** A font's code map, read from its own `/ToUnicode` or from the descendant that carries one. */
function mapOfFont(objects: Map<number, PdfObject>, font: PdfObject): FontMap | null {
  const dict = font.body.toString("latin1");
  const cmap = referenced(objects, /\/ToUnicode\s*(\d+\s+\d+\s+R)/.exec(dict)?.[1]);
  if (cmap?.stream != null) return toUnicode(cmap.stream.toString("latin1"));
  const descendant = referenced(objects, /\/DescendantFonts\s*\[\s*(\d+\s+\d+\s+R)/.exec(dict)?.[1]);
  return descendant === null ? null : mapOfFont(objects, descendant);
}

/** A show-string's bytes as the text its face spells; an unmapped code is kept as its own character. */
function decode(hexOrLiteral: Buffer, font: FontMap | undefined): string {
  if (font === undefined) return hexOrLiteral.toString("latin1");
  let text = "";
  const step = font.bytes;
  for (let at = 0; at + step <= hexOrLiteral.length; at += step) {
    const code = step === 2 ? hexOrLiteral.readUInt16BE(at) : hexOrLiteral.readUInt8(at);
    text += font.codes.get(code) ?? String.fromCharCode(code);
  }
  return text;
}

/** A `<48656C6C6F>` hex string as bytes. */
function fromHex(hex: string): Buffer {
  const even = hex.length % 2 === 0 ? hex : `${hex}0`;
  return Buffer.from(even, "hex");
}

/** A `(Hello\)…)` literal string as bytes, with the escapes the format defines resolved. */
function fromLiteral(literal: string): Buffer {
  const out: number[] = [];
  for (let at = 0; at < literal.length; at += 1) {
    const char = literal.charAt(at);
    if (char !== "\\") {
      out.push(char.charCodeAt(0));
      continue;
    }
    const next = literal.charAt(at + 1);
    const escapes: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 };
    if (next in escapes) {
      out.push(escapes[next] as number);
      at += 1;
    } else if (/[0-7]/.test(next)) {
      const octal = /^[0-7]{1,3}/.exec(literal.slice(at + 1))?.[0] ?? "0";
      out.push(Number.parseInt(octal, 8));
      at += octal.length;
    } else {
      out.push(next.charCodeAt(0));
      at += 1;
    }
  }
  return Buffer.from(out);
}

/** The strings and gaps of one content stream, decoded through the faces the page set them in. */
function textOfContent(content: string, fonts: Map<string, FontMap>): string {
  let current: FontMap | undefined;
  const pieces: string[] = [];
  let run = "";

  // `Tf` is text state and outlives the text object that set it (PDF 32000-1 §9.3), so the face is
  // never forgotten at `ET` — a reader that forgot it decoded every run after the first as raw bytes.
  const token = /\/([^\s/<>[\]]+)\s+[\d.]+\s+Tf|\[([\s\S]*?)\]\s*TJ|<([0-9A-Fa-f\s]*)>\s*Tj|\(((?:\\.|[^\\)])*)\)\s*Tj|\bET\b|\bTd\b|\bTD\b|\bT\*\b/g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(content)) !== null) {
    const [, face, array, hex, literal] = match;
    if (face !== undefined) {
      current = fonts.get(face);
      continue;
    }
    if (array !== undefined) {
      for (const piece of array.matchAll(/<([0-9A-Fa-f\s]*)>|\(((?:\\.|[^\\)])*)\)|(-?[\d.]+)/g)) {
        if (piece[1] !== undefined) run += decode(fromHex(piece[1].replace(/\s+/gu, "")), current);
        else if (piece[2] !== undefined) run += decode(fromLiteral(piece[2]), current);
        else if (Number(piece[3]) <= -WORD_GAP) run += " ";
      }
      continue;
    }
    if (hex !== undefined) {
      run += decode(fromHex(hex.replace(/\s+/gu, "")), current);
      continue;
    }
    if (literal !== undefined) {
      run += decode(fromLiteral(literal), current);
      continue;
    }
    // A text object that ends, or a line that moves, separates what was set from what follows.
    if (run !== "") {
      pieces.push(run);
      run = "";
    }
  }
  if (run !== "") pieces.push(run);
  return pieces.join(" ");
}

/**
 * The text of a rendered PDF, page by page, in the order it was set. Pages are separated by a
 * newline and text objects by a space, so a caller that normalises whitespace reads the document.
 */
export function pdfText(pdf: Uint8Array): string {
  const bytes = Buffer.from(pdf.buffer, pdf.byteOffset, pdf.byteLength);
  const objects = allObjects(bytes);
  const pages: string[] = [];

  for (const object of objects.values()) {
    const dict = object.body.toString("latin1");
    if (!/\/Type\s*\/Page\b/.test(dict)) continue;
    const fonts = fontsOfPage(objects, dict);
    const contents = [...dict.matchAll(/\/Contents\s*(?:\[([^\]]*)\]|(\d+\s+\d+\s+R))/g)].flatMap((entry) =>
      [...(entry[1] ?? entry[2] ?? "").matchAll(/\d+\s+\d+\s+R/g)].map((reference) => referenced(objects, reference[0])),
    );
    const text = contents
      .map((content) => (content?.stream == null ? "" : textOfContent(content.stream.toString("latin1"), fonts)))
      .filter((piece) => piece !== "")
      .join(" ");
    if (text !== "") pages.push(text);
  }
  return pages.join("\n");
}

/** Every `/BaseFont` the file names: the faces the document embedded, subset prefixes and all. */
export function pdfFontNames(pdf: Uint8Array): string[] {
  const bytes = Buffer.from(pdf.buffer, pdf.byteOffset, pdf.byteLength);
  const names = new Set<string>();
  const sources = [bytes.toString("latin1"), ...[...allObjects(bytes).values()].map((object) => object.body.toString("latin1"))];
  for (const source of sources) {
    for (const match of source.matchAll(/\/BaseFont\s*\/([^\s/<>[\]()]+)/g)) names.add(match[1] ?? "");
  }
  return [...names];
}
