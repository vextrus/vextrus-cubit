/**
 * AC-6(b) [debt-src-core-xe0mh7] — the ban's scanner lexes a regex literal as a regex literal.
 *
 * SEAM-GATE's ban is a committed scan rather than a lint rule, so the scan IS the ban: a reach the
 * lexer cannot see is a reach nothing refuses. Its hand-rolled lexer reads `/` as the opening of a
 * comment or as punctuation and reads `'` as the opening of a string wherever it stands — so a file
 * holding `/'/u` swallows the rest of the file into an unterminated string, and every import after it
 * is invisible to the ban. A module can then reach `src/core/gate` under an apostrophe.
 *
 * Judged at the shipped door (`scanGateImports`) over payloads written to a temp checkout, each a
 * two-line file whose SECOND line is the banned reach: the first line is the lexical hazard and the
 * finding owed is the same for all of them. The four hazards are the criterion's own — an apostrophe
 * inside a regex, an apostrophe inside a character class, a division that is not a regex at all, and
 * an escaped slash inside a regex.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { scanGateImports } from "./gate-import-scan";

/** The reach every payload makes, on its second line: an alias import of the banned module. */
const REACH = 'import "@/core/gate";';

/** The layered address a payload is judged at — under a banned root, so a finding is owed. */
const UNDER_BANNED_ROOT = join("src", "modules", "probe.ts");

/** The line the reach stands on in every payload: the hazard is line 1, the import line 2. */
const REACH_LINE = 2;

/** The four first lines the lexer has to get right, each named by what it is. */
const HAZARDS: readonly (readonly [string, string])[] = [
  ["an apostrophe inside a regex literal", "const a = /'/u;"],
  ["an apostrophe inside a regex character class", "const b = /[']/u;"],
  ["a division, which is not a regex literal at all", "const c = 4 / 2;"],
  ["an escaped slash inside a regex literal", "const d = /\\//u;"],
];

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** One payload on disk, at a path whose layered address is under a banned root. */
function payloadAt(source: string): string {
  const root = mkdtempSync(join(tmpdir(), "cubit-gate-lexer-"));
  roots.push(root);
  const file = join(root, UNDER_BANNED_ROOT);
  mkdirSync(join(root, "src", "modules"), { recursive: true });
  writeFileSync(file, `${source}\n${REACH}\n`, "utf8");
  return file;
}

describe("the gate-import scanner sees an import that follows a regex literal", () => {
  test.each(HAZARDS)("AC-6(b): after %s, the reach on the next line is still reported", (_what, hazard) => {
    const file = payloadAt(hazard);
    const found = scanGateImports([file]);
    expect(
      found.map((reach) => reach.line),
      `the ban is the scan: a reach the lexer cannot see past ${JSON.stringify(hazard)} is a reach nothing refuses (SEAM-GATE)`,
    ).toEqual([REACH_LINE]);
    expect(found[0]?.specifier, "and the finding names the specifier that reached the gate").toBe("@/core/gate");
  });

  test("AC-6(b): the hazards themselves are not reaches — only the import after them is", () => {
    // The scan over payloads carrying the hazard ALONE owes nothing: a lexer that recovered by
    // reporting everything would pass the cases above and ban the tree.
    for (const [, hazard] of HAZARDS) {
      const root = mkdtempSync(join(tmpdir(), "cubit-gate-lexer-"));
      roots.push(root);
      mkdirSync(join(root, "src", "modules"), { recursive: true });
      const file = join(root, UNDER_BANNED_ROOT);
      writeFileSync(file, `${hazard}\n`, "utf8");
      expect(scanGateImports([file]), `${JSON.stringify(hazard)} reaches no module, so the ban has nothing to say about it`).toEqual([]);
    }
  });
});
