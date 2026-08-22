/**
 * inc-007b acceptance — every word on the gallery comes from a typed table (AC-5).
 *
 * R-SPINE-060: "Every user-facing string lives in one typed string table (`src/ui/strings.ts`
 * per module) keyed by id with English values; the compiler refuses a missing key; no string
 * literals in JSX except test ids and codes."
 *
 * Three halves, because the rule has three: the tables exist and are typed and English (here,
 * at run time); the compiler refuses a missing key (the `DesignKey` bindings below — this file
 * does not type-check if `design.theme` is not in the table); and no literal reaches JSX (the
 * `cubit/no-jsx-string-literal` rule, run through ESLint's own API over the two directories,
 * so the verdict is a rule id rather than an error count).
 *
 * AM-03 (2) — copy is design — is why §7's values are read out of the Design Decision and
 * compared, instead of being retyped here where they could drift from the decision.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
// Type-only, erased at run time: `keyof typeof` over the shipped tables is the compiler half
// of R-SPINE-060 — a key nobody registered is a build error, not a lookup returning undefined.
import type { DESIGN_STRINGS } from '../../../app/design/strings';
import type { GALLERY_STRINGS } from '../strings';
import { absolute, docStringTable, gallery, importProduct } from './support/surface';

type DesignKey = keyof typeof DESIGN_STRINGS;
type GalleryKey = keyof typeof GALLERY_STRINGS;

const DESIGN_DIR = 'src/app/design';
const GALLERY_DIR = 'src/ui/gallery';
const JSX_RULE = 'cubit/no-jsx-string-literal';
const COLOUR_RULE = 'cubit/no-colour-literal';

/** A translation is not this rule: R-SPINE-060 asks for English values. */
const BENGALI = /[ঀ-৿]/;

async function designStrings(): Promise<Record<string, unknown>> {
  return (
    await importProduct<{ DESIGN_STRINGS: Record<string, unknown> }>('src/app/design/strings.ts')
  ).DESIGN_STRINGS;
}

async function galleryStrings(): Promise<Record<string, unknown>> {
  return (
    await importProduct<{ GALLERY_STRINGS: Record<string, unknown> }>('src/ui/gallery/strings.ts')
  ).GALLERY_STRINGS;
}

/** Every product source file under a directory — the tests beside it are not the product. */
function sourceFiles(relativeDir: string): string[] {
  const found: string[] = [];
  const walk = (relative: string): void => {
    const absoluteDir = absolute(relative);
    let names: string[];
    try {
      names = readdirSync(absoluteDir);
    } catch {
      return;
    }
    for (const name of names) {
      const child = `${relative}/${name}`;
      if (statSync(join(absoluteDir, name)).isDirectory()) {
        if (name === '__tests__') continue;
        walk(child);
      } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
        found.push(child);
      }
    }
  };
  walk(relativeDir);
  return found.sort();
}

describe('AC-5 — the module string tables (R-SPINE-060)', () => {
  it('ships both tables frozen, keyed by id, with English values', async () => {
    const design = await designStrings();
    const galleryTable = await galleryStrings();

    for (const [name, table] of [
      ['DESIGN_STRINGS', design],
      ['GALLERY_STRINGS', galleryTable],
    ] as const) {
      expect(Object.isFrozen(table), `${name} is not frozen`).toBe(true);
      const entries = Object.entries(table);
      expect(entries.length, `${name} is empty`).toBeGreaterThan(0);
      for (const [key, value] of entries) {
        expect(key, `${name}: ${key} is not a module-prefixed id`).toMatch(
          /^(design|gallery)\.[A-Za-z0-9][A-Za-z0-9.-]*$/,
        );
        expect(typeof value, `${name}: ${key} is not a string`).toBe('string');
        expect(String(value).trim().length, `${name}: ${key} is empty`).toBeGreaterThan(0);
        expect(BENGALI.test(String(value)), `${name}: ${key} is not English`).toBe(false);
      }
    }

    // The compiler half, in this file's own types: these bindings do not compile unless the
    // keys are registered (R-SPINE-060, "the compiler refuses a missing key").
    const themeKey: DesignKey = 'design.theme';
    const titleKey: DesignKey = 'design.title';
    expect(typeof design[themeKey]).toBe('string');
    expect(typeof design[titleKey]).toBe('string');
  });

  it('carries the screen chrome copy the Design Decision §7 committed, verbatim', async () => {
    const documented = docStringTable();
    expect(documented.size, 'the Design Decision §7 lists no chrome strings').toBeGreaterThan(0);

    const design = await designStrings();
    for (const [key, value] of documented) {
      expect(design[key], `DESIGN_STRINGS is missing ${key}`).toBeDefined();
      expect(design[key], `${key}: copy differs from the Design Decision`).toBe(value);
    }
  });

  it('has a title and a state label for every entry the gallery declares', async () => {
    const { galleryEntries } = await gallery();
    const galleryTable = await galleryStrings();

    // Derived from the roster, so a component added next month needs its words registered
    // too — the roster is never frozen here.
    // One member of each family, bound at compile time from the Design Decision §5/§7: the
    // roster itself is derived below, never frozen, but `button` is a component the decision
    // commits by name, so its title key is a key the compiler can be made to insist on.
    const buttonTitle: GalleryKey = 'gallery.entry.button';
    expect(galleryTable[String(buttonTitle)]).toBeTypeOf('string');

    for (const entry of galleryEntries) {
      const titleKey = `gallery.entry.${entry.id}`;
      expect(galleryTable[titleKey], `GALLERY_STRINGS is missing ${titleKey}`).toBeTypeOf('string');
      for (const state of entry.states) {
        const stateKey = `gallery.state.${state.name}`;
        expect(galleryTable[stateKey], `GALLERY_STRINGS is missing ${stateKey}`).toBeTypeOf(
          'string',
        );
      }
    }
  });
});

describe('AC-5 — no string literal reaches JSX (R-SPINE-060, B-05)', () => {
  it('lints both directories clean of the JSX-literal and colour-literal rules', async () => {
    const files = [...sourceFiles(DESIGN_DIR), ...sourceFiles(GALLERY_DIR)];

    // Vacuity guard: an empty file list would lint clean and prove nothing. The two files the
    // Increment Spec names by path must be in the set.
    expect(files, 'src/app/design/page.tsx was not linted').toContain(`${DESIGN_DIR}/page.tsx`);
    expect(files, 'src/ui/gallery/index.ts was not linted').toContain(`${GALLERY_DIR}/index.ts`);

    const eslint = new ESLint({ cwd: process.cwd(), ignore: false, errorOnUnmatchedPattern: true });
    const results = await eslint.lintFiles(files.map((file) => absolute(file)));

    const offences: string[] = [];
    for (const result of results) {
      const relative = result.filePath.replace(`${process.cwd()}/`, '');
      expect(result.fatalErrorCount, `${relative} failed to parse`).toBe(0);
      for (const message of result.messages) {
        // R-SPINE-060 (literals in JSX) and R-UI-001 / §9 (no colour literal in this screen).
        if (message.ruleId === JSX_RULE || message.ruleId === COLOUR_RULE) {
          offences.push(`${relative}:${message.line} ${message.ruleId} — ${message.message}`);
        }
      }
    }
    expect(offences, offences.join('\n')).toEqual([]);
  });
});
