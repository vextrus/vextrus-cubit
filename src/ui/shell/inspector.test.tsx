// @vitest-environment jsdom
/**
 * The inspector slot takes a screen's detail without re-rendering the screen that handed it. A screen
 * hands a fresh element on every render; when mounting read the slot's value, each landing re-rendered
 * the screen, which handed a fresh element again — a loop for as long as anything was selected, which
 * starved every transition behind it (J-021 SRCH-1: a palette find chosen from the viewer never
 * committed its navigation).
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { InspectorProvider, ShellInspectorSlot, useInspector } from "./inspector";

afterEach(() => {
  cleanup();
});

describe("useInspector", () => {
  test("a screen that hands a fresh detail each render renders a bounded number of times, and the slot shows its detail", async () => {
    const renders = { count: 0 };
    function Screen(): ReactNode {
      const [label, setLabel] = useState("C2");
      renders.count += 1;
      useInspector(
        <button type="button" onClick={() => setLabel("C3")}>
          {label}
        </button>,
      );
      return null;
    }
    render(
      <InspectorProvider>
        <Screen />
        <ShellInspectorSlot />
      </InspectorProvider>,
    );
    await act(async () => {
      await new Promise((settle) => setTimeout(settle, 50));
    });
    expect(screen.getByRole("button").textContent, "the slot renders the screen's detail").toBe("C2");
    expect(renders.count, "the screen rendered once for its mount (twice at most), never again for its own detail landing").toBeLessThanOrEqual(2);

    await act(async () => {
      screen.getByRole("button").click();
      await new Promise((settle) => setTimeout(settle, 50));
    });
    expect(screen.getByRole("button").textContent, "a change of the screen's own state reaches the slot").toBe("C3");
    expect(renders.count, "one more render for the change, and nothing after it").toBeLessThanOrEqual(3);
  });
});
