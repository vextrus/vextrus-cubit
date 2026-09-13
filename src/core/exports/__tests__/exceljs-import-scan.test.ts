/**
 * AC-2 — the spreadsheet library has ONE home, and the tree says so (the ban, as a committed scan).
 *
 * "Excel (.xlsx) and CSV exports through one export seam" (R-SPINE-041): every consumer asks
 * `@/core/exports` for an artefact, so `exceljs` is named under `src/**` by `src/core/exports/**` and
 * by nothing else. A second caller of the library would be a second answer to how a workbook is
 * formatted, escaped and made deterministic.
 *
 * `scripts/eslint/**` and `eslint.config.mjs` are locked outside a toolchain tag, so the ban is this
 * committed test over the shipped scanner rather than an ESLint rule — the mechanism L-CAD-06's
 * view-type spellings, L-FRM-06's conversion factors and SEAM-GATE's import ban are already banned by
 * (B-17: one way of banning a spelling, not four).
 *
 * This is the test the declared corpus `tests/lint-fixtures/export-seam` is excused by in
 * `tests/toolchain/lint-law.test.ts` (ARCH-01, Q-07). The corpus declares its own answer and this
 * prover holds no copy of the import grammar: a payload's basename says whether the scan owes findings
 * at it (`bad.*`) or must be silent over it (`good.*`), and the recorded reason Q-08 asks a payload's
 * banned line to carry says at which lines. A scanner that over-reports an unmarked line and one that
 * misses a marked one both fail — which is the whole use of a corpus (B-19).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { scanExceljsImports } from "./exceljs-import-scan";

/** The repo root — this file sits at `src/core/exports/__tests__/`. */
const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");

/** The layered tree the ban governs, and the declared corpus it is proved on (AC-2). */
const SOURCE_ROOT = join(REPO_ROOT, "src");
const CORPUS = "tests/lint-fixtures/export-seam";

/**
 * How a corpus payload declares its own status: the basename says whether the payload is one the scan
 * owes findings at (`bad.*`) or one it must be silent over (`good.*`), and a line is owed when its
 * CODE names the library as a module specifier — `from "exceljs"`, a bare `import "exceljs"`,
 * `import("exceljs")` or `require("exceljs")`. The recorded reason Q-08 asks a banned line to carry
 * plays no part in the expectation: the corpus crosses the two (a marker with no import beside it, an
 * import under no marker), so a scanner that merely greps for the marker answers a different set than
 * this one, and the prover would be asking the marker rather than the grammar (B-19).
 */
const BAD_PAYLOAD = "bad.";
const SPECIFIER = /(?:\bfrom\s*|\b(?:import|require)\s*\(?\s*)(["'])exceljs\1/u;

/** The code half of a source line — a mention inside a comment is not code (Q-17). */
const codeOf = (text: string): string => text.split("//")[0] ?? "";

/** The corpus's files, found by walking it — a payload list would go stale as the corpus grows. */
function corpusFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const here = join(directory, entry.name);
    if (entry.isDirectory()) return corpusFiles(here);
    return entry.isFile() && here.endsWith(".ts") ? [here] : [];
  });
}

const basenameOf = (file: string): string => file.slice(file.lastIndexOf("/") + 1);

describe("R-SPINE-041: exceljs is named by the export seam and by nothing else", () => {
  const files = corpusFiles(join(REPO_ROOT, CORPUS));
  const findings = scanExceljsImports(join(REPO_ROOT, CORPUS));

  test("AC-2: the corpus carries a payload to fire on and a lawful counterpart to stay silent over", () => {
    expect(files.map(basenameOf).sort(), `${CORPUS} is the corpus this scan is proved on`).toContain("bad.ts");
    expect(files.map(basenameOf).sort()).toContain("good.ts");
  });

  test.each(["bad.ts", "good.ts"])("AC-2: the scan reports exactly the declared lines of %s", (basename) => {
    const file = files.find((candidate) => basenameOf(candidate) === basename) as string;
    // white-box: AC-2 — the corpus is the scan's INPUT, and what a payload DECLARES is owed is read
    // off its own text. No product source is read here, and nothing is asserted about the scanner.
    const owed = readFileSync(file, "utf8")
      .split("\n")
      .flatMap((text, index) => (SPECIFIER.test(codeOf(text)) ? [index + 1] : []));
    if (basename.startsWith(BAD_PAYLOAD)) expect(owed.length, `${basename} declares the shapes the scan is proved on`).toBeGreaterThan(0);

    const reported = findings.filter((finding) => basenameOf(finding.file) === basename);
    expect(
      reported.map((finding) => finding.line).sort((a, b) => a - b),
      basename.startsWith(BAD_PAYLOAD)
        ? "every line that reaches the library is reported — static import, re-export, dynamic import and require"
        : "a file that reaches the seam rather than the library is reported nowhere, prose naming the library included",
    ).toEqual(owed);
    for (const finding of reported) expect(finding.text, "a finding quotes the line it fired on").toContain("exceljs");
  });

  test("AC-2: the scan is silent over the real tree, the seam included", () => {
    expect(
      scanExceljsImports(SOURCE_ROOT),
      "outside src/core/exports/** the tree names @/core/exports, and the seam itself is the one lawful caller",
    ).toEqual([]);
  });
});
