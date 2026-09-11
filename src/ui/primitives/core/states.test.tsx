// @vitest-environment jsdom
/**
 * EmptyState and ErrorState (Design Direction 00 §1's table, §3.2, R-UI-050).
 *
 * The discipline is the acceptance: one glyph, one sentence, one action — no illustration, no
 * paragraph, no second primary. And the fault's own obligation: a way to try again and the id to
 * quote when it does not work, carried through IdChip so it is whole in the DOM and one press from
 * the clipboard (R-UI-082).
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { strings } from "../../strings";

const HEADING = "No objects registered";
const ACTION = "Measure this campaign";
const FAULT = "fault-9c21b0d4e6";

afterEach(cleanup);

describe("EmptyState", () => {
  test("one glyph, one sentence, one action — and the glyph says nothing to a screen reader", () => {
    const { container } = render(
      <EmptyState heading={HEADING}>
        <Button variant="secondary">{ACTION}</Button>
      </EmptyState>,
    );
    const state = screen.getByTestId("empty-state");
    expect(within(state).getByRole("heading").textContent).toBe(HEADING);
    expect(container.querySelectorAll("svg").length, "one glyph, never an illustration").toBe(1);
    expect(container.querySelector(".cx-empty-state-glyph")?.getAttribute("aria-hidden")).toBe("true");
    expect(within(state).getAllByRole("button").length, "one action, never a row of them").toBe(1);
    expect(within(state).getByRole("button").textContent).toBe(ACTION);
  });

  test("an empty region may be silent: with no action it still says what is not there", () => {
    render(<EmptyState heading={HEADING} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("heading").textContent).toBe(HEADING);
  });

  test("the glyph is the consumer's where its own screen has one", () => {
    render(<EmptyState heading={HEADING} glyph={<svg data-testid="own-glyph" />} />);
    expect(screen.getByTestId("own-glyph")).toBeTruthy();
  });
});

describe("ErrorState", () => {
  test("it announces itself, offers the retry, and renders the report id through IdChip", () => {
    render(<ErrorState heading="The register could not be read" reportId={FAULT} onRetry={() => undefined} />);
    const state = screen.getByTestId("error-state-panel");
    expect(state.getAttribute("role"), "a fault that appears where a reader is not looking must announce").toBe("alert");
    expect(within(state).getByTestId("error-state-retry").textContent).toBe(strings.primitive_error_retry);

    const chip = within(state).getByTestId("error-state-report");
    expect(chip.getAttribute("data-value"), "the id is whole in the DOM — an id is never abbreviated in the data").toBe(FAULT);
    expect(within(chip).getByText(FAULT.slice(0, 7)), "…and short on screen").toBeTruthy();
    expect(state.textContent).not.toContain(`${FAULT}${FAULT}`);
  });

  test("the retry is the consumer's own move", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState heading="Failed" onRetry={onRetry} />);
    await user.click(screen.getByTestId("error-state-retry"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test("a fault with nothing to retry and nothing to quote still renders as one sentence under one glyph", () => {
    const { container } = render(<ErrorState heading="Failed" />);
    expect(screen.queryByTestId("error-state-retry")).toBeNull();
    expect(screen.queryByTestId("error-state-report")).toBeNull();
    expect(container.querySelectorAll("svg").length).toBe(1);
  });
});
