// @vitest-environment jsdom
/**
 * R-UI-050's refusal cell, screen by screen: "refusal (code + remedy)". Every screen's declared
 * refusal state renders a code the register `src/core/errors` owns — machine-readably, as the one
 * renderer publishes it — with the remedy that code carries beside it.
 *
 * The codes are read out of the register itself, never listed here: a code renamed or retired there
 * is a red on the screen that renders it rather than a stale copy that keeps passing (B-19).
 */
import { afterEach, describe, expect, test } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import { screenStates } from "../../src/ui/screen-states";
import { routesOnDisk } from "../../src/ui/screen-states/route-scan";
import { SCREEN_STATE_TESTID, mountState, unmountAll, visibleText } from "./support/matrix-contract";

/** Every code the register publishes — the only codes a screen may show. */
const REGISTERED_CODES = Object.keys(REFUSALS);

describe("R-UI-050: every screen's refusal state carries a registered code and its remedy", () => {
  afterEach(() => {
    unmountAll();
  });

  test("each declared refusal renders a code the register owns, with non-empty remedy text", () => {
    const routes = routesOnDisk();
    expect(routes.length, "there is a screen to grade").toBeGreaterThan(0);
    for (const route of routes) {
      const declaration = screenStates[route];
      expect(declaration, `${route} is declared`).toBeDefined();
      if (declaration === undefined) continue;

      const { root } = mountState(declaration.refusal.render());
      expect(root, `${route}/refusal mounts an element`).not.toBeNull();
      const element = root as Element;
      expect(element.getAttribute("data-testid"), `${route}/refusal is a screen state`).toBe(SCREEN_STATE_TESTID);

      const carriers = [...element.querySelectorAll("[data-code]")].map((node) => node.getAttribute("data-code") ?? "");
      const shown = carriers.filter((code) => REGISTERED_CODES.includes(code));
      expect(shown.length, `${route}/refusal shows a code the register owns (saw ${JSON.stringify(carriers)})`).toBeGreaterThan(0);

      const remedy = element.querySelector('[data-testid="refusal-remedy"]');
      expect(remedy, `${route}/refusal renders the code's remedy`).not.toBeNull();
      expect(visibleText(remedy as Element).length, `${route}/refusal's remedy is not empty`).toBeGreaterThan(0);
      unmountAll();
    }
  });
});
