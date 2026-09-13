// AC-2's acceptance: the seam is the only home of exceljs, and the law that says so is registered.
//
// Three limbs, one per clause of the criterion: the committed scan fires on the corpus and stays
// silent over the real tree; the library is pinned save-exact beside the re-packer it needs; and the
// three EXPORT_* refusals are registered in their own shard and answered by the barrel.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** The checkout this suite judges — the unit lane runs from the repository root. */
const REPO_ROOT = process.cwd();

/** The corpus this increment declares, and the two halves lint-law asks every corpus for. */
const CORPUS = "tests/lint-fixtures/export-seam";

/** What a lint fixture's payload line carries so Q-08's ban on banned constructs is recorded, not broken. */
const RECORDED_REASON = "// RECORDED REASON R-SPINE-041";

/** The scan's surface, structurally — nothing here needs the Builder's module to typecheck. */
type Scan = { scanExceljsImports: (root: string) => { file: string; line: number; text: string }[] };

const scan = async (): Promise<Scan> => (await import("./exceljs-import-scan")) as unknown as Scan;

/**
 * The corpus's own files, found by walking it — never a path list. A committed corpus may lay its
 * payload out flat or under a `src/` tree that gives each file the layered address it is judged at
 * (the way `tests/lint-fixtures/no-gate-outside-worker` does); which of the two this one chooses is
 * the Builder's, and neither changes what the scan owes.
 */
function corpusFiles(directory: string): string[] {
  // white-box: AC-2 — the read is of the CORPUS under `tests/lint-fixtures/export-seam/`, which is
  // the scan's INPUT, not product source: the criterion's subject is what the scan reports over a
  // committed payload, so the payload has to be enumerated to know what it owes. No product source
  // is read anywhere in this file, and nothing is asserted about the scanner's own text.
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const here = join(directory, entry.name);
    if (entry.isDirectory()) return corpusFiles(here);
    return entry.isFile() && here.endsWith(".ts") ? [here] : [];
  });
}

/** A file of the corpus is a payload or a lawful counterpart, by the name lint-law reads it under. */
const isPayload = (file: string): boolean => file.slice(file.lastIndexOf("/") + 1).startsWith("bad");

/** One registered refusal, as R-SPINE-062 spells an entry. */
type Entry = { code: string; message: string; remedy: string; severity: string; surface: string };

/** The copy the interfaces fix for the three codes this seam registers — verbatim. */
const EXPECTED: Readonly<Record<string, Omit<Entry, "code">>> = {
  EXPORT_URL_INVALID: {
    message: "This download link is not one this workspace issued.",
    remedy: "Open the export again to get a fresh link.",
    severity: "error",
    surface: "inline",
  },
  EXPORT_URL_EXPIRED: {
    message: "This download link has expired.",
    remedy: "Open the export again to get a fresh link.",
    severity: "warning",
    surface: "inline",
  },
  EXPORT_NOT_FOUND: {
    message: "No export is stored at this address in this workspace.",
    remedy: "Build the export again before downloading it.",
    severity: "error",
    surface: "inline",
  },
};

describe("AC-2: exceljs lives in the seam and nowhere else", () => {
  it("AC-2: the scan reports every payload line of the corpus and nothing in its lawful counterpart", async () => {
    const { scanExceljsImports } = await scan();

    const findings = scanExceljsImports(join(REPO_ROOT, CORPUS));

    // The expectation is DERIVED from the corpus, never pinned: every line a payload marks with the
    // recorded reason is a line the scan owes a finding for, so a corpus that grows a fifth shape
    // grows this assertion with it.
    const files = corpusFiles(join(REPO_ROOT, CORPUS));
    expect(files.filter(isPayload).length, "the corpus carries a payload the scan is proved on").toBeGreaterThan(0);
    expect(files.filter((file) => !isPayload(file)).length, "and the lawful counterpart lint-law asks every corpus for").toBeGreaterThan(0);

    for (const file of files) {
      // white-box: AC-2 — the same corpus read as above, line by line: the payload's own recorded
      // reasons are what the scan owes a finding for, so the expectation is derived from the input
      // rather than pinned as a list a later shape would have to be added to (B-19).
      const owed = readFileSync(file, "utf8")
        .split("\n")
        .flatMap((text, index) => (isPayload(file) && text.includes(RECORDED_REASON) ? [index + 1] : []));
      if (isPayload(file)) expect(owed.length, `${file} carries the shapes the scan is proved on`).toBeGreaterThan(0);

      const reported = findings.filter((finding) => finding.file.endsWith(file.slice(file.lastIndexOf("/") + 1)));
      expect(
        [...new Set(reported.map((finding) => finding.line))].sort((a, b) => a - b),
        isPayload(file)
          ? `every line of ${file} that names exceljs is reported — static import, re-export, dynamic import and require`
          : `${file} reaches the seam, not the library, so the scan reports nothing in it`,
      ).toEqual(owed);
      for (const finding of reported) {
        expect(finding.text, "a finding quotes the line it fired on").toContain("exceljs");
      }
    }
  });

  it("AC-2: the scan reports nothing over the real src/ tree", async () => {
    const { scanExceljsImports } = await scan();
    expect(
      scanExceljsImports(join(REPO_ROOT, "src")),
      "outside src/core/exports/** the tree names @/core/exports, never exceljs (R-SPINE-041)",
    ).toEqual([]);
  });

  it("AC-2: the corpus is claimed by the scan that proves it, in lint-law's own register", () => {
    // white-box: AC-2 — the claim IS a property of another file's text: that `tests/toolchain/
    // lint-law.test.ts` names this corpus and the prover it is excused by. Nothing at runtime
    // distinguishes a registered corpus from an unregistered one; only the reference is read here,
    // and whether the scan fires is asserted above, where the criterion places it.
    const lintLaw = readFileSync(join(REPO_ROOT, "tests/toolchain/lint-law.test.ts"), "utf8");
    expect(
      lintLaw,
      "SCAN_CORPORA names export-seam and the prover that fires on it, or lint-law judges the corpus to prove nothing",
    ).toContain('"export-seam": "src/core/exports/__tests__/exceljs-import-scan.test.ts"');
  });

  it("AC-2: exceljs and the re-packer it needs are pinned save-exact (AM-08)", () => {
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
    const dependencies = manifest.dependencies ?? {};
    expect(dependencies["exceljs"], "exceljs is bound exactly, with no caret").toBe("4.4.0");
    expect(dependencies["jszip"], "the re-pack the determinism needs is bound exactly too").toBe("3.10.2");
  });

  it("AC-2: the three EXPORT_* refusals are registered in their own shard and answered by the barrel", async () => {
    const shard = (await import("@/core/errors/exports")) as unknown as { EXPORTS_REFUSALS: Record<string, Entry> };
    const barrel = (await import("@/core/errors")) as unknown as { refusalOf: (code: string) => Entry };

    expect(
      Object.keys(shard.EXPORTS_REFUSALS).sort(),
      "the exports shard registers exactly the three codes this seam can answer with (AM-11)",
    ).toEqual(Object.keys(EXPECTED).sort());

    for (const [code, copy] of Object.entries(EXPECTED)) {
      expect(shard.EXPORTS_REFUSALS[code], `${code} is registered whole`).toMatchObject({ code, ...copy });
      // The barrel enumerates the shard rather than re-declaring it, so the same entry answers there.
      expect(barrel.refusalOf(code), `${code} is answered by name from @/core/errors (R-SPINE-062, Q-07)`).toMatchObject({ code, ...copy });
    }
  });
});
