// @vitest-environment jsdom
/**
 * The rail's pin is a DISCLOSURE, and it says so in the one attribute ARIA gives a disclosure.
 *
 * The control names `aria-controls` (the rail body), so a reader is told it opens a region — and a
 * region that opens is `aria-expanded`, never `aria-pressed`: one widget, one state. The state the
 * attribute reports is the pin, which is the person's own answer (Direction §1: "expand to 220 on
 * hover-hold or pin; remembered"); the hover and focus peeks are transient and a control cannot
 * report `false` about a region its own focus is at that moment holding open.
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ShellRail } from "./shell-rail";
import type { ShellWorkspace } from "./routes";

const WORKSPACE: ShellWorkspace = { tenantId: "A", name: "Acme Holdings" };

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function toggle(container: HTMLElement): HTMLButtonElement {
  const node = container.querySelector<HTMLButtonElement>('[data-testid="shell-rail-collapse"]');
  if (node === null) throw new Error("the rail publishes no pin control");
  return node;
}

describe("the rail's pin states what it opens", () => {
  test("it is a disclosure: aria-expanded, aria-controls, and no aria-pressed", () => {
    const { container } = render(<ShellRail workspace={WORKSPACE} area="projects" atAreaHome />);
    const pin = toggle(container);
    expect(pin.getAttribute("aria-pressed"), "a disclosure does not also claim to be a toggle button").toBeNull();
    expect(pin.getAttribute("aria-expanded"), "the rail stands at 48 px until it is pinned (Direction §1)").toBe("false");
    const controls = pin.getAttribute("aria-controls");
    expect(controls, "the control names the region it opens").not.toBeNull();
    expect(container.querySelector(`#${CSS.escape(controls ?? "")}`), "…and that region is in the document").not.toBeNull();
  });

  test("pinning it publishes true, and un-pinning it publishes false again", () => {
    const { container } = render(<ShellRail workspace={WORKSPACE} area="projects" atAreaHome />);
    const pin = toggle(container);
    fireEvent.click(pin);
    expect(pin.getAttribute("aria-expanded"), "a pinned rail is the expanded one").toBe("true");
    fireEvent.click(pin);
    expect(pin.getAttribute("aria-expanded"), "and the answer is reversible").toBe("false");
  });

  test("the rail keeps its navigation at 48 px — a rail with nothing in it is not navigation", () => {
    const { container } = render(<ShellRail workspace={WORKSPACE} area="projects" atAreaHome />);
    expect(container.querySelector('[data-testid="shell-nav-projects"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="shell-rail"]')?.getAttribute("data-collapsed")).toBe("true");
  });
});
