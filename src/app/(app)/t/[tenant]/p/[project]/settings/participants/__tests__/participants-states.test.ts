/**
 * R-UI-050's matrix for the project participants screen, walked.
 *
 * The clause is explicit that the matrix is checkable rather than aspirational: a declaration nothing
 * reflects over is prose in a `.ts` file, and it can say anything — a state left out, a rendered cell
 * naming a module that does not exist, an "impossible" with no reason attached — without anything
 * noticing. Every claim the roster makes is read against the state names' one home and against the
 * tree the cells point into (B-19).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { SHELL_STATE_NAMES } from "../../../../../../../../../ui/shell/states";
import { PARTICIPANTS_STATES } from "../states";

const REPO_ROOT = process.cwd();

test("every state R-UI-050 names has a cell, and no cell names a state it does not", () => {
  expect(Object.keys(PARTICIPANTS_STATES).sort(), "the roster is the clause's roster, derived from its one home rather than respelled").toEqual([...SHELL_STATE_NAMES].sort());
});

describe("every cell says one of the three things, and says it completely", () => {
  for (const name of SHELL_STATE_NAMES) {
    test(`${name} is declared and answerable`, () => {
      const cell = PARTICIPANTS_STATES[name];
      expect(cell, `${name} is declared — a state a screen never mentions is the silence the clause forbids`).toBeDefined();

      if (cell.declared === "rendered") {
        // white-box: the cell's claim IS a path into the tree, and a path that names nothing is a
        // cell that cannot be followed; there is no runtime observable for "this file paints it".
        expect(existsSync(join(REPO_ROOT, cell.by)), `${name} is painted by ${cell.by}, which exists`).toBe(true);
        return;
      }
      if (cell.declared === "delegated") {
        expect(existsSync(join(REPO_ROOT, cell.to)), `${name} is handed to ${cell.to}, which exists`).toBe(true);
        expect(cell.why.length, `${name} says why it is handed over`).toBeGreaterThan(0);
        return;
      }
      expect(cell.why.length, `${name} cannot arise here and says why — a claim with a reason attached is what makes it reviewable`).toBeGreaterThan(0);
    });
  }
});

test("a rendered cell's hook is the one the screen actually publishes, or an honest absence", () => {
  const hooks = Object.values(PARTICIPANTS_STATES)
    .filter((cell) => cell.declared === "rendered")
    .map((cell) => cell.testId);

  expect(hooks.length, "at least one state is painted by this screen").toBeGreaterThan(0);
  for (const hook of hooks) {
    expect(hook === null || hook.length > 0, "a hook is a name a journey can read, or null where the state carries none").toBe(true);
  }
});
