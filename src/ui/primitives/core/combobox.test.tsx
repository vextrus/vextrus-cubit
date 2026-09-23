// @vitest-environment jsdom
/**
 * Combobox — the filterable Select, and the filter chip of Design Direction 00 §3.2
 * (`Class · All ▾`). What is graded: the filter narrows the list, the keyboard still reaches it
 * while a query is being typed, the chip reads as one control rather than a labelled row, and
 * nothing native is rendered — and (s-takeoff I-443) that a list closed by the reader's own
 * hand leaves them on the control, that Tab and a press elsewhere close it, and that the cursor the
 * arrows move is kept in the list's view.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Combobox, type ComboboxOption } from "./combobox";
import { strings } from "../../strings";

const OPTIONS: readonly ComboboxOption[] = [
  { value: "", label: "All" },
  { value: "STRUCTURAL", label: "Structural" },
  { value: "ARCHITECTURAL", label: "Architectural" },
  { value: "MEP", label: "MEP" },
];

/** Twelve levels: more than the nine rows the list shows before it scrolls (`--row-h` × 9). */
const LEVELS: readonly ComboboxOption[] = [
  { value: "", label: "Any level" },
  ...["FDN", "GF", "1F", "2F", "3F", "4F", "5F", "6F", "7F", "8F", "ROOF"].map((level) => ({ value: level, label: level })),
];

function Harness({ variant = "field", initial = "", options = OPTIONS }: { variant?: "field" | "chip"; initial?: string; options?: readonly ComboboxOption[] }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <button type="button" data-testid="before">
        before
      </button>
      <Combobox options={options} value={value} onChange={setValue} label="Class" variant={variant} data-testid="cb" />
      <button type="button" data-testid="after">
        after
      </button>
      <output data-testid="committed">{value}</output>
    </>
  );
}

const trigger = (): HTMLElement => screen.getByTestId("cb");
const filter = (): HTMLElement => screen.getByTestId("cb-filter");
const committed = (): string => screen.getByTestId("committed").textContent ?? "";

/**
 * jsdom lays nothing out and ships no `scrollIntoView`; the browser does. The stand-in records what
 * was asked into view, which is the half of "the cursor stays in view" a DOM without layout can hold.
 */
let askedIntoView: { id: string; options: ScrollIntoViewOptions | boolean | undefined }[] = [];
const shipped = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");

beforeEach(() => {
  askedIntoView = [];
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: function scrollIntoView(this: Element, options?: ScrollIntoViewOptions | boolean): void {
      askedIntoView.push({ id: this.id, options });
    },
  });
});

afterEach(() => {
  cleanup();
  if (shipped === undefined) delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  else Object.defineProperty(Element.prototype, "scrollIntoView", shipped);
});

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

describe("Combobox — the reader's place, after the list goes (s-takeoff I-443)", () => {
  test("an option taken with the pointer leaves the reader on the chip it was opened from, not at the top of the page", async () => {
    const user = userEvent.setup();
    render(<Harness variant="chip" />);
    await user.click(trigger());
    await user.click(within(screen.getByRole("listbox")).getByText("MEP"));
    expect(committed()).toBe("MEP");
    expect(screen.queryByRole("listbox"), "taking an option closes the popover").toBeNull();
    expect(document.activeElement, "and focus stands on the chip, where the reader's next Tab starts from").toBe(trigger());
  });

  test("an option taken with Enter, and a list left with Esc, both hand focus back to the chip", async () => {
    const user = userEvent.setup();
    render(<Harness variant="chip" />);
    await user.click(trigger());
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(committed()).toBe("STRUCTURAL");
    expect(document.activeElement, "Enter took the option and left the reader on the chip").toBe(trigger());

    await user.keyboard("{Enter}");
    expect(document.activeElement, "the chip opens again from the keyboard alone, into its field").toBe(filter());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox"), "Esc closes it").toBeNull();
    expect(committed(), "without committing").toBe("STRUCTURAL");
    expect(document.activeElement, "and the reader is back on the chip").toBe(trigger());
  });

  test("Tab closes the list and moves on to the next stop; Shift+Tab closes it onto the chip itself", async () => {
    const user = userEvent.setup();
    render(<Harness variant="chip" />);
    await user.click(trigger());
    expect(screen.getByRole("listbox").getAttribute("tabindex"), "the list is never a stop of its own — a browser makes a scrolling box one").toBe("-1");
    await user.tab();
    expect(screen.queryByRole("listbox"), "no list is left standing over the page behind the reader").toBeNull();
    expect(trigger().getAttribute("aria-expanded"), "and the chip says so").toBe("false");
    expect(document.activeElement, "focus went on to the stop after the control").toBe(screen.getByTestId("after"));

    await user.click(trigger());
    await user.tab({ shift: true });
    expect(screen.queryByRole("listbox"), "Shift+Tab closes it too").toBeNull();
    expect(document.activeElement, "onto the chip, the stop before the field").toBe(trigger());
  });

  test("a press anywhere else closes the list as Esc does, so the next opening starts from an empty query", async () => {
    const user = userEvent.setup();
    render(<Harness variant="chip" />);
    await user.click(trigger());
    await user.keyboard("arch");
    expect(within(screen.getByRole("listbox")).getAllByRole("option").length, "the query narrowed the list").toBe(1);

    await user.click(screen.getByTestId("before"));
    expect(screen.queryByRole("listbox"), "the press elsewhere closed it").toBeNull();
    expect(committed(), "and chose nothing").toBe("");

    await user.click(trigger());
    expect((filter() as HTMLInputElement).value, "the field opens empty").toBe("");
    expect(within(screen.getByRole("listbox")).getAllByRole("option").length, "and the list whole").toBe(OPTIONS.length);
  });

  test("a press inside the popover but on no option leaves the list open and the reader in the field", async () => {
    const user = userEvent.setup();
    render(<Harness variant="chip" />);
    await user.click(trigger());
    await user.keyboard("zzz");
    await user.click(screen.getByTestId("cb-none"));
    expect(screen.getByTestId("cb-none"), "the no-matches line was pressed, and the popover stands").toBeTruthy();
    expect(document.activeElement, "focus stayed in the field, so the reader can mend the query").toBe(filter());

    await user.keyboard("{Backspace>3/}");
    const popover = filter().parentElement as HTMLElement;
    await user.click(popover);
    expect(screen.getByRole("listbox"), "a press on the popover's own padding closes nothing").toBeTruthy();
    expect(document.activeElement).toBe(filter());
    await user.click(within(screen.getByRole("listbox")).getByText("MEP"));
    expect(committed(), "and an option pressed after it is still taken").toBe("MEP");
  });

  test("the cursor the arrows move is asked into the list's view — the tenth option of a nine-row list is never taken unseen", async () => {
    const user = userEvent.setup();
    render(<Harness variant="chip" options={LEVELS} />);
    await user.click(trigger());
    await user.keyboard("{ArrowDown>10/}");
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    const tenth = options[9] as HTMLElement;
    expect(filter().getAttribute("aria-activedescendant"), "ten presses stand the cursor on the tenth option").toBe(tenth.id);
    expect(askedIntoView.at(-1), "and that option was the last one asked into view, at the nearest edge").toEqual({ id: tenth.id, options: { block: "nearest" } });

    await user.keyboard("{Enter}");
    expect(committed(), "Enter takes the option the reader can see").toBe(tenth.getAttribute("data-value"));
  });
});
