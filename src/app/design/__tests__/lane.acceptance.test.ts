/**
 * inc-007 acceptance — the V-E2E lane is armed and says so (AC-3, AC-4, C-06, C-09, Q-06).
 *
 * V-E2E: "Builds once, ... starts web (3211) ..., runs Playwright journeys (J-nnn) with
 * traces, screenshots at named checkpoints, video on failure, axe on every checkpoint page,
 * and visual comparisons against committed Linux baselines (`toHaveScreenshot`,
 * maxDiffPixelRatio 0.002, per-journey masks for volatile regions). ... Runs in CI on every
 * PR and by the harness gate."
 *
 * C-09: "J-000 runs on every merge to main." Its spec is not written in this increment, so
 * AC-3 buys the clause a *defined* exit rather than a silent one: `e2e: J-000 SKIP
 * JOURNEY_NOT_YET_WRITTEN` on stdout, exit 0 — the same shape C-06 gives an unbuilt lane, one
 * level down. That line rides stdout because the gate reports stderr after stdout.
 *
 * This file lives beside the screen it belongs to rather than in tests/toolchain/: the
 * increment owns src/app/** and the roster test in tests/toolchain/lane-stubs.test.ts is the
 * Builder's to amend (dev, build, start and e2e leave it — worker and the rest stay).
 *
 * Two things are deliberately NOT asserted here. The journey itself is
 * tests/e2e/j-004-design.spec.ts, run by the lane and by CI — a vitest test that shelled out
 * to a full `next build` would be a second, slower copy of the gate. And no assertion names a
 * lane that is still a stub: which lanes are unbuilt is a moving fact, and freezing it here
 * would redden the increment that lawfully builds the next one.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();

/** The two files the toolchain change names, and the workflow that has to run the lane. */
const E2E_SCRIPT = 'scripts/e2e.mjs';
const NEXT_CONFIG = 'next.config.ts';
const WORKFLOWS = '.github/workflows';

/** AC-4 names the committed baselines by path; the checkpoints are the journey's own. */
const BASELINE_DIR = 'tests/e2e/baselines/design';
const CHECKPOINTS: readonly string[] = ['gallery-light', 'gallery-dark'];

interface Ran {
  readonly code: number;
  readonly merged: string;
  readonly stdout: string;
}

/** `pnpm run <script> <args…>`, both streams kept apart and together. */
function run(script: string, args: readonly string[]): Promise<Ran> {
  return new Promise<Ran>((resolve) => {
    const child = spawn('pnpm', ['run', script, ...args], {
      cwd: REPO,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let merged = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      merged += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      merged += chunk.toString('utf8');
    });
    child.on('error', (error: Error) => resolve({ code: -1, stdout, merged: merged + error.message }));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, merged }));
  });
}

/** The journey ids that have a spec file today — `pnpm e2e` maps J-nnn to j-nnn-*.spec.ts. */
function writtenJourneys(): Set<string> {
  const dir = join(REPO, 'tests', 'e2e');
  if (!existsSync(dir)) return new Set<string>();
  const found = new Set<string>();
  for (const entry of readdirSync(dir)) {
    const match = /^j-(\d{3})-.*\.spec\.ts$/.exec(entry);
    if (match !== null) found.add(`J-${match[1] ?? ''}`);
  }
  return found;
}

/** A journey id no spec file answers — derived, so a later increment's specs cannot break it. */
function unwrittenJourney(): string {
  const written = writtenJourneys();
  for (let n = 990; n < 1000; n += 1) {
    const id = `J-${String(n)}`;
    if (!written.has(id)) return id;
  }
  throw new Error('no unwritten journey id is available');
}

/** The whole point of the contract line: exact text, own line, on stdout, exit 0. */
function expectSkipLine(ran: Ran, journey: string): void {
  expect(ran.stdout.split(/\r?\n/), `AC-3: \`pnpm e2e --journey ${journey}\` skip line`).toContain(
    `e2e: ${journey} SKIP JOURNEY_NOT_YET_WRITTEN`,
  );
  expect(ran.code, 'C-09: a defined exit is green — an unwritten journey is not a failure').toBe(0);
}

/** The Playwright config, as the runner reads it. */
interface PlaywrightConfigShape {
  readonly snapshotPathTemplate?: string;
  readonly use?: { readonly trace?: unknown; readonly video?: unknown };
  readonly projects?: readonly { readonly snapshotPathTemplate?: string }[];
}

async function playwrightConfig(): Promise<PlaywrightConfigShape> {
  const mod = (await import('../../../../playwright.config')) as { default: unknown };
  return mod.default as PlaywrightConfigShape;
}

/**
 * The snapshot path a template yields for one screenshot name. Only the placeholders that
 * keep a baseline platform-independent are understood; anything else is reported, which is
 * exactly what `{platform}` and `{projectName}` are.
 */
function resolveTemplate(template: string, arg: string): { path: string; unknown: string[] } {
  const unknown: string[] = [];
  const path = template.replace(/\{([a-zA-Z]+)\}/g, (_match, name: string) => {
    if (name === 'testDir' || name === 'snapshotDir') return 'tests/e2e';
    if (name === 'arg') return arg;
    if (name === 'ext') return '.png';
    unknown.push(name);
    return `{${name}}`;
  });
  return { path: path.replace(/^\.\//, ''), unknown };
}

describe('inc-007 — the V-E2E lane (AC-3, AC-4)', () => {
  it('AC-3 / C-09: an unwritten journey skips by name, on stdout, exit 0', async () => {
    const journey = unwrittenJourney();
    expectSkipLine(await run('e2e', ['--journey', journey]), journey);

    // C-09 names J-000 itself. Its spec arrives with the authenticated journeys, so this
    // holds only while it is unwritten — once it exists, the lane must run it, not skip it.
    if (!writtenJourneys().has('J-000')) {
      expectSkipLine(await run('e2e', ['--journey', 'J-000']), 'J-000');
    }
  }, 180_000);

  it('AC-3 / C-06: the e2e lane is built — it no longer announces LANE_NOT_YET_BUILT', async () => {
    const ran = await run('e2e', ['--journey', unwrittenJourney()]);
    expect(
      ran.merged,
      'C-06: a built lane that still printed the unbuilt reason would be reporting a lie',
    ).not.toContain('LANE_NOT_YET_BUILT');
  }, 180_000);

  it('AC-4 / Q-06: --update-baselines forwards Playwright’s --update-snapshots', async () => {
    const source = readFileSync(join(REPO, E2E_SCRIPT), 'utf8');
    expect(source, 'AC-4: the flag the criterion names is the flag Playwright is given').toContain(
      '--update-snapshots',
    );
    // The flag is accepted wherever it appears — an unwritten journey still exits by contract.
    const journey = unwrittenJourney();
    expectSkipLine(await run('e2e', ['--journey', journey, '--update-baselines']), journey);
  }, 180_000);

  it('AC-3 / C-07: dev, build and start are the real Next lanes', () => {
    const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};
    expect(scripts['dev'] ?? '', 'AC-3: dev → next dev -p 3210 (C-07)').toMatch(/next dev/);
    expect(scripts['dev'] ?? '', 'C-07: web dev on 3210').toContain('3210');
    expect(scripts['build'] ?? '', 'AC-3: build → next build').toMatch(/next build/);
    expect(scripts['start'] ?? '', 'AC-3: start → next start').toMatch(/next start/);
    expect(scripts['e2e'] ?? '', 'AC-3: e2e stays the lane script').toContain(E2E_SCRIPT);
  });

  it('AC-3 / V-VERIFY: next.config.ts honours NEXT_DIST_DIR, defaulting to .next', () => {
    expect(
      existsSync(join(REPO, NEXT_CONFIG)),
      `AC-3: ${NEXT_CONFIG} must exist for verify's typegen and build stages`,
    ).toBe(true);

    const read = (distDir: string | null): string => {
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined && key !== 'NEXT_DIST_DIR') env[key] = value;
      }
      if (distDir !== null) env['NEXT_DIST_DIR'] = distDir;
      env['CUBIT_NEXT_CONFIG_URL'] = pathToFileURL(join(REPO, NEXT_CONFIG)).href;
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          "const m = await import(process.env['CUBIT_NEXT_CONFIG_URL']);" +
            'process.stdout.write(String(m.default?.distDir));',
        ],
        { env, cwd: REPO, encoding: 'utf8' },
      );
      return result.stdout.trim();
    };

    // "cold into its own distDir": verify runs `next build` with NEXT_DIST_DIR=.next-verify,
    // and a config that ignored it would poison — or be poisoned by — the dev build.
    expect(read('.next-verify'), 'AC-3: distDir reads NEXT_DIST_DIR').toBe('.next-verify');
    expect(read(null), 'AC-3: and defaults to .next').toBe('.next');
  }, 60_000);

  it('AC-4 / V-E2E: baselines are committed at tests/e2e/baselines/design/<checkpoint>.png', () => {
    for (const checkpoint of CHECKPOINTS) {
      const baseline = join(BASELINE_DIR, `${checkpoint}.png`);
      expect(existsSync(join(REPO, baseline)), `Q-06: ${baseline} is committed`).toBe(true);
    }
  });

  it('AC-4: the snapshot template puts a checkpoint under baselines with no platform suffix', async () => {
    const config = await playwrightConfig();
    const template =
      config.snapshotPathTemplate ?? config.projects?.[0]?.snapshotPathTemplate ?? '';
    expect(template, 'AC-4: playwright.config.ts pins the snapshot path template').not.toBe('');

    const resolved = resolveTemplate(template, 'design/gallery-light');
    expect(
      resolved.unknown,
      'AC-4: no platform or project placeholder — the baselines are Linux and committed as such',
    ).toEqual([]);
    expect(
      resolved.path,
      "AC-4: toHaveScreenshot('design/gallery-light.png') resolves to the committed baseline",
    ).toBe(`${BASELINE_DIR}/gallery-light.png`);
  });

  it('AC-4 / V-E2E: traces are retained and video is recorded on failure', async () => {
    const config = await playwrightConfig();
    expect(config.use?.trace, 'V-E2E: journeys run with traces').toBe('retain-on-failure');
    expect(config.use?.video, 'V-E2E: video on failure').toBe('retain-on-failure');
  });

  it('AC-3 / V-E2E: CI runs the journeys on every pull request', () => {
    const dir = join(REPO, WORKFLOWS);
    expect(existsSync(dir), 'C-06: the CI workflow is part of the toolchain surface').toBe(true);
    const workflows = readdirSync(dir)
      .filter((entry) => entry.endsWith('.yml') || entry.endsWith('.yaml'))
      .map((entry) => readFileSync(join(dir, entry), 'utf8'));

    const running = workflows.filter((text) => text.includes('pnpm e2e'));
    expect(running.length, 'V-E2E: "Runs in CI on every PR" — a workflow runs `pnpm e2e`').toBeGreaterThan(
      0,
    );
    const text = running.join('\n');
    expect(text, 'AC-3: the e2e job runs the design journey').toContain('J-004');
    expect(text, 'V-E2E: on every PR').toContain('pull_request');
    // The runner has no browser until one is installed; a job that skipped this would fail
    // for a reason that has nothing to do with the product.
    expect(text, 'V-E2E: the job installs the browser it drives').toContain('playwright install');
  });
});
