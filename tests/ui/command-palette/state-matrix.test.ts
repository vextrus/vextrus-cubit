// @vitest-environment jsdom
/**
 * AC-6's matrix half — the palette declares R-UI-050's seven states for both of its rows, in the one
 * enumerable place the suite reflects over (Decision §2, B-19).
 *
 * The palette is not a route, so it declares no row in `src/ui/screen-states`; the declaration is
 * `COMMAND_PALETTE_STATES` inside the pattern, and it is walked here. The seven names are read from
 * the law's own home — a second spelling of them would be the drift R-UI-050 exists to prevent.
 */
import { cleanup, render } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { STATE_NAMES } from "../../../src/ui/screen-states/contract";
import { PALETTE_PATTERN_DIR, named, patternModule } from "./support/palette-stage";

/** The two rows the Decision rules the matrix over. */
const ROWS = ["command-palette", "shortcut-sheet"] as const;

interface DeclaredState {
  readonly render: () => ReactNode;
}

type Declaration = Readonly<Record<string, DeclaredState>>;

async function states(): Promise<Readonly<Record<string, Declaration>>> {
  const bag = await patternModule();
  const declared = named<Readonly<Record<string, Declaration>>>(bag, "COMMAND_PALETTE_STATES", PALETTE_PATTERN_DIR);
  expect(typeof declared, `${PALETTE_PATTERN_DIR}/ publishes \`COMMAND_PALETTE_STATES\` as the enumerable declaration`).toBe("object");
  return declared;
}

afterEach(() => {
  cleanup();
});

describe("AC-6 — COMMAND_PALETTE_STATES declares every R-UI-050 state for both rows", () => {
  test("AC-6: the declaration holds a row for the palette and one for the shortcut sheet", async () => {
    const declared = await states();
    for (const row of ROWS) expect(Object.keys(declared), `${row} declares its states where the suite reflects over them`).toContain(row);
  });

  test("AC-6: each row is total over STATE_NAMES — no state may be omitted", async () => {
    const declared = await states();
    for (const row of ROWS) {
      expect(
        Object.keys(declared[row] ?? {}).sort(),
        `${row} declares exactly R-UI-050's seven states — a missing state is a failing test, never a review note`,
      ).toEqual([...STATE_NAMES].sort());
    }
  });

  test("AC-6: every declared state mounts something", async () => {
    const declared = await states();
    for (const row of ROWS) {
      for (const name of STATE_NAMES) {
        const state = declared[row]?.[name];
        expect(typeof state?.render, `${row}/${name} declares a render`).toBe("function");
        const node = (state as DeclaredState).render();
        expect(node === null || node === undefined, `${row}/${name} renders the state, never nothing`).toBe(false);
        render(createElement("div", null, node));
        cleanup();
      }
    }
  });
});
