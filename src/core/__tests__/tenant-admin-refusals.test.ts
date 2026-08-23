/**
 * inc-010, AC-3 (second half) — the three tenant-admin refusals are in the closed taxonomy,
 * worded exactly as the Design Decision decided (R-SPINE-062, R-UI-020, Q-07, L-QTY-04).
 *
 * R-SPINE-062: "every code has an English message, a remedy hint, a severity and a surface
 * hint". The four fields are not this file's to invent: docs/design/s-settings.md §7 is a
 * committed table of them, and §5 says the refusal block renders `REFUSALS[code].message` and
 * `.remedy` verbatim — "the block never paraphrases". So the register and the screen can only
 * agree if the register carries the designer's words, and that is what is compared here.
 *
 * It sits beside the module rather than in the db lane because none of it needs a database:
 * the taxonomy is a frozen table and the Design Decision is a file. It therefore runs in
 * `pnpm verify`'s vitest stage, which is where Q-07's own register test runs.
 *
 * Naming the three codes here is also what makes them exercised for Q-07 — and they are made
 * to fire, by name, in db/__tests__/inc-010-tenant-admin.test.ts, which is the honest half of
 * the same claim.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REFUSALS, REFUSAL_CODES } from '../errors';

const REPO = process.cwd();

/** The Design Decision this screen — and this register entry — is graded against. */
const DESIGN_DOC = join(REPO, 'docs', 'design', 's-settings.md');

/** AC-3: the three codes the tenant-admin surface reaches for. */
const CODES: readonly string[] = ['NOT_TENANT_ADMIN', 'MEMBER_HAS_ACTS', 'INVITATION_NOT_PENDING'];

/** R-SPINE-062's closed sets, as src/core/errors/types.ts declares them. */
const SEVERITIES = new Set(['block', 'defer', 'warn']);
const SURFACES = new Set(['field', 'toast', 'page', 'log']);

interface Decided {
  readonly message: string;
  readonly remedy: string;
  readonly severity: string;
  readonly surface: string;
}

/**
 * §7's table: `| code | message | remedy | severity | surface |`, read as it is written.
 *
 * It throws rather than returning something partial: a design table this file could not read
 * would make every comparison below vacuously true, which is the one way a register test can
 * pass a tree that has no register at all.
 */
function decidedRegister(): Map<string, Decided> {
  const doc = readFileSync(DESIGN_DOC, 'utf8');
  const section = (doc.split(/^## 7\./m)[1] ?? '').split(/^## 8\./m)[0] ?? '';
  const found = new Map<string, Decided>();
  for (const line of section.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) continue;
    const cells = trimmed
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());
    if (cells.length < 5) continue;
    const code = /^`([^`]+)`$/.exec(cells[0] ?? '')?.[1];
    if (code === undefined) continue;
    found.set(code, {
      message: cells[1] ?? '',
      remedy: cells[2] ?? '',
      severity: cells[3] ?? '',
      surface: cells[4] ?? '',
    });
  }
  const missing = CODES.filter((code) => !found.has(code));
  if (missing.length > 0) {
    throw new Error(
      `docs/design/s-settings.md §7 has no register row for ${missing.join(', ')} — the Design Decision moved under this test`,
    );
  }
  for (const code of CODES) {
    const row = found.get(code);
    if (row === undefined || row.message.trim() === '' || row.remedy.trim() === '') {
      throw new Error(`docs/design/s-settings.md §7 decides no message and remedy for ${code}`);
    }
  }
  return found;
}

/** The registered entry for a code, or a named failure — never a silently skipped assertion. */
function registered(code: string): Record<string, unknown> {
  const table = REFUSALS as unknown as Record<string, unknown>;
  expect(
    REFUSAL_CODES as readonly string[],
    `${code} is not in the closed taxonomy — R-SPINE-062 keeps every refusal in it, reachable from src/core/errors.ts`,
  ).toContain(code);
  const entry = table[code];
  expect(entry, `REFUSALS has no entry for ${code}`).toBeDefined();
  return (entry ?? {}) as Record<string, unknown>;
}

describe('inc-010 AC-3 — the tenant-admin refusals in the closed taxonomy (R-SPINE-062)', () => {
  const decided = decidedRegister();

  it('registers all three with §7’s message and remedy verbatim, because §5 says the block never paraphrases', () => {
    for (const code of CODES) {
      const entry = registered(code);
      const row = decided.get(code) as Decided;
      expect(entry['code'], `${code}'s entry is filed under a different name`).toBe(code);
      expect(entry['message'], `${code}'s registered message is not §7's`).toBe(row.message);
      expect(entry['remedy'], `${code}'s registered remedy is not §7's`).toBe(row.remedy);
    }
  });

  it('gives each a severity and a surface hint, §7’s and inside R-SPINE-062’s closed sets', () => {
    for (const code of CODES) {
      const entry = registered(code);
      const row = decided.get(code) as Decided;
      expect(
        SEVERITIES.has(String(entry['severity'])),
        `${code}'s severity "${String(entry['severity'])}" is outside the closed set`,
      ).toBe(true);
      expect(
        SURFACES.has(String(entry['surface'])),
        `${code}'s surface hint "${String(entry['surface'])}" is outside the closed set`,
      ).toBe(true);
      expect(entry['severity'], `${code}'s registered severity is not §7's`).toBe(row.severity);
      expect(entry['surface'], `${code}'s registered surface hint is not §7's`).toBe(row.surface);
    }
  });

  it('leaves them frozen — a closed taxonomy an importer can edit is not closed', () => {
    expect(Object.isFrozen(REFUSALS), 'REFUSALS is not frozen').toBe(true);
    for (const code of CODES) {
      expect(Object.isFrozen(registered(code)), `${code}'s entry is not frozen`).toBe(true);
    }
  });
});
