/**
 * AC-7 (the copy half) — S-Schedules says the sentences its Design Decision rules, and the module's
 * mirror says them word for word (docs/design/s-schedules.md §3, §7, B-17, C-13).
 *
 * ARCH-01 leaves a module no way to read `src/ui/strings`, so the workspace mirrors the table it
 * says; a mirror can drift, and this file is what makes it a mirror rather than an improvisation
 * (the precedent is tests/takeoff/levels-ui/copy-mirror.test.ts). Both sides are loaded by path so a
 * table the Builder has not written yet reds as the missing module it is rather than killing
 * collection.
 *
 * The Decision is read as a DOCUMENT, not as source: §3 states this screen's copy verbatim, and a
 * screen whose strings differ from the Decision that rules them is a deviation (the product's law).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { TESTIDS } from "../../../src/ui/testids";
import { COPY_MIRROR_MODULE, REPO_ROOT, STRINGS_MODULE } from "./support/bnbc-notes";
import { productModule } from "./support/notes-doors";

/** The Decision this screen is built against. */
const DECISION = "docs/design/s-schedules.md";

/**
 * The Decision of the screen this one was CUT FROM (the grid-workspace template, §0's own preamble).
 * A region table's columns are read off it rather than transcribed here, so the two documents of one
 * template can never drift into two shapes (B-19).
 */
const SIBLING_DECISION = "docs/design/s-levels.md";

/** What each numbered section of a Decision must rule, in the order the criteria name them (AC-7). */
const SECTIONS: readonly (readonly [number, RegExp])[] = [
  [0, /interpretation/i],
  [1, /layout|wireframe/i],
  [2, /state/i],
  [3, /copy/i],
  [4, /motion/i],
  [5, /token/i],
  [6, /theme/i],
  [7, /test hook/i],
];

/** Whitespace as a document wraps it is not a difference in a sentence (§3 wraps its lines). */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The copy table a module publishes: its one exported record of sentences, whatever it is named. */
function copyTableOf(module: Record<string, unknown>, where: string): Record<string, string> {
  const tables = Object.values(module).filter(
    (value): value is Record<string, string> =>
      typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value as Record<string, unknown>).every((entry) => typeof entry === "string"),
  );
  const table = tables.find((one) => Object.keys(one).length > 0);
  expect(table, `${where} publishes a table of sentences`).toBeTruthy();
  return table as Record<string, string>;
}

/** One committed Decision, whole — a document under docs/design/, never product source. */
function documentAt(path: string): string {
  // white-box: AC-7 — the criterion is ABOUT the text of a document: "docs/design/s-schedules.md
  // exists with section 0 Interpretations, section 1 wireframe + region table … section 7 test hooks
  // naming every `TESTIDS.schedules` key". A Design Decision is the screen's contract, not its
  // implementation: there is no product call that answers what the document rules, and the law that
  // makes a deviation from it a defect can only be held by reading it. Nothing under src/, scripts/
  // or db/ is read here — the product side of every assertion below is the loaded module.
  const text = readFileSync(join(REPO_ROOT, path), "utf8");
  expect(text.length, `${path} is committed before the screen it rules (C-13)`).toBeGreaterThan(2000);
  return text;
}

/** One numbered section of a Decision, from its heading to the next one. */
function sectionOf(text: string, ordinal: number): string {
  const opened = text.search(new RegExp(`^## ${ordinal}\\. `, "m"));
  expect(opened, `${DECISION} rules its §${ordinal}`).toBeGreaterThanOrEqual(0);
  const rest = text.slice(opened);
  const next = rest.slice(1).search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

/** The rows of the first markdown table of a section, each as its cells. */
function tableRows(section: string): string[][] {
  const lines = section.split("\n").filter((line) => line.trimStart().startsWith("|"));
  return lines
    .filter((line) => !/^\s*\|[\s:|-]+\|\s*$/.test(line))
    .map((line) =>
      line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cell.trim()),
    );
}

/** Every `key` **sentence** pair §3 of the Decision states, collapsed onto one line each. */
function decisionCopy(): Record<string, string> {
  // white-box: AC-7 — §3 of the Decision states this screen's copy VERBATIM, and the criterion binds
  // the shipped strings to it word for word ("section 3 copy verbatim equal to src/ui/strings/
  // schedules.ts"). The sentences a screen says exist in two places by law; this read is the other
  // place, the document, and the side it is compared against is the loaded module, never its source.
  const text = readFileSync(join(REPO_ROOT, DECISION), "utf8");
  const section = text.split(/^## 3\. /m)[1]?.split(/^## 4\. /m)[0] ?? "";
  expect(section.length, `${DECISION} carries its §3 copy table`).toBeGreaterThan(0);
  const pairs: Record<string, string> = {};
  for (const match of section.matchAll(/`([a-z][a-z0-9_]*)`\s+\*\*([^*]+)\*\*/g)) {
    pairs[match[1] as string] = oneLine(match[2] as string);
  }
  expect(Object.keys(pairs).length, `${DECISION} §3 states this screen's sentences by key`).toBeGreaterThan(0);
  return pairs;
}

describe("AC-7: the Decision rules the whole screen, and its hook contract is the registry's own", () => {
  test("AC-7: every section is ruled, §1's region table is the template's, and §7's hooks are exactly the registry's", () => {
    const text = documentAt(DECISION);

    for (const [ordinal, subject] of SECTIONS) {
      const headings = [...text.matchAll(new RegExp(`^## ${ordinal}\\. (.+)$`, "gm"))].map((match) => match[1] ?? "");
      expect(headings.length, `${DECISION} rules §${ordinal} once — a document with two spellings of one section is a defect (the product's law)`).toBe(1);
      expect(headings[0] ?? "", `and §${ordinal} is the section the criteria name: ${String(subject)}`).toMatch(subject);
    }

    // §1 carries the region table, in the columns the Decision of the screen this one was cut from
    // carries — the ruled width of each region, its tokens, and what it holds when it holds nothing.
    const regions = tableRows(sectionOf(text, 1));
    const columns = tableRows(sectionOf(documentAt(SIBLING_DECISION), 1))[0] ?? [];
    expect(columns.length, `${SIBLING_DECISION} §1 carries the template's region table`).toBeGreaterThan(0);
    expect(regions[0], `${DECISION} §1 rules its regions in the same columns as ${SIBLING_DECISION} (the same template, one shape)`).toEqual(columns);
    expect(regions.length - 1, "and rules more than one region: a screen is a composition").toBeGreaterThan(1);

    const sized = columns.findIndex((column) => /width|height|size/i.test(column));
    for (const region of regions.slice(1)) {
      expect((region[0] ?? "").length, `every row of §1's region table names the region it rules: ${JSON.stringify(region)}`).toBeGreaterThan(0);
      expect(region[sized] ?? "", `and rules how wide or how tall it stands: ${String(region[0])}`).toMatch(/\d/);
      expect((region[columns.length - 1] ?? "").length, `and what stands there when it holds nothing: ${String(region[0])}`).toBeGreaterThan(0);
    }

    /* --- §7: the closed hook contract, read against the registry that publishes the ids --- */
    const group = (TESTIDS as unknown as { schedules?: Record<string, string> }).schedules;
    expect(group, "src/ui/testids.ts publishes this screen's ids under `TESTIDS.schedules` — the one home an id is spelled in (AM-09 §1)").toBeTruthy();
    const published = Object.values(group as Record<string, string>);
    expect(published.length, "and publishes the screen's hooks under it").toBeGreaterThan(0);

    const hooks = sectionOf(documentAt(DECISION), 7);
    const spelled = new Set([...hooks.matchAll(/`(schedules-[a-z0-9-]+)`/g)].map((match) => match[1] ?? ""));
    const byCodePoint = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
    expect(
      [...spelled].sort(byCodePoint),
      "§7 names every key of TESTIDS.schedules and invents none: the Decision and the registry are one closed contract (C-05, B-17)",
    ).toEqual([...published].sort(byCodePoint));

    const nav = (TESTIDS.takeoff as unknown as Record<string, string>)["navSchedules"];
    expect(nav, "src/ui/testids.ts publishes the lane's fourth tab").toBeTruthy();
    expect(hooks.includes(String(nav)), `and §7 names it beside them: ${String(nav)}`).toBe(true);
  });
});

describe("AC-7: the screen's copy is the Decision's, and the module's mirror is the registry's", () => {
  test("AC-7: every sentence the Decision rules stands in the registry, verbatim", async () => {
    const registry = copyTableOf(await productModule<Record<string, unknown>>(STRINGS_MODULE), STRINGS_MODULE);
    const ruled = decisionCopy();
    for (const [key, sentence] of Object.entries(ruled)) {
      expect(oneLine(registry[key] ?? ""), `${STRINGS_MODULE} says \`${key}\` as ${DECISION} §3 rules it`).toBe(sentence);
    }
    expect(
      Object.keys(registry).sort(),
      `and says nothing ${DECISION} §3 does not rule: copy verbatim is a two-way table, so a sentence on the screen that no Decision states is a deviation`,
    ).toEqual(Object.keys(ruled).sort());
  });

  test("AC-7: the module's mirror and the registry carry the same keys and the same words", async () => {
    const registry = copyTableOf(await productModule<Record<string, unknown>>(STRINGS_MODULE), STRINGS_MODULE);
    const mirror = copyTableOf(await productModule<Record<string, unknown>>(COPY_MIRROR_MODULE), COPY_MIRROR_MODULE);

    expect(Object.keys(mirror).sort(), "neither table can gain a sentence the other never hears (B-17)").toEqual(Object.keys(registry).sort());
    for (const [key, mirrored] of Object.entries(mirror)) {
      expect(registry[key], `the mirror says \`${key}\` in the registry's own words`).toBe(mirrored);
    }
  });
});
