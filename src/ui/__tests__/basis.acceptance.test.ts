/**
 * inc-004 acceptance — the basis colour+glyph pair, rendered (AC-4).
 *
 * R-UI-002: "Basis palette (fixed): MEASURED teal · TRANSCRIBED blue · DERIVED violet ·
 * IMPORTED slate · ENTERED amber · INTERPRETED magenta · DEFAULTED grey; each basis also has
 * a glyph (◆ ▣ ƒ ⇩ ✎ ▦ ○) so it survives greyscale and colour-blindness; the pair renders
 * everywhere a basis appears."
 *
 * "The pair" is the whole clause: a chip that is only teal fails a greyscale baseline, and a
 * glyph with no accessible name fails axe (J-004). So every code is asserted three ways at
 * once — glyph, colour variable, and the label the string table registers.
 *
 * Rendered through `react-dom/server`, not a DOM: `renderToStaticMarkup` gives the markup a
 * server component would produce, so this suite needs no jsdom and the vitest environment
 * stays 'node' (test contract). Elements are built with `createElement` rather than JSX so
 * that the assertion under test is BasisMark's markup and never this file's own transform —
 * the .tsx module it imports still needs vitest to transform JSX (vitest.config.ts is this
 * increment's to set; the repo tsconfig says `jsx: preserve`, which is Next's setting, not a
 * transform).
 *
 * The modules are loaded inside each test so that a module which does not exist yet reads as
 * one missing behaviour per test rather than a single collection error.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { StringKey } from '../strings';
import type { BasisCode } from '../tokens';

const REPO = process.cwd();
const BASIS_TSX = 'src/ui/basis.tsx';

const tokensModule = async () => await import('../tokens');
const basisModule = async () => await import('../basis');
const stringsModule = async () => await import('../strings');
const tokensStrings = async () => await import('../strings/tokens');

/**
 * R-UI-002's seven, in the Bible's order, each with the glyph the Bible pairs it with and
 * the English label the string table registers (docs/design/datum-tokens.md §7).
 */
const PAIRS = [
  { code: 'MEASURED', glyph: '◆', label: 'Measured' },
  { code: 'TRANSCRIBED', glyph: '▣', label: 'Transcribed' },
  { code: 'DERIVED', glyph: 'ƒ', label: 'Derived' },
  { code: 'IMPORTED', glyph: '⇩', label: 'Imported' },
  { code: 'ENTERED', glyph: '✎', label: 'Entered' },
  { code: 'INTERPRETED', glyph: '▦', label: 'Interpreted' },
  { code: 'DEFAULTED', glyph: '○', label: 'Defaulted' },
] as const;

const key = (code: string): string => `tokens.basis.${code.toLowerCase()}`;

/** Source with its comments removed — prose about a label is not a label in the JSX. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

/** The rendered text, with the tags taken out: what a greyscale screenshot still shows. */
const textOf = (markup: string): string => markup.replace(/<[^>]*>/g, '');

/** The value of one attribute of the rendered element. */
function attribute(markup: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(markup);
  return match?.[1];
}

const render = async (code: BasisCode): Promise<string> => {
  const { BasisMark } = await basisModule();
  return renderToStaticMarkup(createElement(BasisMark, { basis: code }));
};

describe('AC-4 — the basis palette is seven fixed pairs (R-UI-002)', () => {
  it('pairs each of the seven codes with its glyph and its colour variable', async () => {
    const { BASIS } = await tokensModule();
    const entries = Object.entries(BASIS as Record<string, { glyph: string; cssVar: string }>);

    // "Basis palette (fixed)" — exactly these, in this order. An eighth code, or a missing
    // one, is a palette that is no longer fixed.
    expect(entries.map(([code]) => code)).toEqual(PAIRS.map((pair) => pair.code));

    for (const pair of PAIRS) {
      const entry = (BASIS as Record<string, { glyph: string; cssVar: string }>)[pair.code];
      expect(entry, `${pair.code} is not in BASIS`).toBeDefined();
      // The glyph "so it survives greyscale and colour-blindness".
      expect(entry?.glyph, `${pair.code} carries the wrong glyph`).toBe(pair.glyph);
      // …paired with the colour, named where every other colour is named (R-UI-001).
      expect(entry?.cssVar, `${pair.code} points at the wrong variable`).toBe(
        `--basis-${pair.code.toLowerCase()}`,
      );
    }
  });

  it('names every basis variable in the token sheet itself', async () => {
    const { BASIS, cssVariables } = await tokensModule();
    const light = cssVariables('light');
    const dark = cssVariables('dark');

    for (const [code, entry] of Object.entries(
      BASIS as Record<string, { glyph: string; cssVar: string }>,
    )) {
      // A pair whose colour is not a token is a colour the theme switch cannot reach.
      expect(light[entry.cssVar], `${code}: ${entry.cssVar} is undefined in light`).toBeTruthy();
      expect(dark[entry.cssVar], `${code}: ${entry.cssVar} is undefined in dark`).toBeTruthy();
    }
  });
});

describe('AC-4 — BasisMark renders the pair (R-UI-002, R-SPINE-060)', () => {
  it('renders one span carrying the test id, the code, the glyph and the colour', async () => {
    for (const pair of PAIRS) {
      const markup = await render(pair.code);

      // The test contract's single id, and the code a screenshot diff can be keyed to.
      expect(attribute(markup, 'data-testid'), `${pair.code}`).toBe('basis-mark');
      expect(attribute(markup, 'data-basis'), `${pair.code}`).toBe(pair.code);

      // One element, not a wrapper around a wrapper: the mark inherits its host's size.
      expect(markup.startsWith('<span'), `${pair.code}: ${markup}`).toBe(true);
      expect(markup.endsWith('</span>'), `${pair.code}: ${markup}`).toBe(true);
      expect((markup.match(/<span/g) ?? []).length, `${pair.code}: ${markup}`).toBe(1);

      // The glyph is the whole of the text — nothing else is painted for a sighted reader.
      expect(textOf(markup), `${pair.code} did not render its glyph`).toBe(pair.glyph);

      // …and the colour comes from the token, not from the component.
      expect(attribute(markup, 'style') ?? '', `${pair.code} does not use its token`).toContain(
        `var(--basis-${pair.code.toLowerCase()})`,
      );
    }
  });

  it('gives the mark an accessible name from the string table, and no other copy', async () => {
    const { t } = await stringsModule();

    for (const pair of PAIRS) {
      const markup = await render(pair.code);
      // J-004's axe pass reads this: a glyph with no name is an unlabelled image.
      expect(attribute(markup, 'aria-label'), `${pair.code} has no accessible name`).toBe(
        t(key(pair.code) as StringKey),
      );
      // docs/design/datum-tokens.md §6: role="img", so the label is announced as the name of
      // the mark rather than read as a stray character.
      expect(attribute(markup, 'role'), `${pair.code}`).toBe('img');
    }

    // R-SPINE-060: "no string literals in JSX except test ids and codes". The labels come
    // from the table and the glyphs from BASIS, so neither is spelled in the component.
    const source = withoutComments(readFileSync(join(REPO, BASIS_TSX), 'utf8'));
    for (const pair of PAIRS) {
      expect(source, `${BASIS_TSX} spells the label ${pair.label}`).not.toContain(pair.label);
      expect(source, `${BASIS_TSX} spells the glyph for ${pair.code}`).not.toContain(pair.glyph);
    }
  });
});

describe('AC-4 — the labels are registered copy (R-SPINE-060)', () => {
  it('registers tokens.basis.measured … tokens.basis.defaulted with English labels', async () => {
    const { t } = await stringsModule();

    // The type is the guardrail: this binding does not compile unless StringKey covers the
    // key, which is what "the compiler refuses a missing key" means at a call site.
    const measured: StringKey = 'tokens.basis.measured';
    expect(t(measured)).toBe('Measured');

    for (const pair of PAIRS) {
      expect(t(key(pair.code) as StringKey), `${key(pair.code)}`).toBe(pair.label);
    }
  });

  it('folds the tokens module table into the composed table, frozen and under its prefix', async () => {
    const { STRINGS } = await stringsModule();
    const { TOKENS_STRINGS } = await tokensStrings();
    const strings = STRINGS as Record<string, string>;
    const table = TOKENS_STRINGS as Record<string, string>;

    // Frozen, as SPINE_STRINGS is: a table an importer can edit at run time is a default.
    expect(Object.isFrozen(TOKENS_STRINGS)).toBe(true);
    expect(Object.keys(table).length).toBeGreaterThan(0);
    for (const [id, value] of Object.entries(table)) {
      expect(id.startsWith('tokens.'), `${id} is in the tokens table under another prefix`).toBe(
        true,
      );
      expect(strings[id], `${id} is in TOKENS_STRINGS and not in STRINGS`).toBe(value);
    }
    // The seven the increment owes, whatever else the module later registers.
    for (const pair of PAIRS) {
      expect(table[key(pair.code)], `${key(pair.code)} is not registered`).toBe(pair.label);
    }
  });
});
