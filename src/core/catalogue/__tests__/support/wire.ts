/**
 * Acceptance support for the measurement vocabulary (L-MEA-04, L-FRM-06): the module homes the
 * increment declares, and the loader every case reaches them through.
 *
 * Product modules are loaded by absolute path, exactly as `src/core/format.test.ts` and
 * `tests/server/support/wire.ts` load theirs: a module the Builder has not written yet must fail as
 * an assertion naming the file, never as an unreadable resolution error that kills collection.
 *
 * NOTE FOR THE BUILDER: because the load is by absolute path, the `@/*` tsconfig alias is never
 * resolved inside these modules — keep imports between `src/` files relative, as `src/core/db.ts`
 * does.
 *
 * Nothing here transcribes a roster (B-19). Every expected set is derived from the tree's own
 * exports: the forbidden token set from DIMENSIONS, UNIT_ABBREVIATIONS and ELEMENT_TYPES, the
 * catalogue's key set from KINDS, the unit pairs from the canon's own factors.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

/** The checkout this suite judges. */
export const REPO_ROOT = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

/* ------------------------------------------------------------------ the declared homes */

export const KINDS_MODULE = "src/core/catalogue/kinds.ts";
export const ELEMENT_TYPES_MODULE = "src/core/catalogue/element-types.ts";
export const CATALOGUE_MODULE = "src/core/catalogue/catalogue.ts";
export const BEARS_MODULE = "src/core/catalogue/bears.ts";
export const DISCIPLINE_MODULE = "src/core/catalogue/discipline.ts";
export const ALGEBRA_MODULE = "src/core/catalogue/algebra.ts";
export const EMIT_MODULE = "src/core/catalogue/emit.ts";
export const CANON_MODULE = "src/core/units/canon.ts";

/** The committed emission and the digest the drift stage compares against (V-VERIFY). */
export const CATALOGUE_JSON = "db/catalogue/catalogue.json";
export const BEARS_JSON = "db/catalogue/bears.json";
export const CATALOGUE_DIGEST = "db/catalogue/digest.txt";

/* ------------------------------------------------------------------------- the loader */

/**
 * A product module, asserted to exist before it is imported. The specifier is held in a variable so
 * the transform cannot resolve it at build time — an absent module is this assertion, not a crash.
 */
export async function productModule<T>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/* ------------------------------------------------------- the shapes the contract declares */

/** One work-item catalogue entry, as the test contract spells it. */
export interface CatalogueEntry {
  description: string;
  unit: string;
  dimension: string;
  precision: number;
}

export interface KindsModule {
  KINDS: readonly string[];
}

export interface ElementTypesModule {
  ELEMENT_TYPES: readonly string[];
}

export interface CatalogueModule {
  CATALOGUE: Record<string, CatalogueEntry>;
}

export interface BearsModule {
  BEARS: Record<string, readonly string[]>;
  UNBORNE: readonly string[];
}

export interface DisciplineModule {
  KIND_DISCIPLINE: Record<string, string>;
}

export interface AlgebraModule {
  KIND_ALGEBRA: Record<string, string>;
}

export interface EmitModule {
  emitCatalogueTables(): { catalogue: string; bears: string };
}

/** What `toCanonical` answers: a factor and a dimension, or a code and nothing else (L-FRM-06). */
export type CanonicalResult = { ok: true; factor: number; dimension: string } | { ok: false; code: string };

/** What `convert` answers: a value, or a code and nothing else. */
export type ConvertResult = { ok: true; value: number } | { ok: false; code: string };

export interface CanonModule {
  DIMENSIONS: readonly string[];
  CANONICAL_UNITS: Record<string, string>;
  UNIT_ABBREVIATIONS: readonly string[];
  EXACT_FACTORS: unknown;
  toCanonical(unit: string, product?: { factors?: Record<string, number> }): CanonicalResult;
  convert(value: number, from: string, to: string, product?: { factors?: Record<string, number> }): ConvertResult;
}

/* ---------------------------------------------------------------- memoised module loads */

const memo = new Map<string, Promise<unknown>>();

function once<T>(relative: string, check: (loaded: T) => void): Promise<T> {
  const pending =
    memo.get(relative) ??
    (async (): Promise<T> => {
      const loaded = await productModule<T>(relative);
      check(loaded);
      return loaded;
    })();
  memo.set(relative, pending);
  return pending as Promise<T>;
}

/** Assert a value is a non-empty array of non-empty strings, and hand it back. */
export function stringRoster(value: unknown, what: string): readonly string[] {
  expect(Array.isArray(value), `${what} must be a readonly array of names`).toBe(true);
  const roster = value as readonly unknown[];
  expect(roster.length, `${what} must not be empty — an empty roster makes every case below vacuous`).toBeGreaterThan(0);
  for (const entry of roster) {
    expect(typeof entry, `every member of ${what} is a string; found ${JSON.stringify(entry)}`).toBe("string");
    expect(String(entry).trim(), `${what} carries no blank name`).not.toBe("");
  }
  return roster as readonly string[];
}

export const loadKinds = (): Promise<KindsModule> =>
  once<KindsModule>(KINDS_MODULE, (m) => {
    stringRoster(m.KINDS, `${KINDS_MODULE} export KINDS`);
  });

export const loadElementTypes = (): Promise<ElementTypesModule> =>
  once<ElementTypesModule>(ELEMENT_TYPES_MODULE, (m) => {
    stringRoster(m.ELEMENT_TYPES, `${ELEMENT_TYPES_MODULE} export ELEMENT_TYPES`);
  });

export const loadCatalogue = (): Promise<CatalogueModule> =>
  once<CatalogueModule>(CATALOGUE_MODULE, (m) => {
    expect(m.CATALOGUE, `${CATALOGUE_MODULE} must export CATALOGUE`).toBeTypeOf("object");
  });

export const loadBears = (): Promise<BearsModule> =>
  once<BearsModule>(BEARS_MODULE, (m) => {
    expect(m.BEARS, `${BEARS_MODULE} must export BEARS`).toBeTypeOf("object");
    expect(Array.isArray(m.UNBORNE), `${BEARS_MODULE} must export UNBORNE as an array`).toBe(true);
  });

export const loadDiscipline = (): Promise<DisciplineModule> =>
  once<DisciplineModule>(DISCIPLINE_MODULE, (m) => {
    expect(m.KIND_DISCIPLINE, `${DISCIPLINE_MODULE} must export KIND_DISCIPLINE`).toBeTypeOf("object");
  });

export const loadAlgebra = (): Promise<AlgebraModule> =>
  once<AlgebraModule>(ALGEBRA_MODULE, (m) => {
    expect(m.KIND_ALGEBRA, `${ALGEBRA_MODULE} must export KIND_ALGEBRA`).toBeTypeOf("object");
  });

export const loadEmit = (): Promise<EmitModule> =>
  once<EmitModule>(EMIT_MODULE, (m) => {
    expect(m.emitCatalogueTables, `${EMIT_MODULE} must export emitCatalogueTables`).toBeTypeOf("function");
  });

export const loadCanon = (): Promise<CanonModule> =>
  once<CanonModule>(CANON_MODULE, (m) => {
    stringRoster(m.DIMENSIONS, `${CANON_MODULE} export DIMENSIONS`);
    stringRoster(m.UNIT_ABBREVIATIONS, `${CANON_MODULE} export UNIT_ABBREVIATIONS`);
    expect(m.CANONICAL_UNITS, `${CANON_MODULE} must export CANONICAL_UNITS`).toBeTypeOf("object");
    expect(m.toCanonical, `${CANON_MODULE} must export toCanonical`).toBeTypeOf("function");
    expect(m.convert, `${CANON_MODULE} must export convert`).toBeTypeOf("function");
  });

/* --------------------------------------------------------------------- shared mechanics */

/**
 * A name, split into the word tokens L-MEA-04 judges: underscores, hyphens, spaces and camel-case
 * humps all separate, and every token is compared upper-cased so the ban is case-insensitive.
 */
export function tokensOf(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((token) => token !== "")
    .map((token) => token.toUpperCase());
}

/** Does `haystack` carry `needle` as a contiguous run of whole tokens? */
export function carriesTokenRun(haystack: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((token, offset) => haystack[start + offset] === token)) return true;
  }
  return false;
}

/** Every primitive value reachable inside a value, flattened — a shape-tolerant reading of a row. */
export function flatValues(value: unknown): unknown[] {
  if (value === null || typeof value !== "object") return [value];
  return Object.values(value as Record<string, unknown>).flatMap(flatValues);
}
