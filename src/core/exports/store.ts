// Where a built artefact goes, how a person is handed a link to it, and what that link is answered
// with (R-SPINE-021, Q-12).
//
// An export is evidence like a drawing is: it is stored by the sha256 of its own bytes, under its
// workspace's prefix, through SEAM-STORAGE — which is why `buildWorkbook` had to become a function
// of its spec alone. Nothing here keeps a record beside the bytes; the address IS the record.
//
// The link a browser carries is the STORAGE seam's own signature, re-addressed at this product's
// download route. There is no second signer and no second secret (Q-12): the fields a URL carries
// are the ones storage minted, and reading one back hands them to storage to judge. What this file
// adds is only the translation between the two spellings of one address, and the three registered
// answers a link can earn.
import { createHash } from "node:crypto";
import { isUuid } from "../db";
import { REFUSALS } from "../errors";
import type { ExportsRefusalCode } from "../errors/exports";
import type { Storage } from "../storage";
import { EXPORT_KINDS, type ExportKind } from "./contract";

/** The route a person's link points at — this product's door, not the storage seam's own path. */
const DOWNLOAD_ROUTE = "/api/exports";

/** An address as both seams spell it: exactly 64 lowercase hex characters. */
const ADDRESS_SHAPE = /^[0-9a-f]{64}$/u;

/** Everything a download link names, in the order it is written and read. */
export interface ExportAddress {
  readonly tenantId: string;
  readonly sha256: string;
  readonly kind: ExportKind;
}

/** What minting a link asks for: the address, and how long the link is good for (Q-12). */
export type ExportLink = ExportAddress & { readonly expiresInSeconds: number };

/** A link as it comes back in, field by field — whatever a caller wrote in the query string. */
export interface PresentedLink {
  readonly tenantId: string;
  readonly sha256: string;
  readonly expires: string;
  readonly signature: string;
}

/** What a presented link is answered with: the bytes at its address, or the refusal it earned. */
export type SignedExport = { readonly ok: true; readonly bytes: Uint8Array } | { readonly ok: false; readonly refusal: ExportRefusal };

/** The three codes this seam decides between — the EXPORTS shard's own union, never a second one. */
export type ExportRefusal = ExportsRefusalCode;

/**
 * The codes as the closed register holds them (R-SPINE-062, Q-07). They are READ from it rather than
 * spelled beside it: a literal here would agree with the taxonomy by coincidence, and the day an
 * entry moved, this seam would answer with a code nothing renders.
 */
const URL_INVALID: ExportRefusal = REFUSALS.EXPORT_URL_INVALID.code;
const URL_EXPIRED: ExportRefusal = REFUSALS.EXPORT_URL_EXPIRED.code;
const NOT_FOUND: ExportRefusal = REFUSALS.EXPORT_NOT_FOUND.code;

/**
 * Stores a built artefact and answers its address (R-SPINE-021). The address is the sha256 of the
 * bytes, so storing the same artefact twice is storing it once — and two artefacts that differ by a
 * byte are two addresses, which is what makes a link name one artefact and not a kind of artefact.
 */
export async function storeExport(storage: Storage, tenantId: string, bytes: Uint8Array): Promise<{ sha256: string }> {
  return storage.put(tenantId, bytes);
}

/**
 * The address the seam would give these bytes, computed rather than stored. The one place this
 * product spells the digest of an artefact — the storage seam computes the same digest for the same
 * reason, and the two agree because they are the same function of the same bytes.
 */
export function exportAddress(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * A signed, expiring download link for a stored artefact (Q-12).
 *
 * The signature is minted by SEAM-STORAGE and by nothing else: this function asks storage to sign
 * the address and then writes the fields it minted at this product's own route. A second HMAC here
 * would be a second secret to rotate and a second way for a link to be valid.
 */
export function exportDownloadUrl(storage: Storage, link: ExportLink): string {
  const minted = new URL(storage.sign(link.tenantId, link.sha256, { expiresInSeconds: link.expiresInSeconds }), PLACEHOLDER_ORIGIN);
  const query = new URLSearchParams({
    tenant: link.tenantId,
    kind: link.kind,
    expires: minted.searchParams.get("expires") ?? "",
    signature: minted.searchParams.get("signature") ?? "",
  });
  return `${DOWNLOAD_ROUTE}/${link.sha256}?${query.toString()}`;
}

/**
 * The bytes a presented link earns, or the one refusal it earns instead (R-SPINE-062).
 *
 * The decision lives here, in core, beside the shard that registers the three codes — the door above
 * only gives each an HTTP status. The order is the order the questions stop being answerable in: a
 * link nobody minted names no address to look for, and a link that has aged out names one this
 * workspace will not open again until it is minted afresh.
 */
export async function readSignedExport(storage: Storage, presented: PresentedLink): Promise<SignedExport> {
  const vouched = storage.verify(storageUrlOf(storage, presented));
  if (!vouched.ok) return { ok: false, refusal: vouched.reason === "expired" ? URL_EXPIRED : URL_INVALID };

  const bytes = await storage.get(vouched.tenantId, vouched.sha256);
  // An address nothing is stored at names an artefact this workspace never built — an absence, and
  // an absence is an answer rather than a fault (B-21).
  if (bytes === null) return { ok: false, refusal: NOT_FOUND };
  return { ok: true, bytes };
}

/**
 * The kind the bytes at an address ARE, read off the artefact rather than off the link (Q-12).
 *
 * A download URL carries `kind` outside the signature — SEAM-STORAGE signs a workspace, an address
 * and an expiry, and this seam mints no second signature — so the kind is a claim a caller may
 * rewrite. This is what the claim is checked against: an .xlsx is an OOXML package and a package is
 * a zip, and a zip is a STRUCTURE — a local file header at the front and a central directory record
 * at the back. A CSV is text and has neither.
 *
 * The two letters alone would not do. "PK" is ASCII, and `writeCsv` puts the first column header at
 * the front of the artefact, so a bill whose first column is `PKG` or `PKR` would open with the very
 * same bytes; calling that a package would answer a link the workspace really did mint with "not one
 * this workspace issued", and leave a lawful CSV undownloadable at its own address. What text cannot
 * counterfeit is the pair: the entry header's own `\x03\x04`, and the end-of-central-directory
 * record that closes every zip, both of which are control bytes no column header carries.
 */
export function storedKindOf(bytes: Uint8Array): ExportKind {
  return opensAt(bytes, ZIP_ENTRY, 0) && closesAsArchive(bytes) ? "xlsx" : "csv";
}

/** The local file header every zip entry opens with, and the record every zip closes with. */
const ZIP_ENTRY = Object.freeze([0x50, 0x4b, 0x03, 0x04]);
const ZIP_END = Object.freeze([0x50, 0x4b, 0x05, 0x06]);

/**
 * How far back the closing record is looked for. It stands 22 bytes from the end of an archive with
 * no comment — which is what this seam writes — and a comment may carry it further; a kilobyte is
 * further than any archive of ours puts it and short enough to read at once.
 */
const ZIP_END_WINDOW = 1024;

/** Do these bytes stand at this offset? */
function opensAt(bytes: Uint8Array, signature: readonly number[], at: number): boolean {
  return signature.every((byte, index) => bytes[at + index] === byte);
}

/** Does an end-of-central-directory record stand in the archive's tail, where a zip closes? */
function closesAsArchive(bytes: Uint8Array): boolean {
  for (let at = bytes.length - ZIP_END.length; at >= Math.max(0, bytes.length - ZIP_END_WINDOW); at -= 1) {
    if (opensAt(bytes, ZIP_END, at)) return true;
  }
  return false;
}

/** Is this text a kind this seam writes? The query says one, and a caller wrote the query. */
export function isExportKind(value: unknown): value is ExportKind {
  return typeof value === "string" && (EXPORT_KINDS as readonly string[]).includes(value);
}

/** The origin a relative minted path is parsed against. It travels nowhere and is never answered. */
const PLACEHOLDER_ORIGIN = "https://exports.invalid";

/**
 * The presented fields, written back in the storage seam's own spelling so storage can judge them.
 *
 * The seam's path is its own private fact, so it is asked for rather than restated: signing this
 * very address answers the path a URL for it is minted under, and the presented expiry and signature
 * are written over the query. A prefix copied here instead would be a second statement of a thing
 * SEAM-STORAGE already says, and the day it moved, every link in the product would be invalid for a
 * reason nothing in this file mentioned (B-17).
 */
function storageUrlOf(storage: Storage, presented: PresentedLink): string {
  // A shape storage itself would refuse is refused before it is signed for: `sign` throws on an
  // address or a tenant it will not touch, and far-side input must never travel as an exception. The
  // tenancy seam owns what a workspace id looks like (B-05); the canonical spelling is storage's own
  // rule, because a prefix is a path and a path is case-sensitive.
  const prefixed = isUuid(presented.tenantId) && presented.tenantId === presented.tenantId.toLowerCase();
  if (!prefixed || !ADDRESS_SHAPE.test(presented.sha256)) return "";
  const path = storage.sign(presented.tenantId, presented.sha256, { expiresInSeconds: 1 }).split("?")[0] ?? "";
  return `${path}?expires=${presented.expires}&signature=${presented.signature}`;
}
