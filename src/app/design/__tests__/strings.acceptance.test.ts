/**
 * inc-007 acceptance — the gallery's copy is decided, not improvised (AC-1, AM-03 (2)).
 *
 * AC-1: "All copy comes from a typed string table". AM-03 (2): "Copy is design: product voice
 * is decided in the Design Decision, never improvised by a builder; a copy defect is a
 * defect." R-SPINE-060 puts that table in the module: the Design Decision §6 names it
 * `src/app/design/strings.ts`, exporting a frozen `DESIGN_STRINGS`.
 *
 * So the assertions read the document, not this file: every `key` → value §6 decides must be
 * in the table verbatim. A wording the builder preferred is a copy defect and reads as one,
 * and a key §6 adds later is a later red — the document stays the source.
 *
 * The table is a floor, not a freeze: a key the table carries beyond §6 is not a failure here
 * (the ESLint string-table and JSX-literal rules hold the other half of R-SPINE-060).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { copyEntries } from './design-doc';

const REPO = process.cwd();

/** The file the Design Decision §6 names. */
const TABLE_PATH = 'src/app/design/strings.ts';

/** The table, per test, through a runtime specifier (see registry.acceptance.test.ts). */
async function designStrings(): Promise<Record<string, unknown>> {
  expect(
    existsSync(join(REPO, TABLE_PATH)),
    `AC-1: ${TABLE_PATH} must export DESIGN_STRINGS`,
  ).toBe(true);
  const mod = (await import(new URL('../strings.ts', import.meta.url).href)) as Record<
    string,
    unknown
  >;
  const table = mod['DESIGN_STRINGS'];
  expect(typeof table, 'AC-1: DESIGN_STRINGS is the exported table').toBe('object');
  return table as Record<string, unknown>;
}

describe('inc-007 — the gallery says what the Design Decision decided (AC-1, AM-03)', () => {
  it('AC-1 / AM-03: every string §6 decides is in the table, verbatim', async () => {
    const table = await designStrings();
    const decided = copyEntries(REPO);
    expect(decided.size, 'AM-03: §6 decides the copy — an empty read is a broken read').toBeGreaterThan(
      0,
    );
    const wrong: string[] = [];
    for (const [key, value] of decided) {
      const got = table[key];
      if (got !== value) wrong.push(`${key}: expected ${JSON.stringify(value)}, got ${String(got)}`);
    }
    expect(wrong, 'AM-03 (2): a copy defect is a defect — §6 is the wording that ships').toEqual([]);
  });

  it('AC-1: the table is one frozen table of non-empty strings under one prefix', async () => {
    const table = await designStrings();
    expect(Object.isFrozen(table), 'R-SPINE-060: the table is frozen, not a mutable bag').toBe(true);

    const bad: string[] = [];
    for (const [key, value] of Object.entries(table)) {
      if (!key.startsWith('design.')) bad.push(`${key}: not a design.* key`);
      if (typeof value !== 'string' || value.trim() === '') bad.push(`${key}: not a string value`);
    }
    expect(bad, 'R-SPINE-060: keyed by id with English values').toEqual([]);
  });
});
