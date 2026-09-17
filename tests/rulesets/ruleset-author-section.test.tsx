// @vitest-environment jsdom
/**
 * The Author edition screen, mounted — `docs/design/s-settings-ruleset-author.md` §7: the section is
 * mounted under jsdom over a staged pin and walked through `RULESET_AUTHOR_STATES`.
 *
 * Each limb below is one cell of that matrix, and what it grades is what the Decision rules rather
 * than what the component happens to draw:
 *
 *   empty            — a project with no pin has nothing to fork: the absence notice and a way onward,
 *                      and NO version field, NO grid and NO door pretending an act is available (§2).
 *   rendered (ready) — the pin stands whole in the document (identity beside its digest, I-262), the
 *                      diff is EVERY parameter and not only the moved ones (I-264), and what the
 *                      reader states reaches the door under the pin's own key.
 *   refusal          — I-267: a refused preview is answered in place and no dialog opens; what was
 *                      typed survives it, because a refusal that emptied the form is work done twice.
 *   permissionDenied — I-266: the whole screen renders for a reader without AUTHOR_RULE_SET, and the
 *                      door is shut and described by the standing refusal. Nothing is hidden.
 *
 * Painted facts (tokens, hairlines, the 28 px row) are the journey's and the craft rubric's: this
 * lane has no styles. `.tsx` because the element tree here is JSX, as `tests/app/**` already spells.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { RulesetAuthorSection } from "@/app/(app)/t/[tenant]/p/[project]/settings/ruleset-author/ruleset-author-section";
import { RULESET_AUTHOR_STATES } from "@/app/(app)/t/[tenant]/p/[project]/settings/ruleset-author/states";
import { refusalOf } from "@/core/errors";
import { rulesetAuthorStrings } from "@/modules/spine/ruleset-authoring";
import { TESTIDS } from "@/ui/testids";
import {
  STAGED_PARAMETERS,
  STAGED_PARTICIPANTS_HREF,
  STAGED_PIN,
  STAGED_PROJECT,
  STAGED_RULESET_HREF,
  stageDoors,
  type StagedDoors,
} from "./support/ruleset-author-stage";

afterEach(cleanup);

/** The screen as the page mounts it, with the two doors staged and everything else the Decision's. */
function mount(options: { pinned?: boolean; mayAuthor?: boolean; doors?: StagedDoors } = {}): StagedDoors {
  const doors = options.doors ?? stageDoors();
  render(
    <RulesetAuthorSection
      projectId={STAGED_PROJECT}
      parent={options.pinned === false ? null : STAGED_PIN}
      rulesetHref={STAGED_RULESET_HREF}
      participantsHref={STAGED_PARTICIPANTS_HREF}
      mayAuthor={options.mayAuthor ?? true}
      preview={doors.preview}
      commit={doors.commit}
    />,
  );
  return doors;
}

/** Every diff row the document holds, in the order it holds them. */
function diffRows(): HTMLElement[] {
  return screen.getAllByTestId(TESTIDS.rulesetAuthor.diffRow);
}

/** The field of one parameter row — the control the reader types a new figure into. */
function fieldOf(key: string): HTMLInputElement {
  const row = diffRows().find((held) => held.getAttribute("data-param") === key);
  if (row === undefined) throw new Error(`no diff row for ${key}`);
  return within(row).getByTestId(TESTIDS.rulesetAuthor.value) as HTMLInputElement;
}

function state(): string | null {
  return screen.getByTestId(TESTIDS.rulesetAuthor.section).parentElement?.getAttribute("data-state") ?? null;
}

describe("empty: a project that pins nothing has nothing to fork (RULESET_AUTHOR_STATES.empty)", () => {
  test("the absence notice stands with a way onward, and no part of the act is drawn", () => {
    mount({ pinned: false });
    expect(screen.getByTestId(TESTIDS.ruleset.unpinned).textContent).toContain(rulesetAuthorStrings.ruleset_author_unpinned_heading);
    expect(screen.getByTestId(TESTIDS.rulesetAuthor.seeRuleset).getAttribute("href")).toBe(STAGED_RULESET_HREF);
    for (const absent of [TESTIDS.rulesetAuthor.version, TESTIDS.rulesetAuthor.diff, TESTIDS.rulesetAuthor.submit, TESTIDS.rulesetAuthor.parent]) {
      expect(screen.queryAllByTestId(absent), `${absent} must not render where there is no pin to fork`).toHaveLength(0);
    }
    expect(state()).toBe("empty");
  });
});

describe("rendered: the pin, the whole diff, and the figures the reader states (I-262, I-264)", () => {
  test("the pin stands whole — its scope, its identity and its digest unabbreviated", () => {
    mount();
    const parent = screen.getByTestId(TESTIDS.rulesetAuthor.parent);
    expect(parent.getAttribute("data-digest")).toBe(STAGED_PIN.digest);
    expect(parent.textContent).toContain(`${STAGED_PIN.identity.name} @ ${STAGED_PIN.identity.version}`);
    // I-26's rule, kept here too: a truncated digest compares nothing.
    expect(parent.textContent).toContain(STAGED_PIN.digest);
    expect(parent.textContent).toContain(STAGED_PIN.identity.scope);
  });

  test("every parameter of the pin is a row, carrying its key, its unit and the pinned figure", () => {
    mount();
    const keys = Object.keys(STAGED_PARAMETERS);
    expect(diffRows().map((row) => row.getAttribute("data-param"))).toEqual(keys);
    for (const key of keys) {
      const row = diffRows().find((held) => held.getAttribute("data-param") === key) as HTMLElement;
      const parameter = STAGED_PARAMETERS[key as keyof typeof STAGED_PARAMETERS];
      expect(row.getAttribute("data-unit")).toBe(parameter.unit);
      expect(row.getAttribute("data-before")).toBe(parameter.value);
      // Nothing is authored yet, so the pinned figure is what the row would carry forward.
      expect(row.getAttribute("data-after")).toBe(parameter.value);
      expect(row.getAttribute("data-changed")).toBe("false");
      expect(row.textContent).toContain(parameter.unit);
    }
  });

  test("a figure the reader states marks its own row and leaves every other row alone", () => {
    mount();
    fireEvent.change(fieldOf("openingDeductionMinM2"), { target: { value: "0.25" } });
    const marked = diffRows().map((row) => [row.getAttribute("data-param"), row.getAttribute("data-changed"), row.getAttribute("data-after")]);
    expect(marked).toEqual([
      ["openingDeductionMinM2", "true", "0.25"],
      ["memberEndNoDeductMaxCm2", "false", "500"],
      ["embeddedDuctNoDeductMaxCm2", "false", "100"],
    ]);
  });

  test("a field emptied again states nothing: the pinned figure stands and the row is unmarked", () => {
    mount();
    fireEvent.change(fieldOf("openingDeductionMinM2"), { target: { value: "0.25" } });
    fireEvent.change(fieldOf("openingDeductionMinM2"), { target: { value: "" } });
    const row = diffRows()[0] as HTMLElement;
    expect(row.getAttribute("data-changed")).toBe("false");
    expect(row.getAttribute("data-after")).toBe("0.1");
  });

  test("the door carries the version and the stated figures, under the pin's own keys", async () => {
    const doors = mount();
    fireEvent.change(screen.getByTestId(TESTIDS.rulesetAuthor.version), { target: { value: "2026.09" } });
    fireEvent.change(fieldOf("memberEndNoDeductMaxCm2"), { target: { value: "600" } });
    fireEvent.click(screen.getByTestId(TESTIDS.rulesetAuthor.submit));

    await waitFor(() => expect(doors.previewed).toHaveLength(1));
    // The screen states the whole content it is showing, not a patch of it: every key of the pin with
    // the figure the row carries, so what the act mints is exactly what the reader read (I-265).
    expect(doors.previewed[0]).toEqual({
      version: "2026.09",
      values: { openingDeductionMinM2: "0.1", memberEndNoDeductMaxCm2: "600", embeddedDuctNoDeductMaxCm2: "100" },
    });
    // A consequence opens the dialog: the act is carried there and nowhere else (L-ACT-02).
    await waitFor(() => expect(screen.queryAllByTestId(TESTIDS.consequence.dialog)).toHaveLength(1));
  });
});

describe("refusal: a refused preview is answered in place, and no dialog opens (I-267)", () => {
  test("the refusal renders with its own message and remedy, and what was typed survives it", async () => {
    const doors = stageDoors({ refuseWith: "EDITION_VERSION_TAKEN" });
    mount({ doors });
    fireEvent.change(screen.getByTestId(TESTIDS.rulesetAuthor.version), { target: { value: "2026.08" } });
    fireEvent.change(fieldOf("openingDeductionMinM2"), { target: { value: "0.25" } });
    fireEvent.click(screen.getByTestId(TESTIDS.rulesetAuthor.submit));

    const taken = refusalOf("EDITION_VERSION_TAKEN");
    await waitFor(() => expect(screen.getByTestId(TESTIDS.rulesetAuthor.refusal).textContent).toContain(taken.message));
    expect(screen.getByTestId(TESTIDS.rulesetAuthor.refusal).textContent).toContain(taken.remedy);
    expect(screen.queryAllByTestId(TESTIDS.consequence.dialog)).toHaveLength(0);
    expect(doors.committed).toHaveLength(0);
    // Nothing the reader stated was cleared: they do not do the work twice to fix one version.
    expect((screen.getByTestId(TESTIDS.rulesetAuthor.version) as HTMLInputElement).value).toBe("2026.08");
    expect(fieldOf("openingDeductionMinM2").value).toBe("0.25");
    expect(state()).toBe("refused");
  });
});

describe("permissionDenied: the screen renders, the door is shut and says why (I-266)", () => {
  test("PERMISSION_NOT_HELD stands from the first render, and the grid is not hidden", () => {
    mount({ mayAuthor: false });
    const denied = refusalOf("PERMISSION_NOT_HELD");
    const refusal = screen.getByTestId(TESTIDS.rulesetAuthor.refusal);
    expect(refusal.textContent).toContain(denied.message);
    expect(refusal.textContent).toContain(denied.remedy);
    // Nothing is hidden from a reader who can see the project (R-SPINE-006).
    expect(diffRows()).toHaveLength(Object.keys(STAGED_PARAMETERS).length);
    const submit = screen.getByTestId(TESTIDS.rulesetAuthor.submit);
    expect(submit.getAttribute("aria-disabled")).toBe("true");
    expect(submit.getAttribute("aria-describedby")).toBe(refusal.id);
  });

  test("the shut door carries nothing to the act, however often it is pressed", async () => {
    const doors = mount({ mayAuthor: false });
    fireEvent.click(screen.getByTestId(TESTIDS.rulesetAuthor.submit));
    fireEvent.click(screen.getByTestId(TESTIDS.rulesetAuthor.submit));
    await waitFor(() => expect(screen.getByTestId(TESTIDS.rulesetAuthor.refusal).textContent).not.toBe(""));
    expect(doors.previewed).toHaveLength(0);
  });
});

describe("R-UI-050's matrix for the screen (B-19)", () => {
  test("every state is rendered here with a home, delegated with a reason, or impossible with one", () => {
    const registered = new Set(Object.values(TESTIDS).flatMap((group) => Object.values(group)));
    for (const [name, cell] of Object.entries(RULESET_AUTHOR_STATES)) {
      if (cell.declared === "rendered") {
        expect(cell.by, `${name} names the module that paints it`).not.toBe("");
        if (cell.testId !== null) expect(registered.has(cell.testId), `${name} points at a registered test id`).toBe(true);
      } else if (cell.declared === "delegated") {
        expect(cell.to !== "" && cell.why !== "", `${name} names who owns it and why`).toBe(true);
      } else {
        expect(cell.why, `${name} says why it cannot arise`).not.toBe("");
      }
    }
  });
});
