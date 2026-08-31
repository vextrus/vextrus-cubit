/**
 * The mounting mechanics the screen-states acceptance shares (R-UI-050, inc-018 test contract).
 *
 * Only mechanics live here — how a declared state is put on a document and what "it rendered
 * something a person can perceive" means. The rule being judged (the seven names, the roster, the
 * completeness arithmetic) stays in the suite, so this file cannot be edited into agreement with a
 * matrix that does not satisfy R-UI-050.
 *
 * A state's `render()` answers a `ReactNode`, which is wider than what `@testing-library/react`
 * takes, so everything is mounted inside a Fragment: a string, a number and an element all become
 * lawful children, and the state's own root stays the container's first element child.
 */
import { Fragment, createElement } from "react";
import type { ReactNode } from "react";
import { cleanup, render } from "@testing-library/react";

/** The one testid every declared state's root carries (the increment's test contract). */
export const SCREEN_STATE_TESTID = "screen-state";

/** The attribute whose value must equal the state's own name — the coupling that cannot drift. */
export const SCREEN_STATE_ATTRIBUTE = "data-state";

/** What one mount answers: the container React was given, and the state's own root element. */
export interface MountedState {
  container: HTMLElement;
  root: Element | null;
}

/** Mount one state's node. The caller unmounts with `unmountAll()` in an `afterEach`. */
export function mountState(node: ReactNode): MountedState {
  const { container } = render(createElement(Fragment, null, node));
  return { container, root: container.firstElementChild };
}

/** Tear every mount down — the held-out and public lanes both run with `globals` off. */
export function unmountAll(): void {
  cleanup();
}

/** The text a person reads, whitespace-collapsed. */
export function visibleText(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Does this subtree carry something perceivable? Text is the usual answer; a state rendered as an
 * icon or an image satisfies R-UI-060 through its accessible name instead, so both count.
 */
export function hasPerceivableContent(element: Element): boolean {
  if (visibleText(element).length > 0) return true;
  return element.querySelector("[aria-label], [aria-labelledby], img[alt]:not([alt=''])") !== null;
}

/** Every element in the subtree that claims to be a screen state, the root included. */
export function stateRootsWithin(element: Element): Element[] {
  const found = [...element.querySelectorAll(`[data-testid="${SCREEN_STATE_TESTID}"]`)];
  if (element.getAttribute("data-testid") === SCREEN_STATE_TESTID) found.unshift(element);
  return found;
}
