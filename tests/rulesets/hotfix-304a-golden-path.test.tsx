// @vitest-environment jsdom
/**
 * HOTFIX inc-304a (J-000): tests/e2e/journeys/j-000/m0-workspace-and-project.spec.ts — "the saved name is what the settings screen reads back"
 *
 * THE BREAKAGE, PINNED BEFORE IT IS REPAIRED. inc-304a shipped the settings surfaces the Golden
 * Path's leg reads back — the frame `SettingsPane` draws and the Author edition screen that frame
 * wraps — and shipped the screen WITHOUT the rendered read contract its own Decision fixes. The
 * journey lane reads a screen through `tests/e2e/support/retrying-read.ts`, which reads
 * `data-state`, `data-rendered-region` and `data-rows-rendered` and, finding none of them on the
 * element it was aimed at, falls back to re-reading text until it stops moving — the un-contracted
 * path that answers late on a loaded box and reads a screen mid-flight on a fast one. That is the
 * class of red the evidence pack caught, and this file is it, in the lane that costs a second.
 *
 * `docs/design/s-settings-ruleset-author.md` §7 fixes what the screen owes, and neither half of it
 * is rendered today:
 *
 *   · `ruleset-author` — "the screen root in the content pane, the region a retrying read targets",
 *     carrying `data-state` with the value §2 names. The element exists and carries the attribute;
 *     nothing addresses it, so no read can reach it and the acceptance beside this file has to ask
 *     the section's PARENT for the screen's own state.
 *   · `data-rows-rendered` on `ruleset-author-diff`, with the count of rendered rows — the one read
 *     that says a grid finished rendering rather than that a locator resolved.
 *
 * WHAT IS DERIVED AND WHAT IS NOT (B-19). No state name is spelled here: the roster is the screen's
 * own (`RULESET_AUTHOR_SCREEN_STATES`, beside its state matrix), every state is reached by DRIVING
 * the component into it, and the row count is read off the rows the grid actually rendered. Nothing
 * is snapshotted. A state this screen comes to hold tomorrow is judged by the same three limbs.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { RulesetAuthorSection } from "@/app/(app)/t/[tenant]/p/[project]/settings/ruleset-author/ruleset-author-section";
import { RULESET_AUTHOR_SCREEN_STATES } from "@/app/(app)/t/[tenant]/p/[project]/settings/ruleset-author/states";
import { TESTIDS } from "@/ui/testids";
import {
  STAGED_PARTICIPANTS_HREF,
  STAGED_PIN,
  STAGED_PROJECT,
  STAGED_RULESET_HREF,
  stageDoors,
  type StagedDoors,
} from "./support/ruleset-author-stage";

afterEach(cleanup);

/** The screen as its page mounts it: a pinned project unless the unpinned leg asks otherwise. */
function mount(options: { pinned?: boolean; doors?: StagedDoors } = {}): StagedDoors {
  const doors = options.doors ?? stageDoors();
  render(
    <RulesetAuthorSection
      commit={doors.commit}
      mayAuthor
      parent={(options.pinned ?? true) ? STAGED_PIN : null}
      participantsHref={STAGED_PARTICIPANTS_HREF}
      preview={doors.preview}
      projectId={STAGED_PROJECT}
      rulesetHref={STAGED_RULESET_HREF}
    />,
  );
  return doors;
}

/** The screen root a retrying read targets, and the state it publishes there. */
function screenRoot(): HTMLElement {
  return screen.getByTestId(TESTIDS.rulesetAuthor.screen);
}

function publishedState(): string | null {
  return screenRoot().getAttribute("data-state");
}

describe("inc-304a-ruleset-authoring-ui-hotfix-a1: the settings screen publishes the contract a read of it needs", () => {
  test("the screen root is addressable, and it is the element that carries `data-state`", () => {
    mount();

    const root = screenRoot();
    expect(
      within(root).getByTestId(TESTIDS.rulesetAuthor.section),
      "the screen root wraps the section: the region a retrying read targets holds what the read is about",
    ).toBeTruthy();
    expect(
      [...RULESET_AUTHOR_SCREEN_STATES] as string[],
      `the state a read of this screen gets is one of the screen's own roster, never a word invented at the element; it published ${JSON.stringify(publishedState())}`,
    ).toContain(publishedState());
  });

  test("every state the screen is DRIVEN into is published on that same element", async () => {
    const standing = mount();
    expect(publishedState(), "a pinned project with a door open to it stands ready").toBe("ready");
    expect(standing.previewed, "nothing was asked of the door by rendering the screen").toHaveLength(0);
    cleanup();

    mount({ doors: stageDoors({ refuseWith: "EDITION_VERSION_TAKEN" }) });
    fireEvent.change(screen.getByTestId(TESTIDS.rulesetAuthor.version), { target: { value: "2026.09" } });
    fireEvent.click(screen.getByTestId(TESTIDS.rulesetAuthor.submit));
    await waitFor(() => expect(screen.getByTestId(TESTIDS.rulesetAuthor.refusal).textContent, "the refusal stands in its slot").not.toBe(""));
    expect(publishedState(), "a refused preview leaves the screen refused, and says so where a read can reach it").toBe("refused");
    cleanup();

    mount({ pinned: false });
    expect(publishedState(), "a project that pins nothing has nothing to fork, and the screen states that state too").toBe("empty");
  });

  test("the diff grid says how many rows it rendered, beside the region it publishes", () => {
    mount();

    const grid = screen.getByTestId(TESTIDS.rulesetAuthor.diff);
    expect(grid.getAttribute("data-rendered-region"), "the grid names the region a read of it waits on").toBe(TESTIDS.rulesetAuthor.diff);
    expect(
      grid.getAttribute("data-rows-rendered"),
      "a read of the grid waits for the rows it rendered, counted by the grid itself — never by counting locators the browser happened to resolve",
    ).toBe(String(within(grid).getAllByTestId(TESTIDS.rulesetAuthor.diffRow).length));
  });
});
