/**
 * EVERY `test.fixme` IN THE JOURNEY LANE, AND THE DEFECT IT NAMES.
 *
 * A fixme is lawful: an assertion a node cannot honestly make today is better declared, collected
 * and impossible to forget than deleted. What makes it lawful is that somebody WILL notice it is
 * still there. Until 2026-09-12 nothing did for the lane at large: `j-000-roster.test.ts` reads the
 * Bible's J-000 segments and governs that journey's legs only, and `tests/journeys/guards/
 * journeys-not-weakened.test.ts` walks a fixed path list — so the stub added to
 * `j-011-viewer.spec.ts` on this branch (the pulse, R-UI-022) passed both suites unremarked.
 *
 * So: every `test.fixme` under `tests/e2e` is listed here with the defect it is waiting on, in one
 * line, and the roster is asserted from BOTH sides — an unlisted fixme fails, an unnamed one fails,
 * and an entry whose fixme has been restored fails too, because a licence nobody needs is dead wood
 * (B-19). Restoring a leg therefore deletes its line here, which is the only way this file shrinks.
 * On the golden path (tests/e2e/journeys/j-000/) a stub's title also opens `MISSING DOOR:` — the door
 * it waits on, named first (`unnamedDoors`, session 7).
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
  "tests/e2e/journeys/j-000/m3-bar-schedule.spec.ts": {
    "MISSING DOOR: J-000 m3-bar-schedule: the bar schedule is emitted as DRAFT — UNSIGNED and read against the golden, member by member":
      "no column member's schedule is whole: the campaign's column rebar lines stand PARTIAL_DECLARED with their TIES omitted until the ties slice (R6, D-003) derives them from BNBC 2020 / ACI 318-19 (docs/reference/bnbc-2020/), and the stated LAP 50d (I-308, reserved and not yet minted) rides with that synthesis bump behind the FC contest (N1) — the leg compares whole members, NET and LAP, against fixtures/rcc6-bnbc/bbs.golden.json (session 7)",
  },
  // M4's four segments (AM-17), one door-owing file each since session 7 — the owner ruled "M3 breadth
  // first", so M4 stands on named, measured doors and nothing of it is built; each file's header holds
  // the measured work behind its door, file by line.
  "tests/e2e/journeys/j-000/m4-pdf-sheet.spec.ts": {
    "MISSING DOOR: J-000 m4-pdf-sheet: cad has no PDF or raster extractor (a pdf is stored, then refused SHEET_NOT_INGESTABLE), five places accept a DXF_HANDLE source key and nothing else, and the gate has no AGREED exit, so a corroborated INTERPRETED sighting can never reach a line":
      "ingest reads dxf|dwg only (ingest/request.ts:26-29,88, pipeline.ts:43) and pypdfium2 is a fixtures-group dependency (cad/pyproject.toml:19); DXF_HANDLE is the only scheme the EntityGraph, the Python extractor, the ingests CHECK and the inspector accept; the gate queues every INTERPRETED offer with no AGREED exit (gate/evaluate.ts:288-303) and register standing is CHECK-closed to MEASURED|DERIVED — M4 (R-TO-002/003, J-040): L for a hand trace on a raster page, XL for the vectoriser",
  },
  "tests/e2e/journeys/j-000/m4-sheet-and-manual-measure.spec.ts": {
    "MISSING DOOR: J-000 m4-sheet-and-manual-measure: a hand measurement is recorded as an act with a markless register row (S1), and nothing yet turns one into a line — no method over POLYLINE or POLYGON geometry, no manual arm of a rail, no condition chest, and the viewer's Linear, Area and Count tools stand disabled":
      "docs/design/s-measure.md stands (C-13, session 8 S0) and rules S1–S11; RECORD_MANUAL_MEASUREMENT and the ~m. key stand (S1: src/core/acts/record-manual-measurement.ts, src/core/manual/); no method names POLYLINE/POLYGON (offers/law.ts:57 admits them, S2); no rail offers a hand measurement (S3); no chest (S5); Linear/Area/Count render disabled (viewer-toolbar.tsx:58-62, S4) — M4 (R-TO-040, J-041): L",
  },
  "tests/e2e/journeys/j-000/m4-rooms-and-finishes.spec.ts": {
    "MISSING DOOR: J-000 m4-rooms-and-finishes: F-ARCH is not in the tree (arch-plan.dxf is a 25-entity xref stub and no golden holds a plaster, paint or room row), nothing in the product models a room, and the finishes rail's surfaces seam is hard-coded empty":
      "F-ARCH exists nowhere (fixtures/rcc6-bnbc/arch-plan.dxf: 25 entities, no room, label or schedule; the golden has no plaster, paint or room row); src models no room and closes its kinds on no floor or ceiling finish (catalogue/kinds.ts:12-26); the finishes rail gets walls: {} and surfaces: {} (measure/setup.ts:278-279) — M4 (R-TO-036/037, J-042): XL, its own increment",
  },
  "tests/e2e/journeys/j-000/m4-ask-the-drawings.spec.ts": {
    "MISSING DOOR: J-000 m4-ask-the-drawings: S-Ask is decided (docs/design/s-ask.md, C-13) and not built — the ai router holds no procedure, no grammar reads a question and no query over the register answers one":
      "the ai router is router({}) (server/routers/ai.ts:5); src/modules/takeoff/ask, its query registry and the ASK_* codes do not exist; docs/design/s-ask.md (§6) walks this leg on grammar-routed questions only, so it waits on no recorded model answer — M4 (R-AI-003, J-043): ASK-1a and ASK-1b, then ASK-3 deletes this fixme",
  },
};

/** The golden path's directory. A stub here stands on a door the product owes it (AM-09 §2, AM-17). */
const GOLDEN_PATH = "tests/e2e/journeys/j-000/";
/** What a golden-path stub's title opens with: the door it waits on, named before anything else. */
const MISSING_DOOR = "MISSING DOOR:";

/**
 * THE GOLDEN PATH'S STUBS NAME THEIR DOORS. A fixme on J-000 is lawful only as a MISSING DOOR: "a leg
 * that cannot be reached through the UI is a missing screen, not a licence to stage" (AM-09 §2), and
 * the missing screen is what its title says first. Until session 7 this roster admitted
 * "J-000 m4-sheet-and-manual-measure: a PDF sheet ingested and corroborated, …" with the reason "M4 has
 * not shipped; the same rule applies" — a stub naming four segments and no door, which nobody could
 * have restored because nobody could say what it waited on. Returns the titles of `file` that stand
 * on the golden path without opening `MISSING DOOR:`; a stub elsewhere in the lane is held by its
 * listed defect alone. j-000-roster.test.ts reads the rest of the stub's shape (its leg's own name, one
 * segment, the clauses it cites). Exported so the rule is proved on payloads, not only on the tree.
 */
export function unnamedDoors(file: string, titles: readonly string[]): string[] {
  return file.startsWith(GOLDEN_PATH) ? titles.filter((title) => !title.startsWith(MISSING_DOOR)) : [];
}

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

  it("on the golden path, opens with MISSING DOOR: — a J-000 stub names the door it waits on", () => {
    const unnamed = [...found].flatMap(([file, titles]) => unnamedDoors(file, titles).map((title) => `${file} — ${title}`));
    expect(unnamed, `a stub under ${GOLDEN_PATH} opens its title with "${MISSING_DOOR}" and the door the product owes (AM-09 §2):\n  ${unnamed.join("\n  ")}`).toEqual([]);
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

describe("a golden-path stub names its door, proved on payloads (session 7)", () => {
  const LEG = `${GOLDEN_PATH}m4-sheet-and-manual-measure.spec.ts`;

  it("refuses an m4 fixme WITHOUT \"MISSING DOOR:\" — the anonymous stub this roster admitted until session 7", () => {
    const anonymous = 'test.fixme("J-000 m4-sheet-and-manual-measure: a PDF sheet ingested and corroborated, a manual condition measured, rooms and finishes taken, and a question asked of the drawings", () => {});\n';
    expect(unnamedDoors(LEG, stubsIn(anonymous))).toEqual([
      "J-000 m4-sheet-and-manual-measure: a PDF sheet ingested and corroborated, a manual condition measured, rooms and finishes taken, and a question asked of the drawings",
    ]);
  });

  it("refuses every spelling that takes a golden-path leg out, not only a fixme", () => {
    const skipped = 'test.skip("J-000 m4-sheet-and-manual-measure: the manual condition is measured", async () => {});\n';
    expect(unnamedDoors(LEG, stubsIn(skipped))).toEqual(["J-000 m4-sheet-and-manual-measure: the manual condition is measured"]);
  });

  it("admits the same leg once its title opens on the door it waits on", () => {
    const named = 'test.fixme("MISSING DOOR: J-000 m4-sheet-and-manual-measure: S-Measure has no Design Decision (C-13) and there is no manual measurement act", () => {});\n';
    expect(unnamedDoors(LEG, stubsIn(named))).toEqual([]);
  });
});
