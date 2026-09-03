/**
 * The shell's state keys are derived from R-UI-050's own names, never spelled a second time (B-17).
 * Every expectation is computed from `STATE_NAMES` as the contract publishes it (B-19), so a state
 * the clause gains tomorrow is graded by these sentences without an edit here.
 */
import { describe, expect, test } from "vitest";
import { STATE_NAMES } from "../screen-states/contract";
import { SHELL_AREAS } from "./routes";
import { SHELL_STATES, SHELL_STATE_NAMES, shellStateKey } from "./states";

/**
 * The converter read BACKWARDS: a key's every capital is the letter a separator preceded. Restating
 * the forward expression here would compare the converter with a copy of itself, so a defect in the
 * split or the capitalisation would sit in both halves and pass; an inverse shares no arithmetic
 * with it, and only a conversion that loses, moves or mis-cases a character fails to come back.
 */
function nameForm(key: string): string {
  return key.replace(/[A-Z]/g, (capital) => `-${capital.toLowerCase()}`);
}

describe("the shell's state roster", () => {
  test("shellStateKey loses nothing: every key reads back as the name it came from", () => {
    expect(STATE_NAMES.length).toBeGreaterThan(0);
    for (const name of STATE_NAMES) expect(nameForm(shellStateKey(name))).toBe(String(name));
  });

  test("a key carries the shell's form: no separator survives it", () => {
    for (const name of STATE_NAMES) expect(shellStateKey(name)).not.toContain("-");
  });

  test("only a name carrying a separator changes form", () => {
    const changed = STATE_NAMES.filter((name) => shellStateKey(name) !== String(name));
    expect(changed).toEqual(STATE_NAMES.filter((name) => name.includes("-")));
  });

  test("SHELL_STATE_NAMES is the clause's roster, in the clause's order", () => {
    expect([...SHELL_STATE_NAMES]).toEqual(STATE_NAMES.map((name) => shellStateKey(name)));
    expect(new Set(SHELL_STATE_NAMES).size).toBe(STATE_NAMES.length);
  });

  test("every area declares a cell for exactly those names", () => {
    expect(SHELL_AREAS.length).toBeGreaterThan(0);
    for (const area of SHELL_AREAS) {
      expect(Object.keys(SHELL_STATES[area]).sort()).toEqual([...SHELL_STATE_NAMES].sort());
    }
  });
});
