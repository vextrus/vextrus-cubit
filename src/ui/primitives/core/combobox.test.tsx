// @vitest-environment jsdom
/**
 * Combobox — the filterable Select, and the filter chip of Design Direction 00 §3.2
 * (`Class · All ▾`). What is graded: the filter narrows the list, the keyboard still reaches it
 * while a query is being typed, the chip reads as one control rather than a labelled row, and
 * nothing native is rendered.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { Combobox, type ComboboxOption } from "./combobox";
import { strings } from "../../strings";

const OPTIONS: readonly ComboboxOption[] = [
  { value: "", label: "All" },
  { value: "STRUCTURAL", label: "Structural" },
  { value: "ARCHITECTURAL", label: "Architectural" },
  { value: "MEP", label: "MEP" },
];

function Harness({ variant = "field", initial = "" }: { variant?: "field" | "chip"; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Combobox options={OPTIONS} value={value} onChange={setValue} label="Class" variant={variant} data-testid="cb" />
      <output data-testid="committed">{value}</output>
    </>
  );
}

const trigger = (): HTMLElement => screen.getByTestId("cb");
const filter = (): HTMLElement => screen.getByTestId("cb-filter");
const committed = (): string => screen.getByTestId("committed").textContent ?? "";

afterEach(cleanup);

describe("Combobox", () => {
  test("nothing native is rendered, and the trigger owns the popup", () => {
    const { container } = render(<Harness />);
    expect(container.querySelector("select")).toBeNull();
    expect(trigger().getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  test("the chip variant reads `Label · Value` in one control, not a labelled dropdown row (§3.2)", () => {
    render(<Harness variant="chip" initial="MEP" />);
    const reads = (trigger().textContent ?? "").replace(/\s+/g, " ").trim();
    expect(reads).toContain("Class");
    expect(reads).toContain(strings.primitive_combobox_chip_separator);
    expect(reads).toContain("MEP");
    expect(trigger().className, "the chip skin is the Chip primitive's own face").toContain("cx-chip");
    expect(trigger().getAttribute("aria-label"), "a chip still says what it is for").toBe("Class MEP");
  });

  test("opening puts the reader in the filter field, and typing narrows the list", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    expect(document.activeElement, "the field is what a reader has come to type into").toBe(filter());

    await user.keyboard("arch");
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Architectural"]);
  });

  test("a query that matches nothing says so, rather than showing an empty box", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    await user.keyboard("zzz");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByTestId("cb-none").textContent).toBe(strings.primitive_combobox_no_matches);
  });

  test("the keyboard reaches the list while the query is being written: ↓ moves the cursor, Enter takes it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    await user.keyboard("r");
    await user.keyboard("{ArrowDown}");
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(filter().getAttribute("aria-activedescendant"), "the cursor travels as activedescendant — focus stays in the field").toBe(options[0]?.id);

    await user.keyboard("{Enter}");
    expect(committed()).toBe("STRUCTURAL");
    expect(screen.queryByRole("listbox"), "taking an option closes the popover").toBeNull();
  });

  test("Escape closes without committing, and the next opening starts from an empty query", async () => {
    const user = userEvent.setup();
    render(<Harness initial="MEP" />);
    await user.click(trigger());
    await user.keyboard("struct{Escape}");
    expect(committed()).toBe("MEP");

    await user.click(trigger());
    expect((filter() as HTMLInputElement).value).toBe("");
    expect(within(screen.getByRole("listbox")).getAllByRole("option").length).toBe(OPTIONS.length);
  });

  test("clicking an option commits it and says which one is selected", async () => {
    const user = userEvent.setup();
    render(<Harness initial="MEP" />);
    await user.click(trigger());
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("MEP").getAttribute("aria-selected")).toBe("true");
    await user.click(within(listbox).getByText("Architectural"));
    expect(committed()).toBe("ARCHITECTURAL");
  });
});
