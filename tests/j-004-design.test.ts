/**
 * inc-007e acceptance, the vitest stage's half — the public wrapper for journey J-004.
 *
 * The `.spec.ts` under tests/e2e IS the journey; Playwright runs it and vitest never sees it
 * (vitest.config.ts excludes tests/e2e/**). This file is the vitest stage's proof that the
 * journey exists, that the thing it screenshots is committed, and — when the gate arms it —
 * that the lane really ran and really reported (AC-4).
 *
 * Two arms:
 *
 *   STATIC — always runs, fs only. It judges the committed surface: the contrast remedy in
 *   src/ui/primitives/primitives.css and its record in docs/design/datum-primitives.md
 *   (AC-1), the six baselines (AC-2), and the journey file itself.
 *
 *   LANE — runs only when `J004_E2E=1`. It spawns `pnpm e2e --journey J-004` and judges the
 *   lane's contract: exit code, and the final line of the MERGED stdout+stderr stream. The
 *   gate's acceptance run sets the variable; `pnpm verify` does not, so Q-01's ≤ 60 s budget
 *   survives a suite that would otherwise build Next and drive a browser inside it.
 *
 * Nothing renders here: node environment, `node:fs` and `node:child_process` only.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();

const read = (...parts: string[]): string => readFileSync(join(REPO, ...parts), 'utf8');
const there = (...parts: string[]): boolean => existsSync(join(REPO, ...parts));

/** The primitives sheet AC-1 remedies. */
const PRIMITIVES_CSS = ['src', 'ui', 'primitives', 'primitives.css'];

/** The Design Decision AM-03 requires the remedy to be recorded in, before acceptance. */
const PRIMITIVES_DOC = ['docs', 'design', 'datum-primitives.md'];

/** The journey, and the directory its baselines are committed to. */
const JOURNEY_SPEC = ['tests', 'e2e', 'j-004-design.spec.ts'];
const PAGE_OBJECT = ['tests', 'e2e', 'pages', 'design.ts'];
const BASELINE_DIR = ['tests', 'e2e', 'baselines', 'design'];

/** The route and test ids C-05 fixes for this journey; the screen answers to these names. */
const CONTRACT_HOOKS: readonly string[] = [
  '/design',
  'design-gallery-root',
  'design-theme-toggle',
  'gallery-entry-select-placeholder',
];

/**
 * The three texts the inc-007-design-gallery arbitration moved off `--graphite-500`, spelled
 * as the spec's test contract spells them. `.datum-field::placeholder` covers Input and
 * Textarea; the other two are the Select's placeholder trigger and the Combobox's status row.
 */
const REMEDIED_SELECTORS: readonly string[] = [
  '.datum-field::placeholder',
  '.datum-select-trigger[data-placeholder]',
  '.datum-combobox-status',
];

/** The token the remedy binds, and the one it must leave behind in this file. */
const REMEDY = '--graphite-600';
const SUPERSEDED = '--graphite-500';

/** AC-2: three module groups × two themes, array-form snapshot names, one file each. */
const GROUPS: readonly string[] = ['primitives', 'patterns', 'data'];
const THEMES: readonly string[] = ['light', 'dark'];

/** The heading AC-1 names for the appended section of the Design Decision. */
const APPENDED_SECTION = 'Placeholder and status-text colour';

/**
 * The section that is last in the doc today: the append has to land after it, not inside it.
 * Matched by heading TEXT, not by number — C-05's contract list fixes routes, testids, page-object
 * surface, procedure names, fixtures, stdout lines and env vars, and no clause freezes a Design
 * Decision's heading numerals. A later increment that inserts a section and renumbers is lawful
 * and must not redden this assertion (2026-08-23 arbitration, TEST_AMENDED).
 */
const PREVIOUS_LAST_SECTION = /^## \d+\.\s*Test hooks\s*$/m;

/** The lane's success line, exactly as the runner says it (scripts/e2e.mjs `say`). */
const LANE_OK = /^e2e: ok \(\d+(\.\d+)?s\)$/;

/** The environment name that arms the lane arm, and the one value that arms it. */
const LANE_ENV = 'J004_E2E';
const LANE_ARMED = '1';

/** `pnpm e2e --journey J-004` may build Next, provision a database and drive a browser. */
const LANE_BUDGET_MS = 900_000;
const LANE_KILL_MS = 840_000;

/** PNG's magic bytes — a baseline that is not a PNG is not a baseline. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/**
 * The declaration block a selector opens, with no regard for what is in it.
 *
 * A rule is `<selector> { … }` and none of these three nests, so the first `}` after the
 * opening brace closes it. Returns undefined when the selector is not in the file at all,
 * which is a different failure from "it is there and binds the wrong token".
 */
function declarationBlock(css: string, selector: string): string | undefined {
  const at = css.indexOf(`${selector} {`);
  if (at === -1) return undefined;
  const opened = css.indexOf('{', at);
  const closed = css.indexOf('}', opened);
  if (closed === -1) return undefined;
  return css.slice(opened + 1, closed);
}

/** How many times a string occurs — `split` counts occurrences without a regex to escape. */
const occurrences = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

describe('inc-007e AC-1 / AC-2 / AC-4 — the committed surface journey J-004 grades', () => {
  it('AC-1 (AM-03, R-UI-012): the three placeholder/status texts bind --graphite-600, and nothing in the sheet still binds --graphite-500', () => {
    const css = read(...PRIMITIVES_CSS);

    for (const selector of REMEDIED_SELECTORS) {
      const block = declarationBlock(css, selector);
      expect(block, `${selector} is not a rule in primitives.css — no selector may be removed`).not
        .toBeUndefined();
      // AC-1: the remedy is a colour binding, on the selector the arbitration named.
      expect(
        block ?? '',
        `${selector} does not bind color: var(${REMEDY})`,
      ).toContain(`color: var(${REMEDY})`);
      // AC-1: "no selector is added or removed" — each of the three is still one rule.
      expect(occurrences(css, `${selector} {`), `${selector} opens more than one rule`).toBe(1);
    }

    // AC-1: the superseded token appears zero times in this file afterwards. It appears
    // exactly three times before the remedy, and only in the three rules above.
    expect(
      occurrences(css, SUPERSEDED),
      `primitives.css still binds ${SUPERSEDED} — the contrast remedy is incomplete`,
    ).toBe(0);
  });

  it('AC-1 (AM-03 (1)): docs/design/datum-primitives.md records the remedy as one appended section', () => {
    const doc = read(...PRIMITIVES_DOC);

    // AM-03: the decision is recorded before acceptance is written, in the screen's own doc.
    expect(doc, `the doc has no “${APPENDED_SECTION}” section`).toContain(APPENDED_SECTION);
    const appended = doc.indexOf(APPENDED_SECTION);

    // AC-1: "the doc edit is that append only" — the section that used to end the file is
    // still there, and the new one is after it. Asserting the order rather than the bytes
    // leaves a later increment free to append a section of its own.
    const previous = doc.search(PREVIOUS_LAST_SECTION);
    expect(
      previous,
      'the doc no longer carries a “Test hooks” section heading (any section number)',
    ).toBeGreaterThan(-1);
    expect(appended, 'the new section is not appended after the doc’s existing sections').
      toBeGreaterThan(previous);

    // AC-1: what it records is the token the three texts now use.
    expect(
      doc.slice(appended),
      `the appended section does not record ${REMEDY}`,
    ).toContain(REMEDY);
  });

  it('AC-2 (Q-06, R-UI-011, J-004): the journey is committed and so are the six Linux baselines it compares against', () => {
    expect(there(...JOURNEY_SPEC), `${join(...JOURNEY_SPEC)} is not in the tree`).toBe(true);
    const spec = read(...JOURNEY_SPEC);

    // AC-2: "titles grep-match J-004" — `pnpm e2e --journey J-004` is Playwright's --grep
    // over the full title path, so a spec that never says J-004 is a journey nothing selects.
    expect(spec, 'the journey never names J-004, so --journey J-004 selects nothing').toContain(
      'J-004',
    );

    // AC-2 / R-UI-011: both themes, named. The screenshot names carry them, so this holds
    // however the journey is otherwise arranged.
    for (const theme of THEMES) {
      expect(spec, `the journey does not name the ${theme} theme`).toContain(theme);
    }

    // AC-2 / C-05: the sheet is opened by its route and waited for by the contract's test
    // ids. The journey speaks to the screen through the page object the spec fixes, so the
    // ids are read there — that is the file the contract names as the page-object surface.
    expect(there(...PAGE_OBJECT), `${join(...PAGE_OBJECT)} is not in the tree`).toBe(true);
    const pageObject = read(...PAGE_OBJECT);
    for (const hook of CONTRACT_HOOKS) {
      expect(
        `${spec}${pageObject}`,
        `neither the journey nor its page object names ${hook}`,
      ).toContain(hook);
    }

    for (const group of GROUPS) {
      for (const theme of THEMES) {
        // AC-2: tests/e2e/baselines/design/<group>-<theme>.png — where the array-form
        // snapshot name ['design', '<group>-<theme>.png'] lands through
        // playwright.config.ts's snapshotPathTemplate. `updateSnapshots: 'none'` means a
        // baseline that is not in the tree fails the lane rather than being written by it.
        const baseline = [...BASELINE_DIR, `${group}-${theme}.png`];
        expect(there(...baseline), `${join(...baseline)} is not in the tree`).toBe(true);
        const bytes = readFileSync(join(REPO, ...baseline));
        expect(bytes.length, `${join(...baseline)} is empty`).toBeGreaterThan(0);
        expect(
          bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC),
          `${join(...baseline)} is not a PNG`,
        ).toBe(true);
      }
    }
  });

});

/**
 * AC-4: this arm runs only when the gate's acceptance run arms it. Unarmed, vitest reports
 * the test by name as not run — a named skip, which is what the spec asks for, and not a
 * green assertion about a lane nobody started. The reason is printed beside it.
 */
const LANE_IS_ARMED = process.env[LANE_ENV] === LANE_ARMED;
if (!LANE_IS_ARMED) {
  console.log(
    `J-004 lane arm NOT RUN: ${LANE_ENV} is not "${LANE_ARMED}" — the gate's acceptance run sets it; \`pnpm verify\` does not, so Q-01's ≤ 60 s budget survives.`,
  );
}

describe('inc-007e AC-4 — the lane arm: `pnpm e2e --journey J-004` really runs and really reports', () => {
  it.runIf(LANE_IS_ARMED)(
    'AC-2 / AC-4 (V-E2E, Q-11): the lane exits 0 and its merged stream ends with the e2e: ok line',
    () => {
      // AC-4: "merging the child's stdout and stderr onto ONE stream". The runner writes its
      // contract lines to stdout and every detail — the build, the migrations, Playwright's
      // report — to stderr; captured separately, stderr is reported after stdout and the
      // "final line" of the run is whichever stream you happened to read. `2>&1` in the shell
      // is the merge, so the last line here is the last line the lane actually printed.
      const run = spawnSync('/bin/sh', ['-c', 'pnpm e2e --journey J-004 2>&1'], {
        cwd: REPO,
        encoding: 'utf8',
        timeout: LANE_KILL_MS,
        maxBuffer: 64 * 1024 * 1024,
      });

      const merged = `${run.stdout ?? ''}`;
      const lines = merged.split('\n').filter((line) => line.trim() !== '');
      const final = lines.at(-1) ?? '';
      const tail = lines.slice(-40).join('\n');

      expect(run.error, `the lane could not be spawned: ${String(run.error?.message)}`).
        toBeUndefined();

      // AC-2: "exits 0" — the exit code is the verdict, and scripts/e2e.mjs captures the
      // runner's own status before anything is torn down.
      expect(run.status, `pnpm e2e --journey J-004 exited ${String(run.status)}:\n${tail}`).toBe(0);

      // AC-2: on success the final line of the merged stream is `e2e: ok (<seconds>s)`.
      expect(final, `the lane's final merged line is not the contract line:\n${tail}`).toMatch(
        LANE_OK,
      );
    },
    LANE_BUDGET_MS,
  );
});
