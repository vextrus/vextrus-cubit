/**
 * inc-104 acceptance — the cad lane arms in verify, for real (AC-5, V-VERIFY).
 *
 * V-VERIFY lists `ruff check` + `pytest` (cad) as stages of the one contract whose "exit
 * code is the whole contract". verify's own vitest stage is what runs this file, so it
 * cannot spawn `pnpm verify` without running itself. What it does instead is judge the real
 * thing: it takes the real STAGES exported by scripts/lib/verify-roster.mjs, keeps the two
 * cad stages, and drives them through the real runRoster with the real runStage — the same
 * `uv run --frozen` commands, the same arming predicate, the same printed grammar. If
 * either lane is unarmed, unfrozen or red, the lines below are not the lines that appear.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STAGES, runRoster } from '../../../../scripts/lib/verify-roster.mjs';
import { REPO, uvRun } from './support/cli';

const cadStages = STAGES.filter((stage) => stage.name.startsWith('cad-'));

describe('AC-5 — the lane is armed, frozen and green when verify runs it (V-VERIFY)', () => {
  it('prints `verify: cad-ruff ok (` and `verify: cad-pytest ok (` from the real roster', async () => {
    // The stage definitions are asserted here rather than in a test of their own: the
    // roster already carries them, so a separate shape test would be green before a line
    // of this increment is written and would prove nothing. What is new is that both
    // lanes now arm and both now pass.
    const byName = new Map(cadStages.map((stage) => [stage.name, stage]));
    // Members, not the exact roster: tests/toolchain/verify.test.ts owns the full order.
    expect([...byName.keys()].sort()).toEqual(['cad-pytest', 'cad-ruff']);
    expect(byName.get('cad-ruff')?.input).toBe('cad');
    expect(byName.get('cad-pytest')?.input).toBe('cad/tests');
    for (const stage of cadStages) {
      // `uv run --frozen`, un-weakened: a stale cad/uv.lock stays a hard fail.
      expect(stage.file, stage.name).toBe('uv');
      expect([...(stage.args ?? [])].slice(0, 2), stage.name).toEqual(['run', '--frozen']);
      expect(stage.cwd, stage.name).toBe(join(REPO, 'cad'));
    }
    // C-06 arms a stage on the presence of its input root. AC-5 requires that neither is
    // "skipped as not-yet-built" any more, which is a claim about the tree, not the roster.
    expect(existsSync(join(REPO, 'cad')), 'cad/ arms cad-ruff').toBe(true);
    expect(existsSync(join(REPO, 'cad', 'tests')), 'cad/tests/ arms cad-pytest').toBe(true);

    const lines: string[] = [];
    const details: string[] = [];
    const code = await runRoster(cadStages, {
      say: (line) => lines.push(line),
      detail: (text) => details.push(text),
    });
    const said = `${lines.join('\n')}\n${details.join('\n')}`;
    expect(code, said).toBe(0);
    for (const name of ['cad-ruff', 'cad-pytest']) {
      expect(
        lines.some((line) => line.startsWith(`verify: ${name} ok (`)),
        `${name} did not print an ok line — ${said}`,
      ).toBe(true);
    }
  });
});

describe('AC-5 — cad/tests carries the suites the criterion names', () => {
  it('commits cad/tests/test_licences.py', () => {
    expect(existsSync(join(REPO, 'cad', 'tests', 'test_licences.py'))).toBe(true);
  });

  it('collects at least one pytest node covering ingest', () => {
    const ran = uvRun(['pytest', '--collect-only', '-q']);
    expect(ran.status, `pytest collection said:\n${ran.said}`).toBe(0);
    const nodes = ran.stdout.split('\n').filter((line) => line.includes('::'));
    expect(nodes.length, ran.said).toBeGreaterThan(0);
    expect(
      nodes.some((node) => /ingest/i.test(node)),
      `no collected pytest node names ingest:\n${nodes.join('\n')}`,
    ).toBe(true);
  });

  it('authors the DXF fixtures from cad/tests/fixtures/gen.py and commits the outputs (AS-03)', () => {
    // AS-03: "no AGPL library is used in generation either" — the generator ships so the
    // corpus can be re-derived and read, and the DXFs are committed so both runtimes and
    // the held-out set read the same bytes.
    expect(existsSync(join(REPO, 'cad', 'tests', 'fixtures', 'gen.py'))).toBe(true);
    const committed = readdirSync(join(REPO, 'cad', 'tests', 'fixtures')).filter((n) =>
      n.endsWith('.dxf'),
    );
    for (const name of [
      'basic.dxf',
      'inserts.dxf',
      'units-unmapped.dxf',
      'layouts-strays.dxf',
      'flatten-cap.dxf',
    ]) {
      expect(committed, name).toContain(name);
    }
  });
});

describe('AC-5 — the node licence suite runs in the vitest stage', () => {
  it('commits tests/toolchain/licences.test.ts where plain `pnpm vitest run` finds it', async () => {
    expect(existsSync(join(REPO, 'tests', 'toolchain', 'licences.test.ts'))).toBe(true);
    const config = await import('../../../../vitest.config');
    expect(config.default.test.include).toContain('tests/**/*.test.ts');
    for (const pattern of config.default.test.exclude) {
      expect(pattern.startsWith('tests/toolchain'), pattern).toBe(false);
    }
  });
});
