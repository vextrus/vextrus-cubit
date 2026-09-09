// @vitest-environment jsdom
/**
 * AC-8's screen half — bulk is OFFERED, never assembled (R-UI-023, L-ACT-02,
 * docs/design/s-takeoff.md §1 "Level stack"), and the Measure door answers in place.
 *
 * The asserted ABSENCE is the substance of the clause: a register of 50 000 rows with a select-all
 * is a register that lets a person confirm what they have not read. The offer itself is the shipped
 * OfferedGroups over the key the machine judged, and confirming it opens the one ConsequenceDialog
 * on ONE act with the offer's levels verbatim.
 */
import { cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import {
  CAMPAIGN_NOT_FOUND,
  all,
  aView,
  copy,
  levelStackFixture,
  mountRegister,
  one,
  productModule,
  stagedDoors,
  stringsSeam,
  takeoffStrings,
  text,
} from "./support/fixtures";

afterEach(() => {
  cleanup();
});

/** The one figure seam every screen renders a count through (SEAM-FORMAT, Decision §1). */
const FORMAT_MODULE = "src/core/format.ts";

async function formatted(count: number): Promise<string> {
  const format = await productModule<{ formatUserFigure: (value: string) => string }>(FORMAT_MODULE);
  return format.formatUserFigure(String(count));
}

describe("AC-8 — the level stack is offered whole, and nothing is picked row by row", () => {
  test("AC-8: no checkbox, no role=checkbox and no select-all stands anywhere under the workspace", async () => {
    const root = await mountRegister(levelStackFixture());

    expect(root.querySelectorAll("input[type=checkbox]").length, "a heterogeneous register offers no checkbox (R-UI-023)").toBe(0);
    expect(root.querySelectorAll('[role="checkbox"]').length, "nor anything that announces itself as one").toBe(0);
    expect(
      [...root.querySelectorAll("[data-testid]")].filter((node) => (node.getAttribute("data-testid") ?? "").includes("select-all")).length,
      "and no select-all control at all — there is no select-all over heterogeneous rows",
    ).toBe(0);
  });

  test("AC-8: one offered group per proposal, keyed on the fact judged, counting its members", async () => {
    const view = levelStackFixture();
    const strings = await takeoffStrings();
    const { fill } = await stringsSeam();
    const root = await mountRegister(view);

    const stack = one(root, "register-level-stack");
    const groups = one(root, "offered-groups");
    expect(stack.contains(groups), "the one bulk door stands in the level-stack section").toBe(true);
    expect(groups.getAttribute("data-count"), "the region counts the offers it holds").toBe(String(view.levelStacks.length));

    const offered = all(root, "offered-group");
    expect(
      offered.map((group) => [group.getAttribute("data-kind"), group.getAttribute("data-drawing")]),
      "one group per proposal, keyed on its kind and the drawing it was read from",
    ).toEqual(view.levelStacks.map((stackOffer) => [stackOffer.key.kind, stackOffer.key.drawingId]));

    const first = view.levelStacks[0] as (typeof view.levelStacks)[number];
    expect(
      text(offered[0]?.querySelector('[data-testid="offered-group-count"]') ?? null),
      "the live membership count reads the screen's own line, filled through the figure seam",
    ).toBe(fill(copy(strings, "takeoff_register_level_stack_count"), { count: await formatted(first.count) }));
  });

  test("AC-8: with nothing proposed the region counts zero and says the shipped sentence", async () => {
    const root = await mountRegister(aView());
    const groups = one(root, "offered-groups");
    expect(groups.getAttribute("data-count"), "an empty offer is a counted empty set, never a hidden one").toBe("0");
    expect(text(groups).length, "and it says why it is empty — silence never happens (R-UI-020)").toBeGreaterThan(0);
    expect(all(root, "offered-group").length, "with no group standing").toBe(0);
  });

  test("AC-8: confirming the offer opens the one ConsequenceDialog on ONE INSERT_LEVEL act", async () => {
    const view = levelStackFixture();
    const staged = await stagedDoors();
    const root = await mountRegister(view, { doors: staged.doors });
    const user = userEvent.setup();

    await user.click(one(root, "offered-group-confirm"));

    const dialogs = [...document.querySelectorAll('[data-testid="consequence-dialog"]')] as HTMLElement[];
    expect(dialogs.length, "confirming opens the one shipped ConsequenceDialog (B-17)").toBe(1);
    expect((dialogs[0] as HTMLElement).getAttribute("data-act-type"), "on the act the offer confirms as").toBe("INSERT_LEVEL");

    const previewed = staged.calls.filter((call) => call.door === "previewInsertLevel");
    expect(previewed.length, "the dialog previews the act once — bulk is one act with N subjects (L-ACT-01)").toBe(1);
    expect(
      (previewed[0]?.argument as { input?: Record<string, unknown> } | undefined)?.input,
      "over the offer's own levels, verbatim: nothing is assembled from what a person clicked",
    ).toEqual({ type: "INSERT_LEVEL", projectId: view.projectId, levels: (view.levelStacks[0] as (typeof view.levelStacks)[number]).levels });
  });

  test("AC-8: the Measure door asks once, and a project with no campaign is answered in place", async () => {
    const view = levelStackFixture();
    const strings = await takeoffStrings();
    const staged = await stagedDoors();
    const root = await mountRegister(view, { doors: staged.doors });
    const user = userEvent.setup();

    await user.click(one(root, "register-measure"));
    const asked = staged.calls.filter((call) => call.door === "requestMeasure");
    expect(asked.length, "pressing the door asks the measure door once").toBe(1);
    expect(asked[0]?.argument, "naming the project and the campaign the register is reading").toEqual({ projectId: view.projectId, campaignId: view.campaign?.campaignId });
    expect(text(one(root, "register-timeline")), "and the run is shown where it was started (R-UI-024)").toContain(copy(strings, "takeoff_register_timeline_heading"));

    cleanup();
    const refusing = await stagedDoors({ requestMeasure: CAMPAIGN_NOT_FOUND });
    const second = await mountRegister({ ...view, campaign: null }, { doors: refusing.doors });
    await userEvent.setup().click(one(second, "register-measure"));
    const answer = one(second, "register-answer");
    const states = [...answer.querySelectorAll('[data-testid="refusal-state"]')] as HTMLElement[];
    expect(states.length, "a campaign the project does not hold is answered in place, through the one RefusalState").toBe(1);
    expect((states[0] as HTMLElement).getAttribute("data-code"), "by the code the door answered").toBe(CAMPAIGN_NOT_FOUND);
  });
});
