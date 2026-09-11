// @vitest-environment jsdom
/**
 * Checkbox. The drawing is ours; the CONTROL is the platform's, and that is the whole claim: the
 * input is still in the tab order, still toggled by Space, still named by its label, and still what
 * a form serialises — it is merely invisible in place, with the box beside it doing the painting.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { Checkbox } from "./checkbox";

function Harness({ initial = false }: { initial?: boolean }) {
  const [checked, setChecked] = useState(initial);
  return (
    <>
      <Checkbox checked={checked} onChange={setChecked} label="Show refused lines" data-testid="cb" name="refused" />
      <output data-testid="held">{String(checked)}</output>
    </>
  );
}

const box = (): HTMLInputElement => screen.getByTestId("cb") as HTMLInputElement;
const held = (): string => screen.getByTestId("held").textContent ?? "";

afterEach(cleanup);

describe("Checkbox", () => {
  test("the control is a real checkbox input, named by its label and serialised by its name", () => {
    render(<Harness />);
    expect(box().tagName).toBe("INPUT");
    expect(box().getAttribute("type")).toBe("checkbox");
    expect(box().getAttribute("name")).toBe("refused");
    expect(screen.getByLabelText("Show refused lines"), "the label points at the input, so clicking the words toggles it").toBe(box());
  });

  test("it is invisible in place, never removed: `display: none` would take it out of the tab order", () => {
    render(<Harness />);
    expect(box().className).toContain("cx-checkbox-input");
    expect(box().hasAttribute("hidden")).toBe(false);
    expect(box().getAttribute("tabindex"), "nothing overrides the platform's own tab order").toBeNull();
  });

  test("Space toggles it, as the platform's own checkbox does", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    box().focus();
    await user.keyboard(" ");
    expect(held()).toBe("true");
    await user.keyboard(" ");
    expect(held()).toBe("false");
  });

  test("clicking the label toggles it too, and the painted box follows the state", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByText("Show refused lines"));
    expect(held()).toBe("true");
    expect(container.querySelector(".cx-checkbox")?.getAttribute("data-checked")).toBe("true");
    expect(container.querySelector(".cx-checkbox-mark"), "the tick is the vendored check glyph").not.toBeNull();
  });
});
