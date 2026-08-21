/**
 * Q-08 — no suppression, no `.skip`/`.only`, no explicit `any` in a change
 * without a recorded reason (structural diff check).
 *
 * The structural check reads text, so it cannot tell a suppression from the
 * fixture that proves a suppression is caught. This test is the mechanical
 * form of that distinction (B-05: prose is not enforcement): every Q-08
 * construct on the toolchain surface must sit at one of the three fixture
 * sites below, each of which carries the recorded reason `GUARDRAIL_FIXTURE`
 * in its header and is listed in docs/toolchain.md. A construct anywhere else
 * on the surface — a script, a config, the rules themselves, this file, the
 * docs — fails here.
 *
 * The constructs are assembled from their parts rather than spelled, for the
 * same reason: a check that spells what it forbids reports itself.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

/**
 * The toolchain surface this increment delivers — its ownership paths, and the
 * only files it can be asked to answer for. A later increment that adds a root
 * of its own adds it here; product code is policed by the rules themselves
 * (cubit/no-suppressions, cubit/no-skip-only, no-explicit-any) over src/**.
 */
const SURFACE: readonly string[] = [
  '.github/workflows',
  'cad',
  'docs/toolchain.md',
  'drizzle.config.ts',
  'eslint-rules',
  'eslint.config.mjs',
  'fixtures',
  'package.json',
  'playwright.config.ts',
  'scripts',
  'tests/lint-fixtures',
  // The acceptance suite is part of the change this increment makes, so Q-08's
  // structural check reads it too: a suite that reached for `.only` to get
  // itself green would be the exact failure Q-08 names.
  'tests/toolchain',
  'tsconfig.json',
  'vitest.config.ts',
];

/** Build output and dependency trees are nobody's change. */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', '.next-verify', '.cubit-scratch', '.venv']);

const TEXT = new Set([
  '.ts',
  '.tsx',
  '.mjs',
  '.js',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.toml',
  '.css',
]);

const LINT_DIRECTIVE = ['eslint', 'disable'].join('-');
const TYPE_SUPPRESSIONS = ['ignore', 'expect-error', 'nocheck'].map((word) => `@ts-${word}`);

interface Construct {
  readonly name: string;
  readonly pattern: RegExp;
}

const CONSTRUCTS: readonly Construct[] = [
  { name: 'a lint-disable directive', pattern: new RegExp(`\\b${LINT_DIRECTIVE}(-next-line|-line)?\\b`) },
  ...TYPE_SUPPRESSIONS.map((directive) => ({
    name: `a type-error suppression (${directive.slice(0, 4)}…)`,
    pattern: new RegExp(directive),
  })),
  { name: 'a skip/only marker', pattern: /\.(skip|only)\s*\(/ },
  { name: 'an explicit any', pattern: /:\s*any\b|<\s*any\s*>|,\s*any\s*>/ },
];

/** file → the recorded reason that permits the construct to live there. */
const RECORDED = new Map<string, string>([
  ['tests/lint-fixtures/no-suppressions/bad.ts', 'GUARDRAIL_FIXTURE (cubit/no-suppressions)'],
  ['tests/lint-fixtures/no-skip-only/bad.ts', 'GUARDRAIL_FIXTURE (cubit/no-skip-only)'],
  ['tests/lint-fixtures/no-explicit-any/bad.ts', 'GUARDRAIL_FIXTURE (no-explicit-any)'],
]);

function walk(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (entry.isFile() && TEXT.has(path.extname(entry.name))) {
      out.push(path.relative(ROOT, path.join(dir, entry.name)).split(path.sep).join('/'));
    }
  }
  return out;
}

const surfaceFiles = (): string[] => {
  const files: string[] = [];
  for (const entry of SURFACE) {
    const full = path.join(ROOT, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else {
      files.push(entry);
    }
  }
  return files.sort();
};

describe('Q-08 the constructs are confined to their recorded sites', () => {
  const files = surfaceFiles();

  it('Q-08: the surface is walked, not assumed', () => {
    expect(
      files.length,
      'the walk found next to no files — the check would pass vacuously',
    ).toBeGreaterThan(20);
    for (const site of RECORDED.keys()) {
      expect(files, `${site} is missing; AC-2 requires it`).toContain(site);
    }
  });

  it('Q-08: no suppression, skip/only or explicit any outside the recorded sites', () => {
    const offences: string[] = [];
    for (const file of files) {
      if (RECORDED.has(file)) continue;
      const lines = readFileSync(path.join(ROOT, file), 'utf8').split('\n');
      lines.forEach((line, index) => {
        for (const construct of CONSTRUCTS) {
          if (construct.pattern.test(line)) {
            offences.push(`${file}:${index + 1} holds ${construct.name}`);
          }
        }
      });
    }
    expect(
      offences,
      'Q-08: record the reason in docs/toolchain.md and the file header, or delete the construct',
    ).toEqual([]);
  });

  it('Q-08: each recorded site says so in its own header', () => {
    const missing: string[] = [];
    for (const [site, reason] of RECORDED) {
      const header = readFileSync(path.join(ROOT, site), 'utf8').slice(0, 600);
      if (!header.includes('RECORDED REASON GUARDRAIL_FIXTURE')) {
        missing.push(`${site} does not carry its recorded reason — ${reason}`);
      }
    }
    expect(missing, 'a construct without a reason at the site is a bare suppression').toEqual([]);
  });
});
