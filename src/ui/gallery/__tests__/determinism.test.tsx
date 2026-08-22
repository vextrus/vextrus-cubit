// @vitest-environment jsdom
/**
 * The sheet is drawn from local sample data and nothing else, so two renders of it are the same
 * drawing — byte for byte, inside every `gallery-entry-<component>-<state>` cell.
 *
 * This is what "deterministic local sample data (no network, no DB, no Date.now in rendered
 * output)" means once it reaches markup, and it is the reason no cell mints an id with React's
 * `useId`: that hook counts from a module global, so the second render of an identical tree
 * carries different ids and the visual-baseline suite (AM-03 point 4) would diff a sheet that
 * never changed. Ids that reach the sheet are written from the entry id and the state name
 * instead (entries/labelled.tsx, entries/number-input.tsx).
 *
 * The module is loaded inside each test, never in a hook: a throwing `beforeAll` makes vitest
 * report its tests as skipped (standing lesson).
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SCREEN_STATES, gallery } from './support/surface';

afterEach(cleanup);

/** Every cell of one render, by test id, as the markup it holds. */
function cells(container: HTMLElement): Map<string, string> {
  const found = new Map<string, string>();
  for (const node of container.querySelectorAll('[data-testid^="gallery-entry-"]')) {
    found.set(node.getAttribute('data-testid') ?? '', node.innerHTML);
  }
  return found;
}

/** A media query that matches, so the tree renders as it does for a reader who asked for calm. */
function matchReducedMotion(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

describe('the gallery is deterministic', () => {
  it('paints identical markup in every cell across two successive renders', async () => {
    const { GalleryScreen } = await gallery();
    const first = cells(render(<GalleryScreen />).container);
    cleanup();
    const second = cells(render(<GalleryScreen />).container);

    expect(first.size).toBeGreaterThan(0);
    expect([...second.keys()]).toEqual([...first.keys()]);
    // Every drifting cell at once, by name: one cell at a time would hide the next one.
    const drifted = [...first].filter(([testId, markup]) => second.get(testId) !== markup);
    expect(drifted.map(([testId]) => testId)).toEqual([]);
  });

  it('paints the whole sheet identically, in every forced screen state', async () => {
    const { GalleryScreen } = await gallery();
    const sheet = (screenState?: string): string => {
      const { container } = render(
        screenState === undefined ? <GalleryScreen /> : <GalleryScreen screenState={screenState} />,
      );
      const root = container.querySelector('[data-testid="design-gallery-root"]');
      const markup = root?.innerHTML ?? '';
      cleanup();
      return markup;
    };
    for (const state of [undefined, ...SCREEN_STATES]) {
      const first = sheet(state);
      expect(first.length, state).toBeGreaterThan(0);
      expect(sheet(state), state).toBe(first);
    }
  });

  it('keeps the same roster of cells under prefers-reduced-motion', async () => {
    const { GalleryScreen } = await gallery();
    const plain = cells(render(<GalleryScreen />).container);
    cleanup();
    matchReducedMotion();
    const calm = cells(render(<GalleryScreen />).container);

    expect([...calm.keys()]).toEqual([...plain.keys()]);
  });
});
