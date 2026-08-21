/**
 * The refusal register (Q-07), run against the tree on every `pnpm verify`.
 *
 * Q-07: "Refusal register: every code exercised by name or deferred by name; no orphan
 * codes." L-QTY-04 spells out what that is for: "Reason codes are closed enums, never prose;
 * the same taxonomy serves machine refusals and human deferrals; every member of every reason
 * enum is exercised by name in a test or deferred by name."
 *
 * The law has two directions and this file walks both:
 *
 *   - registry → tests. Every registered code is named by some test file, or deferred by
 *     name with a reason. A code nobody has ever made fire is a claim, not a refusal.
 *   - source → registry. Every refusal-shaped literal in product source is a registered
 *     code. An unregistered one is a refusal outside the closed enum: no message, no remedy,
 *     no severity, no surface, and no reader who can act on it.
 *
 * Collecting the evidence is this file's job; judging it is `auditRefusalRegister`'s, which
 * is why the verdict lives in the module and is testable without a tree at all.
 *
 * No code is written out anywhere below — not in an assertion, not in a comment. "Exercised
 * by name" is a name a test file states, and the scan cannot tell an assertion from prose, so
 * a code named here would be a code this very file excused. (The register excludes itself
 * from its own scan for the same reason; naming one anyway would still be dishonest.)
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REFUSAL_CODES, auditRefusalRegister } from '../errors';
import { DEFERRED_REFUSALS } from '../errors/deferrals';

const REPO = process.cwd();

/** This file, repo-relative: it is excluded from the exercised scan (see the header). */
const SELF = 'src/core/__tests__/refusal-register.test.ts';

/** The module registries. Excluded from both scans: declaring a code is not spelling one. */
const REGISTRIES = 'src/core/errors/';

/** Refusal code grammar, per the Increment Spec. Anchored: a whole literal, or nothing. */
const CODE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;

/**
 * The same grammar, unanchored, for reading a test. A test may name a code as a string, as a
 * pattern inside `toThrow(/…/)`, or in the sentence that explains what it is checking — all
 * three are the code named by a test, and none of them is more of an exercise than another.
 */
const NAMED = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;

/** Directories with nothing of the product in them; dot-directories go the same way. */
const SKIP = new Set(['node_modules', 'out', 'dist', 'coverage', 'test-results', 'cad']);

/** Every file under a repo-relative directory, as repo-relative POSIX paths. */
function walk(dir: string): string[] {
  const absolute = join(REPO, dir);
  if (!existsSync(absolute)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP.has(entry.name)) continue;
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...walk(child));
    else found.push(child);
  }
  return found;
}

/** The whole tree, every lane of it: a test that names a code counts wherever it runs. */
const treeFiles = (): string[] => walk('src').concat(walk('db'), walk('tests'), walk('scripts'));

const read = (rel: string): string => readFileSync(join(REPO, rel), 'utf8');

/**
 * Every string literal in a TypeScript file, with the offset it started at, comments left
 * out. A regex over quote characters reads the apostrophe in a comment's prose as an opening
 * quote and then swallows everything up to the next one, so this walks the text: a comment is
 * skipped whole, and a quote inside one is a character in a sentence.
 */
function literals(text: string): { value: string; start: number }[] {
  const found: { value: string; start: number }[] = [];
  let i = 0;
  while (i < text.length) {
    const pair = text.slice(i, i + 2);
    if (pair === '//') {
      const end = text.indexOf('\n', i);
      i = end === -1 ? text.length : end + 1;
      continue;
    }
    if (pair === '/*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }
    const quote = text[i];
    if (quote !== "'" && quote !== '"' && quote !== '`') {
      i += 1;
      continue;
    }
    const start = i;
    i += 1;
    let value = '';
    while (i < text.length && text[i] !== quote) {
      if (text[i] === '\\') {
        i += 2;
        continue;
      }
      value += text[i];
      i += 1;
    }
    i += 1;
    found.push({ value, start });
  }
  return found;
}

/**
 * A literal read as the key of `process.env` is an environment variable's name and shares the
 * refusal grammar by coincidence. Calling one an orphan would make the environment part of
 * the taxonomy, so the scan looks at what stands immediately in front of the literal.
 */
const ENV_KEY = /\benv\s*\[\s*$/;

/** The refusal-shaped literals in one product file. */
function codesIn(text: string): string[] {
  const found: string[] = [];
  for (const literal of literals(text)) {
    if (!CODE.test(literal.value)) continue;
    if (ENV_KEY.test(text.slice(Math.max(0, literal.start - 20), literal.start))) continue;
    found.push(literal.value);
  }
  return found;
}

const isTest = (rel: string): boolean => rel.endsWith('.test.ts') || rel.endsWith('.test.tsx');

/** A test whose names count as exercise: any in the tree but the registries and this file. */
const countsAsExercise = (rel: string): boolean =>
  isTest(rel) && !rel.startsWith(REGISTRIES) && rel !== SELF;

/** Product source: TypeScript under src/**, outside the registries and outside every test. */
const countsAsSource = (rel: string): boolean =>
  rel.startsWith('src/') &&
  (rel.endsWith('.ts') || rel.endsWith('.tsx')) &&
  !rel.startsWith(REGISTRIES) &&
  !rel.split('/').includes('__tests__');

/** One walk of the tree, both scans, so the two findings are read off the same evidence. */
function scanTree(): { exercised: string[]; spelledInSource: string[] } {
  const exercised = new Set<string>();
  const spelledInSource = new Set<string>();
  for (const rel of treeFiles()) {
    if (countsAsExercise(rel)) {
      const text = read(rel);
      for (const match of text.matchAll(NAMED)) exercised.add(match[0]);
    }
    if (countsAsSource(rel)) {
      for (const code of codesIn(read(rel))) spelledInSource.add(code);
    }
  }
  return { exercised: [...exercised], spelledInSource: [...spelledInSource] };
}

const list = (codes: readonly string[]): string => codes.join(', ');

describe('Q-07 — the refusal register', () => {
  const { exercised, spelledInSource } = scanTree();
  const deferred = DEFERRED_REFUSALS.map((row) => String(row.code));

  it('deferrals are declared by name, with a reason', () => {
    // A deferral with no reason is an untested code with extra steps; a code deferred twice
    // is two people each believing the other wrote the test.
    for (const row of DEFERRED_REFUSALS) {
      expect(row.reason.trim(), `${row.code}: deferred with no reason`).not.toBe('');
    }
    expect(new Set(deferred).size, `a code is deferred twice: ${list(deferred)}`).toBe(
      deferred.length,
    );
  });

  it('every registered code is exercised by name or deferred by name, and no code is an orphan', () => {
    const result = auditRefusalRegister({
      registered: REFUSAL_CODES,
      exercised,
      deferred,
      spelledInSource,
    });

    expect(
      result.unexercised,
      `registered, but named by no test and by no deferral: ${list(result.unexercised)}`,
    ).toEqual([]);
    expect(
      result.danglingDeferrals,
      `deferred by name, but registered nowhere: ${list(result.danglingDeferrals)}`,
    ).toEqual([]);
    expect(
      result.orphans,
      `spelled in product source, unknown to the registry: ${list(result.orphans)}`,
    ).toEqual([]);
    expect(result.ok, 'the register is not clean').toBe(true);
  });
});
