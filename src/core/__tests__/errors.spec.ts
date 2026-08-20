import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REFUSALS, refusal } from '../errors';

// R-SPINE-062 / Q-07 — closed refusal taxonomy; the refusal register test
// covers every code: exercised by name, or deferred by name with a reason.

const ROOT = process.cwd();

const REQUIRED_CODES = [
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_EMAIL_NOT_VERIFIED',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_RATE_LIMITED',
  'TENANT_ACCESS_DENIED',
  'TENANT_SLUG_TAKEN',
  'SYSTEM_REASON_REQUIRED',
  'PRECISION_NOT_APPLIED',
  'CHARACTER_NOT_COVERED',
  'FIXTURE_MISSING',
] as const;

const SEVERITIES = new Set(['info', 'warn', 'error', 'fatal', 'refusal']);

function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

describe('AC-07 the closed REFUSALS register (R-SPINE-062)', () => {
  it('AC-07: every required code is registered', () => {
    for (const code of REQUIRED_CODES) {
      expect(Object.keys(REFUSALS), `refusal ${code} missing`).toContain(code);
    }
  });

  it('AC-07: every entry carries code, message, remedy, severity and surface', () => {
    for (const [code, entry] of Object.entries(REFUSALS)) {
      const e = entry as Record<string, unknown>;
      expect(e.code, `${code}.code must echo its key`).toBe(code);
      expect(String(e.message ?? '').length, `${code}.message`).toBeGreaterThan(0);
      expect(String(e.remedy ?? '').length, `${code}.remedy`).toBeGreaterThan(0);
      expect(SEVERITIES, `${code}.severity`).toContain(String(e.severity));
      expect(String(e.surface ?? '').length, `${code}.surface`).toBeGreaterThan(0);
    }
  });

  it('AC-07: codes are SCREAMING_SNAKE and the register is non-empty', () => {
    const codes = Object.keys(REFUSALS);
    expect(codes.length).toBeGreaterThanOrEqual(REQUIRED_CODES.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z][A-Z0-9_]*$/);
  });

  it('AC-07: refusal(code) returns the registered entry, refusal(unknown) is refused', () => {
    const r = refusal('TENANT_ACCESS_DENIED') as unknown;
    const described =
      r instanceof Error
        ? `${r.message} ${JSON.stringify(r, Object.getOwnPropertyNames(r))}`
        : JSON.stringify(r);
    expect(described, 'refusal() must carry its code').toContain('TENANT_ACCESS_DENIED');
    // the taxonomy is closed: an unregistered code cannot be minted
    expect(() => (refusal as (c: string) => unknown)('NOT_A_REAL_CODE')).toThrow();
  });
});

describe('Q-07 refusal register: no orphan codes', () => {
  it('Q-07: every code is exercised by name or deferred by name with a reason', () => {
    const files = trackedFiles();

    // A deferred list is any tracked file named *refusals*deferred* — a committed
    // map of code -> reason.
    const deferredFiles = files.filter((f) => /refusals?[.-]deferred\.(json|ts|jsonc)$/.test(f));
    const deferred = new Map<string, string>();
    for (const f of deferredFiles) {
      const raw = readFileSync(path.join(ROOT, f), 'utf8');
      const parsed = JSON.parse(raw.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, '$1')) as Record<
        string,
        string
      >;
      for (const [code, reason] of Object.entries(parsed)) deferred.set(code, reason);
    }

    // Every deferred entry must name a real code and carry a reason.
    for (const [code, reason] of deferred) {
      expect(Object.keys(REFUSALS), `deferred code ${code} is not registered`).toContain(code);
      expect(String(reason).trim().length, `deferred code ${code} has no reason`).toBeGreaterThan(0);
    }

    // Exercised by name: the code appears somewhere outside its own definition
    // and outside the deferred list.
    const searchable = files.filter(
      (f) =>
        !/^src\/core\/errors\.ts$/.test(f) &&
        !deferredFiles.includes(f) &&
        /\.(ts|tsx|mjs|js|jsx|sql|md|json|css)$/.test(f),
    );
    const corpus = searchable
      .map((f) => {
        try {
          return readFileSync(path.join(ROOT, f), 'utf8');
        } catch {
          return '';
        }
      })
      .join('\n');

    const orphans = Object.keys(REFUSALS).filter(
      (code) => !deferred.has(code) && !corpus.includes(code),
    );
    expect(orphans, 'orphan refusal codes: neither exercised nor deferred').toEqual([]);
  });
});
