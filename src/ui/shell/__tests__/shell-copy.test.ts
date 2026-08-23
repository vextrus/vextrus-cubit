/**
 * inc-009 acceptance — the shell's copy is the Design Decision's, verbatim (AC-1, AC-3,
 * R-SPINE-060, R-UI-033).
 *
 * docs/design/shell.md §7 is a table of key → value and says where each half lives:
 * `SHELL_STRINGS` in `src/ui/shell/strings.ts` for the frame's own words, `TENANT_STRINGS`
 * in `src/app/t/strings.ts` for the areas'. AC-3 then grades the Projects empty state
 * against "the docs/design/shell.md §copy", which is only checkable if the copy is one
 * table read by key rather than sentences typed into JSX.
 *
 * The direction of the check matters. It runs doc → code: every key the Design Decision
 * publishes must exist, with that value, in the table the doc names. It does not pin the
 * size of either string table, so a later increment that lawfully registers more copy stays
 * green; what it cannot do is quietly reword a sentence the designer decided.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TENANT_STRINGS } from '../../../app/t/strings';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, '..', '..', '..', '..');

/** The Design Decision this increment is graded against. */
const DESIGN_DOC = join(REPO, 'docs', 'design', 'shell.md');

/** The frame's own string table, as §7 names it — loaded by path, not by import specifier. */
const SHELL_STRINGS_MODULE = join(REPO, 'src', 'ui', 'shell', 'strings.ts');

/**
 * A floor on the parse. If a doc reformat ever stops this regex matching, the test must fail
 * loudly rather than pass with nothing to compare — a green that means "I read no copy" is
 * worse than a red.
 */
const MIN_ROWS = 20;

/** Two keys the increment's own criteria quote, so the parse cannot silently miss the areas. */
const REQUIRED_KEYS = ['shell.rail.label', 'tenant.projects.empty.teach'] as const;

interface StringTable {
  readonly [key: string]: unknown;
}

/**
 * §7's table, as key → value. The key column is fenced in backticks; values carry no pipe.
 *
 * The parse checks itself before it is used — a doc reformat that stopped this regex matching
 * would otherwise turn both claims below into "nothing to compare, therefore green".
 */
function decidedCopy(): Map<string, string> {
  const doc = readFileSync(DESIGN_DOC, 'utf8');
  const section = doc.split(/^## 7\./m)[1]?.split(/^## 8\./m)[0] ?? '';
  const rows = new Map<string, string>();
  for (const line of section.split('\n')) {
    const match = /^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (match === null) continue;
    const [, key, value] = match;
    if (key === undefined || value === undefined) continue;
    rows.set(key, value);
  }

  expect(
    rows.size,
    `docs/design/shell.md §7 yielded ${rows.size} rows — the copy table could not be read`,
  ).toBeGreaterThanOrEqual(MIN_ROWS);
  for (const key of REQUIRED_KEYS) {
    expect(rows.has(key), `docs/design/shell.md §7 has no row for ${key}`).toBe(true);
  }
  return rows;
}

async function shellStrings(): Promise<StringTable> {
  expect(
    existsSync(SHELL_STRINGS_MODULE),
    'src/ui/shell/strings.ts is not in the tree — docs/design/shell.md §7 registers the shell copy there',
  ).toBe(true);
  const loaded = (await import(/* @vite-ignore */ SHELL_STRINGS_MODULE)) as {
    SHELL_STRINGS?: StringTable;
  };
  expect(
    loaded.SHELL_STRINGS,
    'src/ui/shell/strings.ts exports no SHELL_STRINGS (docs/design/shell.md §7)',
  ).toBeDefined();
  return loaded.SHELL_STRINGS ?? {};
}

describe('AC-1 / AC-3 — the shell speaks the Design Decision’s words (R-SPINE-060)', () => {
  it('registers every `shell.*` key §7 decides in SHELL_STRINGS, verbatim', async () => {
    const table = await shellStrings();
    const missing: string[] = [];
    const wrong: string[] = [];
    for (const [key, decided] of decidedCopy()) {
      if (!key.startsWith('shell.')) continue;
      const registered = table[key];
      if (registered === undefined) missing.push(key);
      else if (registered !== decided) wrong.push(`${key}: ${String(registered)} ≠ ${decided}`);
    }
    expect(missing, 'SHELL_STRINGS is missing copy docs/design/shell.md §7 decided').toEqual([]);
    expect(wrong, 'SHELL_STRINGS reworded copy the Design Decision fixed').toEqual([]);
  });

  it('registers every `tenant.*` key §7 decides in TENANT_STRINGS, verbatim', () => {
    // The areas' copy joins the table s-auth founded, in src/app/t/strings.ts — §7 again.
    const table = TENANT_STRINGS as StringTable;
    const missing: string[] = [];
    const wrong: string[] = [];
    for (const [key, decided] of decidedCopy()) {
      if (!key.startsWith('tenant.')) continue;
      const registered = table[key];
      if (registered === undefined) missing.push(key);
      else if (registered !== decided) wrong.push(`${key}: ${String(registered)} ≠ ${decided}`);
    }
    expect(missing, 'TENANT_STRINGS is missing copy docs/design/shell.md §7 decided').toEqual([]);
    expect(wrong, 'TENANT_STRINGS reworded copy the Design Decision fixed').toEqual([]);
  });
});
