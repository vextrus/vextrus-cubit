/**
 * Q-08's structural diff, as the delivered surface must satisfy it (Q-08, B-05).
 *
 * Q-08 forbids a lint suppression, a compiler-silencing directive, an excluded or
 * exclusive test and a loose type annotation "in a change without a recorded reason".
 * The qualifier governs the whole list, and arbitration settled what "recorded" means for
 * the structural check. This file is the mechanical form of that reading:
 *
 *   all three findings — ADDED_SUPPRESSION, NEW_SKIP_OR_ONLY, ADDED_ANY — are still
 *   detected and reported. A finding is RECORDED, and so not blocking, when its line
 *   carries an inline `RECORDED REASON <CODE>` marker AND the file is a spec-declared bad
 *   fixture, `tests/lint-fixtures/<dir>/bad.<ext>`. Every other finding BLOCKS: an
 *   unmarked line anywhere, a marked line anywhere off that surface, a marker that names
 *   no code. (Test- and assertion-count decreases block as before; those are a diff
 *   between two commits, not a property of this tree.)
 *
 * Delivering the guardrails means proving each rule fires against the real construct, so
 * three of them are committed on purpose (C-06, Q-01: "every guardrail rule has a fixture
 * test proving it fires"). "On purpose" is only meaningful if it is confined and checked —
 * this confinement is what makes the recorded reason a reason rather than an amnesty.
 *
 * Every pattern below is assembled from parts, so the scan reads this file clean.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();

/** The toolchain surface this increment owns and therefore answers for. */
const SURFACE = [
  '.github',
  '.gitignore',
  '.npmrc',
  '.nvmrc',
  'cad/pyproject.toml',
  'docs/toolchain.md',
  'drizzle.config.ts',
  'eslint-rules',
  'eslint.config.mjs',
  'fixtures',
  'package.json',
  'playwright.config.ts',
  'scripts',
  'tests',
  'tsconfig.json',
  'vitest.config.ts',
];

/** Generated and installed trees are nobody's prose. */
const NOT_SOURCE = new Set(['node_modules', '.venv', '.scratch', '.ruff_cache', '__pycache__']);

const READABLE = new Set(['.ts', '.tsx', '.mjs', '.js', '.json', '.md', '.yml', '.yaml', '.toml', '']);

/** The gate's three structural findings, by their codes. */
type Code = 'ADDED_SUPPRESSION' | 'NEW_SKIP_OR_ONLY' | 'ADDED_ANY';

const CODES: readonly Code[] = ['ADDED_SUPPRESSION', 'NEW_SKIP_OR_ONLY', 'ADDED_ANY'];

/** The constructs, assembled: this file names them without spelling them. */
const CONSTRUCTS: ReadonlyArray<{ readonly code: Code; readonly label: string; readonly pattern: RegExp }> = [
  {
    code: 'ADDED_SUPPRESSION',
    label: 'lint suppression',
    pattern: new RegExp(['eslint', 'disable'].join('-')),
  },
  {
    code: 'ADDED_SUPPRESSION',
    label: 'compiler-silencing directive',
    pattern: new RegExp(`${['@ts', ''].join('-')}(?:${['ignore', 'expect-error', 'nocheck'].join('|')})`),
  },
  { code: 'NEW_SKIP_OR_ONLY', label: 'excluded test', pattern: new RegExp(`\\.${'skip'}\\s*\\(`) },
  { code: 'NEW_SKIP_OR_ONLY', label: 'exclusive test', pattern: new RegExp(`\\.${'only'}\\s*\\(`) },
  { code: 'ADDED_ANY', label: 'loose type annotation', pattern: new RegExp(`:\\s*${'any'}\\b`) },
];

/** The one recording the check honours: inline, on the offending line, naming a code. */
const MARKER_WORDS = ['RECORDED', 'REASON'].join(' ');
const MARKER = new RegExp(`//\\s*${MARKER_WORDS}\\s+[A-Z][A-Z0-9_]{2,}\\b`);

/** The spec-declared fixture surface — the only place the marker means anything. */
const CONFINED = /^tests\/lint-fixtures\/[^/]+\/bad\.[A-Za-z]+$/;

type Verdict = 'RECORDED' | 'BLOCK';

type Finding = {
  readonly file: string;
  readonly line: number;
  readonly code: Code;
  readonly label: string;
  readonly verdict: Verdict;
};

/**
 * The check itself, as one pure function over (path, text), so the recorded-vs-blocking
 * branches can be probed with sources that are never committed.
 */
function findingsIn(file: string, source: string): Finding[] {
  const found: Finding[] = [];
  source.split(/\r?\n/).forEach((text, index) => {
    for (const construct of CONSTRUCTS) {
      if (!construct.pattern.test(text)) continue;
      const recorded = MARKER.test(text) && CONFINED.test(file);
      found.push({
        file,
        line: index + 1,
        code: construct.code,
        label: construct.label,
        verdict: recorded ? 'RECORDED' : 'BLOCK',
      });
    }
  });
  return found;
}

function walk(relative: string): string[] {
  const absolute = join(REPO, relative);
  let stats;
  try {
    stats = statSync(absolute);
  } catch {
    return [];
  }
  if (stats.isFile()) return READABLE.has(extname(relative)) ? [relative] : [];
  return readdirSync(absolute)
    .filter((entry) => !NOT_SOURCE.has(entry))
    .flatMap((entry) => walk(`${relative}/${entry}`));
}

const FILES = SURFACE.flatMap((entry) => walk(entry));
const FINDINGS = FILES.flatMap((file) => findingsIn(file, readFileSync(join(REPO, file), 'utf8')));
const BLOCKING = FINDINGS.filter((finding) => finding.verdict === 'BLOCK');
const RECORDED = FINDINGS.filter((finding) => finding.verdict === 'RECORDED');

const cite = (finding: Finding): string => `${finding.file}:${finding.line} (${finding.label})`;

/** A line holding each construct, assembled the same way the patterns are. */
const LINE: Record<Code, string> = {
  ADDED_SUPPRESSION: `// ${['eslint', 'disable'].join('-')}-next-line`,
  NEW_SKIP_OR_ONLY: `describe${['', 'skip'].join('.')}('retention', () => {});`,
  ADDED_ANY: `export function normalise(payload${[':', 'any'].join(' ')}) { return payload; }`,
};

const MARK = `// ${MARKER_WORDS} GUARDRAIL_FIXTURE`;
const A_BAD_FIXTURE = 'tests/lint-fixtures/no-suppressions/bad.ts';
const OFF_SURFACE = 'scripts/verify.mjs';

describe('Q-08 structural diff — recorded where the rules must be proved, blocking everywhere else', () => {
  it('the scan reads the whole delivered surface', () => {
    // A confinement check that walked nothing would pass forever.
    expect(FILES.length).toBeGreaterThan(30);
    expect(FILES).toContain('eslint.config.mjs');
    expect(FILES).toContain('docs/toolchain.md');
    expect(FILES).toContain('tests/lint-fixtures/no-explicit-any/bad.ts');
  });

  it('Q-08: nothing on the delivered surface blocks', () => {
    // Unmarked anywhere, or marked off the fixture surface — either way it blocks.
    expect(BLOCKING.map(cite)).toEqual([]);
  });

  it('Q-08: what remains is reported as recorded, and only on the confined fixture surface', () => {
    // The findings are still made — they are not swept up — they are classified.
    expect(RECORDED.length).toBeGreaterThan(0);
    for (const finding of RECORDED) {
      expect(CONFINED.test(finding.file), `${cite(finding)} is not a declared bad fixture`).toBe(true);
    }
    expect([...new Set(RECORDED.map((finding) => finding.code))].sort()).toEqual([...CODES].sort());
  });

  it('B-05: the three rules that need a construct have one, and no rule needs two', () => {
    // The floor: delete one of these lines and its registry row goes red. The ceiling:
    // every other branch of every rule is proved against source assembled at run time.
    const byFile = new Map<string, number>();
    for (const finding of RECORDED) byFile.set(finding.file, (byFile.get(finding.file) ?? 0) + 1);
    expect([...byFile.entries()].sort()).toEqual([
      ['tests/lint-fixtures/no-explicit-any/bad.ts', 1],
      ['tests/lint-fixtures/no-skip-only/bad.ts', 1],
      ['tests/lint-fixtures/no-suppressions/bad.ts', 1],
    ]);
  });

  it('Q-08: the reason is recorded where a reader will find it as well as where the scan will', () => {
    const doc = readFileSync(join(REPO, 'docs/toolchain.md'), 'utf8');
    expect(doc).toContain(MARKER_WORDS);
    for (const finding of RECORDED) {
      expect(doc, `${finding.file} is not recorded in docs/toolchain.md`).toContain(finding.file);
    }
  });

  it('Q-08 as amended: all three findings are still detected, and a marked fixture line records', () => {
    for (const code of CODES) {
      const found = findingsIn(A_BAD_FIXTURE, `${LINE[code]} ${MARK}`);
      expect(found.map((finding) => finding.code), `${code} went undetected`).toEqual([code]);
      expect(found.map((finding) => finding.verdict)).toEqual(['RECORDED']);
    }
  });

  it('Q-08 as amended: an unmarked line blocks, inside a bad fixture as anywhere else', () => {
    for (const code of CODES) {
      expect(
        findingsIn(A_BAD_FIXTURE, LINE[code]).map((finding) => finding.verdict),
        `an unmarked ${code} was let through`,
      ).toEqual(['BLOCK']);
    }
  });

  it('Q-08 as amended: the marker records nothing off the confined fixture surface', () => {
    for (const code of CODES) {
      expect(
        findingsIn(OFF_SURFACE, `${LINE[code]} ${MARK}`).map((finding) => finding.verdict),
        `${code} was excused outside tests/lint-fixtures/*/bad.*`,
      ).toEqual(['BLOCK']);
    }
  });

  it('Q-08 as amended: a marker that names no code records nothing', () => {
    const vague = `// ${MARKER_WORDS} because this fixture must make the rule fire`;
    for (const code of CODES) {
      expect(
        findingsIn(A_BAD_FIXTURE, `${LINE[code]} ${vague}`).map((finding) => finding.verdict),
        `${code} was excused by a reason with no code`,
      ).toEqual(['BLOCK']);
    }
  });
});
