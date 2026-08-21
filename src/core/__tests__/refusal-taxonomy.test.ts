/**
 * inc-002 acceptance — the closed refusal taxonomy (AC-1).
 *
 * R-SPINE-062: "Closed refusal taxonomy in `src/core/errors.ts`: every code has an English
 * message, a remedy hint, a severity and a surface hint; the refusal register test (Q-07)
 * covers it." L-QTY-04 is what makes the closure matter: "Reason codes are closed enums,
 * never prose; the same taxonomy serves machine refusals and human deferrals."
 *
 * Everything here is read from the composed barrel, because the barrel is the only import
 * surface the rest of the tree is allowed to know. The one exception is the structural
 * assertion that the barrel composes — that one reads the barrel's own text, since "the
 * barrel composes only per-module registries under src/core/errors/" is a claim about how
 * the file is built and not about what it exports.
 *
 * Codes are assembled from parts wherever this file names one (`CODE_PARTS` below), and no
 * code is written out anywhere in this file — not in an assertion, not in a comment. "A code
 * exercised by name in a test" (L-QTY-04) is a name a test file states, and a scan for it
 * cannot tell an assertion from prose. This file reads the table rather than exercising any
 * refusal in it, so writing one out here would hand Q-07 a pass no test had earned.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REFUSALS, REFUSAL_CODES, auditRefusalRegister } from '../errors';
import type { RefusalCode, RefusalEntry, RefusalSeverity, RefusalSurface } from '../errors';
import { SPINE_REFUSALS } from '../errors/spine';

const REPO = process.cwd();

/** RefusalSeverity, as the Increment Spec closes it. Widening this set is a spec revision. */
const SEVERITIES: readonly RefusalSeverity[] = ['block', 'defer', 'warn'];

/** RefusalSurface, likewise closed. */
const SURFACES: readonly RefusalSurface[] = ['field', 'toast', 'page', 'log'];

/** RefusalEntry: exactly these five fields, all required, no extras. */
const ENTRY_FIELDS = ['code', 'message', 'remedy', 'severity', 'surface'];

/**
 * The Bengali block. Out of scope here: "String-table integration and bn-BD anything —
 * messages are English per R-SPINE-062". A message written in Bengali is a message that
 * skipped the string table, not a translated one.
 */
const BENGALI = /[ঀ-৿]/;

/**
 * The two codes src/core/db.ts already spells, assembled so that this file does not itself
 * count as their exercise (see the header). The seam's own refusals are exercised by tests
 * of `forTenant` and `runAsSystem`, or deferred by name with a reason — never by a registry
 * test that only reads the table.
 */
const CODE_PARTS: readonly (readonly string[])[] = [
  ['SYSTEM', 'REASON', 'REQUIRED'],
  ['TENANT', 'ID', 'INVALID'],
];

const sorted = (values: readonly string[]): string[] => [...values].sort();

/** Every entry, with the key it is filed under. */
const rows = (): { key: string; entry: RefusalEntry }[] =>
  Object.entries(REFUSALS).map(([key, entry]) => ({ key, entry: entry as RefusalEntry }));

/**
 * The module specifiers `src/core/errors.ts` names, static and re-exported alike. A barrel
 * that composes reaches for its module registries and nothing else.
 */
function barrelSpecifiers(): string[] {
  const source = readFileSync(join(REPO, 'src', 'core', 'errors.ts'), 'utf8');
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

describe('AC-1 — the barrel is the taxonomy (R-SPINE-062, L-QTY-04)', () => {
  it('exports the registry, the code list and the register verdict function', () => {
    // R-SPINE-062: the taxonomy lives at src/core/errors.ts, and this is its export surface.
    expect(typeof REFUSALS).toBe('object');
    expect(Array.isArray(REFUSAL_CODES)).toBe(true);
    expect(typeof auditRefusalRegister).toBe('function');

    // The types are part of the surface: these bindings do not compile without them.
    const codes: readonly RefusalCode[] = REFUSAL_CODES;
    const entries: readonly RefusalEntry[] = rows().map((row) => row.entry);
    expect(codes.length).toBe(entries.length);
    expect(SEVERITIES.length).toBe(3);
    expect(SURFACES.length).toBe(4);
  });

  it('registers at least one code, and REFUSAL_CODES is exactly the registry keys', () => {
    // L-QTY-04: "Reason codes are closed enums" — the enum is REFUSAL_CODES, and the table
    // it indexes is REFUSALS. A key in one and not the other is a code with no meaning or a
    // meaning with no code.
    const keys = Object.keys(REFUSALS);
    expect(keys.length).toBeGreaterThan(0);
    expect(sorted(REFUSAL_CODES)).toEqual(sorted(keys));
    expect(new Set(REFUSAL_CODES).size, 'REFUSAL_CODES carries a duplicate').toBe(
      REFUSAL_CODES.length,
    );
  });

  it('gives every code an English message, a remedy, a closed severity and a closed surface', () => {
    for (const { key, entry } of rows()) {
      // R-SPINE-062, verbatim: message, remedy hint, severity, surface hint — each present.
      expect(sorted(Object.keys(entry)), `${key}: RefusalEntry is exactly five fields`).toEqual(
        sorted(ENTRY_FIELDS),
      );
      expect(entry.code, `${key}: entry.code disagrees with its registry key`).toBe(key);
      expect(entry.message.trim(), `${key}: empty message`).not.toBe('');
      expect(entry.remedy.trim(), `${key}: empty remedy`).not.toBe('');
      // "An English message": a sentence a reader can act on, not the code again. The
      // string table and bn-BD are a later increment's work — English is the law today.
      expect(entry.message, `${key}: the message is the code, not a message`).not.toBe(key);
      expect(entry.message.includes(' '), `${key}: the message is a single token`).toBe(true);
      expect(BENGALI.test(entry.message), `${key}: the message is not English`).toBe(false);
      expect(SEVERITIES, `${key}: severity outside the closed set`).toContain(entry.severity);
      expect(SURFACES, `${key}: surface outside the closed set`).toContain(entry.surface);
    }
  });

  it('composes only per-module registries under src/core/errors/', () => {
    // R-SPINE-062 names src/core/errors.ts; the leaf mandates per-module files beneath it.
    // The barrel is the import surface and the module files are the registers, so every
    // specifier the barrel names points into src/core/errors/.
    const specifiers = barrelSpecifiers();
    expect(specifiers.length, 'the barrel composes nothing').toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(specifier, `${specifier} is not a module registry under src/core/errors/`).toMatch(
        /^\.\/errors\/[A-Za-z0-9._-]+$/,
      );
    }
  });

  it('folds SPINE_REFUSALS in whole, entry for entry', () => {
    // The spine module registry is today's only leaf; the barrel adds nothing to it and
    // takes nothing away.
    const spineKeys = Object.keys(SPINE_REFUSALS);
    expect(spineKeys.length).toBeGreaterThan(0);
    for (const key of spineKeys) {
      expect(REFUSAL_CODES, `${key} is in SPINE_REFUSALS but not in the barrel`).toContain(key);
      expect(Object.entries(REFUSALS).find(([code]) => code === key)?.[1]).toEqual(
        Object.entries(SPINE_REFUSALS).find(([code]) => code === key)?.[1],
      );
    }
  });

  it('closes the taxonomy over the two codes the seam already spells', () => {
    // The Increment Spec: "The two codes already living in src/core/db.ts … become
    // registered members, closing the taxonomy over everything the tree already spells."
    // They are the seam's system-reason refusal and its tenant-id refusal, assembled from
    // CODE_PARTS and never written out — see the file header for why.
    for (const parts of CODE_PARTS) {
      const code = parts.join('_');
      expect(REFUSAL_CODES, `${code} is spelled by the seam and unknown to the registry`).toContain(
        code,
      );
      expect(Object.keys(SPINE_REFUSALS), `${code} belongs to the spine module`).toContain(code);
    }
  });
});
