/**
 * AC-5 — the pins are committed, and they are pins, not ranges.
 *
 * C-06/B-15: the gate's own toolchain is born whole in increment zero, so the
 * versions it will be held to must be readable from the tree itself.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();

function read(relative: string): string {
  const absolute = path.join(ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing`).toBe(true);
  return readFileSync(absolute, 'utf8');
}

interface PackageManifest {
  readonly packageManager?: string;
  readonly scripts?: Record<string, string>;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

function manifest(): PackageManifest {
  return JSON.parse(read('package.json')) as PackageManifest;
}

/**
 * tsconfig.json is JSONC in practice. Parse it the way tsc itself does — a
 * comment stripper written as a regex is blind to string context, so a legal
 * `"@/*": ["./src/*"]` path alias would read as a comment and mangle the file.
 * The config is written for the compiler, not for this test.
 */
function readJsonc(relative: string): Record<string, unknown> {
  const parsed = ts.parseConfigFileTextToJson(relative, read(relative));
  expect(parsed.error, `${relative} is not valid JSONC`).toBeUndefined();
  return (parsed.config ?? {}) as Record<string, unknown>;
}

/** The stack the spec declares; every one of them must be pinned here (C-06). */
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
] as const;

const EXACT_SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

describe('AC-5 pinned runtimes', () => {
  it('AC-5: .nvmrc is the single line 24', () => {
    // C-06 pins Node; the CI workflow reads this file rather than a literal.
    expect(read('.nvmrc').trim()).toBe('24');
  });

  it('AC-5: packageManager pins pnpm 10 to an exact patch', () => {
    const packageManager = manifest().packageManager ?? '';
    expect(packageManager, 'package.json must declare packageManager').not.toBe('');
    expect(packageManager).toMatch(/^pnpm@10\.\d+\.\d+(?:\+sha\d*\.[0-9a-f]+)?$/);
  });

  it('AC-5: a lockfile is committed so --frozen-lockfile has something to freeze', () => {
    const lock = read('pnpm-lock.yaml');
    expect(lock.trim().length, 'pnpm-lock.yaml is empty').toBeGreaterThan(0);
  });
});

describe('AC-5 every dependency is pinned exact', () => {
  it('AC-5: no dependency carries a ^ or ~ range', () => {
    const pkg = manifest();
    const all: Record<string, string> = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    const ranged = Object.entries(all)
      .filter(([, version]) => !EXACT_SEMVER.test(version))
      .map(([name, version]) => `${name}@${version}`);
    expect(ranged, 'these dependencies are ranges, not pins').toEqual([]);
  });

  it('AC-5: every declared dependency of the stack is present', () => {
    const pkg = manifest();
    const all: Record<string, string> = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    const missing = DECLARED_DEPENDENCIES.filter((name) => all[name] === undefined);
    expect(missing, 'declared dependencies missing from package.json').toEqual([]);
  });
});

describe('AC-5 the Python side is pinned too', () => {
  it('AC-5: cad/pyproject.toml pins Python 3.13 with ruff and pytest exact', () => {
    const pyproject = read('cad/pyproject.toml');
    expect(pyproject, 'requires-python must name 3.13').toMatch(
      /requires-python\s*=\s*["'][^"']*3\.13/,
    );
    expect(pyproject, 'ruff must be pinned with ==').toMatch(/ruff\s*==\s*\d+\.\d+\.\d+/);
    expect(pyproject, 'pytest must be pinned with ==').toMatch(/pytest\s*==\s*\d+\.\d+\.\d+/);
  });

  it('AC-5: cad/uv.lock is committed and non-empty', () => {
    const absolute = path.join(ROOT, 'cad/uv.lock');
    expect(existsSync(absolute), 'cad/uv.lock is missing').toBe(true);
    expect(statSync(absolute).size, 'cad/uv.lock is empty').toBeGreaterThan(0);
  });
});

describe('AC-5 the binaries this increment does not install are still pinned on paper', () => {
  it('AC-5: docs/toolchain.md records the typst 0.15.x version and its sha256', () => {
    const doc = read('docs/toolchain.md');
    expect(doc, 'typst is not mentioned').toMatch(/typst/i);
    expect(doc, 'typst 0.15.x version pin is missing').toMatch(/0\.15\.\d+/);
    expect(doc, 'a sha256 (64 hex chars) is missing').toMatch(/\b[0-9a-f]{64}\b/);
  });

  it('AC-5: docs/toolchain.md records the LibreDWG 0.13.x pin', () => {
    const doc = read('docs/toolchain.md');
    expect(doc, 'LibreDWG is not mentioned').toMatch(/libredwg/i);
    expect(doc, 'LibreDWG 0.13.x pin is missing').toMatch(/0\.13\.\d+/);
  });
});

describe('AC-5 CI runs the same pins as the machine', () => {
  it('AC-5: ci.yml installs Node from .nvmrc, pnpm via corepack, and uv', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci, 'CI must read the Node version from .nvmrc').toMatch(/\.nvmrc/);
    expect(ci, 'CI must enable pnpm through corepack').toMatch(/corepack/);
    expect(ci, 'CI must install uv').toMatch(/\buv\b/i);
  });

  it('AC-5: ci.yml runs a frozen install then pnpm verify, on push and pull_request', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toMatch(/pnpm install\s+--frozen-lockfile/);
    expect(ci).toMatch(/pnpm (?:run )?verify/);
    expect(ci, 'CI must trigger on push').toMatch(/^\s*push:/m);
    expect(ci, 'CI must trigger on pull_request').toMatch(/^\s*pull_request:/m);
  });
});

describe('tsconfig is strict before any src/ exists (C-06)', () => {
  it('C-06: strict, noUncheckedIndexedAccess and exactOptionalPropertyTypes are on', () => {
    const tsconfig = readJsonc('tsconfig.json');
    const compilerOptions = (tsconfig.compilerOptions ?? {}) as Record<string, unknown>;
    expect(compilerOptions.strict).toBe(true);
    expect(compilerOptions.noUncheckedIndexedAccess).toBe(true);
    expect(compilerOptions.exactOptionalPropertyTypes).toBe(true);
  });

  it('C-06: the deliberately broken lint fixtures are excluded from the type-check', () => {
    // bad.* fixtures may be type-broken by design; tsc must not see them.
    expect(read('tsconfig.json')).toMatch(/lint-fixtures/);
  });
});
