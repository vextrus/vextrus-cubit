// @vitest-environment jsdom
/**
 * AC-2's screen half — the seven areas and the three quick actions (S-Project, R-UI-031,
 * docs/design/s-project.md §1, I-125/I-126).
 *
 * AC-2's browser half — activating the `drawings` tab from the keyboard and landing on the drawings
 * route with `sheet-index` visible — is walked by `tests/e2e/project-home.spec.ts`, because a real
 * navigation is the only honest proof that the home is the visible door into J-010's first screen.
 *
 * The seven keys and their order are S-Project's own clause, and the three live routes are the test
 * contract's; that a tab's availability is *derived* from `PROJECT_AREAS` rather than hand-written
 * beside it is AC-6's, in the held-out set.
 */
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { PROJECT, TENANT, all, copy, homeData, homeStrings, mountHome, one, projectHome, text } from "./support/project-home-stage";

/** S-Project's clause order: "Drawings · Takeoff · Assure · Estimate · Bid · Activity · Settings". */
const CLAUSE_ORDER = ["drawings", "takeoff", "assure", "estimate", "bid", "activity", "settings"] as const;

/**
 * The addresses of the areas that have a screen today (test contract).
 *
 * `takeoff` joined them in inc-214-register-workspace, whose register workspace is the screen the
 * area answers on: the tab becomes a link by gaining an address in `areas.ts` and nothing else
 * changes (I-126, B-20 — this increment owns the acceptance the old law froze).
 */
const LIVE: Readonly<Record<string, string>> = {
  drawings: `/t/${TENANT}/p/${PROJECT}/drawings`,
  takeoff: `/t/${TENANT}/p/${PROJECT}/takeoff`,
  activity: `/t/${TENANT}/p/${PROJECT}/audit`,
  settings: `/t/${TENANT}/p/${PROJECT}/settings/ruleset`,
};

/** The three quick actions and where each one goes (test contract). */
const QUICK_ACTIONS: readonly (readonly [string, string])[] = [
  ["upload-drawings", `/t/${TENANT}/p/${PROJECT}/drawings`],
  ["browse-sets", `/t/${TENANT}/p/${PROJECT}/drawings/sets`],
  ["manage-participants", `/t/${TENANT}/p/${PROJECT}/settings/participants`],
];

afterEach(() => {
  cleanup();
});

describe("AC-2 — the navigation regions", () => {
  test("AC-2: the tab row is a nav holding the clause's seven areas, in its order", async () => {
    const root = mountHome(await projectHome(), homeData());
    const nav = one(root, "project-tabs");

    expect(nav.tagName, "the areas are navigation, so the row is a `<nav>` (I-125)").toBe("NAV");
    expect(screen.getAllByRole("navigation").some((region) => region === nav), "and it is in the accessibility tree as one").toBe(true);
    expect(
      all(root, "project-tab").map((tab) => tab.getAttribute("data-area")),
      "exactly seven tabs, in S-Project's clause order",
    ).toEqual([...CLAUSE_ORDER]);
  });

  test("AC-2: an area with a screen is a link to it; an area without one is an honest non-control", async () => {
    const strings = await homeStrings();
    const unavailable = copy(strings, "project_home_tab_unavailable");
    const root = mountHome(await projectHome(), homeData());

    for (const tab of all(root, "project-tab")) {
      const area = tab.getAttribute("data-area") ?? "";
      const label = copy(strings, `project_home_tab_${area}`);
      const href = LIVE[area];

      if (href !== undefined) {
        expect(tab.tagName, `the \`${area}\` area has a screen, so its tab is an anchor`).toBe("A");
        expect(tab.getAttribute("data-available"), `\`${area}\` is available`).toBe("true");
        expect(tab.getAttribute("href"), `\`${area}\` leads to the address the contract names`).toBe(href);
        expect(text(tab), `\`${area}\` is named by its own line of the string table`).toBe(label);
      } else {
        expect(tab.getAttribute("data-available"), `\`${area}\` has no screen yet, so the tab says so`).toBe("false");
        expect(tab.getAttribute("aria-disabled"), `\`${area}\` announces itself as no control (I-126)`).toBe("true");
        expect(tab.hasAttribute("href"), `\`${area}\` is a door that answers nothing, so it is not a link at all`).toBe(false);
        expect(text(tab).startsWith(label), `\`${area}\` still carries its label`).toBe(true);
        expect(text(tab).endsWith(unavailable), `\`${area}\` states its condition in words, never in colour alone (R-UI-060)`).toBe(true);
      }
    }
  });

  test("AC-2: the three quick actions are links to the addresses they name", async () => {
    const root = mountHome(await projectHome(), homeData());
    const actions = all(root, "project-quick-action");

    expect(
      actions.map((action) => [action.tagName, action.getAttribute("data-action"), action.getAttribute("href")]),
      "exactly three quick actions, each an anchor to the address the contract names",
    ).toEqual(QUICK_ACTIONS.map(([action, href]) => ["A", action, href]));
    expect(one(root, "project-quick-actions").contains(actions[0] as Node), "and they stand in the quick-actions region").toBe(true);
  });
});
