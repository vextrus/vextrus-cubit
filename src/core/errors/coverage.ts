// Why a coverage cell stands unmeasured when nobody declared why (s-coverage I-480). L-QTY-05
// keeps NOT_ESTABLISHED as the writerless fall-through CAUSE, and a rail's own report stays EVIDENCE,
// never a cause; these are the reasons the residue reads off the campaign itself where no rail
// reported one — so a certificate never has to say that nothing explains an absence. Each is a fact
// about the campaign, read, never guessed: the campaign was never measured; the drawings show the
// class and nothing placed a member of it; the measure run does not read the kind for the class; or
// it reads the kind and never reached the members standing here.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type CoverageRefusalCode =
  | "COVERAGE_NOT_MEASURED_YET"
  | "COVERAGE_CLASS_NOT_PLACED"
  | "COVERAGE_KIND_NOT_READ"
  | "COVERAGE_MEMBERS_NOT_REACHED"
  | "COVERAGE_MEMBER_UNCLASSED";

/** This area's registered reasons, frozen entry by entry exactly as the one register holds them. */
export const COVERAGE_REFUSALS: RefusalGroup<CoverageRefusalCode> = Object.freeze({
  // The campaign holds no line and no report at all: no measure run has been carried over it.
  COVERAGE_NOT_MEASURED_YET: Object.freeze({
    code: "COVERAGE_NOT_MEASURED_YET",
    message: "This campaign has not been measured yet, so nothing has been published for this cell.",
    remedy: "Measure the campaign from the register, then read each cell for what was published or why it was not.",
    severity: "info",
    surface: "inline",
  }),
  // Every sighting of the class is the drawing's own declaration — a view's caption or a schedule's
  // title names it — and no member of it was placed off a plan, so there was nothing to offer.
  COVERAGE_CLASS_NOT_PLACED: Object.freeze({
    code: "COVERAGE_CLASS_NOT_PLACED",
    message: "The drawings show this class, but no member of it has been placed off a layout plan, so there was nothing to measure.",
    remedy: "Open the sheet that shows it and check what is drawn; the certificate names it as not measured until its members are placed.",
    severity: "warning",
    surface: "inline",
  }),
  // The class's members stand in the register and the campaign was measured, but nothing in it was
  // published or reported for this kind on this class anywhere: no rail reads the pair yet. The two
  // boundary doors stand only over a cell on a storey (I-194), so the remedy promises them only there.
  COVERAGE_KIND_NOT_READ: Object.freeze({
    code: "COVERAGE_KIND_NOT_READ",
    message: "The measure run does not read this kind for this class from the drawings yet, so nothing was offered for it.",
    remedy: "Take it off by hand for now. Where the cell offers them, declare it out of the project scope or hold it out of this bill, so the certificate states the boundary you chose.",
    severity: "warning",
    surface: "inline",
  }),
  // The run reads this kind for this class — other cells of it published or reported — but it said
  // nothing about the members standing here: they were registered after it, it never reached them, or
  // the gate deferred or refused what it offered for them, which the register's region names. The
  // residue does not read the queue or the gate's refusals, so the remedy sends the reader there first.
  COVERAGE_MEMBERS_NOT_REACHED: Object.freeze({
    code: "COVERAGE_MEMBERS_NOT_REACHED",
    message: "The measure run reads this kind for this class, but it published and reported nothing for the members standing here.",
    remedy: "Open the register for these members: a deferral or a refusal there says why. Where none stands, measure the campaign again, so they are read with the rest.",
    severity: "warning",
    surface: "inline",
  }),
  // A member the drawings draw a view of — a water tank, a parapet, a sunshade — that no class of the
  // roster is: the product has nothing to measure it as, and the certificate names it all the same.
  COVERAGE_MEMBER_UNCLASSED: Object.freeze({
    code: "COVERAGE_MEMBER_UNCLASSED",
    message: "The drawings show this member, but no class this product measures is it, so nothing of it is measured.",
    remedy: "Take it off by hand from the sheet that draws it; the certificate names it as not measured.",
    severity: "info",
    surface: "inline",
  }),
});
