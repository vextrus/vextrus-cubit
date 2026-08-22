/**
 * inc-007b acceptance — the completeness test is honest (AC-2).
 *
 * R-UI-011 ends "a component without a gallery entry fails a test". The Increment Spec puts
 * that test in the product at `src/ui/gallery/__tests__/completeness.test.ts` and requires it
 * to derive the component surface from the three barrels AT RUN TIME, standing on the pure
 * `coverageReport` seam. This file grades that requirement, because the difference between a
 * derived roster and a transcribed one is invisible on the day it is written and expensive
 * afterwards: inc-001's frozen `STILL_STUBS` passed for weeks and then reddened the increment
 * that lawfully armed a lane (2026-08-22 arbitration, TEST_AMENDED).
 *
 * The scan skips `entries/`: an entry's `covers` list is the data model the Increment Spec
 * mandates — names carried as data, read by `coverageReport` — not a frozen roster of what
 * exists. It also skips the acceptance beside it (this directory), which is not the product.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BARRELS, absolute, publicSurface } from './support/surface';

const COMPLETENESS = 'src/ui/gallery/__tests__/completeness.test.ts';
const GALLERY_DIR = 'src/ui/gallery';

/** Product files under src/ui/gallery, minus the entry modules and the tests beside them. */
function scannedFiles(): string[] {
  const found: string[] = [];
  const walk = (relative: string): void => {
    for (const name of readdirSync(absolute(relative))) {
      const child = `${relative}/${name}`;
      if (statSync(join(absolute(relative), name)).isDirectory()) {
        if (name === 'entries' || name === '__tests__') continue;
        walk(child);
      } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
        found.push(child);
      }
    }
  };
  walk(GALLERY_DIR);
  return found.sort();
}

/** Every string literal in a source file, single- or double-quoted, without its quotes. */
function stringLiterals(source: string): string[] {
  return [...source.matchAll(/'([^'\\\n]*)'|"([^"\\\n]*)"/g)].map(
    (match) => match[1] ?? match[2] ?? '',
  );
}

describe('AC-2 — the completeness test derives its roster (R-UI-011)', () => {
  it('exists where the Increment Spec fixed it', () => {
    expect(existsSync(absolute(COMPLETENESS)), `missing ${COMPLETENESS}`).toBe(true);
  });

  it('reads all three barrels and stands on the coverageReport seam', () => {
    expect(existsSync(absolute(COMPLETENESS)), `missing ${COMPLETENESS}`).toBe(true);
    const source = readFileSync(absolute(COMPLETENESS), 'utf8');

    for (const barrel of BARRELS) {
      // The module name as a specifier: primitives, patterns, data — however the file spells
      // the path, it has to reach for each barrel to derive anything from it.
      const module_ = barrel.replace(/^src\/ui\//, '').replace(/\/index\.ts$/, '');
      expect(
        new RegExp(`['\`"][^'\`"]*${module_}(/index)?['\`"]`).test(source),
        `${COMPLETENESS} never reaches for ${barrel}`,
      ).toBe(true);
    }

    expect(
      /\bcoverageReport\b/.test(source),
      `${COMPLETENESS} does not use the pure coverageReport seam`,
    ).toBe(true);
  });

  it('freezes no component roster, in the completeness test or anywhere under src/ui/gallery', async () => {
    const surface = await publicSurface();
    expect(surface.length, 'the derived surface is empty').toBeGreaterThan(0);

    const files = [COMPLETENESS, ...scannedFiles()];

    // Premise: there is a gallery module to scan at all. Without it this test would pass on
    // an empty directory and say nothing (the vacuity the 2026-08-21 arbitrations punished).
    expect(files, `missing ${GALLERY_DIR}/index.ts`).toContain(`${GALLERY_DIR}/index.ts`);
    const frozen: string[] = [];
    for (const file of files) {
      if (!existsSync(absolute(file))) continue;
      const literals = stringLiterals(readFileSync(absolute(file), 'utf8')).filter((literal) =>
        surface.includes(literal),
      );
      // Three component names written down in one file is a transcription of the barrels,
      // whatever it is called; one or two are an example or a message.
      if (literals.length >= 3) frozen.push(`${file}: ${[...new Set(literals)].join(', ')}`);
    }
    expect(frozen, `a frozen component list:\n${frozen.join('\n')}`).toEqual([]);
  });
});
