// The evidence instrument's demonstration of this screen (`?__state=`, `src/app/theme-resolver.ts`).
//
// R-UI-050 rules this screen's cells and the Decision rules each one; a cell only a test runner can
// reach is a cell nobody can review. Issuing a document is out of scope here by name — no act door,
// no render — so until the BOQ and BBS kinds land, the only state a reader could reach on a served
// project is `empty`, and the grid, its chips and its links could be seen nowhere at all.
//
// This file answers, for a state asked for by name, the LISTINGS that put the screen in that state:
// the same screen, the same renderers, the same derivation the ordinary read drives. The rows are a
// demonstration and are addressed as one — the ids below name nothing this workspace holds, so the
// link each row mints is refused at the download door like any link to a document that is not there.
//
// The door is armed by name (`uiInstrumentArmed`) and asked only where an address names a state, so
// nothing here can reach a reader who did not ask for it, and no figure here can be mistaken for an
// issue. `loading` is the route's own leg (`loading.tsx`) and is answered by standing the reader in
// that very leg, so the waiting cell is as reachable as its six neighbours.
//
// The links are minted here rather than by the page, and they are minted WITHOUT the installation's
// signing secret: an installation that signs no download URLs (Q-12, `withoutSigning`) refuses to
// sign by name, and a demonstration that asked it to would take the whole screen down instead of
// showing a cell. What is minted instead is a link of the seam's own shape whose signature is no
// signature at all — so the row carries a link the reader can see and follow, and the download door
// refuses it exactly as it refuses any link it did not sign.
import { documentDownloadUrl, type DocumentListing } from "@/core/documents/store";
import type { Storage } from "@/core/storage";
import type { DocumentsRowView } from "./documents-screen";
import { DOCUMENT_LINK_TTL_SECONDS } from "./links";
import { DOCUMENTS_STATES } from "./states";

/** What the route hands the screen to stand it in one declared state. */
export interface Demonstration {
  /** The route's own waiting leg, asked for by name: `loading.tsx` is what stands in it. */
  readonly loading: boolean;
  /** The rows the screen draws, or the empty roster the teaching state stands on. */
  readonly rows: readonly DocumentsRowView[];
  /** The fault the error cell quotes, in the shape the fault seam mints one. */
  readonly reportId: string | null;
}

/** The demonstration's own ids — named as what they are, so no reader mistakes them for an issue. */
const NEWEST_ID = "00000000-0000-4000-8000-00000000d001";
const SUPERSEDED_ID = "00000000-0000-4000-8000-00000000d002";
const ISSUER_ID = "00000000-0000-4000-8000-00000000d003";
const ACT_ID = "00000000-0000-4000-8000-00000000d004";
const REPORT_ID = "00000000-0000-4000-8000-00000000d005";

/** The kind SEAM-DOC issues today, and the one this screen authors words for (I-260). */
const KIND = "proof";

/** An address of the shape the store records: 64 lowercase hex, distinguishable from its neighbour. */
const digestOf = (of: string): string => of.repeat(64).slice(0, 64);

/** The two issues the ready state stands on: version 2, and the version 1 it superseded. */
const ISSUES: readonly DocumentListing[] = Object.freeze([
  Object.freeze({
    id: NEWEST_ID,
    kind: KIND,
    version: 2,
    sha256: digestOf("c"),
    issuedBy: ISSUER_ID,
    actIds: Object.freeze([ACT_ID]),
    supersededBy: null,
  }),
  Object.freeze({
    id: SUPERSEDED_ID,
    kind: KIND,
    version: 1,
    sha256: digestOf("d"),
    issuedBy: ISSUER_ID,
    actIds: Object.freeze([ACT_ID]),
    supersededBy: NEWEST_ID,
  }),
]);

/**
 * A signer for demonstration rows alone: the seam's URL shape, over an expiry it really carries and
 * a signature that is plainly none.
 *
 * SEAM-STORAGE is the only minter of a signature (Q-12) and this mints none — it fills the field
 * with zeros, a value no HMAC of any secret over these ids produces, so the link is refused at the
 * download door by the same check that refuses a forged one. It exists because `appStorage()` on an
 * installation that states no secret refuses to sign at all, and a demonstration is not a reason to
 * make an installation signable.
 */
const UNSIGNED = "0".repeat(64);
const demonstrationSigner: Pick<Storage, "sign"> = {
  sign: (tenantId, sha256, options) =>
    `/storage/v1/${tenantId}/${sha256}?expires=${Math.floor(Date.now() / 1000) + options.expiresInSeconds}&signature=${UNSIGNED}`,
};

/** A demonstration listing as the screen takes it: the row, and the link minted for it (B-17). */
const linked = (listing: DocumentListing, tenantId: string): DocumentsRowView => ({
  ...listing,
  href: documentDownloadUrl(demonstrationSigner, { id: listing.id, tenantId, sha256: listing.sha256 }, { expiresInSeconds: DOCUMENT_LINK_TTL_SECONDS }),
});

/**
 * The demonstration a named state asks for, or null where the name is not one this screen declares.
 *
 * A name the screen never declared is read as no instruction at all and the ordinary read answers
 * the address — this screen registers no code of its own and has no refusal surface to state one on
 * (Decision §2), so inventing a fault for a mistyped query would be the screen lying about a read
 * that never happened.
 */
export function demonstrationOf(asked: string, tenantId: string): Demonstration | null {
  if (!(DOCUMENTS_STATES as readonly string[]).includes(asked)) return null;
  const standing = { loading: false, rows: [] as readonly DocumentsRowView[], reportId: null as string | null };
  if (asked === "ready") return { ...standing, rows: ISSUES.map((issue) => linked(issue, tenantId)) };
  if (asked === "error") return { ...standing, reportId: REPORT_ID };
  // `loading` is `loading.tsx`'s own leg, held by the route while the read is in flight. The route
  // stands the reader in that leg itself rather than imitating it, so what a reader asking for it
  // sees is the very file the waiting render uses.
  if (asked === "loading") return { ...standing, loading: true };
  // `empty`, the fourth and last name `DOCUMENTS_STATES` holds: no rows, no fault, no waiting.
  return standing;
}
