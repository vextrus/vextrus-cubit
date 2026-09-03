// R-SPINE-020's archive leg: a `.zip` is expanded on the server into the drawings it holds. No
// archiver ships in this tree, so the reader is written here, over `node:zlib` — and it reads the
// central directory, which is what a zip's own index is, rather than walking the local headers a
// writer may leave disagreeing with it.
//
// What it does not read, it refuses by name rather than guessing at: zip64, encryption and any
// compression method beyond stored and deflate are members this product does not read, and a member
// it cannot read is skipped with the registered reason, never silently dropped (Q-07, ARCH-03).
import { inflateRawSync } from "node:zlib";
import { REFUSALS } from "../../../core/errors";
import type { UploadRefusalCode } from "./refusals";
import { UPLOAD_MAX_BYTES } from "../../../core/uploads";

/** The record signatures, in decimal: a packed six-digit hex literal is a colour to the lint (R-UI-001). */
const CENTRAL_HEADER = 33639248; // PK-1-2, the central directory header
const END_OF_DIRECTORY = 101010256; // PK-5-6, the end-of-central-directory record
const LOCAL_HEADER = 67324752; // PK-3-4, the local file header

/** Fixed widths the format states. */
const CENTRAL_HEADER_BYTES = 46;
const LOCAL_HEADER_BYTES = 30;
const END_OF_DIRECTORY_BYTES = 22;
/** The end record is followed by a comment of at most this length, so the search window is bounded. */
const MAX_COMMENT_BYTES = 65535;

/** The general-purpose flag bit that says the member is encrypted. */
const ENCRYPTED_BIT = 1;
/** The external attribute bit MS-DOS marks a directory with. */
const MSDOS_DIRECTORY_BIT = 16;
/** The two compression methods this reader understands. */
const STORED = 0;
const DEFLATE = 8;
/** The sentinel a zip64 archive parks in a 32-bit size field. */
const ZIP64_SENTINEL = 4294967295;

/** The code points a member path may not carry: everything below space, and delete. */
const CONTROL_CEILING = 32;
const DELETE_CODE = 127;

/** One member the reader recovered: the path the archive records, and the member's own bytes. */
export interface ZipMember {
  path: string;
  bytes: Uint8Array;
}

/** A member the reader would not take, with the registered reason it was left behind. */
export interface SkippedMember {
  name: string;
  reason: UploadRefusalCode;
}

/**
 * What an archive expanded to. `readable` is false for bytes that are not an archive this reader can
 * index at all — the caller answers that as the container's own refusal, because an archive nobody
 * can read holds no drawings to report on.
 */
export interface ZipExpansion {
  readable: boolean;
  members: ZipMember[];
  skipped: SkippedMember[];
}

const decoder = new TextDecoder();

function u16(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
}

function u32(bytes: Uint8Array, at: number): number {
  return ((bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8) | ((bytes[at + 2] ?? 0) << 16)) + (bytes[at + 3] ?? 0) * 0x1000000;
}

/** Where the end-of-central-directory record stands, or -1 when these bytes carry none. */
function endOfDirectoryAt(bytes: Uint8Array): number {
  const earliest = Math.max(0, bytes.length - END_OF_DIRECTORY_BYTES - MAX_COMMENT_BYTES);
  for (let at = bytes.length - END_OF_DIRECTORY_BYTES; at >= earliest; at -= 1) {
    if (u32(bytes, at) === END_OF_DIRECTORY) return at;
  }
  return -1;
}

/** The bytes a member's local header points at, or null when the header does not agree with the index. */
function memberBytes(bytes: Uint8Array, offset: number, compressedSize: number): Uint8Array | null {
  if (offset < 0 || offset + LOCAL_HEADER_BYTES > bytes.length) return null;
  if (u32(bytes, offset) !== LOCAL_HEADER) return null;
  const start = offset + LOCAL_HEADER_BYTES + u16(bytes, offset + 26) + u16(bytes, offset + 28);
  const end = start + compressedSize;
  if (end > bytes.length) return null;
  return bytes.subarray(start, end);
}

/**
 * The members an archive holds, and the members it holds that this product does not read. Directory
 * entries are neither: a directory is not a file, so it is not a drawing and not a skipped one.
 */
export function expandZip(bytes: Uint8Array): ZipExpansion {
  const members: ZipMember[] = [];
  const skipped: SkippedMember[] = [];
  const end = endOfDirectoryAt(bytes);
  if (end < 0) return { readable: false, members, skipped };

  const count = u16(bytes, end + 10);
  let at = u32(bytes, end + 16);

  for (let index = 0; index < count; index += 1) {
    if (at + CENTRAL_HEADER_BYTES > bytes.length || u32(bytes, at) !== CENTRAL_HEADER) return { readable: false, members, skipped };
    const flags = u16(bytes, at + 8);
    const method = u16(bytes, at + 10);
    const compressedSize = u32(bytes, at + 20);
    const uncompressedSize = u32(bytes, at + 24);
    const nameLength = u16(bytes, at + 28);
    const extraLength = u16(bytes, at + 30);
    const commentLength = u16(bytes, at + 32);
    const externalAttributes = u32(bytes, at + 38);
    const localOffset = u32(bytes, at + 42);
    const path = decoder.decode(bytes.subarray(at + CENTRAL_HEADER_BYTES, at + CENTRAL_HEADER_BYTES + nameLength));
    at += CENTRAL_HEADER_BYTES + nameLength + extraLength + commentLength;

    const isDirectory = path.endsWith("/") || (externalAttributes & MSDOS_DIRECTORY_BIT) === MSDOS_DIRECTORY_BIT;
    if (isDirectory) continue;

    if ((flags & ENCRYPTED_BIT) === ENCRYPTED_BIT || compressedSize === ZIP64_SENTINEL || uncompressedSize === ZIP64_SENTINEL) {
      skipped.push({ name: path, reason: REFUSALS.FORMAT_NOT_ACCEPTED.code });
      continue;
    }
    if (uncompressedSize > UPLOAD_MAX_BYTES) {
      skipped.push({ name: path, reason: REFUSALS.FILE_TOO_LARGE.code });
      continue;
    }
    if (method !== STORED && method !== DEFLATE) {
      skipped.push({ name: path, reason: REFUSALS.FORMAT_NOT_ACCEPTED.code });
      continue;
    }

    // A member path is recorded verbatim as the drawing's name, so it has to be a path this product
    // would write itself: a traversal segment, an absolute path or a NUL is a name no archive needs
    // and one every later consumer that resolves a drawing by name would inherit (Q-12).
    if (!isMemberPath(path)) {
      skipped.push({ name: path, reason: REFUSALS.FORMAT_NOT_ACCEPTED.code });
      continue;
    }

    const stored = memberBytes(bytes, localOffset, compressedSize);
    if (stored === null) {
      skipped.push({ name: path, reason: REFUSALS.FORMAT_NOT_ACCEPTED.code });
      continue;
    }
    const expanded = method === STORED ? stored : inflated(stored, uncompressedSize);
    if (typeof expanded === "string") {
      skipped.push({ name: path, reason: expanded });
      continue;
    }
    members.push({ path, bytes: expanded });
  }

  return { readable: true, members, skipped };
}

/**
 * A path this reader will carry as a drawing's name: relative, with no traversal segment, no drive
 * or root, no backslash separator and no control character. The archive supplies the name, so the
 * name is judged like anything else a caller wrote.
 */
function isMemberPath(path: string): boolean {
  if (path === "" || path.startsWith("/") || path.includes("\\") || path.includes(":")) return false;
  for (const character of path) {
    const code = character.codePointAt(0) ?? 0;
    if (code < CONTROL_CEILING || code === DELETE_CODE) return false;
  }
  return !path.split("/").some((segment) => segment === "." || segment === "..");
}

/**
 * A deflated member, expanded within the bytes it may amount to — or the registered reason it was
 * not. The archive's own account of a member's size is a claim, so it bounds the expansion rather
 * than standing in for it: a stream that expands past the smaller of that claim and the upload
 * ceiling is refused as the oversized member it is, and never materialised (Q-12). A member whose
 * compressed bytes will not expand at all is one this product does not read, which is an answer the
 * seam means rather than an outage of ours (ARCH-03, B-21).
 */
function inflated(stored: Uint8Array, declared: number): Uint8Array | UploadRefusalCode {
  const ceiling = Math.min(declared, UPLOAD_MAX_BYTES);
  try {
    const expanded = new Uint8Array(inflateRawSync(stored, { maxOutputLength: ceiling + 1 }));
    return expanded.length > ceiling ? REFUSALS.FILE_TOO_LARGE.code : expanded;
  } catch (failure) {
    return (failure as { code?: unknown }).code === "ERR_BUFFER_TOO_LARGE" ? REFUSALS.FILE_TOO_LARGE.code : refused();
  }
}

/** The registered reason a member this reader cannot take is left behind (R-SPINE-062). */
function refused(): UploadRefusalCode {
  return REFUSALS.FORMAT_NOT_ACCEPTED.code;
}
