/**
 * Q-08 — no suppression, no `.skip`/`.only`, no explicit `any` in a change
 * *without a recorded reason* (structural diff check).
 *
 * The prohibition is conditional on those five words, and this file is the
 * mechanical form of the condition (B-05: prose is not enforcement). Amended
 * after arbitration, the recording that silences the scan is exactly one thing:
 *
 *   an inline, line-anchored `// RECORDED REASON <CODE>` marker on the very
 *   line that holds the construct, in a file matching
 *   `tests/lint-fixtures/<dir>/bad.<ext>`.
 *
 * Nothing else records a reason for the purpose of this check. A marker on a
 * line anywhere else on the surface — a script, a config, a rule, the docs, or
 * this file — is an offence, and so is an unmarked construct everywhere,
 * including inside a bad fixture. The marker is not a general amnesty.
 *
 * The docs/toolchain.md registry table and the fixture file headers remain
 * required documentation of *why* the three constructs are committed, but they
 * are not inputs here: a table row cannot sanction a line, and a header cannot
 * sanction the body beneath it.
 *
 * The constructs are assembled from their parts rather than spelled, for the
 * same reason the check exists: a check that spells what it forbids reports
 * itself.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

/**
 * The toolchain surface this increment delivers — its ownership paths, and the
 * only files it can be asked to answer for. A later increment that adds a root
 * of its own adds it here; product code is policed by the rules themselves
 * (cubit/no-suppressions, cubit/no-skip-only, no-explicit-any) over src/**.
 */
const SURFACE: readonly string[] = [
  '.github/workflows',
  'cad',
  'docs/toolchain.md',
  'drizzle.config.ts',
  'eslint-rules',
  'eslint.config.mjs',
  'fixtures',
  'package.json',
  'playwright.config.ts',
  'scripts',
  'tests/lint-fixtures',
  // The acceptance suite is part of the change this increment makes, so Q-08's
  // structural check reads it too: a suite that reached for the exclusive
  // marker to get itself green would be the exact failure Q-08 names.
  'tests/toolchain',
  'tsconfig.json',
  'vitest.config.ts',
];

/** Build output and dependency trees are nobody's change. */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', '.next-verify', '.cubit-scratch', '.venv']);

const TEXT = new Set([
  '.ts',
  '.tsx',
  '.mjs',
  '.js',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.toml',
  '.css',
]);

const LINT_DIRECTIVE = ['eslint', 'disable'].join('-');
const TYPE_SUPPRESSIONS = ['ignore', 'expect-error', 'nocheck'].map((word) => `@ts-${word}`);

interface Construct {
  readonly name: string;
  readonly pattern: RegExp;
}

const CONSTRUCTS: readonly Construct[] = [
  { name: 'a lint-disable directive', pattern: new RegExp(`\\b${LINT_DIRECTIVE}(-next-line|-line)?\\b`) },
  ...TYPE_SUPPRESSIONS.map((directive) => ({
    name: `a type-error suppression (${directive.slice(0, 4)}…)`,
    pattern: new RegExp(directive),
  })),
  { name: 'a skip/only marker', pattern: /\.(skip|only)\s*\(/ },
  { name: 'an explicit any', pattern: /:\s*any\b|<\s*any\s*>|,\s*any\s*>/ },
];

/**
 * The one recording the scan honours: inline on the offending line, naming a
 * code. `// RECORDED REASON GUARDRAIL_FIXTURE` — nothing looser.
 */
const MARKER = new RegExp(`//\\s*${['RECORDED', 'REASON'].join(' ')} [A-Z][A-Z0-9_]{3,}\\b`);

/** The only files in which that marker means anything. */
const BAD_FIXTURE = /^tests\/lint-fixtures\/[^/]+\/bad\.[A-Za-z]+$/;

/**
 * The scan, as one pure function over (path, text) so the exemption can be
 * probed with sources that are never committed. An offence is a line holding a
 * construct that is not both marked and inside a bad fixture.
 */
function offencesIn(file: string, source: string): string[] {
  const offences: string[] = [];
  source.split('\n').forEach((line, index) => {
    for (const construct of CONSTRUCTS) {
      if (!construct.pattern.test(line)) continue;
      if (MARKER.test(line) && BAD_FIXTURE.test(file)) continue;
      offences.push(`${file}:${index + 1} holds ${construct.name}`);
    }
  });
  return offences;
}

/**
 * The three sites AC-2 mandates: a rule with no committed bad fixture has
 * nothing to fire on, so these files must exist and must hold their construct.
 */
const MANDATED_SITES: readonly string[] = [
  'tests/lint-fixtures/no-suppressions/bad.ts',
  'tests/lint-fixtures/no-skip-only/bad.ts',
  'tests/lint-fixtures/no-explicit-any/bad.ts',
];

/** A line holding each construct, assembled so this file never spells one. */
const SPECIMENS: readonly { readonly name: string; readonly line: string }[] = [
  { name: 'a lint-disable directive', line: `/* ${LINT_DIRECTIVE} */` },
  { name: 'a type-error suppression', line: `// ${TYPE_SUPPRESSIONS[0] ?? ''}` },
  { name: 'a skip/only marker', line: `${['describe', 'skip('].join('.')}'retention', () => {});` },
  { name: 'an explicit any', line: `export function normalise(payload${':'} ${'any'}) {}` },
];

const MARKED = ` // ${['RECORDED', 'REASON'].join(' ')} GUARDRAIL_FIXTURE`;

/** Surface paths that are emphatically not bad fixtures. */
const ELSEWHERE: readonly string[] = [
  'docs/toolchain.md',
  'scripts/verify.mjs',
  'eslint.config.mjs',
  'eslint-rules/no-suppressions.mjs',
  'package.json',
  '.github/workflows/ci.yml',
  'tests/toolchain/guardrail-registry.test.ts',
  'tests/lint-fixtures/q08-confinement.test.ts',
  'tests/lint-fixtures/no-suppressions/good.ts',
  'tests/lint-fixtures/no-suppressions/bad.ts.bak',
];

function walk(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (entry.isFile() && TEXT.has(path.extname(entry.name))) {
      out.push(path.relative(ROOT, path.join(dir, entry.name)).split(path.sep).join('/'));
    }
  }
  return out;
}

const surfaceFiles = (): string[] => {
  const files: string[] = [];
  for (const entry of SURFACE) {
    const full = path.join(ROOT, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else {
      files.push(entry);
    }
  }
  return files.sort();
};

describe('Q-08 a construct is recorded on its own line, inside a bad fixture, or not at all', () => {
  const files = surfaceFiles();

  it('Q-08 (AC-2): the surface is walked, not assumed, and the mandated sites are on it', () => {
    expect(
      files.length,
      'the walk found next to no files — the check would pass vacuously',
    ).toBeGreaterThan(20);
    for (const site of MANDATED_SITES) {
      expect(files, `${site} is missing; AC-2 requires it`).toContain(site);
      expect(site, 'a mandated site must be a bad fixture for its marker to count').toMatch(
        BAD_FIXTURE,
      );
    }
  });

  it('Q-08: no unrecorded construct anywhere on the surface', () => {
    const offences: string[] = [];
    for (const file of files) {
      offences.push(...offencesIn(file, readFileSync(path.join(ROOT, file), 'utf8')));
    }
    expect(
      offences,
      'Q-08: mark the line itself inside a bad fixture, or delete the construct',
    ).toEqual([]);
  });

  it('Q-08 (B-05): the marker silences a construct inside a bad fixture', () => {
    for (const specimen of SPECIMENS) {
      for (const site of MANDATED_SITES) {
        expect(
          offencesIn(site, `${specimen.line}${MARKED}`),
          `${specimen.name} marked in place at ${site} is recorded, not an offence`,
        ).toEqual([]);
      }
    }
  });

  it('Q-08 (B-05): the marker is not a general amnesty — marked lines elsewhere still fail', () => {
    const missed: string[] = [];
    for (const specimen of SPECIMENS) {
      for (const file of ELSEWHERE) {
        if (offencesIn(file, `${specimen.line}${MARKED}`).length === 0) {
          missed.push(`${file} silenced ${specimen.name} with a marker it has no right to`);
        }
      }
    }
    expect(missed, 'only tests/lint-fixtures/<dir>/bad.<ext> may carry a marker').toEqual([]);
  });

  it('Q-08: an unmarked construct is an offence everywhere, bad fixtures included', () => {
    const missed: string[] = [];
    for (const specimen of SPECIMENS) {
      for (const file of [...MANDATED_SITES, ...ELSEWHERE]) {
        if (offencesIn(file, specimen.line).length === 0) {
          missed.push(`${file} let ${specimen.name} through unrecorded`);
        }
      }
    }
    expect(missed, 'the exemption is the marker, not the directory alone').toEqual([]);
  });

  it('Q-08 (B-05): the docs table records nothing — a construct spelled there is an offence', () => {
    const docs = 'docs/toolchain.md';
    for (const specimen of SPECIMENS) {
      const row = `| ${docs} | 1 | ${specimen.line} | AC-2 |`;
      expect(
        offencesIn(docs, row),
        `a registry row spelling ${specimen.name} is prose, and prose is not enforcement`,
      ).not.toEqual([]);
      expect(
        offencesIn(docs, `${row}${MARKED}`),
        `a marked registry row spelling ${specimen.name} is still prose`,
      ).not.toEqual([]);
    }
  });

  it('Q-08 (B-05): a header reason does not sanction the body beneath it', () => {
    for (const specimen of SPECIMENS) {
      const source = [
        `// ${['RECORDED', 'REASON'].join(' ')} GUARDRAIL_FIXTURE — the construct below is committed`,
        '// so the rule can be proved to fire on a real file (AC-2).',
        specimen.line,
      ].join('\n');
      const site = MANDATED_SITES[0] ?? '';
      const offences = offencesIn(site, source);
      expect(
        offences,
        `${specimen.name} needs the marker on its own line, not only in the header`,
      ).toHaveLength(1);
      expect(offences[0], 'the offence is anchored at the construct, not the header').toMatch(
        new RegExp(`^${site}:3 holds `),
      );
    }
  });

  it('Q-08: the mandated sites still document their reason in the header (documentation, not the check)', () => {
    const missing: string[] = [];
    for (const site of MANDATED_SITES) {
      const header = readFileSync(path.join(ROOT, site), 'utf8').slice(0, 600);
      if (!header.includes(`${['RECORDED', 'REASON'].join(' ')} GUARDRAIL_FIXTURE`)) {
        missing.push(`${site} does not say why it holds a construct`);
      }
    }
    expect(missing, 'the reason is documented at the site as well as marked on the line').toEqual(
      [],
    );
  });
});
