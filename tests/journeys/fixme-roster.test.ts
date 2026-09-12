/**
 * EVERY `test.fixme` IN THE JOURNEY LANE, AND THE DEFECT IT NAMES.
 *
 * A fixme is lawful: an assertion a node cannot honestly make today is better declared, collected
 * and impossible to forget than deleted. What makes it lawful is that somebody WILL notice it is
 * still there. Until 2026-09-12 nothing did for the lane at large: `j-000-roster.test.ts` reads the
 * Bible's J-000 segments and governs that journey's legs only, and `hotfix-j000/
 * ac3-journeys-not-weakened.test.ts` walks a fixed path list — so the stub added to
 * `j-011-viewer.spec.ts` on this branch (the pulse, R-UI-022) passed both suites unremarked.
 *
 * So: every `test.fixme` under `tests/e2e` is listed here with the defect it is waiting on, in one
 * line, and the roster is asserted from BOTH sides — an unlisted fixme fails, an unnamed one fails,
 * and an entry whose fixme has been restored fails too, because a licence nobody needs is dead wood
 * (B-19). Restoring a leg therefore deletes its line here, which is the only way this file shrinks.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const LANE = join(REPO_ROOT, "tests", "e2e");

/**
 * The declared stubs: `<file>` → `<title>` → the defect, in one line. A title is the key because a
 * file may hold more than one, and a renamed title is a different assertion.
 */
const ROSTER: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "tests/e2e/journeys/j-011-viewer.spec.ts": {
    "J-011: the selection is repainted after the fly-to settles, and the pulse ends by itself (R-UI-022)":
      "with motion in force a Reveal's arrival paints no frame a screenshot can see between `data-flyto=settled` and stillness — paint vs WebGL compositing, which this journey's node cannot own (R-UI-022, docs/design/viewer.md §4; the restore recipe is at the foot of the file)",
  },
  "tests/e2e/journeys/j-000/m2-column-lines.spec.ts": {
    "J-000 m2-column-lines: a level is inserted, the campaign is measured, and its column lines stand in the register":
      "the M2 door this leg walks has not landed; AM-09 §3 writes the segment into the golden path before the milestone exists",
  },
  "tests/e2e/journeys/j-000/m2-coverage-grid.spec.ts": {
    "J-000 m2-coverage-grid: the grid states every cell's coverage, and the certificate preview says it in sentences":
      "the same: the coverage door is announced ground, declared here until M2's screen ships",
  },
  "tests/e2e/journeys/j-000/m3-bill-and-schedules.spec.ts": {
    "J-000 m3-bill-and-schedules: levels and schedules transcribed, the campaign run on the M3 fixture, the register reviewed, and the unpriced BOQ and BBS emitted as DRAFT — UNSIGNED with the XLSX opened":
      "M3 has not shipped; the increment that ships it replaces this stub with the walk and never deletes the file",
  },
  "tests/e2e/journeys/j-000/m4-sheet-and-manual-measure.spec.ts": {
    "J-000 m4-sheet-and-manual-measure: a PDF sheet ingested and corroborated, a manual condition measured, rooms and finishes taken, and a question asked of the drawings":
      "M4 has not shipped; the same rule applies",
  },
};

/** Every spec in the lane, whatever it is nested under. */
function specs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) specs(path, out);
    else if (entry.endsWith(".spec.ts")) out.push(path);
  }
  return out;
}

/**
 * EVERY WAY A LEG IS TAKEN OUT OF THE RUN, NOT ONLY `test.fixme` (P4b §5).
 *
 * This file read `\btest\.fixme\(` and nothing else, so a sixth stub could hide in plain sight as a
 * SKIP: `test.skip("…")` declares a test nobody runs, `test.describe.skip` takes a whole file out at
 * once, and an imperative `test.skip(condition)` in a body takes the leg out for some runs and not
 * others — the worst of the three, because the run that skips it is the run that would have caught
 * the defect. j-000-roster.test.ts even counted a `test.skip` title as "declares at least one test".
 *
 * All four spellings are read here, and all four are governed the same way: listed with the defect
 * that owes them, or red. A conditional skip has no title to be keyed by, so it is keyed by the
 * condition it is taken on — `test.skip(<condition>)` — which is the thing a reader needs to find it.
 */
const SPELLINGS: readonly { readonly what: string; readonly pattern: RegExp }[] = [
  { what: "test.fixme", pattern: /\btest\.fixme\(\s*/g },
  { what: "test.skip", pattern: /\btest\.skip\(\s*/g },
  { what: "test.describe.skip", pattern: /\btest\.describe\.skip\(\s*/g },
  { what: "describe.skip", pattern: /(?<!test\.)\bdescribe\.skip\(\s*/g },
];

/**
 * What one file takes out of the run: a title where the spelling declares one, and the condition
 * where it does not. Exported so the extractor is proved on payloads rather than only on the tree.
 */
export function stubsIn(source: string): string[] {
  const held: string[] = [];
  for (const { what, pattern } of SPELLINGS) {
    for (const match of source.matchAll(pattern)) {
      const rest = source.slice(match.index + match[0].length);
      const quoted = /^(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/.exec(rest);
      if (quoted !== null) {
        held.push(quoted[1] ?? quoted[2] ?? quoted[3] ?? "");
        continue;
      }
      // An imperative skip: `test.skip(process.env.CI !== undefined, "…")`. The condition is the key.
      const condition = /^([^,)]*)/.exec(rest)?.[1]?.trim() ?? "";
      held.push(`${what}(${condition})`);
    }
  }
  return held;
}

/** The stubs the tree actually holds: `<file>` → the titles and conditions it declares. */
function declared(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of specs(LANE)) {
    const titles = stubsIn(readFileSync(file, "utf8"));
    if (titles.length > 0) found.set(relative(REPO_ROOT, file), titles);
  }
  return found;
}

describe("every declared stub in the journey lane is governed (Q-08, C-06, B-19)", () => {
  const found = declared();

  it("names the defect it waits on — an anonymous fixme is a deletion nobody can audit", () => {
    for (const [file, titles] of found) {
      for (const title of titles) {
        expect(title, `${file}: a declared stub with no title is an assertion that vanished silently`).not.toBe("");
        expect(title.length, `${file}: "${title}" says too little to be found again`).toBeGreaterThan(20);
      }
    }
  });

  it("is listed here with the defect that owes it", () => {
    const unlisted = [...found].flatMap(([file, titles]) => titles.filter((title) => ROSTER[file]?.[title] === undefined).map((title) => `${file} — ${title}`));
    expect(unlisted, "a stub nothing lists is a stub nothing will restore: add it to ROSTER with the defect in one line").toEqual([]);
  });

  it("carries a reason that states a defect, not a mood", () => {
    for (const [file, entries] of Object.entries(ROSTER)) {
      for (const [title, reason] of Object.entries(entries)) {
        expect(reason.length, `${file} — ${title}: the reason must say what is broken and who owns it`).toBeGreaterThan(40);
      }
    }
  });

  it("holds no dead entry — a restored leg deletes its line", () => {
    const dead = Object.entries(ROSTER).flatMap(([file, entries]) =>
      Object.keys(entries).filter((title) => !(found.get(file) ?? []).includes(title)).map((title) => `${file} — ${title}`),
    );
    expect(dead, "this fixme is no longer in the tree (restored, renamed or deleted) — delete its line (B-19)").toEqual([]);
  });
});

describe("the roster reads every spelling that takes a leg out of the run (P4b §5)", () => {
  it("sees a skipped test, a skipped describe and a conditional skip, not only a fixme", () => {
    const source = [
      'test.fixme("the pulse is repainted after the fly-to settles", async () => {});',
      'test.skip("the sixth stub, hiding as a skip", async () => {});',
      'test.describe.skip("a whole file taken out at once", () => {});',
      "test(\"one that runs\", async () => {",
      "  test.skip(process.env.CI !== undefined, \"not on CI\");",
      "});",
      "",
    ].join("\n");
    expect(stubsIn(source)).toEqual([
      "the pulse is repainted after the fly-to settles",
      "the sixth stub, hiding as a skip",
      "test.skip(process.env.CI !== undefined)",
      "a whole file taken out at once",
    ]);
  });

  it("finds nothing in a file that takes nothing out", () => {
    expect(stubsIn('test("J-000 m0: the door answers", async () => {\n  await expect(page).toHaveURL("/");\n});\n')).toEqual([]);
  });
});
