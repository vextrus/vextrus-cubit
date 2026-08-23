/**
 * inc-012 — the rule-set edition's one refusal is in the closed taxonomy, and the database
 * raises it by that name (L-MEA-01, R-SPINE-062, Q-07).
 *
 * L-MEA-01 gives an edition exactly one lawful way to change: "authoring mints a new edition,
 * never updates one". The machinery that enforces it at M0 is the statement trigger in
 * `db/migrations/0003_spine_rulesets.sql`, and the code it raises with is only useful if it is
 * the same code the register carries — a refusal spelled one way in SQL and another way in the
 * taxonomy is two refusals, one of which nobody can look up.
 *
 * It sits beside the module rather than in the db lane because neither half needs a database:
 * the taxonomy is a frozen table and the migration is a file. That also puts it in
 * `pnpm verify`'s vitest stage, where Q-07's own register test runs.
 *
 * No Design Decision decides this entry's words: the ruleset pane performs no act and can
 * elicit no refusal (docs/design/s-project-settings.md Interpretation 1, §6), so `surface` is
 * `log` and the wording is graded here for shape rather than against a design table.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REFUSALS, REFUSAL_CODES } from '../../errors';
import { RULESET_REFUSALS } from '../../errors/rulesets';

const REPO = process.cwd();

/** The migration that founds the two tables and the immutability trigger. */
const MIGRATION = join(REPO, 'db', 'migrations', '0003_spine_rulesets.sql');

/** The one code the rule-set machinery can raise at M0. */
const CODE = 'EDITION_IMMUTABLE';

/** R-SPINE-062's closed sets, as src/core/errors/types.ts declares them. */
const SEVERITIES = new Set(['block', 'defer', 'warn']);
const SURFACES = new Set(['field', 'toast', 'page', 'log']);

/** The registered entry, or a named failure — never a silently skipped assertion. */
function registered(): Record<string, unknown> {
  const table = REFUSALS as unknown as Record<string, unknown>;
  expect(
    REFUSAL_CODES as readonly string[],
    `${CODE} is not in the closed taxonomy — R-SPINE-062 keeps every refusal in it, reachable from src/core/errors.ts`,
  ).toContain(CODE);
  const entry = table[CODE];
  expect(entry, `REFUSALS has no entry for ${CODE}`).toBeDefined();
  return (entry ?? {}) as Record<string, unknown>;
}

describe('inc-012 — the rule-set edition refusal (L-MEA-01, R-SPINE-062)', () => {
  it('composes RULESET_REFUSALS into the closed taxonomy under its own name', () => {
    const own = (RULESET_REFUSALS as unknown as Record<string, unknown>)[CODE];
    expect(own, `src/core/errors/rulesets.ts registers no ${CODE}`).toBeDefined();
    expect(registered(), `${CODE} in the barrel is not the entry the module registered`).toBe(own);
  });

  it('R-SPINE-062: it carries an English message, a remedy hint, a severity and a surface', () => {
    const entry = registered();
    expect(entry['code'], `${CODE}'s entry is filed under a different name`).toBe(CODE);
    expect(String(entry['message']).trim(), `${CODE} has no message`).not.toBe('');
    expect(String(entry['remedy']).trim(), `${CODE} has no remedy hint`).not.toBe('');
    expect(
      SEVERITIES.has(String(entry['severity'])),
      `${CODE}'s severity "${String(entry['severity'])}" is outside the closed set`,
    ).toBe(true);
    expect(
      SURFACES.has(String(entry['surface'])),
      `${CODE}'s surface hint "${String(entry['surface'])}" is outside the closed set`,
    ).toBe(true);
  });

  it('leaves it frozen — a closed taxonomy an importer can edit is not closed', () => {
    expect(Object.isFrozen(REFUSALS), 'REFUSALS is not frozen').toBe(true);
    expect(Object.isFrozen(registered()), `${CODE}'s entry is not frozen`).toBe(true);
  });

  it('L-MEA-01: the migration’s UPDATE and DELETE triggers raise it by that name', () => {
    const migration = readFileSync(MIGRATION, 'utf8');
    expect(
      migration.includes(`RAISE EXCEPTION '${CODE}:`),
      `db/migrations/0003_spine_rulesets.sql raises no exception naming ${CODE} — the code a caller reads and the code the register carries would be two different refusals`,
    ).toBe(true);
    for (const event of ['BEFORE UPDATE ON', 'BEFORE DELETE ON']) {
      expect(
        migration.includes(`${event} "rule_set_editions"`),
        `the migration installs no ${event.toLowerCase()} trigger on rule_set_editions — authoring mints a new edition, never updates one`,
      ).toBe(true);
    }
    // Per statement, not per row: FORCEd RLS can make an owner's UPDATE match nothing, and a
    // row trigger that never fires would let "nothing happened" read as "the edition is
    // immutable" (settled reading).
    expect(
      migration.includes('FOR EACH STATEMENT'),
      'the immutability trigger is per row, so an UPDATE that matched no row passes in silence',
    ).toBe(true);
  });
});
