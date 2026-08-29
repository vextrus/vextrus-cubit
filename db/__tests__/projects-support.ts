/**
 * Acceptance support for inc-011-projects (the projects domain and S-Home).
 *
 * Everything here observes the product through names the increment DECLARES — the module homes from
 * its interfaces, the five building types and the sft factor from AC-1, the refusal code from the
 * shipped closed taxonomy. No product source is read: a module the Builder has not written yet
 * fails as an assertion naming the file rather than killing collection at transform time.
 *
 * B-19: nothing here transcribes a schema. Which columns the table lands is read from the
 * catalogue and matched against the FIELDS R-SPINE-010 names, so a column spelled differently than
 * a test author guessed is still found, and a field nobody landed is still missing.
 *
 * NOTE FOR THE BUILDER: product modules are loaded by absolute path, so the `@/*` tsconfig alias is
 * never resolved inside them — keep imports between `src/` files relative, as `src/core/db.ts` does.
 */
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

export const REPO_ROOT = join(import.meta.dirname, "..", "..");

/* ------------------------------------------------------------------ the declared homes */

/** The seam barrel the increment's interfaces name. */
export const PROJECTS_MODULE = "src/modules/spine/projects";
/** The one home of every cubit table (SEAM-TENANT). */
export const DB_MODULE = "src/core/db.ts";
/** What drizzle-kit generates from — db/schema.ts → db/schema/index.ts → the per-area file. */
export const SCHEMA_BARREL = "db/schema.ts";
export const SCHEMA_PROJECTS = "db/schema/projects.ts";
/** The shipped read path a pinned edition is read back through (R-SPINE-012). */
export const EDITIONS_MODULE = "src/core/rulesets/editions/index.ts";
/** The number formatter the sft readout is grouped by (docs/design/s-home.md I-39). */
export const FORMAT_MODULE = "src/core/format.ts";

/** The migration this increment adds, matched as a glob fragment against db/migrations/*.sql. */
export const PROJECTS_MIGRATION = "projects";
/** The table it lands, named by the increment's interfaces (`export const projects`). */
export const PROJECTS_TABLE = "projects";

/* ------------------------------------------------- the contract's rosters and constants */

/** AC-1 closes the building type over exactly these five. */
export const BUILDING_TYPES = ["residential", "commercial", "mixed", "industrial", "infrastructure"] as const;

/** A value that is not one of them, for the negative every closed set owes. */
export const FOREIGN_BUILDING_TYPE = "warehouse";

/** L-ACT-03's all-permissions bundle — the role project creation installs its creator in. */
export const PRINCIPAL = "PRINCIPAL";

/** The registered refusal AC-4's lifecycle guard answers with. */
export const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";

/** AC-1: target GFA is stored in m² and displayed also in sft at this factor. */
export const SFT_PER_M2 = 10.7639;

/**
 * The fields R-SPINE-010 names, each with the shape of a column that would hold it. The pattern is
 * deliberately loose — this file grades COVERAGE, not a column-naming convention, and a schema that
 * spells `site_address` or `address_line` satisfies the clause identically.
 */
export interface FieldMatcher {
  readonly field: string;
  readonly column: RegExp;
}
export const RSPINE010_FIELDS: readonly FieldMatcher[] = [
  { field: "name", column: /(^|_)name$/ },
  { field: "code", column: /code/ },
  { field: "client", column: /client/ },
  { field: "site address", column: /address/ },
  { field: "district", column: /district/ },
  { field: "building type", column: /building.*type|type.*building/ },
  { field: "storeys", column: /storey/ },
  { field: "target GFA (m²)", column: /gfa|floor.*area/ },
  { field: "notes", column: /note/ },
];

/** AC-1's "archived marker", and the two timestamps beside it. */
export const ARCHIVED_MARKER = /archiv/;
export const CREATED_AT = /created/;
export const UPDATED_AT = /updated/;

/* ------------------------------------------------------------------ loading the product */

/** Import a product module by repo-relative path, asserting it exists first (the red we want). */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  let abs = join(REPO_ROOT, relative);
  expect(existsSync(abs), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  if (statSync(abs).isDirectory()) {
    const barrel = ["index.ts", "index.tsx", "index.mts"].map((file) => join(abs, file)).find((file) => existsSync(file));
    expect(barrel, `${relative} is a directory with no index barrel`).toBeTruthy();
    abs = barrel ?? abs;
  }
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

export type SeamFn = (...args: never[]) => Promise<unknown>;

/** One declared export of the seam barrel, refused as absent rather than called as undefined. */
export function seamFunction(bag: Record<string, unknown>, name: string): SeamFn {
  expect(typeof bag[name], `${PROJECTS_MODULE} must export ${name} — the increment's declared interface`).toBe("function");
  return bag[name] as SeamFn;
}

/** The settled marker a refusal travels as: an Error carrying a registered `refusalCode`. */
export interface RefusalError extends Error {
  refusalCode: string;
  permission?: unknown;
  actType?: unknown;
}

export function isRefusal(thrown: unknown): thrown is RefusalError {
  return thrown instanceof Error && typeof (thrown as { refusalCode?: unknown }).refusalCode === "string";
}

/**
 * Call a lifecycle door on one project. The seam's own `createProject(ctx, draft)` fixes the
 * module's convention — a context, then what the call is about — so that shape is tried first; a
 * door that takes the id positionally is called that way rather than reported as broken, because
 * the criterion is about WHO may archive a project, never about which of two spellings the
 * argument wears. A refusal is an answer, so it is never retried: it is what the case came for.
 */
export async function callDoor(door: SeamFn, ctx: unknown, projectId: string, changes: Record<string, unknown> = {}): Promise<unknown> {
  const call = door as unknown as (...args: unknown[]) => Promise<unknown>;
  try {
    return await call(ctx, { projectId, ...changes });
  } catch (thrown) {
    if (isRefusal(thrown) || Object.keys(changes).length > 0) throw thrown;
    return await call(ctx, projectId);
  }
}

/** What a door threw, or a loud absence — a call that should have been refused and was not. */
export async function refusalFrom(call: Promise<unknown>, what: string): Promise<RefusalError> {
  let thrown: unknown;
  let answered = false;
  try {
    await call;
    answered = true;
  } catch (error) {
    thrown = error;
  }
  expect(answered, `${what} was carried out; L-ACT-03 requires it to be refused`).toBe(false);
  expect(isRefusal(thrown), `${what} threw ${String(thrown)}, which carries no registered refusalCode — a refusal is an answer, never a fault (ARCH-03, B-21)`).toBe(true);
  return thrown as RefusalError;
}

/* ------------------------------------------------------------------ reading the answers */

/** The list `projectsForHome` answers with, however the answer is wrapped. */
export function projectRows(answer: unknown): Record<string, unknown>[] {
  if (Array.isArray(answer)) return answer as Record<string, unknown>[];
  if (answer !== null && typeof answer === "object") {
    for (const value of Object.values(answer as Record<string, unknown>)) {
      if (Array.isArray(value)) return value as Record<string, unknown>[];
    }
  }
  throw new Error(`projectsForHome answered ${JSON.stringify(answer)?.slice(0, 240)}, which carries no list of projects`);
}

/** The row for one project, found by the id it was created under rather than by a key name. */
export function rowFor(rows: Record<string, unknown>[], projectId: string): Record<string, unknown> {
  const found = rows.find((row) => Object.values(row).includes(projectId));
  expect(found, `projectsForHome carries no entry for ${projectId}; it answered ${rows.length} row(s)`).toBeTruthy();
  return found ?? {};
}

/** A read-model key, matched against a column name the same way whatever case either wears. */
export function normalise(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}
