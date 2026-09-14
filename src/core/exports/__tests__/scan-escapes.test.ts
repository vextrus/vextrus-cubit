/**
 * The ways round R-SPINE-041's ban, and that the scan sees them (AC-2).
 *
 * The committed corpus `tests/lint-fixtures/export-seam/` states the four spellings a person writes
 * by hand — `import … from`, `export … from`, `import(…)` and `require(…)`. A loader wears two more
 * that resolve the very same module: `require.resolve("exceljs")`, which hands the module's path to
 * whatever wants it, and `createRequire(import.meta.url)("exceljs")`, a require built one line
 * earlier. A deep specifier (`exceljs/lib/…`) reaches the library too. Each is staged as a file at a
 * layered address under a scratch root and scanned there, because what the scan judges is the
 * address a file stands at and the corpus is the Verifier's to write.
 */
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanExceljsImports } from "./exceljs-import-scan";

/** A scratch tree with these files in it, each at the layered address its key names. */
function staged(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), "cubit-scan-escapes-"));
  for (const [address, source] of Object.entries(files)) {
    const path = join(root, address);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source, "utf8");
  }
  return root;
}

/** What the scan reported, as the pairs a reader compares: the line, and the specifier it read. */
const reported = (root: string): { line: number; specifier: string }[] =>
  scanExceljsImports(root).map(({ line, specifier }) => ({ line, specifier }));

describe("AC-2: the ban is on reaching the library, by whatever spelling", () => {
  it("reports a loader that resolves the library without importing it", () => {
    const root = staged({
      "src/modules/boq/resolve.ts": [
        'import { createRequire } from "node:module";',
        'const where = require.resolve("exceljs");',
        'const load = createRequire(import.meta.url)("exceljs");',
        "export const reach = [where, load];",
      ].join("\n"),
    });

    expect(reported(root), "a resolver and a require made on the spot are loaders like any other").toEqual([
      { line: 2, specifier: "exceljs" },
      { line: 3, specifier: "exceljs" },
    ]);
  });

  it("reports a deep specifier, which names the library as surely as its own name does", () => {
    const root = staged({ "src/modules/boq/deep.ts": 'import Workbook from "exceljs/lib/doc/workbook";\n' });
    expect(reported(root)).toEqual([{ line: 1, specifier: "exceljs/lib/doc/workbook" }]);
  });

  it("reports none of it for the seam itself, which is where the library lives", () => {
    const root = staged({
      "src/core/exports/loader.ts": ['const where = require.resolve("exceljs");', 'import Workbook from "exceljs/lib/doc/workbook";'].join("\n"),
    });
    expect(reported(root), "the one address the library may be spelled at (R-SPINE-041)").toEqual([]);
  });

  it("reports nothing for a string that merely spells the library", () => {
    const root = staged({
      "src/modules/boq/prose.ts": ['export const LIBRARY = "exceljs";', 'export const note = describeWith("exceljs");'].join("\n"),
    });
    expect(reported(root), "a plain string reaches nothing (Q-17)").toEqual([]);
  });
});
