// @vitest-environment jsdom
/**
 * AC-2's screen half — the seven areas and the quick actions (S-Project, R-UI-031,
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
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { PROJECT, TENANT, all, copy, homeData, homeStrings, mountHome, one, projectHome, text } from "./support/project-home-stage";
import { TESTIDS } from "@/ui/testids";

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

/**
 * The quick actions and where each one goes (test contract).
 *
 * Four since inc-300b-documents-list: S-Documents is reached from this screen and from nowhere else
 * (R-UI-031), so the roster the old law froze at three is re-baselined here rather than worked
 * around — the documents action is appended last, exactly as `areas.ts` declares it.
 */
const QUICK_ACTIONS: readonly (readonly [string, string])[] = [
  ["upload-drawings", `/t/${TENANT}/p/${PROJECT}/drawings`],
  ["browse-sets", `/t/${TENANT}/p/${PROJECT}/drawings/sets`],
  ["manage-participants", `/t/${TENANT}/p/${PROJECT}/settings/participants`],
  ["documents", `/t/${TENANT}/p/${PROJECT}/documents`],
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
        expect(tab.getAttribute("aria-disabled"), `\`${area}\` announces itself as disabled rather than being a disabled control (I-143)`).toBe("true");
        expect(tab.hasAttribute("href"), `\`${area}\` is a door that answers nothing, so it is not a link at all`).toBe(false);
        // I-143 amends I-126: the condition is a TOOLTIP on a disabled control, not four sentences
        // printed down a 32 px row. The tab says its own label and nothing else …
        expect(text(tab), `\`${area}\` says its label, and only its label (§8's Home/Project fix 2)`).toBe(label);
        // … and the hint is reachable by the keyboard as well as the pointer, which is what makes a
        // tooltip a lawful home for it (R-UI-012). The hint's own paint is walked in the browser.
        expect(tab.getAttribute("tabindex"), `\`${area}\` is reachable, so its condition can be read without a mouse`).toBe("0");
        expect(tab.hasAttribute("data-state"), `\`${area}\` is a tooltip trigger — the shipped primitive's own hook`).toBe(true);
        // R-UI-060: THE SCREEN STATES THE CONDITION IN WORDS. This assertion was weakened on this
        // branch to `unavailable.length > 0` — which proves the string table is non-empty and
        // nothing at all about the screen, leaving the clause unproved (nothing else in `tests/`
        // reads `project_home_tab_unavailable`). I-143 moved the sentence from the row into the
        // tooltip, so the proof moves with it: the hint opens on FOCUS, which is what makes it
        // readable without a pointer, and what it then says is the string table's own sentence.
        fireEvent.focus(tab);
        const hint = await screen.findByTestId(TESTIDS.tooltip.content);
        expect(hint.textContent, `\`${area}\` states its condition in words, in the hint its own trigger opens (R-UI-060, I-143)`).toBe(unavailable);
        fireEvent.blur(tab);
      }
    }
  });

  test("AC-2: the quick actions are links to the addresses they name", async () => {
    const root = mountHome(await projectHome(), homeData());
    const actions = all(root, "project-quick-action");

    expect(
      actions.map((action) => [action.tagName, action.getAttribute("data-action"), action.getAttribute("href")]),
      "exactly the quick actions the contract names, each an anchor to its own address",
    ).toEqual(QUICK_ACTIONS.map(([action, href]) => ["A", action, href]));
    expect(one(root, "project-quick-actions").contains(actions[0] as Node), "and they stand in the quick-actions region").toBe(true);
  });
});
