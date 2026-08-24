/**
 * inc-013, AC-1 — the act seam's three refusals are members of the closed taxonomy
 * (R-SPINE-062, L-QTY-04, L-ACT-02, L-ACT-03, Q-07).
 *
 * SEAM-ACT gives the seam exactly three ways to say no, and each of them is named by a clause
 * rather than invented here: L-ACT-02's "a commit whose digest is not the one current state
 * produces refuses CONSEQUENCES_NOT_CARRIED", and L-ACT-03's "`PERMISSION_NOT_HELD` carries
 * the act type and missing permission" and "the last PRINCIPAL cannot be removed
 * (`PROJECT_WOULD_HAVE_NO_PRINCIPAL`)".
 *
 * The file sits beside the module rather than in the V-DB lane because none of it needs a
 * database: a registry is a frozen table. It therefore runs in `pnpm verify`'s vitest stage,
 * which is where Q-07's own register test runs — and naming the three codes here is what makes
 * them *exercised* for Q-07. They are made to fire, by name, in
 * db/__tests__/inc-013-act-seam.test.ts and in the held-out set, which is the honest half of
 * the same claim.
 *
 * `src/core/errors/acts.ts` is loaded by an absolute path assembled at run time. A literal
 * `import '../errors/acts'` is resolved while this file is transformed, so on the day the
 * module does not exist yet vite would fail the whole file and vitest would report "0 test" —
 * no failing assertion at all. Built at run time, a missing module is one named failure.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REFUSALS, REFUSAL_CODES } from '../errors';

const REPO = process.cwd();

/** The module AC-1 names, and the barrel that must fold it. */
const ACTS_REFUSALS_MODULE = 'src/core/errors/acts.ts';
const ERRORS_BARREL = 'src/core/errors.ts';

/**
 * AC-1: exactly these three, and no fourth. The seam has three ways to refuse because three
 * clauses give it three; a fourth would be a refusal outside the law rather than inside it.
 */
const CODES: readonly string[] = [
  'CONSEQUENCES_NOT_CARRIED',
  'PERMISSION_NOT_HELD',
  'PROJECT_WOULD_HAVE_NO_PRINCIPAL',
];

/** R-SPINE-062's closed sets, as src/core/errors/types.ts declares them. */
const SEVERITIES = new Set(['block', 'defer', 'warn']);
const SURFACES = new Set(['field', 'toast', 'page', 'log']);

/** The five fields a RefusalEntry has — "all required, no extras" (src/core/errors/types.ts). */
const ENTRY_FIELDS: readonly string[] = ['code', 'message', 'remedy', 'severity', 'surface'];

const at = (relative: string): string => join(REPO, ...relative.split('/'));

/** A product module, by an absolute path assembled at run time (see the file header). */
async function importProduct(relative: string): Promise<Record<string, unknown>> {
  const path = at(relative);
  if (!existsSync(path)) throw new Error(`${relative} is not in the tree`);
  return (await import(pathToFileURL(path).href)) as Record<string, unknown>;
}

/**
 * The registry the module exports, found by shape rather than by name.
 *
 * AC-1 fixes what is registered and how (`registry()`), not what the exported constant is
 * called; every other module in `src/core/errors/` calls its own `<MODULE>_REFUSALS`, and a
 * test that welded itself to one spelling would grade a naming convention instead of the
 * taxonomy. Exactly one export may look like a registry, or "the registry" is ambiguous.
 */
function registryIn(module: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const candidates = Object.entries(module).filter(([, value]) => {
    if (typeof value !== 'object' || value === null) return false;
    const rows = Object.values(value as Record<string, unknown>);
    return (
      rows.length > 0 &&
      rows.every(
        (row) =>
          typeof row === 'object' &&
          row !== null &&
          typeof (row as { code?: unknown }).code === 'string',
      )
    );
  });
  expect(
    candidates.map(([name]) => name),
    `${ACTS_REFUSALS_MODULE} exports no registry of refusal entries (or exports more than one)`,
  ).toHaveLength(1);
  const found = candidates[0]?.[1];
  return found as Record<string, Record<string, unknown>>;
}

/** Loaded once; each test awaits it, so a load failure is a named failure and not a skip. */
let registryOnce: Promise<Record<string, Record<string, unknown>>> | undefined;

function actRefusals(): Promise<Record<string, Record<string, unknown>>> {
  registryOnce ??= (async () => registryIn(await importProduct(ACTS_REFUSALS_MODULE)))();
  return registryOnce;
}

describe('AC-1 — the act seam registers exactly three refusals (R-SPINE-062, Q-07)', () => {
  it('AC-1: src/core/errors/acts.ts exists and registers exactly the three codes', async () => {
    const entries = await actRefusals();
    expect(
      Object.keys(entries).sort(),
      'the act registry does not carry exactly the three codes L-ACT-02 and L-ACT-03 name',
    ).toEqual([...CODES].sort());
  });

  it('AC-1: each entry is a full RefusalEntry — five fields, filed under its own code', async () => {
    const entries = await actRefusals();
    for (const [key, entry] of Object.entries(entries)) {
      expect(
        Object.keys(entry).sort(),
        `${key} is not a full RefusalEntry (R-SPINE-062: message, remedy, severity, surface)`,
      ).toEqual([...ENTRY_FIELDS].sort());
      expect(entry['code'], `${key} is filed under a name that is not its own code`).toBe(key);
      // English, and a sentence: a blank message is prose the reader cannot act on, which is
      // the failure L-QTY-04 is written against.
      expect(String(entry['message']).trim(), `${key} has no message`).not.toBe('');
      expect(String(entry['remedy']).trim(), `${key} has no remedy`).not.toBe('');
      expect(
        SEVERITIES.has(String(entry['severity'])),
        `${key} has severity ${String(entry['severity'])}, which is outside the closed set`,
      ).toBe(true);
      expect(
        SURFACES.has(String(entry['surface'])),
        `${key} has surface ${String(entry['surface'])}, which is outside the closed set`,
      ).toBe(true);
    }
  });

  it('AC-1 / R-SPINE-062: the registry is frozen, down to each entry', async () => {
    const entries = await actRefusals();
    expect(Object.isFrozen(entries), 'the act registry is not frozen').toBe(true);
    for (const [key, entry] of Object.entries(entries)) {
      expect(Object.isFrozen(entry), `the entry for ${key} is not frozen`).toBe(true);
    }
  });

  it('AC-1: src/core/errors.ts folds the registry, so all three are in the closed enum', async () => {
    const entries = await actRefusals();
    for (const code of Object.keys(entries)) {
      expect(
        REFUSAL_CODES as readonly string[],
        `${code} is registered in ${ACTS_REFUSALS_MODULE} but the taxonomy in ${ERRORS_BARREL} does not carry it`,
      ).toContain(code);
      // The folded entry is the registered one, not a second copy that could drift from it.
      expect(
        (REFUSALS as Record<string, unknown>)[code],
        `${code} in the taxonomy is not the entry ${ACTS_REFUSALS_MODULE} registered`,
      ).toBe(entries[code]);
    }
  });
});
