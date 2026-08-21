/**
 * Where a Q-08 construct is allowed to exist, mechanically (Q-08, B-05).
 *
 * Q-08 forbids a suppression, a compiler-silencing directive, an excluded or exclusive
 * test and a loose type annotation "in a change without a recorded reason". Delivering the
 * guardrails means proving each fires against the real construct, so the tree contains a
 * few of them on purpose. "On purpose" is only meaningful if it is confined and checked:
 * a construct may appear only on a line of a spec-declared bad fixture that carries the
 * marker, and nowhere else in the delivered surface.
 *
 * Every pattern below is assembled from parts, so this file scans itself clean.
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

const MARKER = ['RECORDED', 'REASON'].join(' ');

/** The constructs, assembled: this file names them without spelling them. */
const CONSTRUCTS: ReadonlyArray<{ readonly label: string; readonly pattern: RegExp }> = [
  { label: 'lint suppression', pattern: new RegExp(['eslint', 'disable'].join('-')) },
  {
    label: 'compiler-silencing directive',
    pattern: new RegExp(`${['@ts', ''].join('-')}(?:${['ignore', 'expect-error', 'nocheck'].join('|')})`),
  },
  { label: 'excluded test', pattern: new RegExp(`\\.${'skip'}\\(`) },
  { label: 'exclusive test', pattern: new RegExp(`\\.${'only'}\\(`) },
  { label: 'loose type annotation', pattern: new RegExp(`:\\s*${'any'}\\b`) },
];

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

/** A spec-declared bad fixture: tests/lint-fixtures/<rule>/bad.<ext>, and nothing else. */
function isDeclaredFixture(relative: string): boolean {
  return /^tests\/lint-fixtures\/[a-z-]+\/bad\.(?:ts|tsx)$/.test(relative);
}

type Hit = { readonly file: string; readonly line: number; readonly label: string; readonly marked: boolean };

function hitsIn(relative: string): Hit[] {
  const lines = readFileSync(join(REPO, relative), 'utf8').split(/\r?\n/);
  const hits: Hit[] = [];
  lines.forEach((line, index) => {
    for (const construct of CONSTRUCTS) {
      if (!construct.pattern.test(line)) continue;
      hits.push({
        file: relative,
        line: index + 1,
        label: construct.label,
        marked: line.includes(MARKER),
      });
    }
  });
  return hits;
}

const FILES = SURFACE.flatMap((entry) => walk(entry));
const HITS = FILES.flatMap((file) => hitsIn(file));

describe('Q-08 constructs are confined to the fixtures that must prove the rules (B-05)', () => {
  it('the scan reads the whole delivered surface', () => {
    // A confinement test that walked nothing would pass forever.
    expect(FILES.length).toBeGreaterThan(30);
    expect(FILES).toContain('eslint.config.mjs');
    expect(FILES).toContain('docs/toolchain.md');
    expect(FILES).toContain('tests/lint-fixtures/no-explicit-any/bad.ts');
  });

  it('Q-08: outside a declared bad fixture, the constructs are assembled or named, never spelled', () => {
    const strays = HITS.filter((hit) => !isDeclaredFixture(hit.file)).map(
      (hit) => `${hit.file}:${hit.line} (${hit.label})`,
    );
    expect(strays).toEqual([]);
  });

  it('Q-08: inside one, every flagged line carries its recorded reason', () => {
    const unmarked = HITS.filter((hit) => !hit.marked).map(
      (hit) => `${hit.file}:${hit.line} (${hit.label})`,
    );
    expect(unmarked).toEqual([]);
  });

  it('Q-08: the reason is recorded where a reader will find it as well as where the scan will', () => {
    const doc = readFileSync(join(REPO, 'docs/toolchain.md'), 'utf8');
    expect(doc).toContain(MARKER);
    for (const hit of HITS) {
      expect(doc, `${hit.file} is not recorded in docs/toolchain.md`).toContain(hit.file);
    }
  });

  it('B-05: the three rules that need a construct have one, and no rule needs two', () => {
    // The floor: delete one of these lines and its registry row goes red. The ceiling:
    // every other branch of every rule is proved against source assembled at run time.
    const byFile = new Map<string, number>();
    for (const hit of HITS) byFile.set(hit.file, (byFile.get(hit.file) ?? 0) + 1);
    expect([...byFile.entries()].sort()).toEqual([
      ['tests/lint-fixtures/no-explicit-any/bad.ts', 1],
      ['tests/lint-fixtures/no-skip-only/bad.ts', 1],
      ['tests/lint-fixtures/no-suppressions/bad.ts', 1],
    ]);
  });
});
