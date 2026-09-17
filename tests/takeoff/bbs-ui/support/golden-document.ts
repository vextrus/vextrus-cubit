/**
 * The F-RCC6-BNBC bar schedule, as the door would answer it — the one input the presenter is graded
 * over (AM-01, the increment's test contract: `goldenBbsDocument()`).
 *
 * The rows are the fixture's own golden rows, read through the golden lane's published support
 * (`bbsGoldenDocument`) and renamed field for field into the shape `bbsOf` answers. NOTHING here
 * computes: no length is re-rounded, no mass is re-summed, no total is re-derived — a helper that
 * reckoned a figure would be grading the presenter against a second implementation rather than
 * against the fixture's own independent model (B-17, B-19).
 *
 * The types are the SPEC'S, not the product's (the pattern tests/docs/support/seam.ts records): a
 * suite that imported the product's own types would agree with whatever the product declared.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { bbsGoldenDocument, type BbsGoldenDocument, type BbsGoldenRow } from "../../../golden/support/golden-fixture";

/** The checkout this suite runs in — tests/takeoff/bbs-ui/support/ is four levels under it. */
const REPO_ROOT: string = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/** The fixture whose detailing model is the yardstick for every figure asserted here (AM-01). */
export const BBS_FIXTURE = "rcc6-bnbc";

/** One stored bar row, as `bbsOf`'s document carries it (interfaces: `BbsDocument.rows`). */
export type BarRowShape = {
  readonly barKey: string;
  readonly objectKey: string;
  readonly class: string;
  readonly level: string | null;
  readonly mark: string;
  readonly barMark: string;
  readonly role: string;
  readonly diameterMm: number;
  readonly shape: string;
  readonly dimsMm: Readonly<Record<string, string>>;
  readonly cuttingRawMm: string;
  readonly cuttingRoundedMm: string;
  readonly cuttingIsAdditiveMm: string;
  readonly piecesPerBar: number;
  readonly lapMm: string;
  readonly lapsPerBar: number;
  readonly barsPerUnit: number;
  readonly parentCount: string;
  readonly bars: string;
  readonly kgNet: string;
  readonly kgLap: string;
  readonly kg: string;
};

/** The campaign's bill of bars, as the one door answers it (interfaces: `BbsDocument`). */
export type BbsDocumentShape = {
  readonly campaignId: string;
  readonly stockMm: string;
  readonly roundingMm: number;
  readonly rows: readonly BarRowShape[];
  readonly perDiameterKg: Readonly<Record<string, string>>;
  readonly perMarkKg: Readonly<Record<string, string>>;
  readonly cuttingStock: Readonly<Record<string, { stockBars: number; pieces: number; offcutMm: string; method: string }>>;
  readonly grandTotalKg: string;
};

/** One row of the grid the workspace draws (interfaces: `BbsGridRow`). */
export type BbsGridRowShape = {
  readonly key: string;
  readonly objectKey: string;
  readonly mark: string;
  readonly class: string;
  readonly level: string | null;
  readonly component: "NET" | "LAP";
  readonly barKey: string;
  readonly barMark: string;
  readonly role: string;
  readonly diameterMm: number;
  readonly shape: string;
  readonly dimsMm: Readonly<Record<string, string>>;
  readonly cuttingRawMm: string;
  readonly cuttingRoundedMm: string;
  readonly cuttingIsAdditiveMm: string;
  readonly piecesPerBar: number;
  readonly bars: string;
  readonly lapMm: string;
  readonly lapsPerBar: number;
  readonly kg: string;
};

/** The cutting-stock summary beneath the grid (interfaces: `BbsSummary`). */
export type BbsSummaryShape = {
  readonly rows: readonly { readonly diameterMm: number; readonly kg: string; readonly stockBars: number; readonly pieces: number; readonly offcutMm: string }[];
  readonly grandTotalKg: string;
  readonly stockMm: string;
  readonly roundingMm: number;
};

/** What the presenter publishes (src/modules/takeoff/bbs-ui/present.ts). */
export type PresentModule = {
  bbsRowsOf(document: BbsDocumentShape): readonly BbsGridRowShape[];
  bbsSummaryOf(document: BbsDocumentShape): BbsSummaryShape;
};

/** What the screen derives its `data-state` through (src/modules/takeoff/bbs-ui/states.ts). */
export type StatesModule = {
  BBS_STATES: readonly string[];
  bbsStateOf(standing: BbsStandingShape): string;
};

/** What a state is derived from (interfaces: `BbsStanding`). */
export type BbsStandingShape = {
  readonly view: BbsViewShape | null;
  readonly permitted?: boolean;
  readonly offline?: boolean;
  readonly refused?: string | null;
  readonly state?: string | null;
};

/** What the server reads for the screen (interfaces: `BbsView`). */
export type BbsViewShape = {
  readonly campaignId: string | null;
  readonly setRevisionId: string | null;
  readonly document: BbsDocumentShape | null;
  readonly partial: boolean;
};

/** The one address this screen answers at (src/app/.../takeoff/bbs/route-address.ts). */
export type RouteAddressModule = { bbsRoute(tenantId: string, projectId: string): string };

/**
 * A product module by repo-relative path, asserted to EXIST first: a module the increment has not
 * written yet fails the case that needed it, naming the file, instead of killing the whole suite at
 * collection with one red for four criteria.
 */
export async function productModule<T>(relative: string): Promise<T> {
  const absolute = resolve(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is not in the tree yet — the bar schedule's view does not provide it`).toBe(true);
  return (await import(absolute)) as T;
}

export const presentModule = (): Promise<PresentModule> => productModule<PresentModule>("src/modules/takeoff/bbs-ui/present.ts");
export const statesModule = (): Promise<StatesModule> => productModule<StatesModule>("src/modules/takeoff/bbs-ui/states.ts");
export const routeAddressModule = (): Promise<RouteAddressModule> =>
  productModule<RouteAddressModule>("src/app/(app)/t/[tenant]/p/[project]/takeoff/bbs/route-address.ts");

/**
 * The golden schedule as a `BbsDocument`: every row renamed field for field, the totals and the
 * cutting-stock result copied across, and the content-derived bar key spelled as L-REG-04 spells one
 * (`<member>|<role>|<diameter>|<index>`).
 */
export function goldenBbsDocument(fixtureId: string = BBS_FIXTURE): BbsDocumentShape {
  const golden: BbsGoldenDocument = bbsGoldenDocument(fixtureId);
  return {
    campaignId: `golden-${fixtureId}`,
    stockMm: golden.stock_mm,
    roundingMm: golden.rounding_mm,
    rows: golden.rows.map((row: BbsGoldenRow, index: number) => ({
      barKey: `${row.member}|${row.role}|${row.dia_mm}|${index}`,
      objectKey: row.member,
      class: row.class,
      level: row.level,
      mark: row.mark,
      barMark: row.bar_mark,
      role: row.role,
      diameterMm: row.dia_mm,
      shape: row.shape,
      dimsMm: row.dims_mm,
      cuttingRawMm: row.cutting_raw_mm,
      cuttingRoundedMm: row.cutting_rounded_mm,
      cuttingIsAdditiveMm: row.cutting_is_additive_mm,
      piecesPerBar: row.pieces_per_bar,
      lapMm: row.lap_mm,
      lapsPerBar: row.laps_per_bar,
      barsPerUnit: row.bars_per_unit,
      parentCount: row.parent_count,
      bars: row.bars,
      kgNet: row.kg_net,
      kgLap: row.kg_lap,
      kg: row.kg,
    })),
    perDiameterKg: golden.per_diameter_kg,
    perMarkKg: golden.per_mark_kg,
    cuttingStock: Object.fromEntries(
      Object.entries(golden.cutting_stock).map(([diameter, answer]) => [
        diameter,
        { stockBars: answer.stock_bars_12m, pieces: answer.pieces, offcutMm: millimetresOf(answer.offcut_m), method: answer.method },
      ]),
    ),
    grandTotalKg: golden.grand_total_kg,
  };
}

/**
 * The offcut in millimetres, as the file records it in metres — a unit change on a decimal STRING,
 * made by moving the point rather than by multiplying, so no float ever touches a stored figure
 * (B-07). `"155.525"` is `"155525"`; `"9.3"` is `"9300"`.
 */
function millimetresOf(metres: string): string {
  const negative = metres.startsWith("-");
  const digits = negative ? metres.slice(1) : metres;
  const [whole = "0", fraction = ""] = digits.split(".");
  const padded = `${fraction}000`.slice(0, 3);
  const shifted = `${whole}${padded}`.replace(/^0+(?=\d)/u, "");
  return `${negative && shifted !== "0" ? "-" : ""}${shifted}`;
}
