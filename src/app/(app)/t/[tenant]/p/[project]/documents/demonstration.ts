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
// issue: `loading` is not answered, because it is the route's own leg (`loading.tsx`) rather than
// anything a reading can express.
import type { DocumentListing } from "@/core/documents/store";
import { DOCUMENTS_STATES } from "./states";

/** What the route hands the screen to stand it in one declared state. */
export interface Demonstration {
  /** The listings the screen draws, or the empty roster the teaching state stands on. */
  readonly listings: readonly DocumentListing[];
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
 * The demonstration a named state asks for, or null where the name is not one this screen declares.
 *
 * A name the screen never declared is read as no instruction at all and the ordinary read answers
 * the address — this screen registers no code of its own and has no refusal surface to state one on
 * (Decision §2), so inventing a fault for a mistyped query would be the screen lying about a read
 * that never happened.
 */
export function demonstrationOf(asked: string): Demonstration | null {
  if (!(DOCUMENTS_STATES as readonly string[]).includes(asked)) return null;
  if (asked === "ready") return { listings: ISSUES, reportId: null };
  if (asked === "empty") return { listings: [], reportId: null };
  if (asked === "error") return { listings: [], reportId: REPORT_ID };
  // `loading` is `loading.tsx`'s own leg, held by the route while the read is in flight: no reading
  // stands the screen in it, so none is offered here.
  return null;
}
