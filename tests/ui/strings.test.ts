/**
 * Public acceptance for the per-module string table (R-SPINE-060, C-SPINE-PLATFORM): AC-4.
 *
 * Three things are proved here and nothing else is frozen:
 *   - the table is per-module — `src/ui/strings/spine.ts` holds the spine module's own keys, and
 *     `src/ui/strings/index.ts` aggregates every module table under the same two exported names;
 *   - the aggregate is complete BY REFLECTION over the directory, so a later module's table extends
 *     it without editing this file (B-19: the rule is "index aggregates the module tables", not
 *     "these are the keys");
 *   - the compiler refuses a missing key — a type-level conditional assertion, checked by `tsc`,
 *     with no suppression comment anywhere (Q-08 forbids one in this tree at all).
 *
 * The static import below is deliberately the same specifier shape `src/app/error.tsx` uses
 * (`../ui/strings`, no `/index`): under `moduleResolution: bundler` it must keep resolving after
 * the single file becomes a directory, which is exactly what AC-4 requires of the move.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { STRINGS_MODULE, loadStrings } from "../server/support/wire";
import { strings } from "../../src/ui/strings";
import type { StringKey } from "../../src/ui/strings";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const STRINGS_DIR = "src/ui/strings";
const SPINE_MODULE = "src/ui/strings/spine.ts";
const INDEX_MODULE = "src/ui/strings/index.ts";
const SINGLE_FILE_TABLE = "src/ui/strings.ts";

/**
 * The spine module's copy as the single-file table declared it before the move. AC-4 makes this a
 * fidelity check on the move itself — byte-identical values — so the three pairs are stated here
 * verbatim; the file they came from is deleted by this same change and cannot be read back.
 */
const SPINE_COPY: Record<string, string> = {
  error_title: "Something went wrong on our side",
  error_body: "Your work is safe. The fault has been recorded for the operators — try again, and if it keeps failing, contact support.",
  error_retry: "Try again",
};

/* ------------------------------------------------------ the compiler's refusal (AC-4) */

/** A type-level assertion: the alias only instantiates when its argument is exactly `true`. */
type Assert<T extends true> = T;

/** A key the table does not declare is not a `StringKey` — this is the missing-key compile error. */
type MissingKeyIsRefused = Assert<"no_such_key" extends StringKey ? false : true>;

/** …and a declared key is one, so the guarantee above is not the emptiness of the key union. */
type DeclaredKeyIsAccepted = Assert<"error_title" extends StringKey ? true : false>;

/** A `StringKey` indexes the table — the type and the value are the same table. */
type KeyIndexesTheTable = Assert<StringKey extends keyof typeof strings ? true : false>;

const missingKeyIsRefused: MissingKeyIsRefused = true;
const declaredKeyIsAccepted: DeclaredKeyIsAccepted = true;
const keyIndexesTheTable: KeyIndexesTheTable = true;

/* ---------------------------------------------------------------------------- helpers */

const at = (path: string): string => join(REPO_ROOT, path);

async function moduleAt(relative: string): Promise<Record<string, unknown>> {
  const absolute = at(relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as Record<string, unknown>;
}

/** Is this exported value a string table — a plain record of non-empty strings? */
function isTable(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length > 0 && entries.every(([, entry]) => typeof entry === "string" && entry.length > 0);
}

/**
 * Every module table under `src/ui/strings/`, found by reading the directory — never a roster.
 *
 * A module file's table is its DESIGNATED export: the one named for the file's basename
 * (`spine.ts` → `spine`), the convention the first test proves. Other exports of the file are
 * ignored, because R-SPINE-060 requires each module to have a table — not that everything a module
 * file exports be one; a lawful code→label map or re-exported constant living beside the table is
 * none of this test's business.
 */
async function moduleTables(): Promise<{ file: string; table: Record<string, string> }[]> {
  const dir = at(STRINGS_DIR);
  expect(existsSync(dir) && statSync(dir).isDirectory(), `${STRINGS_DIR} must be a directory of per-module tables (R-SPINE-060)`).toBe(true);
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts") && name !== "index.ts")
    .sort();
  expect(files.length, `${STRINGS_DIR} must hold at least one module table beside its index`).toBeGreaterThan(0);
  const found: { file: string; table: Record<string, string> }[] = [];
  for (const name of files) {
    const designated = name.slice(0, -".ts".length);
    const loaded = await moduleAt(`${STRINGS_DIR}/${name}`);
    const value = loaded[designated];
    expect(isTable(value), `${STRINGS_DIR}/${name} must export \`${designated}\` — a record of non-empty strings keyed by id (R-SPINE-060)`).toBe(true);
    found.push({ file: name, table: value as Record<string, string> });
  }
  return found;
}

/* ------------------------------------------------------------------------------ tests */

describe("AC-4: the string table is per-module and typed", () => {
  test("AC-4: src/ui/strings/spine.ts exports the spine table with the error keys, byte-identical to the copy that moved", async () => {
    const loaded = await moduleAt(SPINE_MODULE);
    const spine = loaded["spine"];
    expect(spine, `${SPINE_MODULE} must export \`spine\``).toBeTypeOf("object");
    expect(isTable(spine), `\`spine\` must be a record of non-empty strings keyed by id (R-SPINE-060)`).toBe(true);
    const table = spine as Record<string, string>;
    // Presence and fidelity, never closure: the spine module may lawfully gain further keys.
    for (const [key, copy] of Object.entries(SPINE_COPY)) {
      expect(table[key], `spine.${key} must carry the value the single-file table declared, byte for byte`).toBe(copy);
    }
  });

  test("AC-4: src/ui/strings/index.ts aggregates every module table under the exported name `strings`", async () => {
    const index = await moduleAt(INDEX_MODULE);
    expect(index["strings"], `${INDEX_MODULE} must export \`strings\``).toBeTypeOf("object");
    // The barrel the app imports (`../ui/strings`) and the index module are the same table.
    expect(index["strings"]).toStrictEqual(strings);

    const tables = await moduleTables();
    const declared = new Map<string, string>();
    for (const { file, table } of tables) {
      for (const key of Object.keys(table)) {
        expect(declared.has(key), `"${key}" is declared by two module tables — ${declared.get(key) ?? "?"} and ${file}; a key has one home`).toBe(false);
        declared.set(key, file);
      }
    }
    const aggregate = index["strings"] as Record<string, string>;
    expect(Object.keys(aggregate).sort(), "the aggregate is exactly the union of the module tables — no key invented in the index, none dropped").toStrictEqual([...declared.keys()].sort());
    for (const { table } of tables) {
      for (const [key, value] of Object.entries(table)) {
        expect(aggregate[key], `strings.${key} must be the module table's own value`).toBe(value);
      }
    }
  });

  test("AC-4: the single-file table is gone", () => {
    expect(existsSync(at(SINGLE_FILE_TABLE)), `${SINGLE_FILE_TABLE} must be deleted — the table is per-module now (R-SPINE-060)`).toBe(false);
  });

  test("AC-4: the acceptance support points at the new home and keeps loading the table", async () => {
    expect(STRINGS_MODULE, "STRINGS_MODULE must be re-pointed at the aggregating index (B-20 re-baseline)").toBe(INDEX_MODULE);
    const loaded = await loadStrings();
    expect(loaded.strings, "loadStrings keeps its name and its shape").toBeTypeOf("object");
    for (const key of Object.keys(SPINE_COPY)) {
      expect(loaded.strings[key], `loadStrings().strings.${key} must resolve through the new home`).toBe(SPINE_COPY[key]);
    }
  });

  test("AC-4: the compiler refuses a key the table does not declare", async () => {
    // The proof is the three type aliases above: `Assert<T extends true>` fails to instantiate when
    // its argument is `false`, so `tsc --noEmit` is what judges this — no suppression comment is
    // written, and none could be (Q-08). The runtime reads them back so they are never dead code.
    expect(missingKeyIsRefused).toBe(true);
    expect(declaredKeyIsAccepted).toBe(true);
    expect(keyIndexesTheTable).toBe(true);

    // …and the union the compiler judges is the one the modules actually declare: every key of
    // every module table is present on the statically imported barrel, and no invented key is.
    for (const { file, table } of await moduleTables()) {
      for (const key of Object.keys(table)) {
        expect(Object.hasOwn(strings, key), `${file} declares "${key}", so \`strings\` — and therefore StringKey — must carry it`).toBe(true);
      }
    }
    expect(Object.keys(strings)).not.toContain("no_such_key");
  });
});
