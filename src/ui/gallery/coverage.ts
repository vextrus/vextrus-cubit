/**
 * `coverageReport` — the pure seam R-UI-011's "a component without a gallery entry fails a
 * test" stands on.
 *
 * It takes the surface as an argument and reads nothing: no barrel, no filesystem, no
 * registry. The caller derives the surface — the completeness test does it from the three
 * barrels at the moment it runs — so that this file has no opinion about which components
 * exist and cannot be the place a roster quietly freezes.
 */
import type { GalleryEntry } from './types';

export interface CoverageReport {
  /** Component exports no entry accounts for. R-UI-011 fails by these names. */
  readonly missing: string[];
  /** Names an entry claims that the barrels do not export — a rename nobody followed. */
  readonly unknown: string[];
}

export function coverageReport(
  exportNames: readonly string[],
  entries: readonly GalleryEntry[],
): { missing: string[]; unknown: string[] } {
  const covered = new Set<string>();
  for (const entry of entries) for (const name of entry.covers) covered.add(name);
  const exported = new Set(exportNames);

  return {
    missing: [...exported].filter((name) => !covered.has(name)).sort(),
    unknown: [...covered].filter((name) => !exported.has(name)).sort(),
  };
}
