// @vitest-environment node
// AM-01 freezes F-RCC6's M2 column proof across the v1.1 repair — "the M2 column rows do not move
// and that must be proved, not asserted". The proof is a diff: the v1.0 golden's COLUMN rows are
// committed verbatim beside this file, and every one of them must still be in the committed golden
// with the same bytes, in the same order, with nothing added and nothing dropped. The v1.0 FOOTING,
// PILE_CAP and TIE_BEAM rows are committed beside them, because "BEAM and SLAB moved and nothing
// else" is a claim about those three classes as much as about COLUMN.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const GOLDEN = join(REPO_ROOT, "fixtures", "rcc6", "takeoff.golden.json");
const FROZEN = join(HERE, "rcc6-v10-column-rows.json");
/** The other three classes v1.1 may not move — the ones the third test below names. */
const FROZEN_FOUNDATION = join(HERE, "rcc6-v10-foundation-rows.json");
const FOUNDATION_CLASSES = ["FOOTING", "PILE_CAP", "TIE_BEAM"];

type Row = { class: string; kind: string; level: string; quantity: string; unit: string; formula: string };

function rowsOf(path: string): Row[] {
  return (JSON.parse(readFileSync(path, "utf8")) as { rows: Row[] }).rows;
}

/** A row as one line of text, so a diff names the field that moved rather than "objects differ". */
function line(row: Row): string {
  return `${row.class} ${row.kind} ${row.level} = ${row.quantity} ${row.unit} [${row.formula}]`;
}

describe("F-RCC6 v1.1: the COLUMN rows the repair may not move (AM-01)", () => {
  it("carries the v1.0 COLUMN rows byte for byte, in order", () => {
    const frozen = rowsOf(FROZEN).map(line);
    const now = rowsOf(GOLDEN).filter((row) => row.class === "COLUMN").map(line);
    expect(frozen.length, "the frozen v1.0 COLUMN rows are missing").toBeGreaterThan(0);
    expect(now, "v1.1 moved a COLUMN row — AM-01 freezes the M2 column proof").toEqual(frozen);
  });

  it("keeps the seven storeys of column concrete M2 proved: GF–5F 16.740 m³ and ROOF 2.304 m³", () => {
    const concrete = new Map(
      rowsOf(GOLDEN)
        .filter((row) => row.class === "COLUMN" && row.kind === "RCC_CONCRETE")
        .map((row) => [row.level, row.quantity] as const),
    );
    expect([...concrete.keys()]).toEqual(["GF", "1F", "2F", "3F", "4F", "5F", "ROOF"]);
    for (const level of ["GF", "1F", "2F", "3F", "4F", "5F"]) expect(concrete.get(level), level).toBe("16.740");
    expect(concrete.get("ROOF")).toBe("2.304");
  });

  it("moves BEAM and SLAB rows only — FOOTING, PILE_CAP and TIE_BEAM are the v1.0 bytes too", () => {
    // P4a: this test named three classes and diffed against a map whose 14 rows were all COLUMN, so
    // it could not fail for any of them. The v1.0 foundation rows are frozen beside it now.
    const key = (row: Row) => `${row.class}|${row.kind}|${row.level}`;
    const frozen = [...rowsOf(FROZEN), ...rowsOf(FROZEN_FOUNDATION)];
    const classes = [...new Set(frozen.map((row) => row.class))].sort();
    expect(classes, "the frozen map does not cover the classes this test names").toEqual(
      ["COLUMN", ...FOUNDATION_CLASSES].sort(),
    );
    const now = new Map(rowsOf(GOLDEN).map((row) => [key(row), line(row)]));
    const dropped = frozen.filter((row) => !now.has(key(row))).map((row) => key(row));
    expect(dropped, "a frozen row is no longer in the golden").toEqual([]);
    const moved = frozen.filter((row) => now.get(key(row)) !== line(row)).map((row) => `${now.get(key(row))} != ${line(row)}`);
    expect(moved, "a frozen row moved").toEqual([]);
    const carried = new Set(rowsOf(GOLDEN).filter((row) => FOUNDATION_CLASSES.includes(row.class)).map(key));
    expect(
      [...carried].filter((entry) => !frozen.some((row) => key(row) === entry)),
      "the golden carries a foundation row the frozen map does not pin",
    ).toEqual([]);
  });
});
