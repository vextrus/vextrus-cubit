// @vitest-environment jsdom
/**
 * AC-2's screen half — S-Project gains a fourth quick action, `documents`, and it is a link to the
 * one spelling of this screen's address (`documentsRoute`, R-UI-031, R-UI-084).
 *
 * AC-2's browser half — pressing that action, landing on `documents-screen`, and the crumb then
 * reading **Documents** — is walked by `tests/e2e/documents.spec.ts` (J-030): a real navigation is
 * the only honest proof that the screen is reachable by visible navigation from the shell.
 *
 * The roster is NOT frozen here. What is asserted is the rule the frozen lists of three were an
 * instance of: every quick action `areas.ts` declares is rendered, as an anchor, at the address its
 * own `route` answers — so the day a fifth lands, this suite passes without being re-baselined and
 * still refuses an action that leads nowhere (B-19).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { PROJECT, TENANT, all, copy, homeData, homeStrings, mountHome, one, projectHome, text } from "./support/project-home-stage";
import { areasModule, documentsRoute } from "../documents/support/documents-stage";

/** The key the increment's interfaces give the fourth action, and the id it renders under. */
const DOCUMENTS = "documents";

/** Its line of S-Project's string table, and the word that line reads (docs/design/s-documents.md §3). */
const LABEL_KEY = "project_home_action_documents";
const LABEL = "Documents";

afterEach(cleanup);

describe("AC-2 — S-Documents is reached from S-Project", () => {
  test("AC-2: `QUICK_ACTIONS` holds a `documents` action, addressed by `documentsRoute` and named by the string table", async () => {
    const areas = await areasModule();
    const route = await documentsRoute();
    const strings = await homeStrings();

    const action = areas.QUICK_ACTIONS.find((entry) => entry.key === DOCUMENTS);
    expect(action, `areas.ts declares a \`${DOCUMENTS}\` quick action (increment interfaces): ${JSON.stringify(areas.QUICK_ACTIONS.map((entry) => entry.key))}`).toBeDefined();
    // IDENTITY, not equality of two answers: the entry's `route` IS `documentsRoute`, imported from
    // the address's one home. A second function that happens to build the same string today is the
    // second spelling B-17 forbids — and the one that drifts when the address moves.
    expect(action?.route, "the action's address is `documentsRoute` itself, imported from documents/route-address (B-17)").toBe(route);
    expect(route(TENANT, PROJECT), "and that home answers the address the test contract fixes").toBe(`/t/${TENANT}/p/${PROJECT}/documents`);
    // The KEY the interfaces name, and the word the Decision authored for it — not merely some key
    // whose copy is non-empty.
    expect(action?.label, "the action is named by the string key the increment's interfaces fix").toBe(LABEL_KEY);
    expect(copy(strings, LABEL_KEY), `which reads the Decision's own word for it: ${LABEL}`).toBe(LABEL);
  });

  test("AC-2: every declared quick action is rendered as an anchor to the address it names — the documents one among them", async () => {
    const areas = await areasModule();
    const strings = await homeStrings();
    const root = mountHome(await projectHome(), homeData());
    const rendered = all(root, "project-quick-action");

    expect(
      rendered.map((action) => [action.tagName, action.getAttribute("data-action"), action.getAttribute("href"), text(action)]),
      "the quick actions the screen draws are the ones `areas.ts` declares, each an anchor to its own address",
    ).toEqual(areas.QUICK_ACTIONS.map((entry) => ["A", entry.key, entry.route?.(TENANT, PROJECT) ?? null, copy(strings, entry.label)]));

    const documents = rendered.filter((action) => action.getAttribute("data-action") === DOCUMENTS);
    expect(documents.length, `exactly one \`${DOCUMENTS}\` quick action stands on S-Project`).toBe(1);
    expect(one(root, "project-quick-actions").contains(documents[0] as Node), "and it stands in the quick-actions region with its siblings").toBe(true);
  });

  test("AC-2: S-Project's Design Decision names the action the screen now offers", async () => {
    // The Decision is the screen's contract (C-13), so a fourth button on the screen and a Decision
    // that still rules three is the deviation the clause calls a defect. Read here, never
    // transcribed: what the document must be consistent WITH is `areas.ts`'s own roster.
    const areas = await areasModule();
    const decision = readFileSync(join(process.cwd(), "docs/design/s-project.md"), "utf8");

    expect(
      decision.includes(DOCUMENTS),
      "the Decision names the documents quick action this increment adds to the screen (AC-2: a changelog line naming the fourth action)",
    ).toBe(true);
    if (areas.QUICK_ACTIONS.length > 3) {
      expect(
        /three quick actions/i.test(decision),
        `the screen now offers ${areas.QUICK_ACTIONS.length} quick actions, so the Decision no longer rules three`,
      ).toBe(false);
    }
  });
});
