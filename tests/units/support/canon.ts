/**
 * How the acceptance reaches the M2 measurement vocabulary while it is still being built.
 *
 * A static import of a module the tree has not got yet dies at collection, which reads as the
 * suite's own defect rather than as the product's absence — so every product module is reached by
 * repo-relative path, asserted present first. A missing module is then one named AssertionError in
 * the case that needed it (the same shape `db/__tests__/takeoff-scale.migration.test.ts` uses).
 *
 * The canon's rosters are read from `src/core/units` as a whole rather than from one file: the
 * criteria pin `toCanonical`, `convert` and the exempt list to `src/core/units/canon.ts` and say
 * nothing about where `DIMENSIONS`, `UNITS`, `PACKAGING_UNITS` and `CANONICAL_UNIT` are declared, so
 * the acceptance asks the canon's home for them and lets the Builder lay the home out. `canon.ts`
 * itself is still required to exist, because that is the file the criteria name.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

/** The checkout these suites run against. */
export const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

/** The canon's home, and the one file within it the criteria name by path. */
const UNITS_DIR = "src/core/units";
const CANON_FILE = `${UNITS_DIR}/canon.ts`;

/** The catalogue's home, for the suites that read a roster out of it. */
export const CATALOGUE_DIR = "src/core/catalogue";

/**
 * A product module by repo-relative path, asserted present first so its absence is the finding.
 */
export async function productModule(relative: string): Promise<Record<string, unknown>> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as Record<string, unknown>;
}

/** Every export of every module directly under a directory of the product, merged. */
async function exportsUnder(directory: string, required: string): Promise<Record<string, unknown>> {
  await productModule(required);
  const merged: Record<string, unknown> = {};
  for (const entry of readdirSync(join(REPO_ROOT, directory), { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts")) continue;
    Object.assign(merged, await productModule(`${directory}/${entry.name}`));
  }
  return merged;
}

/** The unit canon, whole: whatever `src/core/units` declares, with `canon.ts` required to be there. */
export function canon(): Promise<Record<string, unknown>> {
  return exportsUnder(UNITS_DIR, CANON_FILE);
}

/** One named export, or a finding that says which name is missing and where it was looked for. */
export function named<T>(source: Record<string, unknown>, name: string, home: string): T {
  expect(Object.hasOwn(source, name), `${name} is not exported from ${home} — the acceptance reads the law there`).toBe(true);
  return source[name] as T;
}

/** A roster as a plain, comparable set of strings. */
export function setOf(values: Iterable<string>): Set<string> {
  return new Set(values);
}

/** A roster in code-point order, so two rosters compare as lists without either being sorted twice. */
export function byCodePoint(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
