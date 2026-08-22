/**
 * R-UI-011's last clause, as a product test: "a component without a gallery entry fails a test."
 *
 * The roster of components is read off the three barrels at the moment this runs, never written
 * down: a transcribed list passes on the day it is typed and reddens the increment that lawfully
 * adds a primitive months later (the lanes-armed arbitration, 2026-08-22). What is asserted is
 * the pure `coverageReport` seam's verdict over that derived surface, and the failure message is
 * the components nobody drew — by name, because a count tells a reader nothing they can act on.
 */
import { describe, expect, it } from 'vitest';
import * as dataBarrel from '../../data/index';
import * as patternsBarrel from '../../patterns/index';
import * as primitivesBarrel from '../../primitives/index';
import { coverageReport, galleryEntries } from '../index';

/**
 * The Increment Spec's settled predicate for "public component surface": a capitalized value
 * export that is a React component. A lower-case export like the toast function is excluded by
 * the same rule that keeps a sub-part such as a select item in.
 */
function isComponentExport(name: string, value: unknown): boolean {
  if (!/^[A-Z]/.test(name)) return false;
  if (typeof value === 'function') return true;
  return typeof value === 'object' && value !== null && '$$typeof' in value;
}

/** Every component export of the three barrels, derived at run time and sorted. */
function publicSurface(): string[] {
  const barrels: Record<string, unknown>[] = [primitivesBarrel, patternsBarrel, dataBarrel];
  const names = new Set<string>();
  for (const barrel of barrels) {
    for (const [name, value] of Object.entries(barrel)) {
      if (isComponentExport(name, value)) names.add(name);
    }
  }
  return [...names].sort();
}

describe('the gallery covers the public component surface (R-UI-011)', () => {
  it('derives a surface at all', () => {
    // Without this the report below would be vacuously empty on both halves: a barrel that
    // stopped exporting components would look like a gallery with nothing left to draw.
    expect(publicSurface().length).toBeGreaterThan(0);
    expect(galleryEntries.length).toBeGreaterThan(0);
  });

  it('has an entry for every component, and claims no component that is gone', () => {
    const report = coverageReport(publicSurface(), galleryEntries);

    expect(report.missing, `components with no gallery entry: ${report.missing.join(', ')}`).toEqual(
      [],
    );
    expect(report.unknown, `entries claiming absent exports: ${report.unknown.join(', ')}`).toEqual(
      [],
    );
  });

  it('draws each component from exactly one entry', () => {
    const claims = new Map<string, string[]>();
    for (const entry of galleryEntries) {
      for (const name of entry.covers) {
        claims.set(name, [...(claims.get(name) ?? []), entry.id]);
      }
    }

    const doubled = [...claims.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([name, ids]) => `${name} → ${ids.join(' + ')}`);
    expect(doubled, `components drawn by more than one entry: ${doubled.join(', ')}`).toEqual([]);
  });

  it('gives every entry a kebab-case id and at least one drawn state', () => {
    for (const entry of galleryEntries) {
      expect(entry.id, `${entry.id} is not kebab-case`).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
      expect(entry.states.length, `entry ${entry.id} draws no state`).toBeGreaterThan(0);
      for (const state of entry.states) {
        expect(typeof state.render, `${entry.id}/${state.name} has no render()`).toBe('function');
      }
    }
  });
});
