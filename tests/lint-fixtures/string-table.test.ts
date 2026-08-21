/**
 * inc-003 acceptance — the compiler refuses a missing key, mechanically (AC-3, R-SPINE-060,
 * B-05).
 *
 * R-SPINE-060: "…keyed by id with English values; the compiler refuses a missing key." B-05
 * says a guardrail that matters is mechanical, "a type, a lint rule with a fixture test that
 * proves it fires" — this one is a type, so its fixture is a tsc project rather than a lint
 * run, and the proof is the compiler's own exit code on the two projects under
 * tests/lint-fixtures/format/.
 *
 * The pair is what makes it a guardrail: the bad project must fail *for the key*, and the
 * good project must pass. A bad project that fails because the table is missing, or because
 * a path is wrong, proves nothing about `StringKey` — so this suite reads which files the
 * diagnostics name and refuses a resolution failure as the reason.
 *
 * These fixtures are not lint fixtures and add no guardrail-registry row: the registry is
 * pinned at ten rows by tests/lint-fixtures/registry.test.ts, which reads its own list and
 * is untouched by the directory beside them.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();

const DIR = 'tests/lint-fixtures/format';
const BAD_PROJECT = `${DIR}/tsconfig.bad.json`;
const GOOD_PROJECT = `${DIR}/tsconfig.good.json`;
const BAD_FILE = `${DIR}/missing-key.bad.ts`;
const GOOD_FILE = `${DIR}/known-key.good.ts`;

/** A file a diagnostic names, however tsc lays the line out. */
const DIAGNOSTIC_FILE = /([A-Za-z0-9_./-]+\.tsx?)[(:]\d+/g;

/** The compiler failing to find something is a broken fixture, never the refusal we want. */
const RESOLUTION_FAILURE = /Cannot find (?:module|name|file)|TS2307|TS2688/;

type Ran = { status: number; output: string; spawnError: string | null };

/**
 * The exact command the Increment Spec's procedures name — no extra flags, so what passes
 * here is what a reader can run. The env pins colour OFF: under a full `pnpm verify` from a
 * terminal, vitest's workers set FORCE_COLOR and the spawned tsc inherited it, so every
 * diagnostic arrived wrapped in ANSI codes, `filesNamed` matched nothing, and this suite
 * reported "the compiler named no file" on a run where the compiler had refused the key
 * perfectly — a persistent false red on main (2026-08-22). The proof must not depend on who
 * runs it.
 */
function tsc(project: string): Ran {
  const env: Record<string, string | undefined> = { ...process.env, NO_COLOR: '1', NODE_DISABLE_COLORS: '1' };
  delete env.FORCE_COLOR;
  const result = spawnSync('pnpm', ['exec', 'tsc', '--noEmit', '-p', project], {
    cwd: REPO,
    encoding: 'utf8',
    env,
  });
  return {
    status: result.status ?? -1,
    // Strip ANSI anyway (defence in depth): a colour code between file and line is invisible
    // in a terminal and fatal to the regex.
    output: stripAnsi(`${result.stdout ?? ''}${result.stderr ?? ''}`),
    spawnError: result.error ? String(result.error) : null,
  };
}

const stripAnsi = (text: string): string => text.replace(/\u001b\[[0-9;]*m/g, '');

/** Every file the run's diagnostics point at, deduplicated. */
const filesNamed = (output: string): string[] => [
  ...new Set([...output.matchAll(DIAGNOSTIC_FILE)].map((match) => match[1] ?? '')),
];

/**
 * A non-zero exit with no `error TS…` diagnostic is the runner failing to run the compiler
 * (a spawn error, an empty pipe), never the compiler judging the fixture. Assert it apart, so
 * a red here names the machine and not the guardrail.
 */
const compilerJudged = (ran: Ran): boolean => /error TS\d+/.test(ran.output);

describe('AC-3 — a key nobody registered does not compile (R-SPINE-060, B-05)', () => {
  it('refuses the unregistered key: the bad project exits non-zero, for the key itself', () => {
    // The fixture is one file listed explicitly, so nothing else can be the reason.
    const project = JSON.parse(readFileSync(join(REPO, BAD_PROJECT), 'utf8').replace(/^\s*\/\/.*$/gm, '')) as {
      files?: string[];
      include?: string[];
    };
    expect(project.files).toEqual(['missing-key.bad.ts']);
    expect(project.include ?? []).toEqual([]);
    expect(existsSync(join(REPO, BAD_FILE))).toBe(true);

    const ran = tsc(BAD_PROJECT);
    // The compiler must have JUDGED the fixture before any exit code means anything: a spawn
    // failure or an empty pipe exits non-zero having named no file, and that red belongs to
    // the machine, not to StringKey.
    expect(
      compilerJudged(ran),
      `the compiler never judged the fixture (this is the runner's environment, not the key guardrail): status=${ran.status} spawnError=${ran.spawnError ?? '-'}\n${ran.output || '(no output)'}`,
    ).toBe(true);
    expect(ran.status, `tsc -p ${BAD_PROJECT} compiled an unregistered key clean`).not.toBe(0);

    // …and it is the key that fails, not the fixture's plumbing: a missing module or an
    // unresolved name would fail this project forever and prove nothing about StringKey.
    expect(
      RESOLUTION_FAILURE.test(ran.output),
      `tsc -p ${BAD_PROJECT} failed to resolve rather than refusing the key:\n${ran.output}`,
    ).toBe(false);
    expect(filesNamed(ran.output)).toEqual([BAD_FILE]);
  });

  it('accepts the registered key: the good project exits 0', () => {
    const project = JSON.parse(readFileSync(join(REPO, GOOD_PROJECT), 'utf8').replace(/^\s*\/\/.*$/gm, '')) as {
      files?: string[];
      include?: string[];
    };
    expect(project.files).toEqual(['known-key.good.ts']);
    expect(project.include ?? []).toEqual([]);
    expect(existsSync(join(REPO, GOOD_FILE))).toBe(true);

    const ran = tsc(GOOD_PROJECT);
    expect(ran.status, `tsc -p ${GOOD_PROJECT} reported:\n${ran.output}`).toBe(0);
    expect(ran.output).not.toMatch(/error TS/);
  });
});
