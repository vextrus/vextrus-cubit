// @vitest-environment jsdom
/**
 * AC-4 — refusals and deferrals, through the ONE RefusalState (R-UI-020, B-17,
 * docs/design/s-takeoff.md §1 "Refusals" and §2 "Refusal").
 *
 * Two surfaces, one renderer: a sighting that produced no line renders its registered entry in its
 * own row, and a door's rejection renders the same entry in the answer slot — with no dialog opened
 * over a consequence of nothing. The codes are read from the registry rather than spelled here, so a
 * later increment that re-words an entry re-words this expectation with it (B-19).
 */
import { cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import {
  READING_NOT_NUMERIC,
  all,
  copy,
  drawingsRoute,
  mountRegister,
  one,
  refusalCodes,
  refusalRegister,
  refusalsFixture,
  stagedDoors,
  takeoffStrings,
  text,
  textNodesUnder,
} from "./support/fixtures";

afterEach(() => {
  cleanup();
});

describe("AC-4 — a sighting that produced no line says why, in place", () => {
  test("AC-4: every refused or deferred sighting renders exactly one RefusalState carrying its evidence", async () => {
    const view = refusalsFixture();
    const register = await refusalRegister();
    const root = await mountRegister(view);

    const region = one(root, "register-refusals");
    expect(region.getAttribute("data-count"), "the region counts the sightings it holds").toBe(String(view.refusals.length));

    const rows = all(root, "register-refusal");
    expect(
      rows.map((row) => [row.getAttribute("data-code"), row.getAttribute("data-object")]),
      "one row per refusal the view answers, in the order it answers them",
    ).toEqual(view.refusals.map((refusal) => [refusal.code, refusal.objectKey]));

    for (const [at, row] of rows.entries()) {
      const refusal = view.refusals[at] as (typeof view.refusals)[number];
      const states = [...row.querySelectorAll(testIdSelector(TESTIDS.refusal.state))] as HTMLElement[];
      expect(states.length, `the row for ${refusal.code} renders exactly one RefusalState — a screen-local refusal block is a defect (B-17)`).toBe(1);

      const state = states[0] as HTMLElement;
      const entry = register[refusal.code];
      expect(entry, `${refusal.code} is a registered code — this screen adds none (scope)`).toBeTruthy();
      expect(state.getAttribute("data-code"), "the rendered state carries the row's own code").toBe(refusal.code);
      expect(text(within(state).getByTestId("refusal-message")), "the registry's message, never a paraphrase").toBe((entry as { message: string }).message);
      expect(text(within(state).getByTestId("refusal-remedy")), "the registry's remedy, never a paraphrase").toBe((entry as { remedy: string }).remedy);
      expect(
        within(state).getByTestId("refusal-evidence-link").getAttribute("href"),
        "and the link to the evidence that resolves it — the source drawings (R-UI-020)",
      ).toBe(drawingsRoute(view.tenantId, view.projectId));
    }

    expect(root.getAttribute("data-state"), "some rows refused: shown, not hidden (R-UI-050's partial cell)").toBe("partial");
  });

  test("AC-4: a door's rejection is answered in place and opens no dialog", async () => {
    const view = refusalsFixture();
    const strings = await takeoffStrings();
    const staged = await stagedDoors({ previewCorroborate: READING_NOT_NUMERIC });
    const root = await mountRegister(view, { doors: staged.doors });
    const user = userEvent.setup();

    const attribute = all(root, "register-attribute")[0] as HTMLElement;
    await user.click(within(attribute).getByRole("button", { name: copy(strings, "takeoff_register_corroborate") }));
    await user.click(within(attribute).getByRole("button", { name: copy(strings, "takeoff_register_corroborate_preview") }));

    expect(staged.calls.map((call) => call.door), "the reading was previewed at the door before anything was shown").toContain("previewCorroborate");

    const answer = one(root, "register-answer");
    const states = [...answer.querySelectorAll(testIdSelector(TESTIDS.refusal.state))] as HTMLElement[];
    expect(states.length, "the rejection renders the one RefusalState in the answer slot — never a toast (R-UI-020)").toBe(1);
    expect((states[0] as HTMLElement).getAttribute("data-code"), "carrying the code the door answered").toBe(READING_NOT_NUMERIC);
    expect(document.querySelectorAll(testIdSelector(TESTIDS.consequence.dialog)).length, "a dialog that opens on nothing is a consequence of nothing (Decision §1)").toBe(0);
  });

  test("AC-4: no text node outside a RefusalState spells a registered code", async () => {
    const view = refusalsFixture();
    const codes = await refusalCodes();
    const root = await mountRegister(view);

    const outside = textNodesUnder(root, (node) => node.getAttribute("data-testid") === "refusal-state");
    for (const said of outside) {
      for (const code of codes) {
        expect(said.includes(code), `a code is spelled only inside the one RefusalState — "${said}" spells ${code} (R-UI-020, B-17)`).toBe(false);
      }
    }
  });
});
