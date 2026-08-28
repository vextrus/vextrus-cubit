/**
 * Public acceptance for AC-4's other half — R-UI-050 as the committed Design Decision §2 rules it
 * for this screen: "Declared in the enumerable home `states.ts` (route directory), export
 * `RULESET_SETTINGS_STATES` — one row, seven cells in the shell matrix's cell shape … and
 * `tests/rulesets/state-matrix.test.ts` walks it." This is that walker.
 *
 * It judges four things and deliberately not the pixels of any state: all seven states are
 * declared and no eighth invented; a cell that claims a state is RENDERED names a module that
 * exists in the checkout; a cell that DELEGATES names a module that exists and says why; and a
 * cell that calls a state IMPOSSIBLE says why in words. The seven names are not re-declared here —
 * they are read from the shell's own `ShellStateName`, which is R-UI-050's one home in this tree,
 * so a clause amended there moves this file with it (B-19).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT, ROUTE_DIR, STATES_MODULE, productModule } from "./support/editions";
import type { ShellStateCell, ShellStateName } from "../../src/ui/shell/states";

/** R-UI-050's seven, spelled once against the shell's own type so neither list can drift alone. */
const R_UI_050_STATES: readonly ShellStateName[] = ["loading", "empty", "error", "refusal", "partial", "offline", "permissionDenied"];

type StateRow = Readonly<Record<string, ShellStateCell>>;

async function row(): Promise<StateRow> {
  const module = await productModule<{ RULESET_SETTINGS_STATES?: StateRow }>(STATES_MODULE);
  const declared = module.RULESET_SETTINGS_STATES;
  expect(declared, `${STATES_MODULE} must export RULESET_SETTINGS_STATES — the enumerable home R-UI-050 requires for this screen (Design Decision §2)`).toBeTypeOf("object");
  return declared as StateRow;
}

describe("AC-4: the screen declares its seven states where a suite can walk them (R-UI-050)", () => {
  test("AC-4: the row declares exactly R-UI-050's seven states", async () => {
    const declared = await row();
    for (const state of R_UI_050_STATES) {
      expect(Object.prototype.hasOwnProperty.call(declared, state), `RULESET_SETTINGS_STATES declares no ${state} state — the matrix is checkable, not aspirational (R-UI-050)`).toBe(true);
    }
    expect([...Object.keys(declared)].sort(), "the screen declares exactly the seven states, no eighth of its own").toStrictEqual([...R_UI_050_STATES].sort());
  });

  test("AC-4: every cell says one of the three things, and never nothing", async () => {
    const declared = await row();
    for (const state of R_UI_050_STATES) {
      const cell = declared[state];
      expect(cell, `the ${state} cell must be declared`).toBeTypeOf("object");
      const kind = (cell as { declared?: unknown }).declared;
      expect(["rendered", "delegated", "impossible"], `the ${state} cell must say rendered, delegated or impossible — silence is never lawful`).toContain(kind);

      if (kind === "rendered") {
        const by = (cell as { by?: unknown }).by;
        expect(typeof by, `the rendered ${state} cell must name the module that paints it`).toBe("string");
        expect(existsSync(join(REPO_ROOT, by as string)), `the rendered ${state} cell names ${String(by)}, which is not in the checkout — a claim nothing backs is the review note R-UI-050 abolishes`).toBe(true);
      } else if (kind === "delegated") {
        const to = (cell as { to?: unknown }).to;
        const why = (cell as { why?: unknown }).why;
        expect(typeof to, `the delegated ${state} cell must name the module that owns the state instead`).toBe("string");
        expect(existsSync(join(REPO_ROOT, to as string)), `the delegated ${state} cell names ${String(to)}, which is not in the checkout`).toBe(true);
        expect(typeof why === "string" && (why as string).trim().length > 0, `the delegated ${state} cell must say why, in words`).toBe(true);
      } else {
        const why = (cell as { why?: unknown }).why;
        expect(typeof why === "string" && (why as string).trim().length > 0, `the impossible ${state} cell must say why it cannot arise — "impossible" is a claim with a reason attached`).toBe(true);
      }
    }
  });

  test("AC-4: the loading state the Decision rules is a real file in the route directory", async () => {
    const declared = await row();
    const loading = declared["loading"];
    expect((loading as { declared?: unknown } | undefined)?.declared, "Design Decision §2 renders the loading state as the route's own loading.tsx").toBe("rendered");
    expect(existsSync(join(REPO_ROOT, ROUTE_DIR, "loading.tsx")), `${ROUTE_DIR}/loading.tsx is owed — the Decision §2 rules the loading state as this route's own bones`).toBe(true);
  });
});
