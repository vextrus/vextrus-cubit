// @vitest-environment jsdom
/**
 * C-13: a declared state renders its screen's committed copy, never an improvisation.
 *
 * Most of the matrix reads the shared table `src/ui/strings`, where the sentence has one home and no
 * drift is possible. A screen whose Design Decision fixes its own words keeps them in a table beside
 * its route (`src/app/.../strings.ts`), and `src/ui` may never import `src/app` (ARCH-01) — so that
 * screen's empty state is mirrored into `src/ui/strings/screen-states.ts`, and a mirror can drift.
 *
 * The rule this file grades is therefore general, not a transcription of the mirrors that exist
 * today (B-19): every screen that keeps a table beside its route says that table's sentences in its
 * declared empty cell. The roster of such screens is probed off the tree, each route table's
 * committed sentences are read out of its source by the checkout's own parser, and every word the
 * empty cell renders must be one of:
 *
 *   - a value of that screen's own route table — the mirror, verbatim, or it is not a mirror; or
 *   - a value of a shared `src/ui/strings` table other than `screen-states.ts` — a sentence whose
 *     home is elsewhere and which many screens say, such as a shared action label.
 *
 * A sentence that exists only in `screen-states.ts` is copy the matrix wrote for a screen that had
 * already committed its own, which is the improvisation C-13 forbids. So a screen added later with
 * a route table of its own is graded by existing, and re-wording a route table without re-wording
 * the mirror is a red — neither needs an edit here.
 *
 * The empty cell is what a route table commits: the six other states of such a screen are the
 * "cannot arise" reasons the matrix itself authors, which have no original beside the route.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import { afterEach, describe, expect, test } from "vitest";
import { strings } from "../../src/ui/strings";
import { screenStates as matrixCopy } from "../../src/ui/strings/screen-states";
import { screenStates } from "../../src/ui/screen-states";
import { mountState, unmountAll, visibleText } from "./support/matrix-contract";

/** `src/app`, from this file at `tests/screen-states/`. */
const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "app");

/** The file a screen keeps its own committed copy in, beside its `page.tsx`. */
const TABLE_FILE = "strings.ts";

/** The whitespace-collapsed form both sides of every comparison are read in. */
const norm = (value: string): string => value.replace(/\s+/g, " ").trim();

/** Code point order — `localeCompare` is banned tree-wide (no-raw-intl). */
const byCodePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** A route-group directory names no path segment, exactly as the app router reads it. */
const isGroup = (segment: string): boolean => segment.startsWith("(") && segment.endsWith(")");

/** One screen that keeps its copy beside its route: the route key, and that table's source file. */
interface RouteTable {
  route: string;
  file: string;
}

/**
 * Every screen with a table of its own, probed off the tree: a directory holding both a `page.tsx`
 * and a `strings.ts`. Independent of `routesOnDisk` on purpose — the roster this file grades is
 * recomputed here rather than taken on trust.
 */
function routeTablesOnDisk(appDir: string = APP_DIR): RouteTable[] {
  const found: RouteTable[] = [];

  const walk = (dir: string, segments: readonly string[]): void => {
    const entries = statSync(dir, { throwIfNoEntry: false })?.isDirectory() === true ? readdirSync(dir) : [];
    if (entries.includes("page.tsx") && entries.includes(TABLE_FILE)) {
      const kept = segments.filter((segment) => !isGroup(segment));
      found.push({ route: kept.length === 0 ? "/" : `/${kept.join("/")}`, file: join(dir, TABLE_FILE) });
    }
    for (const name of entries) {
      const child = join(dir, name);
      if (statSync(child, { throwIfNoEntry: false })?.isDirectory() === true) walk(child, [...segments, name]);
    }
  };

  walk(resolve(appDir), []);
  return found.sort((a, b) => byCodePoint(a.route, b.route));
}

/**
 * The sentences a route table commits, read out of its source with the checkout's own parser: every
 * string literal a property of it is assigned. Reading the source rather than importing the module
 * keeps the probe indifferent to how many tables one file exports and to what else it does.
 */
function committedSentences(file: string): Set<string> {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const sentences = new Set<string>();

  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteralLike(node.initializer)) {
      const text = norm(node.initializer.text);
      if (text.length > 0) sentences.add(text);
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return sentences;
}

/** Every word a mounted state puts on the page, one entry per text node, collapsed. */
function renderedRuns(root: Element): string[] {
  const runs: string[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = norm(node.textContent ?? "");
    if (text.length > 0) runs.push(text);
  }
  return runs;
}

/** Sentences whose only home is the matrix's own table — lawful only where a screen committed none. */
const MATRIX_OWN_COPY = new Set(Object.values(matrixCopy).map(norm));

/** Every sentence the shared tables publish, the matrix's own included. */
const SHARED_COPY = new Set(Object.values(strings).map(norm));

/** The empty cell of one screen with a table of its own, mounted and read. */
function readEmptyCell(table: RouteTable): { runs: string[]; committed: Set<string> } {
  const declaration = screenStates[table.route];
  expect(declaration, `${table.route} is declared in the matrix`).toBeDefined();
  if (declaration === undefined) return { runs: [], committed: new Set() };

  const { root } = mountState(declaration.empty.render());
  expect(root, `${table.route}/empty mounts an element`).not.toBeNull();
  if (root === null) return { runs: [], committed: new Set() };

  expect(visibleText(root).length, `${table.route}/empty is not silent`).toBeGreaterThan(0);
  return { runs: renderedRuns(root), committed: committedSentences(table.file) };
}

describe("C-13: a screen with a table of its own says that table's words", () => {
  const tables = routeTablesOnDisk();

  afterEach(() => {
    unmountAll();
  });

  test("the tree holds screens that commit their own copy, and each is declared", () => {
    expect(tables.length, "at least one screen keeps a strings table beside its route").toBeGreaterThan(0);
    for (const { route, file } of tables) {
      expect(committedSentences(file).size, `${file} commits sentences`).toBeGreaterThan(0);
      expect(screenStates[route], `${route} is declared in the matrix`).toBeDefined();
    }
  });

  test("each such screen's empty cell says at least one sentence its own table commits", () => {
    for (const table of tables) {
      const { runs, committed } = readEmptyCell(table);
      const own = runs.filter((run) => committed.has(run));
      expect(own.length, `${table.route}/empty repeats its own table's committed copy`).toBeGreaterThan(0);
      unmountAll();
    }
  });

  test("no sentence in such a screen's empty cell is copy the matrix wrote for it", () => {
    for (const table of tables) {
      const { runs, committed } = readEmptyCell(table);
      for (const run of runs) {
        if (committed.has(run)) continue;
        const improvised = MATRIX_OWN_COPY.has(run) || !SHARED_COPY.has(run);
        expect(
          improvised,
          `${table.route}/empty says "${run}", which its own table does not commit and which no shared table other than screen-states.ts publishes`,
        ).toBe(false);
      }
      unmountAll();
    }
  });
});
