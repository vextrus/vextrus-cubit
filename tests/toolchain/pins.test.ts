/**
 * inc-000 acceptance — the pinned toolchain surface (C-06, B-15, AM-02, AC-4, AC-5).
 *
 * Static contract only: every assertion here reads a committed file — the working tree's,
 * or (for the one claim that is about what increment zero delivered) inc-000's own commit,
 * read with `git ls-tree`. Nothing here starts a build or a server, so it is safe to run
 * inside `pnpm verify`'s own vitest stage.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();

const read = (rel: string): string => readFileSync(join(REPO, rel), 'utf8');

const git = (args: string[]): string =>
  execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/**
 * Reads the tree increment zero delivered: `entries('')` is its top level, `entries('tests/')`
 * what its test tree carried. Null when this checkout cannot answer (no `.git`, or a history
 * that does not reach inc-000). AM-02 is a claim about that commit and not about every tree
 * after it, so it is asked of the commit.
 */
function incZeroTree(): ((dir: string) => string[]) | null {
  try {
    // The delivered unit is the oldest commit whose SUBJECT names the increment; a later
    // commit that merely mentions it in a body is not it.
    const delivered = git(['log', '--format=%H%x00%s'])
      .split('\n')
      .filter((line) => (line.split('\0')[1] ?? '').includes('inc-000-foundation'))
      .at(-1)
      ?.split('\0')[0];
    if (delivered === undefined) return null;
    return (dir: string) =>
      git(['ls-tree', '--name-only', delivered, dir === '' ? '.' : dir])
        .split('\n')
        .filter(Boolean);
  } catch {
    return null;
  }
}

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
  it('C-06: every file the interfaces section names is delivered', () => {
    const missing = INTERFACE_FILES.filter((rel) => !existsSync(join(REPO, rel)));
    expect(missing).toEqual([]);

    // C-06: eslint-rules/*.mjs is the `cubit` plugin — the NEVERs as named rules.
    expect(existsSync(join(REPO, 'eslint-rules'))).toBe(true);
    const ruleFiles = readdirSync(join(REPO, 'eslint-rules')).filter((f) => f.endsWith('.mjs'));
    expect(ruleFiles.length).toBeGreaterThan(0);

    // C-10 (leaf note): traceability.json is gate-owned; the script ships, the JSON does not.
    expect(existsSync(join(REPO, 'docs/traceability.json'))).toBe(false);
  });

  it('AM-02: increment zero shipped the toolchain ONLY — no product tree in its delivered unit', (ctx) => {
    // "Increment zero is the toolchain ONLY" is a fact about what inc-000 delivered, not a
    // ban on every tree that follows it: the foundation series founds src/ and db/ (inc-001
    // founds both, with SEAM-TENANT and the schema root), and C-06 arms their lanes as they
    // appear. So the claim is put to inc-000's own commit, where it stays true forever.
    const entries = incZeroTree();
    if (entries === null) {
      // Recorded reason, never a silent pass: this checkout has no history to read.
      ctx.skip('AM-02 snapshot: inc-000-foundation is not reachable in this checkout');
      return;
    }
    const top = entries('');
    for (const forbidden of ['src', 'db', 'documents']) {
      expect(top, forbidden).not.toContain(forbidden);
    }
    // tests/ shipped — the toolchain's own suite. What it did not carry was a journey tree.
    expect(top).toContain('tests');
    expect(entries('tests/')).not.toContain('tests/e2e');
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
