// @vitest-environment jsdom
/**
 * AC-5's registry half — the three codes this increment registers, the two screens' declared states,
 * and the cells those declarations render (R-SPINE-062, R-UI-020, R-UI-050, Q-07, B-17).
 *
 * Every code is named here by name, in a lane the gate executes, because Q-07's scan is what makes a
 * registered code a wired one rather than a spelling; the sentences are never transcribed — the
 * register is the one home of them, and the mirror is judged against the register itself.
 *
 * jsdom, because the declared cells are mounted for real: a state that cannot render is not declared.
 */
import { createElement, Fragment, type ReactNode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import {
  PIN_SET,
  REFUSAL_ENTRIES_MODULE,
  REGISTERED_CODES,
  SCREEN_STATES_MODULE,
  SETS_ROUTE_KEY,
  SET_NAME_NOT_USABLE,
  SET_NOT_PINNABLE,
  SET_ROUTE_KEY,
  byCodePoint,
  productModule,
  refusals,
  type RefusalEntryShape,
} from "./support/sets-stage";

/** The screen-states matrix, as a screen's own declaration is read out of it. */
type StateCell = { render: () => ReactNode };
type ScreenStatesSeam = {
  STATE_NAMES: readonly string[];
  screenStates: Record<string, Record<string, StateCell> | undefined>;
  missingStates: (routes: readonly string[]) => string[];
};

afterEach(() => {
  cleanup();
});

async function matrix(): Promise<ScreenStatesSeam> {
  return productModule<ScreenStatesSeam>(SCREEN_STATES_MODULE);
}

/** The mirror `src/ui` renders from — the same entries, authored as data (ARCH-01). */
async function mirrored(): Promise<Record<string, RefusalEntryShape | undefined>> {
  const module = await productModule<{ REFUSAL_ENTRIES: Record<string, RefusalEntryShape | undefined> }>(REFUSAL_ENTRIES_MODULE);
  return module.REFUSAL_ENTRIES;
}

/** One declared state of one screen, mounted — and the refusal code it renders, if it renders one. */
function mountCell(cell: StateCell): HTMLElement {
  const { container } = render(createElement(Fragment, null, cell.render()));
  return container;
}

function refusalCodesIn(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('[data-testid="refusal-state"]')].map((state) => state.getAttribute("data-code") ?? "");
}

describe("AC-5: the three codes this increment registers", () => {
  test("AC-5: SET_NOT_PINNABLE, SET_NAME_NOT_USABLE and SET_MEMBER_NOT_IN_PROJECT stand in the register", async () => {
    const register = await refusals();
    // Named here, one by one, in a lane the gate executes: that is what Q-07 counts as exercised.
    expect(byCodePoint([...REGISTERED_CODES]), "the three codes this increment registers, by name").toEqual(byCodePoint(["SET_MEMBER_NOT_IN_PROJECT", "SET_NAME_NOT_USABLE", "SET_NOT_PINNABLE"]));

    for (const code of REGISTERED_CODES) {
      const entry = register[code];
      expect(entry, `${code} is registered in src/core/errors.ts — a code the register lacks does not exist (R-SPINE-062, Q-07)`).toBeTruthy();
      expect(entry?.code, `${code} is filed under its own name`).toBe(code);
      expect(entry?.severity, `${code} is a refusal needing correction, not an explanation of an absence (Design Decision §3)`).toBe("error");
      expect(entry?.surface, `${code} renders in place, on the region that asked (R-UI-020)`).toBe("inline");
      expect((entry?.message ?? "").trim().length, `${code} says what was refused and why`).toBeGreaterThan(0);
      expect((entry?.remedy ?? "").trim().length, `${code} says what resolves it`).toBeGreaterThan(0);
    }
  });

  test("AC-5: the screens' mirror carries the register's own words for each of them", async () => {
    const register = await refusals();
    const entries = await mirrored();
    for (const code of REGISTERED_CODES) {
      const entry = entries[code];
      expect(entry, `${code} is mirrored in src/ui/screen-states/refusal-entries.ts — the screens render from the mirror (ARCH-01)`).toBeTruthy();
      expect(entry, `${code}'s mirrored entry carries the register's own message, remedy, severity and surface word for word (B-17: two homes that may disagree are one home too many)`).toStrictEqual(register[code]);
    }
  });
});

describe("AC-5: both screens declare their seven states", () => {
  test("AC-5: the sets index and the set browser stand in the screen-states matrix, whole", async () => {
    const states = await matrix();
    for (const route of [SETS_ROUTE_KEY, SET_ROUTE_KEY]) {
      const declared = states.screenStates[route];
      expect(declared, `${route} declares its states in the one enumerable place the suite reflects over (R-UI-050, B-19)`).toBeTruthy();
      expect(
        byCodePoint(Object.keys(declared ?? {})),
        `${route} declares every state R-UI-050 names — a missing state is a failing test, never a review note`,
      ).toEqual(byCodePoint([...states.STATE_NAMES]));
    }
    expect(states.missingStates([SETS_ROUTE_KEY, SET_ROUTE_KEY]), "neither screen leaves a state undeclared").toEqual([]);
  });

  test("AC-5: each screen's refusal cell renders its own registered code, and its denial names PIN_SET", async () => {
    const states = await matrix();
    const owed: [string, string][] = [
      [SETS_ROUTE_KEY, SET_NAME_NOT_USABLE],
      [SET_ROUTE_KEY, SET_NOT_PINNABLE],
    ];

    for (const [route, code] of owed) {
      const declared = states.screenStates[route];
      expect(declared, `${route} stands in the screen-states matrix — a screen that declares nothing renders no cell`).toBeTruthy();
      const cells = declared as Record<string, StateCell>;
      const refusal = mountCell(cells["refusal"] as StateCell);
      expect(refusalCodesIn(refusal), `${route}'s refusal cell renders ${code} through the one RefusalState (R-UI-020: a screen-local refusal block is a defect)`).toContain(code);
      cleanup();

      const denied = mountCell(cells["permission-denied"] as StateCell);
      expect(denied.textContent ?? "", `${route}'s permission-denied cell names the permission this screen's doors need (R-UI-050, L-ACT-03)`).toContain(PIN_SET);
      cleanup();
    }
  });
});
