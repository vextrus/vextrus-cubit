// The one home for reading a fixture's golden takeoff (ARCH-02). AM-01 put two fixtures in the
// tree — F-RCC6, frozen at v1.1, and F-RCC6-BNBC, the M3/M4 yardstick — so the reader takes a
// fixture id, and the default is F-RCC6 so every caller written before there was a choice reads
// exactly what it always read.
//
// It lives here, in the golden lane's own support, rather than inside the column rail's stage: the
// stage reaches live Postgres through the product modules it drives, and a suite that only wants
// to read committed bytes must not be dragged into the database lane by importing it. The rail
// re-exports these, so its callers are unchanged.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

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
};

/** A golden takeoff as its file records it: the fixture it belongs to, its schema and its rows. */
export type GoldenDocument = { fixture: string; schema?: number; provenance?: string; rows: GoldenRow[] };

/** The golden takeoff of `fixtureId` (default F-RCC6). */
export function goldenDocument(fixtureId: string = DEFAULT_GOLDEN_FIXTURE): GoldenDocument {
  const relative = goldenFixturePath(fixtureId);
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, relative), "utf8")) as GoldenDocument;
  expect(Array.isArray(parsed.rows), `${relative} records the rows a competent manual takeoff produced`).toBe(true);
  return parsed;
}

/** Every row of a fixture's golden takeoff (test contract: fixtures/<id>/takeoff.golden.json). */
export function goldenRows(fixtureId: string = DEFAULT_GOLDEN_FIXTURE): GoldenRow[] {
  return goldenDocument(fixtureId).rows;
}
