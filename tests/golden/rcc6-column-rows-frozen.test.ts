// @vitest-environment node
// AM-01 freezes F-RCC6's M2 column proof across the v1.1 repair — "the M2 column rows do not move
// and that must be proved, not asserted". The proof is a diff: the v1.0 golden's COLUMN rows are
// committed verbatim beside this file, and every one of them must still be in the committed golden
// with the same bytes, in the same order, with nothing added and nothing dropped.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const GOLDEN = join(REPO_ROOT, "fixtures", "rcc6", "takeoff.golden.json");
const FROZEN = join(HERE, "rcc6-v10-column-rows.json");

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

  it("moves BEAM and SLAB rows only — no other class changed with them", () => {
    const v10 = new Map(rowsOf(FROZEN).map((row) => [`${row.class}|${row.kind}|${row.level}`, line(row)]));
    const moved = rowsOf(GOLDEN)
      .filter((row) => v10.has(`${row.class}|${row.kind}|${row.level}`) && v10.get(`${row.class}|${row.kind}|${row.level}`) !== line(row))
      .map((row) => row.class);
    expect(moved, "a frozen row moved").toEqual([]);
  });
});
