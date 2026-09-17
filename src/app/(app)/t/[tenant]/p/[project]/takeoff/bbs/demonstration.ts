// The evidence instrument's demonstration of this screen (`?__state=`, `src/app/theme-resolver.ts`).
//
// R-UI-050 rules the cells for S-BBS and the Decision §2 rules each one; a cell that can only be
// reached by a test runner is a cell nobody can review. This file answers, for a state asked for by
// name, the props that put the SCREEN ITSELF in that state — the same workspace, the same renderers,
// the same derivation — rather than a stand-in drawn beside it.
//
// The schedule it stands on is a READING, stated here as data: `bbsOf` answers a campaign, and a
// demonstration has none, so the bill below is a small one written out — three bars of two columns,
// one of them lapping — exactly as the draft BOQ's demonstration writes out its published lines. It
// goes through the SAME presenter the screen draws every schedule with, so what a reviewer sees is
// the product's own arrangement of it and never a picture of one (B-17).
import { REFUSALS } from "@/core/errors";
import type { BbsDocument } from "@/modules/takeoff/bbs-ui/view";
import type { BbsView } from "@/modules/takeoff/bbs-ui/view";
import { BBS_STATES, type BbsState } from "@/modules/takeoff/bbs-ui/states";

/** What a demonstration hands the screen: the reading, and the flags the state is derived from. */
export interface Demonstration {
  /** Stated outright only where no reading can express it: `loading` and `error` (R-UI-050). */
  readonly state: string | null;
  readonly view: BbsView | null;
  readonly permitted: boolean;
  readonly offline: boolean;
  readonly reportId: string | null;
  /** A registry code the screen answers at its door, as it would answer a rejection (R-UI-020). */
  readonly refusal: string | null;
}

/** The demonstration's own campaign — named as what it is, so no reader mistakes it for a reading. */
const CAMPAIGN_ID = "00000000-0000-4000-8000-00000000c000";
const REVISION_ID = "00000000-0000-4000-8000-00000000c001";

/** The report id the error cell quotes, in the shape a fault seam mints one. */
const REPORT_ID = "00000000-0000-4000-8000-00000000c002";

/** The code a `__state` nobody declared is answered under — a statement the door cannot parse. */
const NOT_A_DECLARED_STATE = REFUSALS.REQUEST_MALFORMED.code;

/** The code the refused cell demonstrates: a statement this screen's door could not read. */
const DEMONSTRATED_REFUSAL = REFUSALS.REQUEST_MALFORMED.code;

/** One bar of the demonstrated bill, in the shape the one door answers one (L-REG-04). */
function bar(
  mark: string,
  suffix: string,
  role: "MAIN" | "TIE",
  diameterMm: number,
  shape: string,
  dimsMm: Record<string, string>,
  cutting: { raw: string; rounded: string; is: string },
  count: { barsPerUnit: number; bars: string },
  lap: { lapMm: string; lapsPerBar: number },
  mass: { kgPerMetre: string; kgNet: string; kgLap: string; kg: string },
) {
  const objectKey = `column/GF/${mark}`;
  return {
    barKey: `${objectKey}|${role}|${String(diameterMm)}|0`,
    objectKey,
    class: "column" as const,
    level: "GF",
    mark,
    barMark: `${mark}-${suffix}`,
    role,
    diameterMm,
    shape,
    dimsMm,
    cuttingRawMm: cutting.raw,
    cuttingRoundedMm: cutting.rounded,
    cuttingIsAdditiveMm: cutting.is,
    piecesPerBar: 1,
    lapMm: lap.lapMm,
    lapsPerBar: lap.lapsPerBar,
    barsPerUnit: count.barsPerUnit,
    parentCount: "1",
    bars: count.bars,
    kgPerMetre: mass.kgPerMetre,
    kgNet: mass.kgNet,
    kgLap: mass.kgLap,
    kg: mass.kg,
    sourceKeys: ["S-101:e:41"],
    detailingSourceKeys: ["S-01:t:7"],
    editionDigest: "demonstration",
    semantic: "demonstration",
  };
}

/** The bill a whole schedule is read off: two columns, three bars, two of them lapping at 50 × d. */
const BARS = [
  bar(
    "C1",
    "v",
    "MAIN",
    20,
    "00",
    { A: "3450.000" },
    { raw: "3450.000", rounded: "3450", is: "3450.000" },
    { barsPerUnit: 6, bars: "6" },
    { lapMm: "1000", lapsPerBar: 1 },
    { kgPerMetre: "2.466", kgNet: "51.046", kgLap: "14.796", kg: "65.842" },
  ),
  bar(
    "C1",
    "t",
    "TIE",
    8,
    "51",
    { A: "300.000", B: "450.000" },
    { raw: "1638.400", rounded: "1650", is: "1672.000" },
    { barsPerUnit: 42, bars: "42" },
    { lapMm: "0", lapsPerBar: 0 },
    { kgPerMetre: "0.395", kgNet: "27.181", kgLap: "0.000", kg: "27.181" },
  ),
  bar(
    "C2",
    "v",
    "MAIN",
    16,
    "00",
    { A: "3450.000" },
    { raw: "3450.000", rounded: "3450", is: "3450.000" },
    { barsPerUnit: 8, bars: "8" },
    { lapMm: "800", lapsPerBar: 1 },
    { kgPerMetre: "1.578", kgNet: "43.553", kgLap: "10.099", kg: "53.652" },
  ),
];

/** The bill of bars a demonstration stands on, as the one door would answer it. */
const DOCUMENT: BbsDocument = {
  campaignId: CAMPAIGN_ID,
  stockMm: "12000",
  roundingMm: 25,
  rows: BARS,
  perDiameterKg: { "8": "27.181", "16": "53.652", "20": "65.842" },
  perMarkKg: { "C1-v": "65.842", "C1-t": "27.181", "C2-v": "53.652" },
  cuttingStock: {
    "8": { stockBars: 6, pieces: 42, offcutMm: "2700", method: "first-fit-decreasing" },
    "16": { stockBars: 3, pieces: 8, offcutMm: "8400", method: "first-fit-decreasing" },
    "20": { stockBars: 2, pieces: 6, offcutMm: "3300", method: "first-fit-decreasing" },
  },
  grandTotalKg: "146.675",
};

/** The reading the demonstration stands on, whole or with nothing scheduled at all. */
function reading(scheduled: boolean, partial: boolean): BbsView {
  if (!scheduled) return { campaignId: null, setRevisionId: null, document: null, partial: false };
  return { campaignId: CAMPAIGN_ID, setRevisionId: REVISION_ID, document: DOCUMENT, partial };
}

/**
 * The two cells R-UI-050 names differently from this screen's own roster (`src/ui/screen-states`'s
 * `refusal` and `permission-denied` against `refused` and `denied`). A reviewer's instrument asks by
 * the MATRIX's name, so both spellings open the same cell (R-UI-050, AM-09 §4).
 */
const CELL_NAMES: Readonly<Record<string, string>> = Object.freeze({ refusal: "refused", "permission-denied": "denied" });

/** What every demonstration starts from: a reader who holds the door, online, with nothing refused. */
const OPEN: Omit<Demonstration, "view"> = { state: null, permitted: true, offline: false, reportId: null, refusal: null };

/**
 * The props that stand this screen in the state an address asked for — and, for a name the screen
 * never declared, the refusal the product answers an unreadable statement with, so an instrument that
 * did not understand the address says so instead of painting the ordinary read (R-UI-020).
 */
export function demonstrationOf(asked: string): Demonstration {
  const state = BBS_STATES.find((name): name is BbsState => name === (CELL_NAMES[asked] ?? asked));
  const whole = reading(true, false);
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
      return { ...OPEN, view: reading(false, false) };
    case "partial":
      return { ...OPEN, view: reading(true, true) };
    case "ready":
      return { ...OPEN, view: whole };
    default:
      return { ...OPEN, view: whole, refusal: NOT_A_DECLARED_STATE };
  }
}
