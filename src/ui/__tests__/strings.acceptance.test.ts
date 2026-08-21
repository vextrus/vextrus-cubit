/**
 * inc-003 acceptance — the typed string table (AC-3, R-SPINE-060).
 *
 * R-SPINE-060: "Every user-facing string lives in one typed string table (`src/ui/strings.ts`
 * per module) keyed by id with English values; the compiler refuses a missing key; no string
 * literals in JSX except test ids and codes. Not a translation system — a readiness rule."
 *
 * Recorded interpretation (Increment Spec, risk note 1): "one typed string table
 * (`src/ui/strings.ts` per module)" is read as one composed table at `src/ui/strings.ts`
 * folding per-module tables under `src/ui/strings/` — the same fold `src/core/errors.ts`
 * already performs over `src/core/errors/`. This suite holds the runtime half of the rule;
 * the compiler half — a key nobody registered is a compile error, not a runtime lookup that
 * returns undefined — is proved mechanically by the tsc fixture projects under
 * `tests/lint-fixtures/format/`, driven from tests/lint-fixtures/string-table.test.ts.
 *
 * The table is loaded inside each test so that a table which does not exist yet reads as one
 * missing behaviour per test rather than a single collection error. The type-only import is
 * erased before the module is ever resolved, so it costs nothing at run time and still makes
 * `StringKey` part of what tsc checks.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { StringKey } from '../strings';

const REPO = process.cwd();

/** R-SPINE-060 names the file; the per-module tables live in the directory beside it. */
const TABLE_PATH = 'src/ui/strings.ts';
const MODULES_DIR = 'src/ui/strings';

/** The composed table, per test (see the file header). */
const table = async () => await import('../strings');

/** The spine module's own table, likewise. */
const spineTable = async () => await import('../strings/spine');

/** English values, per R-SPINE-060: a Bengali value is a translation, and not this rule. */
const BENGALI = /[ঀ-৿]/;

/** A key: a module prefix, a dot, and an id. */
const KEY = /^[a-z][a-z0-9]*\.[A-Za-z0-9][A-Za-z0-9.]*$/;

/** The module names the fold has to account for, read off the directory. */
function moduleNames(): string[] {
  return readdirSync(join(REPO, MODULES_DIR))
    .filter((entry) => entry.endsWith('.ts'))
    .map((entry) => entry.replace(/\.ts$/, ''))
    .sort();
}

/** The module specifiers `src/ui/strings.ts` names — a barrel reaches for its leaves only. */
function tableSpecifiers(): string[] {
  const source = readFileSync(join(REPO, TABLE_PATH), 'utf8');
  const found: string[] = [];
  for (const match of source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) {
    const specifier = match[1];
    if (specifier !== undefined) found.push(specifier);
  }
  for (const match of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const specifier = match[1];
    if (specifier !== undefined) found.push(specifier);
  }
  return found;
}

const entries = (strings: Record<string, unknown>): [string, unknown][] => Object.entries(strings);

describe('AC-3 — one typed string table, composed and frozen (R-SPINE-060)', () => {
  it('answers t(“spine.appName”) with the product’s name', async () => {
    const { t } = await table();

    // The one value the Increment Spec pins by name, and the type that guards the lookup:
    // this binding does not compile unless StringKey is exported and covers the key.
    const key: StringKey = 'spine.appName';
    expect(t(key)).toBe('Vextrus CUBIT');
  });

  it('exposes the whole table frozen, with t reading from it and nowhere else', async () => {
    const { STRINGS, t } = await table();
    const strings = STRINGS as Record<string, string>;

    expect(entries(strings).length).toBeGreaterThan(0);
    // Frozen for the reason the refusal registries are: a table an importer can edit at run
    // time is not "one string table", it is a default.
    expect(Object.isFrozen(STRINGS)).toBe(true);
    const mutable = STRINGS as unknown as Record<string, unknown>;
    expect(() => {
      mutable['spine.appName'] = 'something else';
    }).toThrow();
    expect(strings['spine.appName']).toBe('Vextrus CUBIT');

    // t is the reader, not a second table: every key answers with its registered value.
    for (const [key, value] of entries(strings)) {
      expect(t(key as StringKey), `t disagrees with STRINGS at ${key}`).toBe(value);
    }
  });

  it('keys every value by module, in English, with nothing blank', async () => {
    const { STRINGS } = await table();
    const strings = STRINGS as Record<string, string>;
    const modules = moduleNames();

    expect(modules, 'the spine module has no table').toContain('spine');
    for (const [key, value] of entries(strings)) {
      expect(KEY.test(key), `${key} is not a module-prefixed key`).toBe(true);
      const prefix = key.slice(0, key.indexOf('.'));
      expect(modules, `${key} belongs to no module table under ${MODULES_DIR}`).toContain(prefix);
      expect(typeof value, `${key} is not a string`).toBe('string');
      expect(String(value).trim(), `${key} is blank`).not.toBe('');
      // R-SPINE-060 is a readiness rule: English values today, and a table ready to carry
      // more later. A Bengali value would be a translation system nobody asked for yet.
      expect(BENGALI.test(String(value)), `${key} is not an English value`).toBe(false);
    }
  });

  it('composes the per-module tables, whole, and imports nothing else', async () => {
    const { STRINGS } = await table();
    const { SPINE_STRINGS } = await spineTable();
    const strings = STRINGS as Record<string, string>;
    const spine = SPINE_STRINGS as Record<string, string>;

    // Every specifier the composed table names points at a per-module table beside it.
    const specifiers = tableSpecifiers();
    expect(specifiers.length, 'the table composes nothing').toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(specifier, `${specifier} is not a module table under ${MODULES_DIR}/`).toMatch(
        /^\.\/strings\/[A-Za-z0-9._-]+$/,
      );
    }

    // The spine module's keys are its own, and the fold carries them across untouched.
    expect(entries(spine).length).toBeGreaterThan(0);
    expect(spine['spine.appName']).toBe('Vextrus CUBIT');
    for (const [key, value] of entries(spine)) {
      expect(key.startsWith('spine.'), `${key} is in the spine table under another prefix`).toBe(
        true,
      );
      expect(strings[key], `${key} is in SPINE_STRINGS and not in STRINGS`).toBe(value);
    }
  });
});
