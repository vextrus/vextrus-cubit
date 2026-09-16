// The evidence instrument's demonstration of this screen (`?__state=`, `src/app/theme-resolver.ts`).
//
// R-UI-050 rules eight cells for S-Schedules and the Decision rules each one cell by cell; a cell
// that can only be reached by a test runner is a cell nobody can review. This file answers, for a
// state asked for by name, the props that put the SCREEN ITSELF in that state — the same workspace,
// the same renderers, the same derivation — rather than a stand-in drawn beside it. Five of the eight
// are reached by the reading the screen is handed and the flags it is handed with it, exactly as the
// product reaches them; only `loading` and `error` are stated outright, because they are facts about
// a read in flight rather than about any sheet.
//
// The reading below is a DEMONSTRATION and says so in its own words: no drawing was read for it. It
// is never composed on the ordinary path — the door is armed by name (`uiInstrumentArmed`) and the
// page asks for this only when an address names a state — so nothing here can reach a reader who did
// not ask for it, and nothing here is a figure any bill could carry (L-CAD-08, I-251).
import { REFUSALS } from "@/core/errors";
import type { SchedulesView, SheetView } from "@/modules/takeoff/schedules-ui/view";
import { SCHEDULES_STATES, type SchedulesState } from "./states";

/** What the route hands the screen to stand it in one declared state. */
export interface Demonstration {
  /** Stated outright only where no reading can express it: `loading` and `error` (R-UI-050). */
  readonly state: string | null;
  readonly view: SchedulesView | null;
  readonly permitted: Readonly<Record<string, boolean>>;
  readonly offline: boolean;
  readonly reportId: string | null;
  /** A registry code the screen answers at its door, as it would answer a rejection (R-UI-020). */
  readonly refusal: string | null;
}

/** The demonstration's own drawing — named as what it is, so no reader mistakes it for a reading. */
const DRAWING_ID = "00000000-0000-4000-8000-00000000d000";
const REVISION_ID = "00000000-0000-4000-8000-00000000d001";
const ACTOR_ID = "00000000-0000-4000-8000-00000000d002";

/** The report id the error cell quotes, in the shape a fault seam mints one. */
const REPORT_ID = "00000000-0000-4000-8000-00000000d003";

/** The code the refused cell demonstrates: this screen's own door, refusing a reading off its sheet. */
const DEMONSTRATED_REFUSAL = REFUSALS.NOTE_SOURCE_NOT_ON_SHEET.code;

/** The code a `__state` nobody declared is answered under — the door read a statement it cannot parse. */
const NOT_A_DECLARED_STATE = REFUSALS.REQUEST_MALFORMED.code;

/** One cell of the demonstrated schedule, at its column, with the text entity it was read off. */
const cell = (columnIndex: number, text: string) => ({ columnIndex, text, sourceKeys: [`demo:t${columnIndex}${text.length}`] });

/** The column schedule the Decision's §1 wireframe stands a table on: a header band and three rows. */
const COLUMN_SCHEDULE = {
  scheduleKey: "demo-column-schedule",
  viewKey: "demo-view-schedule",
  title: "COLUMN SCHEDULE (DEMONSTRATION)",
  header: { rowIndex: 0, cells: [cell(0, "MARK"), cell(1, "SIZE"), cell(2, "MAIN"), cell(3, "TIES")] },
  rows: [
    { rowIndex: 1, cells: [cell(0, "C1"), cell(1, "300x450"), cell(2, "8-20Ø"), cell(3, "10Ø@150 c/c")] },
    { rowIndex: 2, cells: [cell(0, "C2"), cell(1, "300x600"), cell(2, "10-20Ø"), cell(3, "10Ø@125 c/c")] },
    { rowIndex: 3, cells: [cell(0, "C3"), cell(1, "450x450"), cell(2, "12-25Ø"), cell(3, "10Ø@100 c/c")] },
  ],
} as const;

/** The member types those columns named — the mark family, its band, and the zones beneath it. */
const MEMBER_TYPES = [
  {
    family: "C",
    markText: "C1",
    sourceKeys: ["demo:mark-c1"],
    variants: [
      {
        variantKey: "GF-3RD",
        bandText: "GF TO 3RD",
        sectionText: "300x450",
        sourceKeys: ["demo:band-gf-3rd"],
        zones: [
          { zone: "main" as const, text: "8-20Ø", sourceKeys: ["demo:zone-main"] },
          { zone: "ties-end" as const, text: "10Ø@100 c/c", sourceKeys: ["demo:zone-ties-end"] },
          { zone: "ties-mid" as const, text: "10Ø@150 c/c", sourceKeys: ["demo:zone-ties-mid"] },
        ],
      },
    ],
  },
];

/** What the grammar reads off the demonstrated sheet's own words — the offer, at the figure written. */
const PROPOSAL = {
  kind: "LAP" as const,
  sourceKey: "demo:note-lap",
  text: "LAP 50d TENSION / 40d COMPRESSION U.N.O.",
  valueAsWritten: "50d",
  unitAsWritten: "d",
  canonical: "50",
};

/** The notes the demonstrated sheet's own words state, with one reading committed against them. */
const READING = {
  readingKey: "demo-reading-fy",
  drawingId: DRAWING_ID,
  layoutName: "S-01",
  kind: "FY" as const,
  actorId: ACTOR_ID,
  sourceKey: "demo:note-fy",
  valueAsWritten: "500 MPa",
  unitAsWritten: "MPa",
  canonical: "500",
  basis: "TRANSCRIBED",
  acceptance: "ACCEPTED" as const,
  actId: "00000000-0000-4000-8000-00000000d004",
  superseded: false,
};

/** The sheet everything stands on, with the half that is deferred or suspended switched on or off. */
function sheet(held: "whole" | "deferred"): SheetView {
  return {
    drawingId: DRAWING_ID,
    layoutName: held === "whole" ? "S-01" : "S-02",
    schedules: held === "whole" ? [COLUMN_SCHEDULE] : [],
    deferrals: held === "whole" ? [] : [{ viewKey: "demo-view-deferred", reason: "SCHEDULE_VIEW_CONTRIBUTED_NOTHING" }],
    families: MEMBER_TYPES,
    notes: {
      // The whole sheet carries the offer as well as the record, so the act door stands where §1
      // wireframes it; the deferred sheet states no figure at all, which is the silence the notes
      // panel answers with NOTES_NONE_PROPOSED.
      proposals: held === "whole" ? [PROPOSAL] : [],
      readings: [READING],
      standings:
        held === "whole"
          ? [{ kind: "FY" as const, standing: "AGREED" as const, canonical: "500", unitAsWritten: "MPa", code: null }]
          : [
              { kind: "FY" as const, standing: "AGREED" as const, canonical: "500", unitAsWritten: "MPa", code: null },
              { kind: "LAP" as const, standing: "SUSPENDED" as const, canonical: null, unitAsWritten: null, code: "NOTE_READING_CONTESTED" as const },
            ],
    },
  };
}

/** The reading the demonstration stands on, with the sheets a state needs in the rail. */
function reading(projectId: string, sheets: readonly SheetView[]): SchedulesView {
  return { projectId, setRevisionId: REVISION_ID, sheets };
}

/** What every demonstration starts from: a reader who holds the door, online, with nothing refused. */
const OPEN: Omit<Demonstration, "view"> = { state: null, permitted: { MEASURE: true }, offline: false, reportId: null, refusal: null };

/**
 * The props that stand this screen in the state an address asked for — and, for a name the screen
 * never declared, the refusal the product answers an unreadable statement with, so an instrument that
 * did not understand the address says so instead of painting the ordinary read (R-UI-020).
 */
export function demonstrationOf(asked: string, projectId: string): Demonstration {
  const state = SCHEDULES_STATES.find((name): name is SchedulesState => name === asked);
  const whole = reading(projectId, [sheet("whole")]);
  switch (state) {
    case "loading":
      return { ...OPEN, state: "loading", view: null };
    case "error":
      return { ...OPEN, state: "error", view: null, reportId: REPORT_ID };
    case "denied":
      return { ...OPEN, view: whole, permitted: { MEASURE: false } };
    case "offline":
      return { ...OPEN, view: whole, offline: true };
    case "refused":
      return { ...OPEN, view: whole, refusal: DEMONSTRATED_REFUSAL };
    case "empty":
      return { ...OPEN, view: reading(projectId, []) };
    case "partial":
      return { ...OPEN, view: reading(projectId, [sheet("deferred"), sheet("whole")]) };
    case "ready":
      return { ...OPEN, view: whole };
    default:
      return { ...OPEN, view: whole, refusal: NOT_A_DECLARED_STATE };
  }
}
