/**
 * WHAT A RENDERED PAGE DREW — the operators, beside `pdf-text.ts`'s words (V-DOCS, A-BBS-PDF).
 *
 * The lane's reader answers "what does this document SAY"; a shape sketch says nothing at all. It is
 * drawn: a path is constructed (`m`, `l`, `c`, `v`, `y`, `re`) and then painted (`S`, `f`, `B` and
 * their kin), and a template that prints a code as text and draws nothing emits neither. So this
 * module answers the other half of the same question, over the same artefact, and nothing here
 * duplicates the text reader: it decodes no font, joins no run and reads no string.
 *
 * Only DRAWN streams are counted. A font program is a deflated stream too, and its bytes inflate to
 * a binary that holds ` m ` by coincidence often enough to make any count meaningless — so a stream
 * whose dictionary marks it a font program, an image or a piece of file furniture is skipped, and
 * everything else is read: a page's own content, and the form XObjects a writer may factor a
 * repeated drawing into (skipping those would credit a document for nothing it drew).
 */
import { inflateSync } from "node:zlib";

/** What one document painted: how many paths were constructed, and how many were painted. */
export type PaintCount = { readonly constructed: number; readonly painted: number };

/** Every content stream of the file, inflated, as latin1 text. */
function contentStreams(pdf: Uint8Array): string[] {
  const bytes = Buffer.from(pdf.buffer, pdf.byteOffset, pdf.byteLength);
  const text = bytes.toString("latin1");
  const found: string[] = [];
  for (const header of text.matchAll(/(\d+)\s+(\d+)\s+obj\b/gu)) {
    const from = (header.index ?? 0) + header[0].length;
    const end = text.indexOf("endobj", from);
    if (end === -1) continue;
    const body = text.slice(from, end);
    const at = body.indexOf("stream");
    if (at === -1) continue;
    const dict = body.slice(0, at);
    if (/\/Length1\b/u.test(dict)) continue;
    if (/\/Subtype\s*\/(Type1C|CIDFontType0C|OpenType|TrueType|Image|XML)\b/u.test(dict)) continue;
    if (/\/Type\s*\/(Font|Metadata|ObjStm|XRef|EmbeddedFile)\b/u.test(dict)) continue;
    let start = from + at + "stream".length;
    if (text.charAt(start) === "\r") start += 1;
    if (text.charAt(start) === "\n") start += 1;
    const stop = text.indexOf("endstream", start);
    if (stop === -1) continue;
    const raw = bytes.subarray(start, stop);
    if (!/\/Filter\s*\/FlateDecode|\/Filter\s*\[\s*\/FlateDecode/u.test(dict)) {
      found.push(raw.toString("latin1"));
      continue;
    }
    try {
      found.push(inflateSync(raw).toString("latin1"));
    } catch {
      // A stream this reader cannot open is not counted; the caller's assertion fails on the
      // operators that are missing rather than on an exception here.
    }
  }
  return found;
}

/** How many times the document's own content constructs and paints a path. */
export function paintCountOf(pdf: Uint8Array): PaintCount {
  let constructed = 0;
  let painted = 0;
  for (const stream of contentStreams(pdf)) {
    constructed += [...stream.matchAll(/(?:^|[\s])(?:m|l|c|v|y|re)(?=[\s])/gu)].length;
    painted += [...stream.matchAll(/(?:^|[\s])(?:S|s|f|F|f\*|B|B\*|b|b\*)(?=[\s])/gu)].length;
  }
  return { constructed, painted };
}
