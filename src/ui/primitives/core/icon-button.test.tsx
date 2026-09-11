// @vitest-environment jsdom
/**
 * IconButton (Design Direction 00 §1, §3.1: "Every button: 28 px, icon 16, tooltip 'Fit to sheet F'").
 * A glyph names nothing on its own, so what is graded is that the label is the ACCESSIBLE name and
 * the tooltip both, that the key is a keycap rather than prose inside the label, and that a tool
 * with a mode is a real toggle.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { IconButton } from "./icon-button";
import { IconFit } from "../../icons";

afterEach(cleanup);

describe("IconButton", () => {
  test("the label names the control, and the glyph itself says nothing to a screen reader", () => {
    const { container } = render(<IconButton icon={<IconFit />} label="Fit to sheet" kbd="F" data-testid="fit" />);
    const button = screen.getByRole("button", { name: "Fit to sheet" });
    expect(button.getAttribute("data-testid")).toBe("fit");
    const glyph = container.querySelector("svg");
    expect(glyph?.getAttribute("aria-hidden"), "the label already said it — the glyph repeating it is noise").toBe("true");
    expect(glyph?.getAttribute("data-icon")).toBe("fit");
  });

  test("the hint carries the label and the key, and the key is a keycap", async () => {
    const user = userEvent.setup();
    render(<IconButton icon={<IconFit />} label="Fit to sheet" kbd="F" />);
    await user.hover(screen.getByRole("button", { name: "Fit to sheet" }));
    const hint = await screen.findAllByTestId("tooltip-content");
    const text = (hint[0]?.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(text).toContain("Fit to sheet");
    expect(hint[0]?.querySelector("kbd")?.textContent, "a shortcut is a key, not a word inside the label").toBe("F");
  });

  test("a tool with a mode is a toggle that says whether it is on", () => {
    render(<IconButton icon={<IconFit />} label="Ortho" pressed={true} data-testid="ortho" />);
    expect(screen.getByTestId("ortho").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("ortho").getAttribute("data-pressed")).toBe("true");
  });

  test("a plain tool is not a toggle at all — nothing claims a pressed state it does not have", () => {
    render(<IconButton icon={<IconFit />} label="Fit to sheet" data-testid="fit" />);
    expect(screen.getByTestId("fit").hasAttribute("aria-pressed")).toBe(false);
  });

  test("it presses", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton icon={<IconFit />} label="Zoom in" onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
