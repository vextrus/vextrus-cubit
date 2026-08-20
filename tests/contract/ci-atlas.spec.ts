import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function workflowSources(): string[] {
  const dir = path.join(ROOT, '.github/workflows');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => readFileSync(path.join(dir, f), 'utf8'));
}

describe('AC-18 CI runs the gate on every PR', () => {
  it('AC-18: a workflow exists and triggers on pull_request', () => {
    const sources = workflowSources();
    expect(sources.length, 'no workflow under .github/workflows').toBeGreaterThan(0);
    expect(sources.some((s) => /^\s*pull_request\s*:/m.test(s)), 'no pull_request trigger').toBe(
      true,
    );
  });

  it('AC-18: CI runs checkup, verify, test:db and e2e', () => {
    const all = workflowSources().join('\n');
    for (const cmd of ['pnpm checkup', 'pnpm verify', 'pnpm test:db', 'pnpm e2e']) {
      expect(all, `CI does not run "${cmd}"`).toContain(cmd);
    }
  });

  it('AC-18: CI provides a Postgres 16 service on 5544 (C-07)', () => {
    const all = workflowSources().join('\n');
    expect(all).toMatch(/postgres:16/);
    expect(all).toContain('5544');
  });
});

describe('AC-18 the atlas maps this increment to lanes and journeys', () => {
  it('AC-18: docs/atlas/foundation.md names the foundation seams', () => {
    const atlas = readFileSync(path.join(ROOT, 'docs/atlas/foundation.md'), 'utf8');
    for (const id of ['SEAM-TENANT', 'SEAM-FORMAT', 'C-06', 'B-15']) {
      expect(atlas, `docs/atlas/foundation.md does not mention ${id}`).toContain(id);
    }
  });

  it('AC-18: docs/traceability.json maps requirement ids to lanes and journeys', () => {
    const raw = readFileSync(path.join(ROOT, 'docs/traceability.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    const flat = JSON.stringify(parsed);
    for (const id of [
      'R-SPINE-001',
      'R-SPINE-002',
      'R-SPINE-060',
      'R-SPINE-061',
      'R-SPINE-062',
      'R-UI-001',
      'R-UI-012',
      'L-FMT-01',
      'J-000',
      'J-001',
    ]) {
      expect(flat, `docs/traceability.json does not map ${id}`).toContain(id);
    }
  });
});

describe('AC-13 the fixture policy is written down', () => {
  it('AC-13: fixtures/README.md documents the fixture policy', () => {
    const readme = readFileSync(path.join(ROOT, 'fixtures/README.md'), 'utf8');
    expect(readme.trim().length).toBeGreaterThan(200);
    expect(readme).toMatch(/fixture/i);
  });
});
