// @vitest-environment jsdom
/**
 * IdChip (R-UI-082): the short form on screen, the whole value in the DOM and in the tooltip, and
 * one press to the clipboard. A digest is never abbreviated in the DATA — only in the rendering.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { IdChip, shortForm } from "./id-chip";
import { strings } from "../../strings";

const DIGEST = "a3f9c2b1d0e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("IdChip", () => {
  test("the whole value is in the DOM; what is painted is the short form", () => {
    render(<IdChip value={DIGEST} />);
    const chip = screen.getByTestId("id-chip");
    expect(chip.getAttribute("data-value")).toBe(DIGEST);
    expect(within(chip).getByText(shortForm(DIGEST)).textContent).toBe(DIGEST.slice(0, 7));
  });

  test("a value already short is not shortened, and a caller's own short form is honoured", () => {
    expect(shortForm("S-101")).toBe("S-101");
    render(<IdChip value={DIGEST} short="rev a3f9c2" />);
    expect(screen.getByText("rev a3f9c2")).toBeTruthy();
  });

  test("the tooltip carries the whole value, so nobody has to copy it to read it", async () => {
    const user = userEvent.setup();
    render(<IdChip value={DIGEST} />);
    await user.hover(screen.getByText(shortForm(DIGEST)));
    const hints = await screen.findAllByTestId("tooltip-content");
    expect(hints.some((hint) => hint.textContent === DIGEST)).toBe(true);
  });

  test("the copy button copies the whole value and then says it has", async () => {
    const user = userEvent.setup();
    // After `setup()`, not before: user-event installs a clipboard of its own on the navigator it
    // finds, so a stub written first is the one that gets replaced.
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<IdChip value={DIGEST} />);

    await user.click(screen.getByTestId("id-chip-copy"));
    expect(writeText).toHaveBeenCalledWith(DIGEST);
    await waitFor(() => expect(screen.getByTestId("id-chip").getAttribute("data-copied")).toBe("true"));
    expect(screen.getByRole("button", { name: strings.primitive_id_chip_copied }), "the button says what just happened").toBeTruthy();
  });

  test("a context with no clipboard is not a fault: the chip simply never claims to have copied", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("navigator", {});
    render(<IdChip value={DIGEST} />);
    await user.click(screen.getByTestId("id-chip-copy"));
    expect(screen.getByTestId("id-chip").hasAttribute("data-copied")).toBe(false);
  });
});
