// @vitest-environment jsdom
/**
 * NumberInput (Design Direction 00 §5 item 5). The two things a `type="number"` field costs are
 * what is graded here: the spinner chrome is gone, and what a person typed is never silently
 * rewritten — the value is a string, carried verbatim, and only ↑ ↓ and the bounds move it.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { NumberInput, clampValue, stepValue } from "./number-input";

function Harness({ initial = "", ...rest }: { initial?: string; step?: number; min?: number; max?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumberInput value={value} onChange={setValue} aria-label="Distance" data-testid="num" {...rest} />
      <output data-testid="held">{value}</output>
    </>
  );
}

const field = (): HTMLInputElement => screen.getByTestId("num") as HTMLInputElement;
const held = (): string => screen.getByTestId("held").textContent ?? "";

afterEach(cleanup);

describe("NumberInput", () => {
  test("it is not a native number field, so no spinner is painted and nothing is parsed away", () => {
    render(<Harness initial="12.345" />);
    expect(field().getAttribute("type"), "type=number brings the platform's spinner buttons and its rounding").toBe("text");
    expect(field().getAttribute("inputmode"), "a decimal keypad is still what a phone should offer").toBe("decimal");
    expect(field().getAttribute("role"), "it still announces as the spinbutton it behaves like").toBe("spinbutton");
    expect(field().value).toBe("12.345");
    expect(field().className).toContain("cx-number-input");
  });

  test("what a person types is what the consumer receives — including a part-written figure", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "0.");
    expect(held(), "a native number field drops a trailing point and the reader's keystroke vanishes").toBe("0.");
  });

  test("↑ and ↓ step by the stated step and clamp at the bounds", async () => {
    const user = userEvent.setup();
    render(<Harness initial="1" step={0.5} min={0} max={2} />);
    field().focus();
    await user.keyboard("{ArrowUp}");
    expect(held()).toBe("1.5");
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(held(), "the maximum is a wall, not a suggestion").toBe("2.0");
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(held()).toBe("0.0");
  });

  test("leaving the field settles a figure outside the bounds, and leaves text that is no figure alone", async () => {
    const user = userEvent.setup();
    render(<Harness initial="" min={0} max={10} />);
    await user.type(field(), "42");
    await user.tab();
    expect(held()).toBe("10");
  });

  test("the step and clamp rules are pure, so the surface is graded on wiring and not on arithmetic", () => {
    expect(stepValue("", 1, 1)).toBe("1");
    expect(stepValue("not a figure", 1, 1), "a step from nothing starts at zero").toBe("1");
    expect(stepValue("2.50", -1, 0.25, 0), "the written precision follows the step").toBe("2.25");
    expect(clampValue("5", 0, 4)).toBe("4");
    expect(clampValue("3", 0, 4), "a figure already inside the bounds is not rewritten").toBe("3");
    expect(clampValue("1.500", 0, 4), "…not even to a tidier spelling of itself").toBe("1.500");
    expect(clampValue("abc", 0, 4)).toBe("abc");
  });
});
