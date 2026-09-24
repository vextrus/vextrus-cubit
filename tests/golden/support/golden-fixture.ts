// The one home for reading a fixture's golden takeoff (ARCH-02). AM-01 put two fixtures in the
// tree — F-RCC6, frozen at v1.1, and F-RCC6-BNBC, the M3/M4 yardstick — and session 8 a third,
// F-ARCH (`goldenRows("arch")`), the architect's set of F-RCC6-BNBC's building, graded at M4. So the
// reader takes a fixture id, and the default is F-RCC6 so every caller written before there was a
// choice reads exactly what it always read.
//
// It lives here, in the golden lane's own support, rather than inside the column rail's stage: the
// stage reaches live Postgres through the product modules it drives, and a suite that only wants
// to read committed bytes must not be dragged into the database lane by importing it. The rail
// re-exports these, so its callers are unchanged.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// `node:assert` rather than a runner's `expect`, on purpose (session 4, 2026-09-21): the golden path
// reads a golden through this one home too (AM-17's M3 leg, `goldenRows("rcc6-bnbc")`), and a
// vitest `expect` has no runner to bind to inside a Playwright process — the BNBC notes roster
// (tests/takeoff/notes/support/bnbc-notes.ts) made the same choice for the same reason. A reader
// that fails still throws, naming the file, in every lane that opens it.

/** tests/golden/support/ → the checkout. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** The fixture a reader is graded against unless it names another (F-RCC6, AM-01's regression). */
export const DEFAULT_GOLDEN_FIXTURE = "rcc6";

/** Where a fixture keeps its golden takeoff: `fixtures/<id>/takeoff.golden.json`. */
export function goldenFixturePath(fixtureId: string = DEFAULT_GOLDEN_FIXTURE): string {
  return join("fixtures", fixtureId, "takeoff.golden.json");
}

/** F-RCC6's golden takeoff, the path the rail has always named (PREMISES C6). */
export const GOLDEN_FIXTURE = goldenFixturePath();

/**
 * One row of a golden takeoff, in either schema a fixture may be written in.
 *
 * Schema 1 (F-RCC6) is a ledger keyed (class, kind, level) with a quantity, its unit and the
 * formula it came from. Schema 2 (F-RCC6-BNBC) keys the same way — `kind` there reaches beyond
 * RCC_CONCRETE/FORMWORK to REBAR, PILE_LENGTH, PILE_COUNT, EXCAVATION, BLINDING and BRICKWORK —
 * and carries the grade, the bar diameter, the component the quantity is (NET, LAP, EDGE) and the
 * members it came from. The optional fields are exactly the ones schema 1 omits, so one type
 * admits both and a reader that only knows schema 1 still reads a schema-2 row.
 */
export type GoldenRow = {
  class: string;
  kind: string;
  level: string;
  quantity: string;
  unit: string;
  formula?: string;
  grade?: string;
  component?: string;
  diameter_mm?: number;
  members?: readonly string[];
  /** F-ARCH: the room a SURFACE row is measured in (its id in the generator's model). */
  room?: string;
  /** F-ARCH: the opening mark an OPENING row counts (as the plan tags it). */
  mark?: string;
  /** F-ARCH: what the row's threshold rule retained rather than deducted (L-MEA-02), listed. */
  retained?: readonly { id: string; quantity: string }[];
};

/** A golden takeoff as its file records it: the fixture it belongs to, its schema and its rows. */
export type GoldenDocument = { fixture: string; schema?: number; provenance?: string; rows: GoldenRow[] };

/** The golden takeoff of `fixtureId` (default F-RCC6). */
export function goldenDocument(fixtureId: string = DEFAULT_GOLDEN_FIXTURE): GoldenDocument {
  const relative = goldenFixturePath(fixtureId);
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, relative), "utf8")) as GoldenDocument;
  assert.ok(Array.isArray(parsed.rows), `${relative} records the rows a competent manual takeoff produced`);
  return parsed;
}

/** Every row of a fixture's golden takeoff (test contract: fixtures/<id>/takeoff.golden.json). */
export function goldenRows(fixtureId: string = DEFAULT_GOLDEN_FIXTURE): GoldenRow[] {
  return goldenDocument(fixtureId).rows;
}

/* ------------------------------------------------------------ the product's kinds, in the golden's words */

/**
 * How a golden takeoff spells each KIND the product publishes under — the ONE correspondence.
 *
 * The two vocabularies are not one transliteration apart. AC-7 wrote the pair out itself — "kind
 * RCC_CONCRETE ↔ rcc.concrete, FORMWORK ↔ rcc.formwork" — so the concrete kind carries `RCC_` in the
 * golden and the formwork kind does not, and a pile is COUNTED under `piling.bored` (PILE_COUNT) and
 * BORED under `piling.boring` (PILE_LENGTH). The product publishes under the catalogue's kind and the
 * goldens are byte-frozen under AM-01, so the translation is the tests' to carry, and it is carried
 * here once: four suites and the M3 journey leg each spelled their own slice of it until session 7.
 * A suite that wants only its own kinds takes its slice through `goldenKindsOf`, so the key set it
 * iterates is still exactly its own.
 */
export const PRODUCT_TO_GOLDEN_KIND: Readonly<Record<string, string>> = Object.freeze({
  "rcc.concrete": "RCC_CONCRETE",
  "rcc.formwork": "FORMWORK",
  "rcc.rebar": "REBAR",
  "masonry.brickwork": "BRICKWORK",
  "earthwork.excavation": "EXCAVATION",
  "pcc.blinding": "BLINDING",
  "piling.bored": "PILE_COUNT",
  "piling.boring": "PILE_LENGTH",
  // The finish kinds F-ARCH's golden bills (session 8). tests/golden/arch-golden.test.ts refuses an
  // ARCHITECTURAL kind with no spelling that has rows.
  "finish.plaster": "PLASTER",
  "finish.paint": "PAINT",
  // F-ARCH's own finishes (ARCH-2, I-541): the floor finish, the wall's tiled dado and the
  // skirting. F-ARCH's OPENING_COUNT and OPENING_AREA rows have no product kind yet — what an opening
  // is billed as lands with the rail that counts it — and so no spelling here.
  "finish.flooring": "FLOORING",
  "finish.tiling": "WALL_TILE",
  "finish.skirting": "SKIRTING",
});

/**
 * The golden's spelling of one product kind — refused by name where there is none. A kind with no
 * golden spelling has no golden rows, and a band taken against no rows is no band at all: G collapses
 * to zero and "three per cent under, never over" degenerates into "publish nothing here".
 */
export function goldenKindOf(kind: string): string {
  const spelling = PRODUCT_TO_GOLDEN_KIND[kind];
  assert.ok(spelling !== undefined, `the golden spells no product kind ${kind} — a kind with no golden spelling has no yardstick, and an empty row set is not one (L-QTY-06)`);
  return spelling;
}

/** A suite's own slice of the one correspondence: exactly these product kinds, each in the golden's words. */
export function goldenKindsOf(kinds: readonly string[]): Readonly<Record<string, string>> {
  return Object.freeze(Object.fromEntries(kinds.map((kind) => [kind, goldenKindOf(kind)])));
}

/* ------------------------------------------------------------------ the golden's own typography */

/** One cell of a golden takeoff, in the golden's own spelling: `COLUMN × RCC_CONCRETE × GF`. */
export type GoldenCell = { readonly class: string; readonly kind: string; readonly level: string };

/** Every golden row of one fixture standing in one (class, kind, level) cell, over all its components. */
export function goldenCellRows(fixtureId: string, cell: GoldenCell): GoldenRow[] {
  return goldenRows(fixtureId).filter((row) => row.class === cell.class && row.kind === cell.kind && row.level === cell.level);
}

/**
 * HOW FINELY A GOLDEN FIGURE MAY BE COMPARED WITH AT ALL — the printing allowance, in its one home.
 *
 * A golden row is PUBLISHED rounded — `16.828`, never the exact figure the authored model computed —
 * so the takeoff L-QTY-06 names as the yardstick and the string the fixture stores differ by up to
 * half a unit in each row's own last printed place, in whichever direction that row's print rounded.
 * A band is therefore taken against the record plus and minus its own typography: a delta smaller than
 * the transcript's half-unit cannot be told from the transcript's rounding, so it is not
 * over-measurement (the arbitration recorded at tests/takeoff/rails/support/slab-wall-stair-stage.ts's
 * `insideBand`). Anything beyond it still is, and B-07 forbids the other cure — the product's figures
 * are never rounded to the golden's precision to make a band pass.
 *
 * Derived from the golden strings ALONE, never from the product's figures (L-QTY-06: "an input may
 * never be derived from the figure it is compared against"), and accumulated as one half-unit per
 * contributing row, each in THAT row's own last printed place — so a golden republished at more
 * decimals tightens it by itself (B-19). Answered as an exact decimal string, summed in integers of
 * the finest place, so no reader of it is handed a float.
 */
export function printingAllowanceOf(rows: readonly { readonly quantity: string }[]): string {
  if (rows.length === 0) return "0";
  const places = rows.map((row) => {
    const dot = row.quantity.indexOf(".");
    return dot < 0 ? 0 : row.quantity.length - dot - 1;
  });
  // Every half-unit counted in units of the finest place any row prints to, plus one: `16.828`'s
  // half-unit is 5 × 10⁻⁴, and at a scale of four places it is the integer 5.
  const scale = Math.max(...places) + 1;
  const units = places.reduce((sum, printed) => sum + 5n * 10n ** BigInt(scale - printed - 1), 0n);
  const digits = units.toString().padStart(scale + 1, "0");
  return `${digits.slice(0, digits.length - scale)}.${digits.slice(digits.length - scale)}`;
}

/** The printing allowance of one fixture's golden cell: one half-unit per row standing in it. */
export function goldenCellAllowance(fixtureId: string, cell: GoldenCell): string {
  return printingAllowanceOf(goldenCellRows(fixtureId, cell));
}

/* ------------------------------------------------------------------ the bar schedule beside it */

/** Where a fixture keeps its golden bar schedule: `fixtures/<id>/bbs.golden.json` (AM-01). */
export function bbsGoldenPath(fixtureId: string): string {
  return join("fixtures", fixtureId, "bbs.golden.json");
}

/**
 * One bar of a golden schedule, as AM-01 records one: the member it belongs to, the shape and the
 * legs it was detailed as, and the three lengths BS 8666 gives it — the raw cutting length (never
 * rounded), the one rounded surface, and the IS-additive figure recorded beside them and never
 * billed. The masses are the table's: `kg_net`, `kg_lap` and their sum.
 */
export type BbsGoldenRow = {
  member: string;
  class: string;
  level: string;
  mark: string;
  bar_mark: string;
  role: string;
  dia_mm: number;
  shape: string;
  dims_mm: Record<string, string>;
  cutting_raw_mm: string;
  cutting_rounded_mm: string;
  cutting_is_additive_mm: string;
  pieces_per_bar: number;
  lap_mm: string;
  laps_per_bar: number;
  bars_per_unit: number;
  parent_count: string;
  bars: string;
  kg: string;
  kg_net: string;
  kg_lap: string;
};

/** A golden bar schedule as its file records it, with the cutting-stock result beside its rows. */
export type BbsGoldenDocument = {
  fixture: string;
  schema?: number;
  stock_mm: string;
  rounding_mm: number;
  rows: BbsGoldenRow[];
  per_diameter_kg: Record<string, string>;
  per_mark_kg: Record<string, string>;
  cutting_stock: Record<string, { stock_bars_12m: number; pieces: number; offcut_m: string; method: string }>;
  grand_total_kg: string;
};

/** The golden bar schedule of `fixtureId` (test contract: `bbsGoldenDocument`). */
export function bbsGoldenDocument(fixtureId: string): BbsGoldenDocument {
  const relative = bbsGoldenPath(fixtureId);
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, relative), "utf8")) as BbsGoldenDocument;
  assert.ok(Array.isArray(parsed.rows), `${relative} records every bar mark the fixture's own detailing model produced (AM-01)`);
  return parsed;
}
