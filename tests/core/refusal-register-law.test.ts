/**
 * inc-002 acceptance — the Q-07 register, judged from outside it (AC-2).
 *
 * Q-07: "Refusal register: every code exercised by name or deferred by name; no orphan
 * codes." L-QTY-04 says the same thing at length: "every member of every reason enum is
 * exercised by name in a test or deferred by name (the refusal register, Q-07)."
 *
 * The register test the increment delivers lives at src/core/__tests__/refusal-register.test.ts
 * and proves the law against the tree. A test cannot be its own acceptance, so this file
 * scans the tree independently — its own walk, its own literal reader — and asserts three
 * things the register also asserts, plus the two wiring facts that decide whether the
 * register runs at all (V-VERIFY: the vitest stage is where it must run).
 *
 * This file lives under tests/ rather than beside the module on purpose. An acceptance test
 * that only runs once the feature is wired cannot report the feature being unwired: the
 * include extension AC-2 requires is asserted from a file that `pnpm verify` already runs.
 *
 * The scan here is deliberately no stricter than the law: where the register may reasonably
 * read a literal as something other than a refusal (a `process.env[...]` key is the case the
 * tree already carries), this file reads it the same lenient way. A finding here is a
 * finding under any defensible reading.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REFUSAL_CODES, auditRefusalRegister } from '../../src/core/errors';
import { DEFERRED_REFUSALS } from '../../src/core/errors/deferrals';

const REPO = process.cwd();

/** The register test the Increment Spec names, as a repo-relative path. */
const REGISTER_TEST = 'src/core/__tests__/refusal-register.test.ts';

/** Refusal code grammar, verbatim from the Increment Spec's interfaces section. */
const CODE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;

/**
 * The same grammar, read anywhere in a test file. "Exercised by name" (Q-07) is a name a
 * test states, whatever it states it as: the seam's system refusal is exercised today by a
 * `toThrow(/SYSTEM.../)` in db/__tests__, where the name is a pattern and not a string. A
 * scan that only read string literals would call that code untested and be wrong about it.
 */
const NAMED = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;

/** A string literal, with where it started — enough to read what stands in front of it. */
type Literal = { value: string; start: number };

/** Directories a tree walk has no business entering. Dot-directories are skipped wholesale. */
const SKIP = new Set(['node_modules', 'out', 'dist', 'coverage', 'test-results', 'cad']);

/** Every file under `dir`, repo-relative, with `/` separators whatever the platform uses. */
function walk(dir: string): string[] {
  const absolute = join(REPO, dir);
  if (!existsSync(absolute)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP.has(entry.name)) continue;
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...walk(child));
    else found.push(child);
  }
  return found;
}

const repoFiles = (): string[] => walk('src').concat(walk('db'), walk('tests'), walk('scripts'));

const read = (rel: string): string => readFileSync(join(REPO, rel), 'utf8');

/**
 * Every string literal in a TypeScript file, comments excluded. A regex over quotes reads
 * an apostrophe in prose as an opening quote and swallows whatever follows it, so this walks
 * the text instead: a comment is skipped whole, and a quote inside a comment is a character
 * in a sentence.
 */
function literals(text: string): Literal[] {
  const found: Literal[] = [];
  let i = 0;
  while (i < text.length) {
    const here = text.slice(i, i + 2);
    if (here === '//') {
      const end = text.indexOf('\n', i);
      i = end === -1 ? text.length : end + 1;
      continue;
    }
    if (here === '/*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }
    const quote = text[i];
    if (quote !== "'" && quote !== '"' && quote !== '`') {
      i += 1;
      continue;
    }
    const start = i;
    i += 1;
    let value = '';
    while (i < text.length && text[i] !== quote) {
      if (text[i] === '\\') {
        i += 2;
        continue;
      }
      value += text[i];
      i += 1;
    }
    i += 1;
    found.push({ value, start });
  }
  return found;
}

/**
 * The refusal-shaped literals in one file. A literal read as the key of `process.env` is a
 * variable's name, not a refusal — the tree spells one such today (the seam's database URL)
 * and the register cannot call it an orphan without calling the environment a taxonomy.
 */
function codesIn(text: string): string[] {
  const found: string[] = [];
  for (const literal of literals(text)) {
    if (!CODE.test(literal.value)) continue;
    if (/\benv\s*\[\s*$/.test(text.slice(Math.max(0, literal.start - 20), literal.start))) continue;
    found.push(literal.value);
  }
  return found;
}

const isTest = (rel: string): boolean => rel.endsWith('.test.ts') || rel.endsWith('.test.tsx');

/** AC-2's exclusions for the exercised scan: the module registries, and the register itself. */
const countsAsExercise = (rel: string): boolean =>
  isTest(rel) && !rel.startsWith('src/core/errors/') && rel !== REGISTER_TEST;

/** AC-2's exclusions for the source scan: the module registries, and every __tests__ tree. */
const countsAsSource = (rel: string): boolean =>
  rel.startsWith('src/') &&
  (rel.endsWith('.ts') || rel.endsWith('.tsx')) &&
  !rel.startsWith('src/core/errors/') &&
  !rel.split('/').includes('__tests__');

/** Every code a test file names, however it names it. */
function namesIn(text: string): string[] {
  return [...text.matchAll(NAMED)].map((match) => match[0]);
}

function collect(): { exercised: string[]; spelledInSource: string[] } {
  const exercised = new Set<string>();
  const spelledInSource = new Set<string>();
  for (const rel of repoFiles()) {
    if (countsAsExercise(rel)) for (const code of namesIn(read(rel))) exercised.add(code);
    if (countsAsSource(rel)) for (const code of codesIn(read(rel))) spelledInSource.add(code);
  }
  return { exercised: [...exercised], spelledInSource: [...spelledInSource] };
}

/** The test files `vitest run` would actually load, asked of vitest rather than of a glob. */
function vitestFiles(): string[] {
  const output = execFileSync(
    join(REPO, 'node_modules', '.bin', 'vitest'),
    ['list', '--filesOnly', '--json'],
    { cwd: REPO, encoding: 'utf8', env: { ...process.env, CI: '1', FORCE_COLOR: '0' } },
  );
  // The runner is entitled to say things on the way past; the answer is the JSON array.
  const opens = output.indexOf('[');
  const closes = output.lastIndexOf(']');
  if (opens === -1 || closes < opens) throw new Error(`vitest list said: ${output}`);
  const parsed: unknown = JSON.parse(output.slice(opens, closes + 1));
  if (!Array.isArray(parsed)) throw new Error('vitest list did not answer with an array');
  return parsed.map((row) => {
    const file = (row as { file?: unknown }).file;
    if (typeof file !== 'string') throw new Error('vitest list answered without a file');
    return relative(REPO, file).split(sep).join('/');
  });
}

describe('AC-2 — the refusal register runs, and the law it enforces holds (Q-07, V-VERIFY)', () => {
  it('delivers the register test at the path the spec names', () => {
    // Q-07 is a test in the tree, not a promise about one.
    expect(existsSync(join(REPO, REGISTER_TEST)), `${REGISTER_TEST} does not exist`).toBe(true);
  });

  it("runs the register — and src/**/__tests__ — inside `pnpm verify`'s vitest stage", () => {
    // V-VERIFY names `vitest run` as the fourth stage; a register outside its include is a
    // law nobody applies. Asked of vitest itself, so the answer is the include and the
    // exclude as the runner resolves them, not as a glob string suggests.
    const files = vitestFiles();
    expect(files, `${REGISTER_TEST} is not collected by vitest`).toContain(REGISTER_TEST);
    expect(files, 'the taxonomy suite beside src/core is not collected by vitest').toContain(
      'src/core/__tests__/refusal-taxonomy.test.ts',
    );
    // The lanes that were already collected stay collected: extending an include is not a
    // licence to narrow it.
    expect(files).toContain('tests/toolchain/pins.test.ts');
    expect(files).toContain('tests/core/refusal-register-law.test.ts');
  });

  it('declares deferrals as { code, reason }, each naming a registered code, each reasoned', () => {
    // L-QTY-04: "the same taxonomy serves machine refusals and human deferrals". A deferral
    // with no reason is an untested code with extra steps.
    const codes: string[] = [];
    for (const deferral of DEFERRED_REFUSALS) {
      expect(sortedKeys(deferral), 'a deferral is exactly { code, reason }').toEqual([
        'code',
        'reason',
      ]);
      expect(typeof deferral.reason).toBe('string');
      expect(deferral.reason.trim(), `${deferral.code}: deferred with no reason`).not.toBe('');
      expect(REFUSAL_CODES, `${deferral.code} is deferred but not registered`).toContain(
        deferral.code,
      );
      codes.push(deferral.code);
    }
    expect(new Set(codes).size, 'a code is deferred twice').toBe(codes.length);
  });

  it('leaves no registered code unexercised and undeferred', () => {
    // Q-07: "every code exercised by name or deferred by name".
    const { exercised } = collect();
    const deferred = DEFERRED_REFUSALS.map((row) => String(row.code));
    const known = new Set([...exercised, ...deferred]);
    const unexercised = REFUSAL_CODES.filter((code) => !known.has(code)).sort();
    expect(
      unexercised,
      `registered, never exercised by name in a test, never deferred by name: ${unexercised.join(', ')}`,
    ).toEqual([]);
  });

  it('leaves no orphan code spelled in product source', () => {
    // Q-07: "no orphan codes" — a refusal-shaped literal in src/** that the taxonomy has
    // never heard of is a refusal outside the closed enum (L-QTY-04).
    const { spelledInSource } = collect();
    const registered = new Set<string>(REFUSAL_CODES);
    const orphans = spelledInSource.filter((code) => !registered.has(code)).sort();
    expect(orphans, `spelled in src/**, unknown to the registry: ${orphans.join(', ')}`).toEqual([]);
  });

  it("agrees with the register's own verdict over the same tree", () => {
    // AC-2: the register "passes only when auditRefusalRegister reports ok with empty
    // unexercised, danglingDeferrals and orphans". Same tree, same function, independent
    // collection — the verdict is the register's, the evidence is this file's.
    const { exercised, spelledInSource } = collect();
    const result = auditRefusalRegister({
      registered: REFUSAL_CODES,
      exercised,
      deferred: DEFERRED_REFUSALS.map((row) => String(row.code)),
      spelledInSource,
    });
    expect(result.unexercised).toEqual([]);
    expect(result.danglingDeferrals).toEqual([]);
    expect(result.orphans).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

/** The own-property names of an object, sorted — how a shape is asserted here. */
function sortedKeys(value: object): string[] {
  return Object.keys(value).sort();
}
