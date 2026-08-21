/**
 * inc-000 acceptance — the pinned toolchain surface (C-06, B-15, AM-02, AC-4, AC-5).
 *
 * Static contract only: every assertion here reads a committed file. Nothing in this
 * file starts a process, so it is safe to run inside `pnpm verify`'s own vitest stage.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();

const read = (rel: string): string => readFileSync(join(REPO, rel), 'utf8');

type Manifest = {
  name?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type TsConfig = {
  include?: string[];
  exclude?: string[];
  compilerOptions?: Record<string, unknown>;
};

/**
 * A string-aware JSONC reader. tsconfig.json is JSONC, and TypeScript itself reads it
 * with full string awareness: a `/*` inside a JSON string (a `paths` alias, a glob) is
 * data, not the start of a comment. A regex-based stripper gets that wrong and fails on
 * an unrelated assertion, so this walks the text once.
 */
function parseJsonc<T>(text: string): T {
  let out = '';
  let inString = false;
  let escaped = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i] ?? '';
    const next = text[i + 1] ?? '';
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (ch === ',') {
      // Drop a trailing comma: JSONC allows it before a closing brace or bracket.
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j] ?? '')) j += 1;
      const after = text[j] ?? '';
      if (after === '}' || after === ']') {
        i += 1;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return JSON.parse(out) as T;
}

const manifest = (): Manifest => parseJsonc<Manifest>(read('package.json'));

/** Every file the Increment Spec's `interfaces` section names as delivered. */
const INTERFACE_FILES = [
  '.nvmrc',
  '.gitignore',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'eslint.config.mjs',
  'vitest.config.ts',
  'playwright.config.ts',
  'drizzle.config.ts',
  'scripts/verify.mjs',
  'scripts/checkup.mjs',
  'scripts/db-migrate.mjs',
  'scripts/db-drift.mjs',
  'scripts/method-hashes.mjs',
  'scripts/e2e.mjs',
  'scripts/seed.mjs',
  'scripts/gen-fixtures.mjs',
  'scripts/traceability.mjs',
  '.github/workflows/ci.yml',
  'cad/pyproject.toml',
  'cad/uv.lock',
  'fixtures/gen/README.md',
  'docs/toolchain.md',
];

/** C-06's package.json scripts block, in full. */
const SCRIPTS = [
  'verify',
  'checkup',
  'dev',
  'build',
  'start',
  'worker',
  'test:db',
  'e2e',
  'test:golden',
  'test:docs',
  'test:perf',
  'db:migrate',
  'db:drift',
  'seed',
  'gen:fixtures',
  'traceability',
];

/** The Increment Spec's declared dependencies — the whole stack, pinned here once. */
const DECLARED_DEPENDENCIES = [
  'next',
  'react',
  'react-dom',
  'typescript',
  'zod',
  '@trpc/server',
  '@trpc/client',
  '@trpc/react-query',
  '@tanstack/react-query',
  'drizzle-orm',
  'drizzle-kit',
  'pg',
  '@types/pg',
  'pg-boss',
  'better-auth',
  'decimal.js',
  'tailwindcss',
  'motion',
  'lucide-react',
  '@tanstack/react-table',
  '@tanstack/react-virtual',
  'cmdk',
  'zustand',
  'pixi.js',
  'recharts',
  'exceljs',
  '@playwright/test',
  '@axe-core/playwright',
  'vitest',
  'eslint',
  'typescript-eslint',
  '@types/node',
  '@types/react',
  '@types/react-dom',
];

describe('inc-000 — the toolchain is born whole (C-06, B-15)', () => {
  it('C-06: every file the interfaces section names is delivered, and no product tree ships (AM-02)', () => {
    const missing = INTERFACE_FILES.filter((rel) => !existsSync(join(REPO, rel)));
    expect(missing).toEqual([]);

    // C-06: eslint-rules/*.mjs is the `cubit` plugin — the NEVERs as named rules.
    expect(existsSync(join(REPO, 'eslint-rules'))).toBe(true);
    const ruleFiles = readdirSync(join(REPO, 'eslint-rules')).filter((f) => f.endsWith('.mjs'));
    expect(ruleFiles.length).toBeGreaterThan(0);

    // AM-02: increment zero is the toolchain ONLY — tokens, primitives, shell and the
    // auth scaffold are later foundation-series increments. src/ and db/ were born in
    // inc-001, which founded SEAM-TENANT and the schema root; what inc-000 shipped is a
    // matter of its own commit, and the trees below are the ones still unborn.
    for (const forbidden of ['documents', 'tests/e2e']) {
      expect(existsSync(join(REPO, forbidden))).toBe(false);
    }

    // C-10 (leaf note): traceability.json is gate-owned; the script ships, the JSON does not.
    expect(existsSync(join(REPO, 'docs/traceability.json'))).toBe(false);
  });

  it('AC-5 / C-06: .nvmrc is the single line 24', () => {
    const raw = read('.nvmrc');
    expect(raw.trim()).toBe('24');
    expect(raw.trim().split('\n')).toHaveLength(1);
  });

  it('AC-5 / C-06: packageManager names an exact pnpm 10', () => {
    expect(manifest().packageManager ?? '').toMatch(/^pnpm@10\.\d+\.\d+(?:\+sha[\w.-]+)?$/);
  });

  it('AC-5 / C-06: every dependency version is exact — no caret, no tilde, no range', () => {
    const m = manifest();
    const all = { ...(m.dependencies ?? {}), ...(m.devDependencies ?? {}) };
    expect(Object.keys(all).length).toBeGreaterThan(0);
    const loose = Object.entries(all).filter(([, range]) => !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(range));
    expect(loose).toEqual([]);
  });

  it('C-06: the whole declared stack is pinned here, once', () => {
    const m = manifest();
    const all = { ...(m.dependencies ?? {}), ...(m.devDependencies ?? {}) };
    const missing = DECLARED_DEPENDENCIES.filter((name) => !(name in all));
    expect(missing).toEqual([]);
  });

  it('AC-4 / C-06: package.json defines the full scripts block', () => {
    const scripts = manifest().scripts ?? {};
    const missing = SCRIPTS.filter((name) => typeof scripts[name] !== 'string');
    expect(missing).toEqual([]);
  });

  it('C-06: strict, noUncheckedIndexedAccess and exactOptionalPropertyTypes are on', () => {
    expect(existsSync(join(REPO, 'tsconfig.json'))).toBe(true);
    const tsconfig = parseJsonc<TsConfig>(read('tsconfig.json'));
    const options = tsconfig.compilerOptions ?? {};
    expect(options['strict']).toBe(true);
    expect(options['noUncheckedIndexedAccess']).toBe(true);
    expect(options['exactOptionalPropertyTypes']).toBe(true);
    // Risk note 3: tsc with an empty include errors "no inputs" before src/ exists.
    expect(tsconfig.include ?? []).not.toHaveLength(0);
  });

  it('AC-5 / C-06: cad/ pins Python 3.13 with ruff and pytest, and the lock is committed', () => {
    const pyproject = read('cad/pyproject.toml');
    expect(pyproject).toMatch(/requires-python\s*=\s*["'][^"']*3\.13/);
    expect(pyproject).toMatch(/\bruff\s*==\s*\d+\.\d+(?:\.\d+)?/);
    expect(pyproject).toMatch(/\bpytest\s*==\s*\d+\.\d+(?:\.\d+)?/);
    expect(read('cad/uv.lock').length).toBeGreaterThan(0);
  });

  it('AC-5 / C-06: docs/toolchain.md records the typst and LibreDWG pins', () => {
    const doc = read('docs/toolchain.md');
    const lines = doc.split('\n');
    const typst = lines.filter((l) => /typst/i.test(l));
    expect(typst.some((l) => /\b0\.15\.\d+\b/.test(l))).toBe(true);
    // V-CHECKUP: a pin is a version *and* a hash, or the machine cannot check it.
    expect(doc).toMatch(/\b[0-9a-f]{64}\b/);
    const libredwg = lines.filter((l) => /libredwg/i.test(l));
    expect(libredwg.some((l) => /\b0\.13\.\d+\b/.test(l))).toBe(true);
  });

  it('AC-5 / C-06: CI installs the pinned toolchain and runs verify on push and pull_request', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toMatch(/^\s*push\s*:/m);
    expect(ci).toMatch(/^\s*pull_request\s*:/m);
    expect(ci).toContain('.nvmrc');
    expect(ci).toMatch(/corepack/);
    expect(ci).toMatch(/\buv\b/);
    expect(ci).toMatch(/pnpm install --frozen-lockfile/);
    expect(ci).toMatch(/pnpm (run )?verify/);
  });
});
