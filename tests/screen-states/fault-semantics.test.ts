// @vitest-environment jsdom
/**
 * R-UI-060 on the state that stands in for `src/app/error.tsx`. The shipped boundary renders its
 * fault inside `<section role="alert" aria-labelledby="error-state-title">` over an `<h1>`, so a
 * reader who cannot see the screen is told a fault happened and what it is. The matrix composes its
 * own fault card (the boundary is `src/app`, which `src/ui` may not import), and composing it is
 * exactly where those semantics can be dropped — perceivable text alone would not notice.
 *
 * The rule is stated over the whole matrix rather than over a list of routes: wherever a declared
 * state shows the fault heading, that heading names a region announcing itself as an alert. Every
 * screen's error cell owes one; a screen whose Decision hands another state to the fault surface is
 * graded by the same sentence without an edit here (B-19).
 */
import { afterEach, describe, expect, test } from "vitest";
import { STATE_NAMES } from "../../src/ui/screen-states";
import { screenStates } from "../../src/ui/screen-states";
import { routesOnDisk } from "../../src/ui/screen-states/route-scan";
import { strings } from "../../src/ui/strings";
import { mountState, unmountAll, visibleText } from "./support/matrix-contract";

/** The headings of a mounted state that carry the fault card's title. */
function faultHeadings(root: Element): Element[] {
  return [...root.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter((heading) => visibleText(heading) === strings.error_title);
}

describe("R-UI-060: a declared fault announces itself as the shipped boundary does", () => {
  afterEach(() => {
    unmountAll();
  });

  test("every screen's error cell renders an alert region named by the fault heading", () => {
    const routes = routesOnDisk();
    expect(routes.length, "there is a screen to grade").toBeGreaterThan(0);
    for (const route of routes) {
      const declaration = screenStates[route];
      expect(declaration, `${route} is declared`).toBeDefined();
      if (declaration === undefined) continue;

      const { root } = mountState(declaration.error.render());
      expect(root, `${route}/error mounts an element`).not.toBeNull();
      const headings = faultHeadings(root as Element);
      expect(headings.length, `${route}/error shows the fault heading`).toBe(1);
      unmountAll();
    }
  });

  test("wherever a state shows the fault heading, it names an alert region", () => {
    const routes = routesOnDisk();
    for (const route of routes) {
      const declaration = screenStates[route];
      if (declaration === undefined) continue;
      for (const state of STATE_NAMES) {
        const { root } = mountState(declaration[state].render());
        if (root === null) continue;
        for (const heading of faultHeadings(root)) {
          const where = `${route}/${state}`;
          const id = heading.getAttribute("id");
          expect(id, `${where}'s fault heading can be pointed at`).toBeTruthy();
          const region = root.querySelector(`[role="alert"][aria-labelledby="${id ?? ""}"]`);
          expect(region, `${where}'s fault is an alert region named by its heading`).not.toBeNull();
          expect(region?.contains(heading), `${where}'s alert region holds that heading`).toBe(true);
          expect(visibleText(region as Element).length, `${where}'s alert region says something`).toBeGreaterThan(0);
        }
        unmountAll();
      }
    }
  });
});
