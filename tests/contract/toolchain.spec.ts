import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
const readJson = (p: string) => JSON.parse(read(p)) as Record<string, unknown>;

describe('AC-01 pinned toolchain (C-06, B-15)', () => {
  it('AC-01: .nvmrc names Node 24 LTS', () => {
    const nvmrc = read('.nvmrc').trim();
    expect(nvmrc).toMatch(/^v?24(\.\d+){0,2}$/);
  });

  it('AC-01: package.json packageManager pins pnpm 10 exactly', () => {
    const pkg = readJson('package.json');
    // exact pin: pnpm@10.x.y (optionally with an integrity hash), never a range
    expect(String(pkg.packageManager)).toMatch(/^pnpm@10\.\d+\.\d+(\+sha\S+)?$/);
  });

  it('AC-01: .npmrc has save-exact=true', () => {
    expect(read('.npmrc')).toMatch(/^\s*save-exact\s*=\s*true\s*$/m);
  });

  it('AC-01: tsconfig has strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes', () => {
    const raw = read('tsconfig.json');
    // tsconfig may carry comments; strip them before parsing
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
    const tsconfig = JSON.parse(stripped) as { compilerOptions?: Record<string, unknown> };
    const co = tsconfig.compilerOptions ?? {};
    expect(co.strict).toBe(true);
    expect(co.noUncheckedIndexedAccess).toBe(true);
    expect(co.exactOptionalPropertyTypes).toBe(true);
  });

  it('AC-04: tsconfig excludes tests/lint-fixtures from the tree-wide type-check', () => {
    const raw = read('tsconfig.json');
    expect(raw).toMatch(/lint-fixtures/);
  });
});

describe('AC-02 the full package.json scripts block (C-06)', () => {
  const REQUIRED_SCRIPTS = [
    'dev',
    'build',
    'start',
    'lint',
    'typecheck',
    'test',
    'verify',
    'checkup',
    'test:db',
    'e2e',
    'seed',
    'db:migrate',
    'db:drift',
    'method-hashes',
    'gen:fixtures',
    'gen:tokens',
  ] as const;

  const DELEGATIONS: ReadonlyArray<readonly [string, string]> = [
    ['verify', 'scripts/verify.mjs'],
    ['checkup', 'scripts/checkup.mjs'],
    ['db:migrate', 'scripts/db-migrate.mjs'],
    ['db:drift', 'scripts/db-drift.mjs'],
    ['e2e', 'scripts/e2e.mjs'],
    ['seed', 'scripts/seed.mjs'],
    ['method-hashes', 'scripts/method-hashes.mjs'],
    ['gen:fixtures', 'scripts/gen-fixtures.mjs'],
    ['gen:tokens', 'scripts/gen-tokens.mjs'],
  ];

  it('AC-02: every named script is defined', () => {
    const pkg = readJson('package.json');
    const scripts = (pkg.scripts ?? {}) as Record<string, string>;
    for (const name of REQUIRED_SCRIPTS) {
      expect(Object.keys(scripts), `script "${name}" missing`).toContain(name);
    }
  });

  it('AC-02: each script delegates to its scripts/*.mjs file, and the file exists', () => {
    const pkg = readJson('package.json');
    const scripts = (pkg.scripts ?? {}) as Record<string, string>;
    for (const [name, file] of DELEGATIONS) {
      const body = scripts[name] ?? '';
      expect(body, `script "${name}" must delegate to ${file}`).toContain(file);
      expect(existsSync(path.join(ROOT, file)), `${file} missing`).toBe(true);
    }
  });

  it('AC-02: the e2e script forwards arguments (--journey / --update-baselines)', () => {
    const pkg = readJson('package.json');
    const scripts = (pkg.scripts ?? {}) as Record<string, string>;
    // pnpm passes trailing args through, so the script body must not swallow them
    // with a fixed argument list of its own.
    expect(scripts.e2e).toMatch(/scripts\/e2e\.mjs\s*$/);
  });
});

describe('AC-08/AC-13 declared config and fixture surface', () => {
  const REQUIRED_FILES = [
    'tsconfig.json',
    'next.config.ts',
    'postcss.config.mjs',
    'eslint.config.mjs',
    'vitest.config.ts',
    'playwright.config.ts',
    'drizzle.config.ts',
    '.env.example',
    '.gitignore',
    'db/schema/index.ts',
    'db/schema/spine.ts',
    'db/schema/takeoff.ts',
    'db/schema/assure.ts',
    'db/schema/book.ts',
    'db/schema/estimate.ts',
    'db/schema/bid.ts',
    'src/core/db.ts',
    'src/core/env.ts',
    'src/core/errors.ts',
    'src/core/format.ts',
    'src/ui/tokens.ts',
    'src/ui/patterns/refusal-state.tsx',
    'src/server/router.ts',
    'src/modules/takeoff/router.ts',
    'src/modules/assure/router.ts',
    'src/modules/book/router.ts',
    'src/modules/estimate/router.ts',
    'src/modules/bid/router.ts',
    'src/app/globals.css',
    'src/app/layout.tsx',
    'fixtures/README.md',
  ] as const;

  it('AC-02/AC-08/AC-17: the whole declared surface is present in one unit', () => {
    const missing = REQUIRED_FILES.filter((f) => !existsSync(path.join(ROOT, f)));
    expect(missing).toEqual([]);
  });

  it('AC-11: .env.example names every contract env var', () => {
    const envExample = read('.env.example');
    for (const name of [
      'DATABASE_URL_MIGRATE',
      'DATABASE_URL_APP',
      'DATABASE_URL_AUTH',
      'BETTER_AUTH_SECRET',
      'BETTER_AUTH_URL',
      'MAIL_TRANSPORT',
      'MAIL_OUTBOX_DIR',
      'PORT',
    ]) {
      expect(envExample, `.env.example missing ${name}`).toMatch(new RegExp(`^\\s*#?\\s*${name}=`, 'm'));
    }
  });

  it('AC-11: .gitignore keeps the mail outbox and env out of the tree', () => {
    const gitignore = read('.gitignore');
    expect(gitignore).toMatch(/\.mail-outbox/);
    expect(gitignore).toMatch(/^\.env$/m);
  });
});
