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
import { PROJECT_SETTINGS_AREAS } from "@/app/(app)/t/[tenant]/p/[project]/settings/areas";
import { projectSettingsNavItems } from "@/app/(app)/t/[tenant]/p/[project]/settings/layout";
import { RulesetAuthorSection } from "@/app/(app)/t/[tenant]/p/[project]/settings/ruleset-author/ruleset-author-section";
import { RULESET_AUTHOR_SCREEN_STATES } from "@/app/(app)/t/[tenant]/p/[project]/settings/ruleset-author/states";
import { SettingsPane } from "@/app/(app)/t/[tenant]/settings/settings-pane";
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

/** The workspace this staged project stands in — an address, never a word a screen renders. */
const TENANT = "5eed0000-0000-4000-8000-000000000001";

/** The area the Author edition screen answers for: the roster's last entry, read rather than spelled. */
const AUTHOR_AREA = PROJECT_SETTINGS_AREAS.at(-1)?.area ?? "";

/**
 * The J-000 leg this file is the reproduction of, spelled once and spoken where a FAILING RUN
 * PRINTS it: the suite's own name and every message below. Whoever reads a red here is looking for
 * the journey that broke, and the header above this file is not in the output they are handed.
 */
const J000_LEG = "tests/e2e/journeys/j-000/m0-workspace-and-project.spec.ts";

/** Why a limb is owed, said with the leg that goes red when it is not. */
function blames(why: string): string {
  return `${J000_LEG} — ${why}`;
}

/** The screen root a retrying read targets, and the state it publishes there. */
function screenRoot(): HTMLElement {
  const roots = screen.queryAllByTestId(TESTIDS.rulesetAuthor.screen);
  expect(
    roots,
    blames(
      "its read of this screen is aimed at the screen root the Decision's §7 registers, and finding no element under that id it falls back to re-reading text until it stops moving",
    ),
  ).toHaveLength(1);
  return roots[0] as HTMLElement;
}

function publishedState(): string | null {
  return screenRoot().getAttribute("data-state");
}

describe(`inc-304a-ruleset-authoring-ui-hotfix-a1 (${J000_LEG}): the settings screen publishes the contract a read of it needs`, () => {
  test(`the screen root is addressable, and it is the element that carries \`data-state\` — ${J000_LEG}`, () => {
    mount();

    const root = screenRoot();
    expect(
      within(root).getByTestId(TESTIDS.rulesetAuthor.section),
      blames("the screen root wraps the section: the region its retrying read targets holds what the read is about"),
    ).toBeTruthy();
    expect(
      [...RULESET_AUTHOR_SCREEN_STATES] as string[],
      blames(
        `the state its read of this screen gets is one of the screen's own roster, never a word invented at the element; it published ${JSON.stringify(publishedState())}`,
      ),
    ).toContain(publishedState());
  });

  test(`every state the screen is DRIVEN into is published on that same element — ${J000_LEG}`, async () => {
    const standing = mount();
    expect(publishedState(), blames("a pinned project with a door open to it stands ready")).toBe("ready");
    expect(standing.previewed, blames("nothing was asked of the door by rendering the screen")).toHaveLength(0);
    cleanup();

    mount({ doors: stageDoors({ refuseWith: "EDITION_VERSION_TAKEN" }) });
    fireEvent.change(screen.getByTestId(TESTIDS.rulesetAuthor.version), { target: { value: "2026.09" } });
    fireEvent.click(screen.getByTestId(TESTIDS.rulesetAuthor.submit));
    await waitFor(() =>
      expect(screen.getByTestId(TESTIDS.rulesetAuthor.refusal).textContent, blames("the refusal stands in its slot")).not.toBe(""),
    );
    expect(publishedState(), blames("a refused preview leaves the screen refused, and says so where a read can reach it")).toBe("refused");
    cleanup();

    mount({ pinned: false });
    expect(publishedState(), blames("a project that pins nothing has nothing to fork, and the screen states that state too")).toBe("empty");
  });

  test(`the settings frame hands the screen through whole: the contract survives the pane the leg reads back in — ${J000_LEG}`, () => {
    const doors = stageDoors();
    render(
      <SettingsPane active={AUTHOR_AREA} items={projectSettingsNavItems(TENANT, STAGED_PROJECT)}>
        <RulesetAuthorSection
          commit={doors.commit}
          mayAuthor
          parent={STAGED_PIN}
          participantsHref={STAGED_PARTICIPANTS_HREF}
          preview={doors.preview}
          projectId={STAGED_PROJECT}
          rulesetHref={STAGED_RULESET_HREF}
        />
      </SettingsPane>,
    );

    const current = screen.getAllByTestId(TESTIDS.settings.area).filter((row) => row.getAttribute("aria-current") === "page");
    expect(
      current.map((row) => row.getAttribute("data-area")),
      blames("the frame marks the one row the reader is standing on"),
    ).toEqual([AUTHOR_AREA]);
    expect(
      within(screenRoot()).getByTestId(TESTIDS.rulesetAuthor.diff).getAttribute("data-rows-rendered"),
      blames("the screen inside the frame is the same screen: its root is addressable and its grid still says what it rendered"),
    ).not.toBeNull();
  });

  test(`the diff grid says how many rows it rendered, beside the region it publishes — ${J000_LEG}`, () => {
    mount();

    const grid = screen.getByTestId(TESTIDS.rulesetAuthor.diff);
    expect(grid.getAttribute("data-rendered-region"), blames("the grid names the region a read of it waits on")).toBe(TESTIDS.rulesetAuthor.diff);
    expect(
      grid.getAttribute("data-rows-rendered"),
      blames(
        "its read of the grid waits for the rows the grid rendered, counted by the grid itself — never by counting locators the browser happened to resolve",
      ),
    ).toBe(String(within(grid).getAllByTestId(TESTIDS.rulesetAuthor.diffRow).length));
  });
});
