/**
 * The shell's state keys are derived from R-UI-050's own names, never spelled a second time (B-17).
 * Every expectation is computed from `STATE_NAMES` as the contract publishes it (B-19), so a state
 * the clause gains tomorrow is graded by these sentences without an edit here.
 */
import { describe, expect, test } from "vitest";
import { STATE_NAMES } from "../screen-states/contract";
import { SHELL_AREAS } from "./routes";
import { SHELL_STATES, SHELL_STATE_NAMES, shellStateKey } from "./states";

/** The rule the converter states, restated as arithmetic over a name's separators. */
function keyForm(name: string): string {
  const [head = "", ...rest] = name.split("-");
  return [head, ...rest.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)].join("");
}

describe("the shell's state roster", () => {
  test("shellStateKey answers the key form of every name the clause holds", () => {
    expect(STATE_NAMES.length).toBeGreaterThan(0);
    for (const name of STATE_NAMES) expect(shellStateKey(name)).toBe(keyForm(name));
  });

  test("only a name carrying a separator changes form", () => {
    const changed = STATE_NAMES.filter((name) => shellStateKey(name) !== String(name));
    expect(changed).toEqual(STATE_NAMES.filter((name) => name.includes("-")));
  });

  test("SHELL_STATE_NAMES is the clause's roster, in the clause's order", () => {
    expect([...SHELL_STATE_NAMES]).toEqual(STATE_NAMES.map(keyForm));
  });

  test("every area declares a cell for exactly those names", () => {
    expect(SHELL_AREAS.length).toBeGreaterThan(0);
    for (const area of SHELL_AREAS) {
      expect(Object.keys(SHELL_STATES[area]).sort()).toEqual([...SHELL_STATE_NAMES].sort());
    }
  });
});
