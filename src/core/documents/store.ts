// Where an issued document goes, how it is listed, and how a person is handed a link to it
// (R-SPINE-040, R-SPINE-021, Q-12).
//
// The bytes go through SEAM-STORAGE, addressed by the sha256 of themselves — the same way a drawing
// and an export do — and the row records everything the document was rendered UNDER, so a reader can
// say what it stood on without opening it (L-FMT-03).
//
// Issuing is a CHAIN. Each document is version n of its kind on its project, and the issue it
// replaces names it. Both writes are one transaction: a supersession that survived a rollback would
// leave a project with a document superseded by one that was never issued.
//
// The link a browser carries is the STORAGE seam's own signature, re-addressed at this product's
// download route — the pattern `src/core/exports/store.ts` records, and for the same reason. There is
// no second signer and no second secret (Q-12): what a URL carries is what storage minted, and
// reading one back hands those fields to storage to judge.
import { and, desc, documents, eq, holdStateLock, isUuid, type TenantTx } from "../db";
import { REFUSALS } from "../errors";
import type { DocsRefusalCode } from "../errors/docs";
import type { Storage } from "../storage";
import type { RenderedDocument } from "./contract";

/** The route a person's link points at — this product's door, not the storage seam's own path. */
const DOWNLOAD_ROUTE = "/api/documents";

/** An address as both seams spell it: exactly 64 lowercase hex characters. */
const ADDRESS_SHAPE = /^[0-9a-f]{64}$/u;

/** The origin a relative minted path is parsed against. It travels nowhere and is never answered. */
const PLACEHOLDER_ORIGIN = "https://documents.invalid";

/**
 * The three answers a presented link can earn. The DOCS area registers more codes than these — a
 * kind nobody registered, a payload that will not parse, a renderer that fell over — and none of them
 * is a thing a LINK can be. Narrowing here is what lets the door's status table be total over exactly
 * what this seam answers, so a code can never arrive at a door that has no status for it.
 */
export type DocumentLinkRefusal = Extract<DocsRefusalCode, "DOCUMENT_URL_INVALID" | "DOCUMENT_URL_EXPIRED" | "DOCUMENT_NOT_FOUND">;

/** The codes as the closed register holds them, read from it rather than spelled beside it (Q-07). */
const URL_INVALID: DocumentLinkRefusal = REFUSALS.DOCUMENT_URL_INVALID.code;
const URL_EXPIRED: DocumentLinkRefusal = REFUSALS.DOCUMENT_URL_EXPIRED.code;
const NOT_FOUND: DocumentLinkRefusal = REFUSALS.DOCUMENT_NOT_FOUND.code;

/** What a document is issued under, beside the payload it was rendered from (R-SPINE-040). */
export interface DocumentIssue {
  readonly tenantId: string;
  readonly projectId: string;
  readonly issuedBy: string;
  readonly taxonomyVersion: string;
  readonly actIds: readonly string[];
}

/** A stored document as the writer answers it: enough to link to it and to say which issue it is. */
export interface DocumentRow {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly kind: string;
  readonly version: number;
  readonly sha256: string;
}

/** One document as the project's list states it (R-SPINE-040: kind, version, issued-by, superseded-by). */
export interface DocumentListing {
  readonly id: string;
  readonly kind: string;
  readonly version: number;
  readonly sha256: string;
  readonly issuedBy: string;
  readonly supersededBy: string | null;
}

/** A link as it comes back in, field by field — whatever a caller wrote in the query string. */
export interface PresentedDocumentLink {
  readonly tenantId: string;
  readonly sha256: string;
  readonly expires: string;
  readonly signature: string;
}

/** What a presented link is answered with: the bytes at its address, or the refusal it earned. */
export type SignedDocument = { readonly ok: true; readonly bytes: Uint8Array } | { readonly ok: false; readonly refusal: DocumentLinkRefusal };

/** What this store needs of the world: the caller's transaction, and the artefact store (SEAM-STORAGE). */
export interface DocumentStoreDeps {
  readonly tx: TenantTx;
  readonly storage: Pick<Storage, "put">;
}

/**
 * Stores a rendered document and records the issue (R-SPINE-040).
 *
 * The bytes go to storage first: the address they come back with IS the row's `sha256`, so the row
 * can never name an address nothing was written to. Storage is content-addressed and idempotent, so
 * re-issuing a byte-identical document stores it once and records a new issue of it — which is
 * exactly right, because the issue is a fact about this project and this moment, not about the bytes.
 *
 * The version is derived from what is stored, so the store has to arbitrate it: the state lock is
 * held on this project's kind for the length of the transaction, which is what makes "read the
 * newest, then write the next" true rather than merely usually true. The unique index is the belt —
 * two writers that somehow got past the lock cannot both land version n.
 */
export async function storeDocument(deps: DocumentStoreDeps, rendered: RenderedDocument, issue: DocumentIssue): Promise<DocumentRow> {
  const { tx, storage } = deps;
  const { sha256 } = await storage.put(issue.tenantId, rendered.pdf);

  await holdStateLock(tx, `documents:${issue.projectId}:${rendered.kind}`);
  const [previous] = await tx
    .select({ id: documents.id, version: documents.version })
    .from(documents)
    .where(and(eq(documents.projectId, issue.projectId), eq(documents.kind, rendered.kind)))
    .orderBy(desc(documents.version))
    .limit(1);

  const version = (previous?.version ?? 0) + 1;
  const [written] = await tx
    .insert(documents)
    .values({
      tenantId: issue.tenantId,
      projectId: issue.projectId,
      kind: rendered.kind,
      version,
      sha256,
      payloadDigest: rendered.payloadDigest,
      rendererPin: rendered.rendererPin,
      fontHashes: { ...rendered.fontHashes },
      taxonomyVersion: issue.taxonomyVersion,
      actIds: [...issue.actIds],
      issuedBy: issue.issuedBy,
    })
    .returning({ id: documents.id });

  const id = written?.id ?? "";
  if (id === "") throw new Error("the documents store wrote no row and the database named no id for it");

  // The supersession is part of the SAME act: the issue that replaces one says so, and the one it
  // replaces says so too, or neither does.
  if (previous !== undefined) {
    await tx.update(documents).set({ supersededBy: id }).where(eq(documents.id, previous.id));
  }

  return Object.freeze({ id, tenantId: issue.tenantId, projectId: issue.projectId, kind: rendered.kind, version, sha256 });
}

/**
 * Every document this project has issued, newest first (R-SPINE-040).
 *
 * Every issue, not just the live one: a superseded document is still evidence of what was published,
 * and `supersededBy` is how a reader tells the two apart. The order is by version rather than by
 * clock, because the version is what the chain is built on and two issues can share a timestamp.
 */
export async function listDocuments(tx: TenantTx, projectId: string): Promise<readonly DocumentListing[]> {
  const rows = await tx
    .select({
      id: documents.id,
      kind: documents.kind,
      version: documents.version,
      sha256: documents.sha256,
      issuedBy: documents.issuedBy,
      supersededBy: documents.supersededBy,
    })
    .from(documents)
    .where(eq(documents.projectId, projectId))
    .orderBy(desc(documents.version), desc(documents.id));

  return Object.freeze(rows.map((row) => Object.freeze({ ...row, supersededBy: row.supersededBy ?? null })));
}

/**
 * The document a workspace holds under an id, or null when it holds none.
 *
 * Scoped by tenant as well as by id: the id is a uuid a caller wrote in a URL, and "this workspace
 * has no such document" is the only thing a member of one workspace may learn about another's (Q-12).
 */
export async function documentUnder(tx: TenantTx, tenantId: string, id: string): Promise<DocumentRow | null> {
  if (!isUuid(id)) return null;
  const [row] = await tx
    .select({ id: documents.id, projectId: documents.projectId, kind: documents.kind, version: documents.version, sha256: documents.sha256 })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
    .limit(1);
  return row === undefined ? null : Object.freeze({ ...row, tenantId });
}

/**
 * A signed, expiring download link for a stored document (Q-12).
 *
 * The signature is minted by SEAM-STORAGE and by nothing else: this function asks storage to sign the
 * document's ADDRESS and then writes the fields it minted at this product's own route, naming the
 * document by its row id. A second HMAC here would be a second secret to rotate and a second way for
 * a link to be valid.
 *
 * The id rides outside the signature, which signs the workspace and the address. That is sound
 * because the id is not a capability: the door looks the row up under the workspace the signature
 * DOES cover, and answers a member who names a row that workspace does not hold with "no such
 * document" — so rewriting the id buys a caller nothing it did not already have.
 */
export function documentDownloadUrl(storage: Pick<Storage, "sign">, row: { id: string; tenantId: string; sha256: string }, opts: { expiresInSeconds: number }): string {
  const minted = new URL(storage.sign(row.tenantId, row.sha256, { expiresInSeconds: opts.expiresInSeconds }), PLACEHOLDER_ORIGIN);
  const query = new URLSearchParams({
    tenant: row.tenantId,
    expires: minted.searchParams.get("expires") ?? "",
    signature: minted.searchParams.get("signature") ?? "",
  });
  return `${DOWNLOAD_ROUTE}/${row.id}?${query.toString()}`;
}

/**
 * The bytes a presented link earns, or the one refusal it earns instead (R-SPINE-062).
 *
 * The decision lives here, in core, beside the shard that registers the codes — the door above only
 * gives each an HTTP status. The caller has already found the row, so the address judged here is the
 * one the DATABASE holds and never one a URL claimed.
 */
export async function readSignedDocument(storage: Pick<Storage, "get" | "sign" | "verify">, presented: PresentedDocumentLink): Promise<SignedDocument> {
  const vouched = storage.verify(storageUrlOf(storage, presented));
  if (!vouched.ok) return { ok: false, refusal: vouched.reason === "expired" ? URL_EXPIRED : URL_INVALID };

  const bytes = await storage.get(vouched.tenantId, vouched.sha256);
  // A row naming an address nothing is stored at is a document this workspace cannot produce — an
  // absence, and an absence is an answer rather than a fault (B-21).
  if (bytes === null) return { ok: false, refusal: NOT_FOUND };
  return { ok: true, bytes };
}

/**
 * The presented fields, written back in the storage seam's own spelling so storage can judge them.
 *
 * The seam's path is its own private fact, so it is asked for rather than restated: signing this very
 * address answers the path a URL for it is minted under, and the presented expiry and signature are
 * written over the query. A prefix copied here instead would be a second statement of a thing
 * SEAM-STORAGE already says (B-17).
 */
function storageUrlOf(storage: Pick<Storage, "sign">, presented: PresentedDocumentLink): string {
  // A shape storage itself would refuse is refused before it is signed for: `sign` throws on an
  // address or a tenant it will not touch, and far-side input must never travel as an exception.
  const prefixed = isUuid(presented.tenantId) && presented.tenantId === presented.tenantId.toLowerCase();
  if (!prefixed || !ADDRESS_SHAPE.test(presented.sha256)) return "";
  const path = storage.sign(presented.tenantId, presented.sha256, { expiresInSeconds: 1 }).split("?")[0] ?? "";
  return `${path}?expires=${presented.expires}&signature=${presented.signature}`;
}
