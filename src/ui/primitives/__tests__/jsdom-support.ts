/**
 * Test support for the inc-005 acceptance suites — the jsdom gaps Radix trips over.
 *
 * Not a test and not product: jsdom implements no pointer-capture API, no layout, and no
 * `ResizeObserver`, so a primitive built on Radix throws on a missing method before it ever
 * gets to the behaviour under test. The Increment Spec's risk note says to "polyfill inside
 * test setup or component-side guards, not by weakening assertions"; the increment does not
 * own vitest.config.ts, so the setup is here, imported by each suite.
 *
 * Every shim is additive and installed only where the method is absent: none of them can
 * make a real assertion pass. What they buy is that a red says "the menu did not open on
 * Enter" rather than "hasPointerCapture is not a function".
 *
 * The file does not match the runner's include glob, so it is support and never collected.
 */

/** A no-op that satisfies a void DOM method jsdom does not implement. */
function noop(): void {
  /* nothing to do: jsdom has no layout to scroll and no pointer to capture */
}

/** Install the shims. Idempotent — each suite calls it at module load. */
export function installJsdomSupport(): void {
  if (typeof Element === 'undefined') return;

  const element = Element.prototype;
  if (typeof element.hasPointerCapture !== 'function') {
    element.hasPointerCapture = (): boolean => false;
  }
  if (typeof element.setPointerCapture !== 'function') {
    element.setPointerCapture = noop;
  }
  if (typeof element.releasePointerCapture !== 'function') {
    element.releasePointerCapture = noop;
  }
  if (typeof element.scrollIntoView !== 'function') {
    element.scrollIntoView = noop;
  }

  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe(): void {
        noop();
      }
      unobserve(): void {
        noop();
      }
      disconnect(): void {
        noop();
      }
    } as unknown as typeof ResizeObserver;
  }

  if (typeof globalThis.DOMRect === 'undefined') {
    globalThis.DOMRect = class {
      readonly x = 0;
      readonly y = 0;
      readonly width = 0;
      readonly height = 0;
      readonly top = 0;
      readonly right = 0;
      readonly bottom = 0;
      readonly left = 0;
      toJSON(): object {
        return {};
      }
      static fromRect(): DOMRect {
        return new globalThis.DOMRect();
      }
    } as unknown as typeof DOMRect;
  }
}
