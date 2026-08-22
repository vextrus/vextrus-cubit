// @vitest-environment jsdom
/**
 * The `?state=` surface is product API (C-05), and the page hands it to this screen as a prop on
 * every render. So the screen has to *follow* the prop: a client navigation between two `?state=`
 * URLs re-renders the same mounted instance with a new `screenState`, and a screen that seeded
 * the value into `useState` on mount would go on drawing the state it was born with. The
 * visual-baseline increment (AM-03 (4)) drives exactly these URLs.
 *
 * Also here: the retry, which cancels the state it recovered from and nothing else, and the theme
 * attribute, which is this screen's and does not outlive it (§10 — no preference is persisted).
 *
 * The module is loaded inside each test, never in a hook: a throwing `beforeAll` makes vitest
 * report its tests as skipped (standing lesson).
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { gallery } from './support/surface';

afterEach(cleanup);

/* The `?state=` values under test — names of a query surface, not copy (the JSX-literal rule). */
const EMPTY = 'empty';
const ERROR = 'error';
const REFUSAL = 'refusal';

const stateCell = (container: HTMLElement, state: string): Element | null =>
  container.querySelector(`[data-testid="design-screen-state-${state}"]`);

const sheetCell = (container: HTMLElement): Element | null =>
  container.querySelector('[data-testid^="gallery-entry-"]');

describe('the gallery screen follows the ?state= prop', () => {
  it('paints the new state when the same instance is re-rendered with another one', async () => {
    const { GalleryScreen } = await gallery();
    const { container, rerender } = render(<GalleryScreen screenState={EMPTY} />);
    expect(stateCell(container, EMPTY)).not.toBeNull();

    rerender(<GalleryScreen screenState={ERROR} />);
    expect(stateCell(container, EMPTY)).toBeNull();
    expect(stateCell(container, ERROR)).not.toBeNull();

    // A navigation back to the bare route: the page passes no `screenState` at all.
    rerender(<GalleryScreen />);
    expect(stateCell(container, ERROR)).toBeNull();
    expect(sheetCell(container)).not.toBeNull();
  });

  it('renders the sheet after a retry, and still follows a later state', async () => {
    const { GalleryScreen } = await gallery();
    const { container, rerender } = render(<GalleryScreen screenState={ERROR} />);
    const retry = container.querySelector<HTMLButtonElement>(
      '[data-testid="design-screen-state-error"] button',
    );
    expect(retry).not.toBeNull();
    act(() => retry?.click());

    expect(stateCell(container, ERROR)).toBeNull();
    expect(sheetCell(container)).not.toBeNull();

    // The retry dismissed `error`, not "whatever the query says next".
    rerender(<GalleryScreen screenState={REFUSAL} />);
    expect(stateCell(container, REFUSAL)).not.toBeNull();
  });

  it('takes the theme attribute with it when it leaves', async () => {
    const { GalleryScreen } = await gallery();
    const { container, unmount } = render(<GalleryScreen />);
    const toggle = container.querySelector<HTMLElement>('[data-testid="design-theme-toggle"]');
    expect(toggle).not.toBeNull();
    act(() => toggle?.click());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    unmount();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
