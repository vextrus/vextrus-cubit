/**
 * inc-007c acceptance — J-004 as a run, not as a file (J-004, Q-06, Q-11, R-UI-011, AM-03(4)).
 *
 * The increment's public claim is a lane invocation: `pnpm e2e --journey J-004` builds the
 * app, seeds the scratch database, serves it and compares forty committed Linux baselines
 * with axe at every checkpoint. That spawns a build and drops a database, so it lives here
 * rather than in tests/toolchain — `pnpm verify`'s vitest stage and CI both run without a
 * provisioned cluster, exactly as inc-001 reasoned and inc-007a followed.
 *
 * Why this file exists at all, said plainly: the gate's own line is
 * `pnpm e2e --journey J-004 --journey J-000`, and scripts/e2e.mjs keeps only the LAST
 * `--journey` flag (the spec's own risk note 2), so that line is a J-000 run. Without a
 * test that spawns the single-flag form, nothing in the tree would ever run J-004 again.
 * J-000's own greenness (C-09) is claimed by db/__tests__/e2e-lane.test.ts, in this same
 * lane, on every `pnpm test:db`.
 *
 * The run is read from the outside — an exit status, the contract line on stdout, and the
 * working tree afterwards. The two source scans below assert rules the criteria state
 * (array snapshot names, an unnarrowed axe scan gating on serious/critical per
 * INT-J004-axe-impact-threshold, keyboard-only opens); they pin no count, no ordering and no
 * roster that a later increment may lawfully grow.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, isNested, lastLine, lines, run } from './support/lanes';
import type { Ran } from './support/lanes';
import config from '../../playwright.config';

/** The two files this increment owns, and the only ones these scans read. */
const JOURNEY = join('tests', 'e2e', 'j-004-design.spec.ts');
const PAGE_OBJECT = join('tests', 'e2e', 'pages', 'design.ts');

const BASELINES = join('tests', 'e2e', 'baselines', 'design');

/** AC-2's roster, in the words AC-2 uses. */
const SECTION_SHOTS = ['primitives.png', 'patterns.png', 'data.png'];
const SCREEN_STATES = [
  'loading',
  'empty',
  'error',
  'refusal',
  'partial',
  'offline',
  'permission-denied',
];
const OVERLAY_ENTRIES = [
  'dialog',
  'sheet',
  'consequence-dialog',
  'dropdown-menu',
  'context-menu',
  'popover',
  'tooltip',
  'select',
  'combobox',
  'toaster',
];
const ROSTER = [
  ...SECTION_SHOTS,
  ...SCREEN_STATES.map((state) => `state-${state}.png`),
  ...OVERLAY_ENTRIES.map((entry) => `overlay-${entry}.png`),
];

const there = (...parts: string[]): boolean => existsSync(join(REPO, ...parts));
const read = (...parts: string[]): string => readFileSync(join(REPO, ...parts), 'utf8');

interface JourneyRun {
  readonly ran: Ran;
  readonly before: string[];
  readonly after: string[];
}

/**
 * The single-flag J-004 run, made once and awaited by each claim that reads it. A
 * `beforeAll` that threw would have vitest report these tests as skipped rather than
 * failed, and a suite that proves no red is worse than none.
 */
let theRun: Promise<JourneyRun> | undefined;

function journeyRun(): Promise<JourneyRun> {
  theRun ??= (async () => {
    const before = await porcelain();
    const ran = await run('pnpm', ['run', 'e2e', '--journey', 'J-004']);
    return { ran, before, after: await porcelain() };
  })();
  return theRun;
}

async function porcelain(): Promise<string[]> {
  const status = await run('git', ['status', '--porcelain']);
  return lines(status.stdout);
}

/**
 * The file with its comments taken out.
 *
 * Every scan below is a claim about what the journey *does*, and prose is not doing. A
 * lane written in this tree's style explains itself — "no private AxeBuilder", "opened by
 * keyboard, never clicked" — and a scan that read those sentences would report the journey
 * for the very rule its comment is keeping. The same cut makes the presence claims mean
 * something: naming `toBeVisible` in a comment is not polling for a surface.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, (_match, before: string) => before);
}

/** The journey and its page object, as code — the rules below hold across both. */
function ownedSources(): { readonly journey: string; readonly pageObject: string } {
  return { journey: code(read(JOURNEY)), pageObject: code(read(PAGE_OBJECT)) };
}

describe('inc-007c — the /design gallery as gate evidence (J-004, Q-06, Q-11, AM-03(4))', () => {
  it('AC-1 / C-03: `pnpm e2e --journey J-004` is green on the unchanged lane, and writes nothing', async (ctx) => {
    // The nested `pnpm test:db` that lanes-armed.test.ts spawns re-runs this suite; the
    // spawning claims belong to the outer run, and the nested one records the skip out loud
    // rather than passing hollowly (C-06).
    ctx.skip(isNested(), 'NESTED_LANE_RUN — the outer `pnpm test:db` makes this claim');

    // What "green" has to mean here, asserted before the run rather than about it: the
    // comparison is the committed one — two thousandths of the viewport, and a missing
    // baseline is a failure rather than a first write (Q-06) — and the lane is the one
    // J-000 is green on (C-09, C-03).
    // Read as text: B-07 keeps fractional literals out of db/**, and the ratio is a pinned
    // configuration value here rather than a quantity anything computes with.
    expect(String(config.expect?.toHaveScreenshot?.maxDiffPixelRatio)).toBe('0.002');
    expect(config.updateSnapshots, 'the lane would author baselines instead of comparing').toBe(
      'none',
    );
    expect(String(config.snapshotPathTemplate)).toContain('{arg}');
    expect(String(config.snapshotPathTemplate)).toContain('baselines');
    for (const file of [
      join('tests', 'e2e', 'smoke.spec.ts'),
      join('tests', 'e2e', 'harness.spec.ts'),
      join('tests', 'e2e', 'red.spec.ts'),
      join('tests', 'e2e', 'axe.ts'),
      join('tests', 'e2e', 'setup', 'fonts.conf'),
      join('scripts', 'e2e.mjs'),
    ]) {
      expect(there(file), `${file} is gone; the lane J-000 runs on has changed`).toBe(true);
    }
    // AC-3 / C-03: the lane's shared helper — J-000's own axe check, out of this
    // increment's reach — still asserts *every* violation on the full rule set. If this
    // increment had cured an axe finding by narrowing the helper the whole lane trusts, it
    // would show here; an axe defect rooted in a merged primitive blocks per AM-03 instead.
    const axe = code(read('tests', 'e2e', 'axe.ts'));
    for (const narrowing of ['disableRules', 'withRules', 'withTags']) {
      expect(axe, `tests/e2e/axe.ts now narrows axe with ${narrowing}`).not.toContain(narrowing);
    }
    expect(axe, 'tests/e2e/axe.ts no longer asserts an empty violation list').toMatch(
      /toEqual\(\s*\[\s*\]\s*\)/,
    );

    const { ran } = await journeyRun();
    expect(ran.code, `pnpm e2e --journey J-004 exited ${ran.code}\n${ran.merged}`).toBe(0);

    // AC-1: "prints the lane's final contract line `e2e: ok (…s)` on stdout". stdout,
    // because the gate reports stderr after stdout and a contract split across the two
    // reads out of order.
    expect(lastLine(ran.stdout), ran.merged).toMatch(/^e2e: ok \(\d+(\.\d+)?s\)$/);

    // AC-1: the filter selected this journey — a run that found nothing to do is the shape
    // this claim had before the journey existed ("Error: No tests found").
    expect(ran.merged, 'the J-004 run reports no J-004 test').toContain('J-004');
    // … and nothing else: the other committed specs are titled HARNESS-SELF and HARNESS-RED.
    expect(ran.merged, 'the J-004 filter also ran the harness self-test').not.toContain(
      'HARNESS-SELF',
    );

    // Q-06 / AC-2: the lane compares, it never authors. Under `updateSnapshots: 'none'` a
    // missing or drifted baseline fails; a run that instead *wrote* a baseline would leave
    // it in the working tree, which is also what CI's "the tree is untouched" step sees.
    const { before, after } = await journeyRun();
    const appeared = after.filter((line) => !before.includes(line));
    expect(appeared, 'the J-004 run left new entries in the working tree').toEqual([]);
  }, 900_000);

  it('AC-2: the gallery’s Linux baselines are committed for both themes', () => {
    // AC-2: forty PNGs, twenty names per theme. Asserted as "each of these names is
    // committed in both themes", never as "the directory holds exactly these files" — a
    // later increment that adds a gallery entry adds a baseline, and that is lawful.
    // The held-out set makes the stricter claim (the two sets match each other, and no dark
    // capture is byte-identical to its light one).
    for (const theme of ['light', 'dark']) {
      for (const name of ROSTER) {
        const path = join(REPO, BASELINES, theme, name);
        expect(existsSync(path), `${join(BASELINES, theme, name)} is not in the tree`).toBe(true);
        const bytes = readFileSync(path);
        expect(
          [...bytes.subarray(0, 8)],
          `${join(BASELINES, theme, name)} is not a PNG`,
        ).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        expect(bytes.byteLength, `${join(BASELINES, theme, name)} is a stub`).toBeGreaterThan(256);
      }
    }
  });

  it('AC-2: the journey names its snapshots as arrays under design/, and masks nothing', () => {
    expect(there(JOURNEY), `${JOURNEY} is not in the tree`).toBe(true);
    expect(there(PAGE_OBJECT), `${PAGE_OBJECT} is not in the tree`).toBe(true);
    const { journey, pageObject } = ownedSources();

    for (const [path, source] of [
      [JOURNEY, journey],
      [PAGE_OBJECT, pageObject],
    ] as const) {
      // A string name is flattened before snapshotPathTemplate sees it, so 'design/light/x'
      // becomes design-light-x and the routed directory is never used.
      expect(
        source.match(/toHaveScreenshot\(\s*['"`]/g) ?? [],
        `${path} passes a string snapshot name`,
      ).toEqual([]);

      // Every literal array name begins with 'design' — the directory the baselines are
      // committed under. A name assembled at run time is left to the run itself: under
      // `updateSnapshots: 'none'` a name that resolves anywhere else has no baseline, and
      // the lane fails.
      const heads = [...source.matchAll(/toHaveScreenshot\(\s*\[\s*(['"`])([^'"`]*)\1/g)].map(
        (match) => match[2] ?? '',
      );
      for (const head of heads) {
        expect(head, `${path} routes a snapshot outside tests/e2e/baselines/design`).toBe('design');
      }

      // AC-2: "No masks are used" — the sample data is deterministic and motion is reduced,
      // so a mask would be hiding a real difference rather than a volatile region.
      expect(
        source.match(/\bmask\s*:/g) ?? [],
        `${path} masks a region; AC-2 declares no masks`,
      ).toEqual([]);
    }
  });

  it('AC-3: every checkpoint is scanned on axe’s full rule set, gating on serious/critical', () => {
    expect(there(JOURNEY), `${JOURNEY} is not in the tree`).toBe(true);
    const { journey, pageObject } = ownedSources();
    const both = `${journey}\n${pageObject}`;

    // The threshold is the arbitration's (INT-J004-axe-impact-threshold): Q-11 says "axe:
    // zero serious/critical on every journey checkpoint", R-UI-012 says the same of every
    // screen, and AM-03(3) blocks on "serious accessibility findings". So the journey's scan
    // gates on those two impacts by name.
    for (const impact of ['serious', 'critical']) {
      expect(both, `the journey's axe scan never names the gating impact ${impact}`).toContain(
        impact,
      );
    }

    // What the split may not become is a quiet allowlist. A finding below the threshold is
    // recorded into the run — AM-03(3) still wants it read and cured against the surface
    // that owns it (C-03) — and a scan that dropped it would leave the design finding
    // nowhere.
    expect(both, 'findings below the threshold are dropped rather than recorded').toMatch(
      /annotations|attach/,
    );

    // AC-3's surviving half, which the arbitration left standing: "No rule set is narrowed
    // … no per-page exception introduced." The impact split is the whole of the filtering.
    for (const narrowing of ['disableRules', 'withRules', 'withTags', 'setLegacyMode']) {
      expect(both, `the journey narrows axe with ${narrowing}`).not.toContain(narrowing);
    }

    // And the lane's shared helper — which asserts every impact and is what J-000's own
    // checkpoints call — is untouched by this increment (C-03). AC-1 above reads it back.
    expect(there('tests', 'e2e', 'axe.ts'), 'the lane lost its axe helper').toBe(true);
  });

  it('AC-4: the journey opens every overlay by keyboard, and polls for the surface', () => {
    expect(there(JOURNEY), `${JOURNEY} is not in the tree`).toBe(true);
    const { journey, pageObject } = ownedSources();
    const both = `${journey}\n${pageObject}`;

    // AC-4: "opened by keyboard only". A pointer gesture anywhere in this journey is either
    // an overlay opened the wrong way or a keyboard path that was not proved. Moving the
    // mouse is not a gesture and is not covered here; pressing it is.
    for (const pointer of ['.click(', '.dblclick(', '.tap(', '.hover(']) {
      expect(both, `the journey uses ${pointer} — AC-4 opens every overlay by keyboard`).not.toContain(
        pointer,
      );
    }
    // The gestures themselves: keys, pressed on a focused element.
    expect(both, 'the journey presses no keys').toMatch(/\.press\(|keyboard\s*\.\s*press\(/);

    // "every open POLLS for a visible overlay surface (toBeVisible with timeout), never
    // asserting synchronously" — the web-first assertion is what does the polling.
    expect(both, 'no overlay open polls for a visible surface').toMatch(/toBeVisible\(/);

    // R-UI-012's focus ring, and the toggle's own claim: data-theme flips both directions.
    expect(both, 'the journey never reads a focus outline').toMatch(/outline/i);
    expect(both, 'the journey never reads data-theme off the document').toContain('data-theme');
    expect(both, 'the journey never operates the theme toggle').toContain('design-theme-toggle');

    // The test contract: reduced motion is emulated after navigation, so overlay and toast
    // pixels are stable without a mask.
    expect(journey + pageObject, 'reduced motion is never emulated').toContain('emulateMedia');
    expect(journey + pageObject, 'reduced motion is never emulated').toContain('reducedMotion');

    // AC-1: the journey is selected by `--journey J-004`, which greps full title paths.
    expect(journey, `${JOURNEY} names J-004 in no title`).toContain('J-004');
  });

});
