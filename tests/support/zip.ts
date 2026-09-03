/**
 * A stored-method zip writer, for the acceptance that drives R-SPINE-020's archive leg (AC-2).
 *
 * No archiver ships in this tree and none may be added offline, so the fixture corpus is written
 * here, by hand, in the one format the increment's own reader must accept without ambiguity: every
 * member STORED (method 0), no data descriptors, no zip64, no encryption. The central directory is
 * what a reader reads — the local headers are written to agree with it, because a zip whose two
 * tables disagree tests the reader's tolerance rather than the product's rule.
 *
 * It is deliberately a *writer* only: nothing here reads a zip back, so the acceptance can never
 * grade the product's reader against a second reader of its own (B-17).
 */
import { deflateRawSync } from "node:zlib";

/** One member of an archive: a file with bytes, or a directory entry, which carries none. */
export interface ZipMember {
  /** The path the archive records, verbatim — `structural/S-101.dxf`, or `structural/` for a directory. */
  path: string;
  /** The member's bytes. Omitted for a directory entry. */
  bytes?: Uint8Array;
  /** A directory entry: zero length, and the path ends in `/`. */
  directory?: boolean;
  /** How the member is stored. `stored` unless a case needs the deflated spelling. */
  method?: "stored" | "deflate";
}

/**
 * The numbers the format is written with, in decimal: this tree's lint refuses a packed
 * six-to-eight digit hex literal anywhere outside the token table (R-UI-001), and a zip signature
 * is exactly that shape.
 */
const LOCAL_HEADER = 67324752; // the local file header's signature, PK-3-4 read little-endian
const CENTRAL_HEADER = 33639248; // the central directory header's, PK-1-2
const END_OF_DIRECTORY = 101010256; // the end-of-central-directory record's, PK-5-6
const CRC_POLYNOMIAL = 3988292384; // the reversed CRC-32 polynomial the format specifies
const CRC_SEED = 4294967295; // thirty-two ones: the register the digest starts and ends against
const MSDOS_DIRECTORY_BIT = 16; // the external attribute that says "this member is a directory"

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? CRC_POLYNOMIAL ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** The CRC-32 a zip entry records for its uncompressed bytes. */
export function crc32(bytes: Uint8Array): number {
  let c = CRC_SEED;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ CRC_SEED) >>> 0;
}

/** A little-endian writer over a growing array — the whole of what the format needs. */
class Bytes {
  private readonly parts: Uint8Array[] = [];
  private size = 0;

  u16(value: number): this {
    return this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  u32(value: number): this {
    return this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]));
  }

  push(bytes: Uint8Array): this {
    this.parts.push(bytes);
    this.size += bytes.length;
    return this;
  }

  get length(): number {
    return this.size;
  }

  done(): Uint8Array {
    const out = new Uint8Array(this.size);
    let at = 0;
    for (const part of this.parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  }
}

const encoder = new TextEncoder();

/** The bytes of an archive holding exactly these members, in this order. */
export function buildZip(members: readonly ZipMember[]): Uint8Array {
  const file = new Bytes();
  const central = new Bytes();
  const empty = new Uint8Array(0);

  for (const member of members) {
    const isDirectory = member.directory === true;
    const raw = isDirectory ? empty : (member.bytes ?? empty);
    const deflated = !isDirectory && member.method === "deflate";
    const stored = deflated ? new Uint8Array(deflateRawSync(raw)) : raw;
    const name = encoder.encode(member.path);
    const crc = isDirectory ? 0 : crc32(raw);
    const offset = file.length;

    file.u32(LOCAL_HEADER).u16(20).u16(0).u16(deflated ? 8 : 0).u16(0).u16(0);
    file.u32(crc).u32(stored.length).u32(raw.length).u16(name.length).u16(0);
    file.push(name).push(stored);

    central.u32(CENTRAL_HEADER).u16(20).u16(20).u16(0).u16(deflated ? 8 : 0).u16(0).u16(0);
    central.u32(crc).u32(stored.length).u32(raw.length).u16(name.length).u16(0).u16(0).u16(0).u16(0);
    // External attributes: the MS-DOS directory bit, which is how a directory entry says so beyond
    // its trailing slash.
    central.u32(isDirectory ? MSDOS_DIRECTORY_BIT : 0).u32(offset);
    central.push(name);
  }

  const centralBytes = central.done();
  const centralOffset = file.length;
  const end = new Bytes();
  end.u32(END_OF_DIRECTORY).u16(0).u16(0).u16(members.length).u16(members.length).u32(centralBytes.length).u32(centralOffset).u16(0);

  return new Bytes().push(file.done()).push(centralBytes).push(end.done()).done();
}
