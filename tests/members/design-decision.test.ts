/**
 * AC-1 (C-13): the members surface's Design Decision is committed WHOLE, before acceptance — the
 * screen's layout and hierarchy, all seven of R-UI-050's states, its Datum tokens, both themes, its
 * motion, and the route and `data-testid` names it fixes for C-05's contract.
 *
 * The two invitation ids are the point of the last clause: `members-invite-form` and
 * `members-pending-invitations` are named here and rendered by inc-010b, so the name inc-010b
 * builds against is fixed by a document that exists before either increment's code does.
 *
 * The roster of ids this file grades against is the increment's own contract, declared once in
 * `support/members-page.ts` and imported by every suite that asserts one (B-19).
 *
 * This criterion is green the moment the Decision lands, which C-13 requires to be BEFORE this file
 * was written: it is the guard that keeps the committed document whole as the surface grows, not a
 * missing feature waiting to be built.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ACTION_NAMES, CONTRACT_TESTIDS, MEMBERS_ROUTE_PATTERN, SETTINGS_ROUTE_PATTERN } from "./support/members-page";

/** The Decision this increment's screen is built against. */
const DECISION = join(import.meta.dirname, "..", "..", "docs", "design", "s-settings.md");

/** R-UI-050's seven, in the clause's own order — the clause is the specification of the tuple. */
const R_UI_050_STATES = ["loading", "empty", "error", "refusal", "partial", "offline", "permission-denied"] as const;

/** What C-13 asks every Decision to rule beyond its states: motion, the tokens, both themes. */
const C_13_SUBJECTS = ["motion", "token", "theme"] as const;

const decision = (): string => {
  expect(existsSync(DECISION), "docs/design/s-settings.md is committed before acceptance is written (C-13)").toBe(true);
  return readFileSync(DECISION, "utf8");
};

describe("AC-1: the committed Design Decision rules the members surface", () => {
  test("AC-1: the Decision exists and is a whole document, not a stub", () => {
    const text = decision();
    expect(text.length, "a Design Decision that rules layout, seven states, copy, motion, tokens and both themes is not a stub").toBeGreaterThan(2000);
  });

  test("AC-1: it names each of R-UI-050's seven states", () => {
    const text = decision().toLowerCase();
    for (const state of R_UI_050_STATES) {
      expect(text.includes(state), `the Decision must rule the ${state} state — rendered, delegated, or impossible with a reason (R-UI-050, C-13)`).toBe(true);
    }
  });

  test("AC-1: it rules motion, the Datum tokens and both themes", () => {
    const text = decision().toLowerCase();
    for (const subject of C_13_SUBJECTS) {
      expect(text.includes(subject), `C-13 asks the Decision to rule ${subject}`).toBe(true);
    }
  });

  test("AC-1: it fixes the members route, reached from the settings landing", () => {
    const text = decision();
    expect(text.includes(MEMBERS_ROUTE_PATTERN), `the Decision fixes the route ${MEMBERS_ROUTE_PATTERN} (C-05)`).toBe(true);
    expect(text.includes(SETTINGS_ROUTE_PATTERN), `the Decision names the landing ${SETTINGS_ROUTE_PATTERN} the members link is reached from (R-UI-031)`).toBe(true);
  });

  test("AC-1: it fixes every data-testid in the contract, the two inc-010b panels included", () => {
    const text = decision();
    const missing = CONTRACT_TESTIDS.filter((testId) => !text.includes(testId));
    expect(missing, "every data-testid this increment's contract fixes is named in the Decision (C-05, C-13) — inc-010b builds against the last two").toEqual([]);
  });

  test("AC-1: it names the server actions the surface's mutations go through", () => {
    const text = decision();
    const missing = ACTION_NAMES.filter((name) => !text.includes(name));
    expect(missing, "the Decision names the server actions the contract fixes (C-05)").toEqual([]);
  });
});
