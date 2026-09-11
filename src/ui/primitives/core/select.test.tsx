// @vitest-environment jsdom
/**
 * Select (Design Direction 00 §1: the native select element is refused). What is graded is the
 * exchange the native control used to make for free: the platform's keyboard, its selected
 * reading, and its promise that a reader who does not commit changes nothing — with the chrome gone.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { Select, type SelectOption } from "./select";

const OPTIONS: readonly SelectOption[] = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie", disabled: true },
  { value: "d", label: "Delta" },
];

const LABEL = "Unit";

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Select options={OPTIONS} value={value} onChange={setValue} aria-label={LABEL} data-testid="sel" name="unit" />
      <output data-testid="committed">{value}</output>
    </>
  );
}

const trigger = (): HTMLElement => screen.getByTestId("sel");
const committed = (): string => screen.getByTestId("committed").textContent ?? "";
const activeOption = (): string | null => trigger().getAttribute("aria-activedescendant");

afterEach(cleanup);

describe("Select", () => {
  test("there is no native select anywhere in what it renders — the control is a combobox button over a listbox", () => {
    const { container } = render(<Harness />);
    expect(container.querySelector("select"), "a native select element paints the platform's chrome, which §1 refuses").toBeNull();
    expect(container.querySelector("option"), "and it brings the platform's options with it").toBeNull();
    expect(trigger().getAttribute("role")).toBe("combobox");
    expect(trigger().getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(trigger().tagName).toBe("BUTTON");
  });

  test("a form still gets the value: the chosen value rides a hidden input under the control's name", () => {
    const { container } = render(<Harness initial="d" />);
    const carried = container.querySelector('input[type="hidden"][name="unit"]') as HTMLInputElement | null;
    expect(carried, "a control inside a form must serialise").not.toBeNull();
    expect(carried?.value).toBe("d");
  });

  test("with no value chosen the control shows its placeholder rather than a blank box", () => {
    render(<Harness />);
    expect(trigger().getAttribute("data-placeholder")).toBe("true");
    expect(trigger().textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  test("opening lists every option, says which one is selected, and puts the cursor on it", async () => {
    const user = userEvent.setup();
    render(<Harness initial="d" />);
    await user.click(trigger());

    const listbox = screen.getByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    expect(options.length, "a disabled option is shown — it is an answer, not an absence").toBe(OPTIONS.length);
    expect(options[3]?.getAttribute("aria-selected")).toBe("true");
    expect(options[2]?.getAttribute("aria-disabled")).toBe("true");
    expect(activeOption(), "the cursor opens on what is already chosen").toBe(options[3]?.id);
    expect(trigger().getAttribute("aria-controls")).toBe(listbox.id);
  });

  test("the keyboard is the platform's: ↓ ↑ skip the disabled option, Home and End reach the ends", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    trigger().focus();

    await user.keyboard("{ArrowDown}");
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(activeOption(), "↓ opens the list on its first choosable option").toBe(options[0]?.id);

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(activeOption(), "Charlie is disabled, so the second ↓ lands on Delta").toBe(options[3]?.id);

    await user.keyboard("{Home}");
    expect(activeOption()).toBe(options[0]?.id);
    await user.keyboard("{End}");
    expect(activeOption()).toBe(options[3]?.id);
  });

  test("Enter takes the option under the cursor, and the list closes with the value committed", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    trigger().focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(committed()).toBe("b");
    expect(screen.queryByRole("listbox"), "a taken option closes the list").toBeNull();
    expect(trigger().textContent).toContain("Bravo");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  test("Escape leaves the value exactly as it was — not committing is a decision the control honours", async () => {
    const user = userEvent.setup();
    render(<Harness initial="a" />);
    trigger().focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(committed(), "the cursor moved; the value did not").toBe("a");
  });

  test("with the list open, typing moves the cursor to what starts with what was typed", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    trigger().focus();

    await user.keyboard("{ArrowDown}");
    await user.keyboard("d");
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(activeOption()).toBe(options[3]?.id);
    expect(committed(), "moving the cursor is not choosing").toBe("");
  });

  test("with the list closed, typing commits the option it names — as a native select does", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    trigger().focus();
    await user.keyboard("b");
    expect(committed()).toBe("b");
    expect(screen.queryByRole("listbox"), "the list never opened: the letter was the whole interaction").toBeNull();
  });

  test("keystrokes inside the type-ahead window make one word, so a second letter refines rather than jumps", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    trigger().focus();
    await user.keyboard("br");
    expect(committed(), "b then r reads as \"br\" — Bravo, not a jump to whatever starts with r").toBe("b");
  });

  test("a disabled option cannot be taken by pointer either", async () => {
    const user = userEvent.setup();
    render(<Harness initial="a" />);
    await user.click(trigger());
    await user.click(within(screen.getByRole("listbox")).getByText("Charlie"));
    expect(committed()).toBe("a");
  });

  test("clicking an option takes it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    await user.click(within(screen.getByRole("listbox")).getByText("Delta"));
    expect(committed()).toBe("d");
  });

  test("a disabled control does not open", async () => {
    const user = userEvent.setup();
    render(<Select options={OPTIONS} value="a" onChange={() => undefined} aria-label={LABEL} data-testid="sel" disabled />);
    await user.click(trigger());
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
