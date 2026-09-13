// Where a built artefact goes, and how a browser is told to come and get it (R-SPINE-021, Q-12).
//
// An export is stored by the content address of its own bytes under the tenant's prefix, exactly as
// a drawing is: two builds of one spec are byte-identical (see ./workbook.ts), so building the same
// bill twice stores it once and both builds name the same object.
//
// The URL is the storage seam's OWN signature, re-addressed at the download route. There is no
// second HMAC and no second secret: the signer that minted the signature is the verifier that reads
// it back, and a link this installation did not sign verifies nowhere (Q-12).

import type { ExportsRefusalCode } from "../errors/exports";
import type { Storage } from "../storage";
import type { ExportKind } from "./sheet";

/** The route a signed export is fetched from; the door that answers it reads this same address. */
const DOWNLOAD_ROUTE = "/api/exports";

/** Where the storage seam's own signature carries the expiry and the signature it minted. */
const SIGNED_EXPIRES = "expires";
const SIGNED_SIGNATURE = "signature";

/** An artefact a caller wants a link to: whose it is, which bytes, what kind, and for how long. */
export interface ExportAddress {
  readonly tenantId: string;
  readonly sha256: string;
  readonly kind: ExportKind;
  readonly expiresInSeconds: number;
}

/** Stores a built artefact under its workspace and answers its content address. Idempotent. */
export async function storeExport(storage: Storage, tenantId: string, bytes: Uint8Array): Promise<{ sha256: string }> {
  return await storage.put(tenantId, bytes);
}

/**
 * An expiring download URL for a stored artefact.
 *
 * The storage seam signs its own address (`/storage/v1/<tenant>/<sha256>?expires=&signature=`) and
 * this re-addresses that one signature at the door a browser can reach. The parts are read off the
 * minted URL rather than re-derived, so the expiry the door verifies is the expiry that was signed.
 */
export function exportDownloadUrl(storage: Storage, address: ExportAddress): string {
  const signed = new URL(storage.sign(address.tenantId, address.sha256, { expiresInSeconds: address.expiresInSeconds }), "http://exports.invalid");
  const expires = signed.searchParams.get(SIGNED_EXPIRES);
  const signature = signed.searchParams.get(SIGNED_SIGNATURE);
  if (expires === null || signature === null) {
    throw new TypeError("exports: the storage seam minted a URL carrying no expiry and signature, so nothing can be addressed from it");
  }
  const asked = new URLSearchParams({ tenant: address.tenantId, kind: address.kind, expires, signature });
  return `${DOWNLOAD_ROUTE}/${address.sha256}?${asked.toString()}`;
}

/**
 * The storage seam's own address for a download URL's parts, in the spelling `verify` reads back.
 * The seam hands back what it was given rather than building a signature of its own: the one signer
 * is the one verifier (Q-12).
 */
function signedStorageUrl(parts: SignedLink): string {
  return `/storage/v1/${parts.tenantId}/${parts.sha256}?${SIGNED_EXPIRES}=${parts.expires}&${SIGNED_SIGNATURE}=${parts.signature}`;
}

/** A download link's parts as they arrived, each carried as the text that was signed. */
export interface SignedLink {
  readonly tenantId: string;
  readonly sha256: string;
  /** The expiry as digits: the signature covers what was signed, and a re-rendered number is not it. */
  readonly expires: string;
  readonly signature: string;
}

/** What a signed link is worth: the artefact's bytes, or the one refusal that says why not. */
export type SignedExportRead = { readonly ok: true; readonly bytes: Uint8Array } | { readonly ok: false; readonly refusal: ExportsRefusalCode };

/**
 * The bytes a signed link addresses, or this area's own refusal (R-SPINE-062, AM-11).
 *
 * The three EXPORT_* codes are decided here, beside the shard that registers them: a link this
 * installation did not sign is EXPORT_URL_INVALID, one whose hour has passed EXPORT_URL_EXPIRED —
 * an expiry is a link that WAS good, which is a different fact from a forgery — and an address the
 * workspace has nothing stored at is EXPORT_NOT_FOUND. Who may ask is not this seam's question: the
 * door above resolves the caller before it reaches here, and maps a refusal to its status.
 */
export async function readSignedExport(storage: Storage, link: SignedLink): Promise<SignedExportRead> {
  const verified = storage.verify(signedStorageUrl(link));
  if (!verified.ok) return { ok: false, refusal: verified.reason === "expired" ? "EXPORT_URL_EXPIRED" : "EXPORT_URL_INVALID" };

  const bytes = await storage.get(link.tenantId, link.sha256);
  if (bytes === null) return { ok: false, refusal: "EXPORT_NOT_FOUND" };
  return { ok: true, bytes };
}
