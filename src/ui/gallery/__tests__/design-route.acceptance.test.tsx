// @vitest-environment jsdom
/**
 * inc-007b acceptance — /design serves the gallery, unauthenticated, in both themes (AC-4).
 *
 * R-UI-011 puts the living gallery "at `/design`". The Increment Spec records the reading that
 * it ships outside any `(app)/[tenant]` group with no session (auth is a later increment), and
 * the Design Decision §3 fixes the theme control: the Datum Switch, light by default, writing
 * `data-theme` on the document root in both directions, named from the string table
 * (R-SPINE-060).
 *
 * The stylesheet assertion is not decoration: the root layout imports none by design, so a
 * `/design` segment that forgets its own import renders the gallery with no tokens at all —
 * and R-UI-011's evidence is a screenshot.
 */
import { existsSync, readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { absolute, gallery, importProduct } from './support/surface';

const PAGE = 'src/app/design/page.tsx';
const LAYOUT = 'src/app/design/layout.tsx';
const ROOT_LAYOUT = 'src/app/layout.tsx';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
});

/** The page's callable shape: a Next 16 segment reads its query off a promise. */
type PageComponent = (props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => unknown;

async function pageModule(): Promise<{ default: PageComponent }> {
  expect(existsSync(absolute(PAGE)), `missing ${PAGE}`).toBe(true);
  return await importProduct<{ default: PageComponent }>(PAGE);
}

async function designStrings(): Promise<Record<string, string>> {
  const module_ = await importProduct<{ DESIGN_STRINGS: Record<string, string> }>(
    'src/app/design/strings.ts',
  );
  return module_.DESIGN_STRINGS;
}

describe('AC-4 — the /design segment (R-UI-011, C-05)', () => {
  it('lives at src/app/design with no session and no tenant segment', async () => {
    expect(existsSync(absolute(PAGE)), `missing ${PAGE}`).toBe(true);

    // The recorded interpretation: unauthenticated, outside any (app)/[tenant] group. A page
    // under a tenant segment would not answer /design at all.
    expect(existsSync(absolute('src/app/(app)/design')), '/design is inside the tenant group').toBe(
      false,
    );

    const source = readFileSync(absolute(PAGE), 'utf8');
    const specifiers = [...source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
    const gated = specifiers.filter((specifier) => /auth|session/i.test(specifier ?? ''));
    expect(gated, `${PAGE} reaches for a session: ${gated.join(', ')}`).toEqual([]);
  });

  it('carries the token stylesheet on the segment layout, not on the root layout', () => {
    expect(existsSync(absolute(LAYOUT)), `missing ${LAYOUT}`).toBe(true);

    const segment = readFileSync(absolute(LAYOUT), 'utf8');
    expect(
      /import\s+['"][^'"]*globals\.css['"]/.test(segment),
      `${LAYOUT} does not import the global stylesheet — the gallery would render unstyled`,
    ).toBe(true);

    // The root stays as inc-007a left it: no stylesheet, which is why the segment needs one.
    const root = readFileSync(absolute(ROOT_LAYOUT), 'utf8');
    expect(/\.css['"]/.test(root), `${ROOT_LAYOUT} imports a stylesheet`).toBe(false);
  });

  it('passes the ?state= value through to GalleryScreen', async () => {
    const { default: Page } = await pageModule();

    const element = (await Page({
      searchParams: Promise.resolve({ state: 'refusal' }),
    })) as ReactElement;
    render(element);

    expect(
      screen.getAllByTestId('design-screen-state-refusal'),
      '/design?state=refusal did not reach the screen',
    ).toHaveLength(1);
  });

  it('serves the gallery itself at /design with no query', async () => {
    const { default: Page } = await pageModule();

    const element = (await Page({ searchParams: Promise.resolve({}) })) as ReactElement;
    render(element);

    expect(screen.getAllByTestId('design-gallery-root')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid^="design-screen-state-"]')).toHaveLength(0);
  });
});

describe('AC-4 — the theme toggle flips data-theme both ways (R-UI-011, §3)', () => {
  it('writes dark then light on the document root', async () => {
    const { GalleryScreen } = await gallery();
    render(<GalleryScreen />);

    // Light is the default: absent or "light", never "dark" before anybody asks.
    expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark');

    const toggle = screen.getByTestId('design-theme-toggle');
    fireEvent.click(toggle);
    expect(document.documentElement.getAttribute('data-theme'), 'first flip').toBe('dark');

    fireEvent.click(toggle);
    expect(document.documentElement.getAttribute('data-theme'), 'flip back').toBe('light');
  });

  it('takes its accessible name from the string table (R-SPINE-060)', async () => {
    const strings = await designStrings();
    const label = strings['design.theme'] ?? '';
    expect(label, 'design.theme is not in DESIGN_STRINGS').not.toBe('');

    const { GalleryScreen } = await gallery();
    render(<GalleryScreen />);

    const toggle = screen.getByTestId('design-theme-toggle');
    const named = [
      ...screen.queryAllByRole('switch', { name: label }),
      ...screen.queryAllByRole('button', { name: label }),
      ...screen.queryAllByRole('checkbox', { name: label }),
    ];
    expect(named.length, `no control is accessibly named “${label}”`).toBeGreaterThan(0);
    expect(
      named.some((node) => node === toggle || node.contains(toggle) || toggle.contains(node)),
      'the control named from the string table is not design-theme-toggle',
    ).toBe(true);
  });
});
