// R-SPINE-020: "DWG, DXF, PDF, PNG/JPG/TIFF", judged by the name AND by the bytes. A name is what a
// caller wrote and a signature is what the file is, so a format is accepted only where the two agree
// — which is exactly what the registered remedy tells a person (Q-12: uploads validated).
//
// The roster itself lives in `src/core/uploads`, where the column's CHECK reads it too (B-17).
import { ACCEPTED_FORMATS, isAcceptedFormat, type AcceptedFormat } from "../../../core/uploads";

/** How much of a file has to be in hand to judge what it is. */
export const FORMAT_HEAD_BYTES = 1024;

/** The container this seam expands rather than stores (R-SPINE-020's `.zip`). */
const ZIP_EXTENSION = "zip";

/** Spellings a person's file carries for a format the roster names once. */
const EXTENSION_ALIASES: Readonly<Record<string, AcceptedFormat>> = Object.freeze({
  jpeg: "jpg",
  tif: "tiff",
});

/** The signature each format opens with, read off the head. */
const SIGNATURES: Readonly<Record<AcceptedFormat, (head: Uint8Array, text: string) => boolean>> = Object.freeze({
  // R2000 and later open with their version code — `AC1015`, `AC1032` and their kin.
  dwg: (_head, text) => /^AC10[0-9]{2}/.test(text),
  // An ASCII DXF opens with the group code 0 and the word SECTION; the binary spelling says so.
  dxf: (_head, text) => /^\s*0\s*\r?\n\s*SECTION/.test(text) || text.startsWith("AutoCAD Binary DXF"),
  pdf: (_head, text) => text.startsWith("%PDF-"),
  png: (head) => startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: (head) => startsWith(head, [0xff, 0xd8, 0xff]),
  // Little-endian and big-endian TIFF, by the byte order mark the format opens with.
  tiff: (head) => startsWith(head, [0x49, 0x49, 0x2a, 0x00]) || startsWith(head, [0x4d, 0x4d, 0x00, 0x2a]),
});

/** The local file header a zip opens with, as bytes (PK-3-4). */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

/** Do these bytes open with that sequence? */
function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((byte, at) => bytes[at] === byte);
}

/** The head as text, for the formats whose signature is one — decoded leniently, never validated. */
function headText(head: Uint8Array): string {
  return new TextDecoder("latin1").decode(head.subarray(0, FORMAT_HEAD_BYTES));
}

/** The extension a presented name carries, lowercased, or an empty string when it carries none. */
export function extensionOf(name: string): string {
  const base = name.slice(name.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot + 1).toLowerCase();
}

/**
 * The format a name declares, or null when it declares none the product reads. This is the question a
 * session can be opened on: the content is only knowable once the bytes arrive.
 */
export function declaredFormat(name: string): AcceptedFormat | null {
  const extension = extensionOf(name);
  const canonical = EXTENSION_ALIASES[extension] ?? extension;
  return isAcceptedFormat(canonical) ? canonical : null;
}

/** Is this presented name an archive — the one container this seam expands instead of storing? */
export function isArchiveName(name: string): boolean {
  return extensionOf(name) === ZIP_EXTENSION;
}

/** Do these bytes open as an archive? */
export function isArchiveContent(head: Uint8Array): boolean {
  return startsWith(head, ZIP_SIGNATURE);
}

/**
 * The format this file is, or null when the name and the content do not agree on one the product
 * reads. `head` is the file's leading bytes — `FORMAT_HEAD_BYTES` is enough for every signature above,
 * so a 500 MB drawing is judged without being held in memory.
 */
export function detectFormat(name: string, head: Uint8Array): AcceptedFormat | null {
  const declared = declaredFormat(name);
  if (declared === null) return null;
  return SIGNATURES[declared](head, headText(head)) ? declared : null;
}

export { ACCEPTED_FORMATS };
export type { AcceptedFormat };
