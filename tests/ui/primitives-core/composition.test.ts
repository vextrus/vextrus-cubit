// @vitest-environment jsdom
/**
 * AC-5 — the composed slice: keyboard reach, the two value-bearing chips, and axe in both themes
 * (R-UI-012, Q-11).
 *
 * The composition is the Design Decision §4 sample, whose document order is also the Tab order the
 * Decision fixes. Q-11 is honoured literally: the travel begins on the keyboard from the document
 * body, the gate is serious/critical only, and nothing is asserted by counting painted nodes.
 */
import type { ReactElement } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import type { UserEventLike } from "./support/primitives";
import {
  COPY,
  COVERAGE_SAMPLE,
  TESTIDS,
  describeViolations,
  keyboardUser,
  loadBarrel,
  seriousOrCritical,
  tabOrder,
  tabTo,
} from "./support/primitives";
import { composition, el, mount, themed } from "./support/render";

/**
 * Open the composition's Tooltip the way a keyboard user does (Q-11: begin on the keyboard, never a
 * click on a focused element) and hand back the trigger and the content the Decision §3 names.
 *
 * Queries are document-scoped, not container-scoped, because whether the Content sits inline or in a
 * Radix Portal is the Builder's call — the Decision fixes the behaviour and the id, not the mount
 * point. For the same reason the axe context below is the document body.
 */
async function openTooltipByKeyboard(
  ui: ReactElement,
  criterion: string,
): Promise<{ user: UserEventLike; trigger: HTMLElement; content: HTMLElement }> {
  const user = await keyboardUser(criterion);
  mount(ui);
  const trigger = screen.getByRole("button", { name: COPY.tooltipTrigger });
  await tabTo(user, trigger, `the Tooltip trigger "${COPY.tooltipTrigger}"`);
  const content = await screen.findByTestId(
    TESTIDS.tooltipContent,
    {},
    { timeout: 2000 },
  );
  return { user, trigger, content };
}

afterEach(() => {
  cleanup();
});

describe("AC-5: keyboard reach across the composition", () => {
  test("AC-5: Tab from the document body reaches Button, Input, Textarea and the Tooltip trigger", async () => {
    const mod = await loadBarrel();
    const user = await keyboardUser("AC-5");
    const container = mount(composition(mod));
    const queries = within(container);

    const reached = await tabOrder(user);
    expect(reached.length, "Tab reached nothing — R-UI-012: every interactive element is keyboard reachable").toBeGreaterThan(0);

    const owed: [string, Element][] = [
      [`the Button "${COPY.primary}"`, queries.getAllByRole("button", { name: COPY.primary })[0] as Element],
      [`the Input "${COPY.inputLabel}"`, queries.getByLabelText(COPY.inputLabel)],
      [`the Textarea "${COPY.textareaLabel}"`, queries.getByLabelText(COPY.textareaLabel)],
      [`the Tooltip trigger "${COPY.tooltipTrigger}"`, queries.getByRole("button", { name: COPY.tooltipTrigger })],
    ];
    const missed = owed.filter(([, element]) => !reached.includes(element as HTMLElement)).map(([what]) => what);
    expect(missed, "R-UI-012: Tab travel alone must reach every interactive primitive in the composition").toEqual([]);
  });

  /**
   * R-UI-012: "a hint only a pointer can reach is not a hint" — reaching the trigger is not the
   * hint, the hint is the content. Design Decision §3 fixes the behaviour verbatim: "Focus on the
   * trigger opens it (Radix default); Escape closes." Q-11 fixes how it is proven: begin on the
   * keyboard from the body, and observe the response semantically — the tooltip role, the copy the
   * Decision writes, and the description the trigger advertises — never by counting painted nodes.
   */
  test("AC-5: focus opens the Tooltip with the Decision's copy, described to the trigger; Escape closes it", async () => {
    const mod = await loadBarrel();
    const { user, trigger, content } = await openTooltipByKeyboard(composition(mod), "AC-5");

    expect(
      content.getAttribute("role"),
      `the hint a keyboard user reaches must be announced as one — Design Decision §3 renders it on data-testid="${TESTIDS.tooltipContent}"`,
    ).toBe("tooltip");
    expect(
      content.textContent,
      "the tooltip carries the copy the Design Decision §4 fixes, verbatim (copy is design, never improvised)",
    ).toContain(COPY.tooltip);

    const describedBy = trigger.getAttribute("aria-describedby");
    expect(describedBy, "R-UI-012: the open tooltip is described to the focused trigger, not merely painted near it").toBeTruthy();
    const described = describedBy
      ?.split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);
    expect(
      described?.some((node) => node === content || node.contains(content) || content.contains(node)),
      `aria-describedby="${String(describedBy)}" must resolve to the tooltip content itself`,
    ).toBe(true);

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByTestId(TESTIDS.tooltipContent),
        "Design Decision §3: Escape closes the tooltip — a hint a keyboard user cannot dismiss is a trap",
      ).toBeNull();
    });
  });
});

describe("AC-5: Skeleton is the loading placeholder the Decision rules", () => {
  /**
   * Design Decision §3 gives Skeleton the contract testid and rules its ARIA: `aria-hidden` —
   * "the owning screen announces loading, not each bone" (R-UI-004: loading uses skeletons that
   * keep layout, never spinners). The pulse's 1600 ms and its reduced-motion branch are authored
   * CSS, proven at the token source and by the visual baseline suite, never by jsdom timing.
   */
  test("AC-5: Skeleton renders on its contract testid, hidden from the accessibility tree", async () => {
    const mod = await loadBarrel();
    const container = mount(el(mod, "Skeleton", {}));
    const skeleton = within(container).getByTestId(TESTIDS.skeleton);

    expect(
      skeleton.getAttribute("aria-hidden"),
      "Design Decision §3: each bone is aria-hidden — the owning screen announces loading, not the placeholder",
    ).toBe("true");
    expect(
      skeleton.textContent?.trim(),
      "a placeholder that keeps layout announces nothing itself (R-UI-004)",
    ).toBe("");
  });
});

describe("AC-5: CoverageChip and UnitBadge render their values", () => {
  test("AC-5: CoverageChip's accessible text is the coverage it was given", async () => {
    const mod = await loadBarrel();
    const container = mount(el(mod, "CoverageChip", { value: COVERAGE_SAMPLE }));
    expect(within(container).getByTestId(TESTIDS.coverageChip).textContent?.trim()).toBe("82%");
  });

  test("AC-5: CoverageChip never rounds an incomplete coverage up to done (Design Decision §3)", async () => {
    const mod = await loadBarrel();
    const cases: [number, string][] = [
      [0, "0%"],
      [0.5, "50%"],
      [0.82, "82%"],
      [0.996, "99%"],
      [0.9999, "99%"],
      [1, "100%"],
      [1.5, "100%"],
      [-0.4, "0%"],
    ];
    for (const [value, shown] of cases) {
      const container = mount(el(mod, "CoverageChip", { value }));
      expect(
        within(container).getByTestId(TESTIDS.coverageChip).textContent?.trim(),
        `a precision instrument renders ${value} as ${shown} — it clamps to [0,1] and floors, and says 100% only when coverage is complete`,
      ).toBe(shown);
      cleanup();
    }
  });

  test("AC-5: UnitBadge shows the unit string it was given, verbatim", async () => {
    const mod = await loadBarrel();
    for (const unit of ["SQM", "CUM", "RFT"]) {
      const container = mount(el(mod, "UnitBadge", { unit }));
      expect(
        within(container).getByTestId(TESTIDS.unitBadge).textContent?.trim(),
        "UnitBadge carries the unit it is given — it invents and translates nothing",
      ).toBe(unit);
      cleanup();
    }
  });
});

describe("AC-5: axe on the composition, in both themes (Q-11)", () => {
  test("AC-5: zero serious/critical violations in the default theme", async () => {
    const mod = await loadBarrel();
    const container = mount(composition(mod));
    const violations = await seriousOrCritical(container, "AC-5");
    expect(violations.length, `Q-11: zero serious/critical\n${describeViolations(violations)}`).toBe(0);
  });

  test("AC-5: zero serious/critical violations under [data-theme=\"dark\"]", async () => {
    const mod = await loadBarrel();
    const container = mount(themed(composition(mod)));
    const violations = await seriousOrCritical(container, "AC-5");
    expect(violations.length, `Q-11: zero serious/critical under the dark theme\n${describeViolations(violations)}`).toBe(0);
  });

  /**
   * Q-11 gates every checkpoint, and an open tooltip is a state of this composition a keyboard user
   * arrives at — a run that only ever walks the closed tree audits a tree the user never sees. The
   * axe context is the document, so the content is judged whether it renders inline or in a portal.
   */
  for (const [theme, wrap] of [
    ["the default theme", (ui: ReactElement) => ui],
    ["[data-theme=\"dark\"]", themed],
  ] as [string, (ui: ReactElement) => ReactElement][]) {
    test(`AC-5: zero serious/critical violations with the Tooltip open, in ${theme}`, async () => {
      const mod = await loadBarrel();
      await openTooltipByKeyboard(wrap(composition(mod)), "AC-5");
      const violations = await seriousOrCritical(document.body, "AC-5");
      expect(
        violations.length,
        `Q-11: zero serious/critical with the tooltip open in ${theme}\n${describeViolations(violations)}`,
      ).toBe(0);
    });
  }
});
