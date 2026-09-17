// The evidence instrument's demonstration of this screen (`?__state=`, `src/app/theme-resolver.ts`).
//
// R-UI-050 rules the cells for S-BOQ and the Decision §2 rules each one; a cell that can only be
// reached by a test runner is a cell nobody can review. This file answers, for a state asked for by
// name, the props that put the SCREEN ITSELF in that state — the same workspace, the same renderers,
// the same derivation — rather than a stand-in drawn beside it.
//
// The draft it stands on is EMITTED, not transcribed: a demonstration reading goes through
// `boqDraftPayloadOf` and `numberItems`, so the sections, the subtotals and the item numbers a
// reviewer sees are the product's own answers over a reading and never a picture of them (B-17).
import { REFUSALS } from "@/core/errors";
import { boqDraftPayloadOf } from "@/modules/takeoff/boq/emission";
import { numberItems } from "@/modules/takeoff/boq/numbering";
import { BILL_TAXONOMY } from "@/modules/takeoff/boq/taxonomy";
import type { BoqView } from "@/modules/takeoff/boq/view";
import { BOQ_STATES, type BoqState } from "./states";

/** What a demonstration hands the screen: the reading, and the flags the state is derived from. */
export interface Demonstration {
  /** Stated outright only where no reading can express it: `loading` and `error` (R-UI-050). */
  readonly state: string | null;
  readonly view: BoqView | null;
  readonly permitted: boolean;
  readonly offline: boolean;
  readonly reportId: string | null;
  /** A registry code the screen answers at its door, as it would answer a rejection (R-UI-020). */
  readonly refusal: string | null;
}

/** The demonstration's own campaign — named as what it is, so no reader mistakes it for a reading. */
const CAMPAIGN_ID = "00000000-0000-4000-8000-00000000b000";
const REVISION_ID = "00000000-0000-4000-8000-00000000b001";

/** The report id the error cell quotes, in the shape a fault seam mints one. */
const REPORT_ID = "00000000-0000-4000-8000-00000000b002";

/** The code the refused cell demonstrates: this screen's own door, refusing a draft nobody can make. */
const DEMONSTRATED_REFUSAL = REFUSALS.BOQ_NO_PUBLISHED_LINE.code;

/** The code a `__state` nobody declared is answered under — the door read a statement it cannot parse. */
const NOT_A_DECLARED_STATE = REFUSALS.REQUEST_MALFORMED.code;

/** The stack the demonstration's lines stand on: a foundation level under a ground floor. */
const LEVELS = [
  { levelId: "lvl-fdn", ordinal: -1, label: "FDN" },
  { levelId: "lvl-gf", ordinal: 0, label: "GF" },
] as const;

/** One published line of the demonstrated campaign. */
function line(lineId: string, objectKey: string, klass: string, kind: string, levelId: string, value: string | null, coverage: string) {
  return {
    lineId,
    objectKey,
    class: klass as never,
    kind: kind as never,
    levelId,
    value,
    unit: "m3",
    quantityBasis: "MEASURED",
    selectionBasis: "TRANSCRIBED",
    coverage,
  };
}

/** The lines a whole draft is read off, and the two that make one partial (L-QTY-02, L-BD-08). */
const MEASURED = [
  line("l-cap-1", "pile_cap/FDN/P1", "pile_cap", "rcc.concrete", "lvl-fdn", "4.160", "COMPLETE"),
  line("l-cap-2", "pile_cap/FDN/P2", "pile_cap", "rcc.concrete", "lvl-fdn", "4.160", "COMPLETE"),
  line("l-col-1", "column/GF/C1", "column", "rcc.concrete", "lvl-gf", "0.405", "COMPLETE"),
];
const DECLARED = line("l-col-2", "column/GF/C2", "column", "rcc.concrete", "lvl-gf", null, "PARTIAL_DECLARED");

/** The reading the demonstration stands on, emitted through the product's own seam. */
function reading(projectId: string, lines: readonly ReturnType<typeof line>[], coverageComplete: boolean): BoqView {
  if (lines.length === 0) {
    return { campaignId: CAMPAIGN_ID, setRevisionId: REVISION_ID, taxonomyVersion: BILL_TAXONOMY.version, coverage: "INCOMPLETE", payload: null, items: new Map() };
  }
  const payload = boqDraftPayloadOf({
    project: projectId,
    campaignId: CAMPAIGN_ID,
    setRevisionId: REVISION_ID,
    levels: LEVELS,
    lines,
    coverageComplete,
  });
  return {
    campaignId: CAMPAIGN_ID,
    setRevisionId: REVISION_ID,
    taxonomyVersion: payload.taxonomyVersion,
    coverage: payload.coverage === "COMPLETE" ? "COMPLETE" : "INCOMPLETE",
    payload,
    items: numberItems(payload.sections),
  };
}

/** What every demonstration starts from: a reader who holds the door, online, with nothing refused. */
const OPEN: Omit<Demonstration, "view"> = { state: null, permitted: true, offline: false, reportId: null, refusal: null };

/**
 * The props that stand this screen in the state an address asked for — and, for a name the screen
 * never declared, the refusal the product answers an unreadable statement with, so an instrument that
 * did not understand the address says so instead of painting the ordinary read (R-UI-020).
 */
export function demonstrationOf(asked: string, projectId: string): Demonstration {
  const state = BOQ_STATES.find((name): name is BoqState => name === asked);
  const whole = reading(projectId, MEASURED, true);
  switch (state) {
    case "loading":
      return { ...OPEN, state: "loading", view: null };
    case "error":
      return { ...OPEN, state: "error", view: null, reportId: REPORT_ID };
    case "denied":
      return { ...OPEN, view: whole, permitted: false };
    case "offline":
      return { ...OPEN, view: whole, offline: true };
    case "refused":
      return { ...OPEN, view: whole, refusal: DEMONSTRATED_REFUSAL };
    case "empty":
      return { ...OPEN, view: reading(projectId, [], false) };
    case "partial":
      return { ...OPEN, view: reading(projectId, [...MEASURED, DECLARED], false) };
    case "ready":
      return { ...OPEN, view: whole };
    default:
      return { ...OPEN, view: whole, refusal: NOT_A_DECLARED_STATE };
  }
}
