// @vitest-environment jsdom
/**
 * AC-5 — the composed slice: keyboard reach, the two value-bearing chips, and axe in both themes
 * (R-UI-012, Q-11).
 *
 * The composition is the Design Decision §4 sample, whose document order is also the Tab order the
 * Decision fixes. Q-11 is honoured literally: the travel begins on the keyboard from the document
 * body, the gate is serious/critical only, and nothing is asserted by counting painted nodes.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, within } from "@testing-library/react";
import {
  COPY,
  COVERAGE_SAMPLE,
  TESTIDS,
  describeViolations,
  keyboardUser,
  loadBarrel,
  seriousOrCritical,
  tabOrder,
} from "./support/primitives";
import { composition, el, mount, themed } from "./support/render";

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
});
