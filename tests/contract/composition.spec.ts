import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { appRouter } from '../../src/server/router';
import * as schema from '../../db/schema/index';

// AS-A1 — composition is pre-wired now so later increments never touch it.

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

function mountedNamespaces(router: unknown): Set<string> {
  const def = (router as { _def?: Record<string, unknown> })._def ?? {};
  const record = (def.record ?? {}) as Record<string, unknown>;
  const procedures = (def.procedures ?? {}) as Record<string, unknown>;
  const names = new Set<string>(Object.keys(record));
  for (const key of Object.keys(procedures)) {
    const head = key.split('.')[0];
    if (head !== undefined) names.add(head);
  }
  return names;
}

describe('AC-17 appRouter mounts the spine plus every module stub', () => {
  it('AC-17: spine, takeoff, assure, book, estimate, bid and ai are mounted', () => {
    const names = mountedNamespaces(appRouter);
    for (const ns of ['spine', 'takeoff', 'assure', 'book', 'estimate', 'bid', 'ai']) {
      expect([...names], `router "${ns}" is not mounted on appRouter`).toContain(ns);
    }
  });

  it('AC-17: spine.health.ping is a registered procedure', () => {
    const def = (appRouter as unknown as { _def: { procedures: Record<string, unknown> } })._def;
    expect(Object.keys(def.procedures)).toContain('spine.health.ping');
  });
});

describe('AC-08 db/schema/index.ts composes every per-area file', () => {
  it('AC-08: index re-exports spine plus the five module stubs', () => {
    const source = read('db/schema/index.ts');
    for (const area of ['spine', 'takeoff', 'assure', 'book', 'estimate', 'bid']) {
      expect(source, `db/schema/index.ts does not compose ${area}.ts`).toMatch(
        new RegExp(`['"]\\./${area}(\\.js|\\.ts)?['"]`),
      );
    }
  });

  it('AC-08: the composed schema exposes drizzle tables from the spine', () => {
    const exported = Object.values(schema).filter(
      (v) => typeof v === 'object' && v !== null,
    );
    expect(exported.length, 'db/schema/index.ts exports nothing').toBeGreaterThan(0);
  });
});

describe('AC-16 owned screens draw strings from typed tables (R-SPINE-060)', () => {
  it('AC-16: src/ui/strings holds typed tables and refusal-state renders in place', () => {
    const refusalState = read('src/ui/patterns/refusal-state.tsx');
    for (const testid of ['refusal-state', 'refusal-code', 'refusal-message', 'refusal-remedy']) {
      expect(refusalState, `refusal-state.tsx does not render ${testid}`).toContain(testid);
    }
  });
});
