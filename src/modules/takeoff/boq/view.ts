// What S-BOQ is handed, as a value: the campaign the draft was read off, the payload the document
// would be rendered from, and the item numbers derived over it (R-TO-053, I-269).
//
// A view type and nothing else — no reading, no rendering — so the screen's suite mounts the
// workspace over a value and the route's door answers one (B-19, ARCH-01).
import type { BoqDraftPayload } from "@/core/documents/kinds/boq-draft";
import type { GroupDescriptions } from "./description-basis";

/** The two readings a draft states about its own coverage (L-QTY-04, L-QTY-07). */
export type BoqCoverage = "COMPLETE" | "INCOMPLETE";

/**
 * The whole reading one draft screen paints.
 *
 * The payload is the DOCUMENT's payload — the very value `renderDocument("boq-draft", …)` is given —
 * so a figure a reader sees and a figure the PDF prints are one figure (I-271), and `items` is the
 * numbering derived over it by the one function both faces call (I-269). Everything the screen says
 * about an item — its member lines, their marks and the codes a line gave for what it could not
 * measure — is read off that payload too, so the screen never holds a second reading beside the
 * document's (I-528). Nothing here is stored: a register that changes renumbers freely
 * (AM-14 §2).
 */
export type BoqView = {
  /** The pinned campaign, `null` where none is open on this project (R-UI-050's empty cell). */
  readonly campaignId: string | null;
  /** The revision that campaign is pinned to, quoted whole on the screen (I-26). */
  readonly setRevisionId: string | null;
  /** The taxonomy the sections were resolved under, stamped on the screen and on the page (L-BD-08). */
  readonly taxonomyVersion: string;
  readonly coverage: BoqCoverage;
  /** The draft, or `null` where the campaign published no line at all. */
  readonly payload: BoqDraftPayload | null;
  /** item key → `S.G.I`, derived at emission and stored nowhere (AM-14 §2). */
  readonly items: ReadonlyMap<string, string>;
  /**
   * `<class> <kind>` → the description a model proposed for that group, the basis it wears and the
   * call it came from (L-BD-01, L-AI-02, I-298). Empty where nothing was asked or nothing answered;
   * the payload above already reads it, so the screen reads this only to say WHERE a description
   * came from — and the issue reads it to record what it took.
   *
   * Absent where nobody asked: a reading composed without a call context carries no proposal at
   * all, and a screen handed one reads the catalogue's sentences it always read.
   */
  readonly descriptions?: GroupDescriptions;
};
