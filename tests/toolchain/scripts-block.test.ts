/**
 * AC-4 — the full package.json scripts block, and every unbuilt lane saying so
 * out loud on stdout instead of passing silently (C-06).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { run, lines, transcript, type RunResult } from './support/exec.js';

const ROOT = process.cwd();

const REQUIRED_SCRIPTS = [
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
] as const;

/** Every script whose lane is not built yet — i.e. all but verify and checkup. */
const STUB_SCRIPTS = REQUIRED_SCRIPTS.filter(
  (name) => name !== 'verify' && name !== 'checkup',
);

/** C-06 names the file each script delegates to. */
const DELEGATIONS: ReadonlyArray<readonly [string, string]> = [
  ['verify', 'scripts/verify.mjs'],
  ['checkup', 'scripts/checkup.mjs'],
  ['db:migrate', 'scripts/db-migrate.mjs'],
  ['db:drift', 'scripts/db-drift.mjs'],
  ['e2e', 'scripts/e2e.mjs'],
  ['seed', 'scripts/seed.mjs'],
  ['gen:fixtures', 'scripts/gen-fixtures.mjs'],
  ['traceability', 'scripts/traceability.mjs'],
];

function scripts(): Record<string, string> {
  const raw = readFileSync(path.join(ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw) as { readonly scripts?: Record<string, string> };
  return pkg.scripts ?? {};
}

describe('AC-4 the scripts block is complete', () => {
  it('AC-4: every script the spec names is defined', () => {
    const defined = Object.keys(scripts());
    const missing = REQUIRED_SCRIPTS.filter((name) => !defined.includes(name));
    expect(missing, 'scripts missing from package.json').toEqual([]);
  });

  it('C-06: each named script delegates to its scripts/*.mjs, and the file exists', () => {
    const defined = scripts();
    const broken: string[] = [];
    for (const [name, file] of DELEGATIONS) {
      const body = defined[name] ?? '';
      if (!body.includes(file)) {
        broken.push(`${name} -> "${body}" does not run ${file}`);
      }
      if (!existsSync(path.join(ROOT, file))) {
        broken.push(`${file} does not exist`);
      }
    }
    expect(broken, 'script delegation is broken').toEqual([]);
  });
});

describe('AC-4 an unbuilt lane skips out loud', () => {
  const results = new Map<string, RunResult>();

  beforeAll(async () => {
    // Run them together: fourteen sequential pnpm spawns would dominate the
    // vitest stage's share of Q-01's sixty seconds.
    const settled = await Promise.all(
      STUB_SCRIPTS.map(async (name) => {
        const result = await run('pnpm', ['run', name], { cwd: ROOT, timeoutMs: 90_000 });
        return [name, result] as const;
      }),
    );
    for (const [name, result] of settled) {
      results.set(name, result);
    }
  }, 180_000);

  for (const name of STUB_SCRIPTS) {
    it(`AC-4: pnpm ${name} prints "${name}: SKIP LANE_NOT_YET_BUILT" on stdout and exits 0`, () => {
      const result = results.get(name);
      expect(result, `pnpm run ${name} produced no result`).toBeDefined();
      if (result === undefined) {
        return;
      }
      expect(result.timedOut, `pnpm run ${name} never exited`).toBe(false);
      expect(result.code, transcript(`pnpm run ${name}`, result)).toBe(0);
      expect(
        lines(result.stdout),
        `the skip line must be on stdout: ${transcript(`pnpm run ${name}`, result)}`,
      ).toContain(`${name}: SKIP LANE_NOT_YET_BUILT`);
    });
  }
});
