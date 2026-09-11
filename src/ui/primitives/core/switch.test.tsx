// @vitest-environment jsdom
/**
 * Switch. A switch IS the act, where a checkbox states an intention a form will act on later — so
 * it announces as `role="switch"` and a reader hears which one they met (Q-11).
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { Switch } from "./switch";

function Harness({ initial = false }: { initial?: boolean }) {
  const [checked, setChecked] = useState(initial);
  return (
    <>
      <Switch checked={checked} onChange={setChecked} label="Snap" data-testid="sw" />
      <output data-testid="held">{String(checked)}</output>
    </>
  );
}

const control = (): HTMLElement => screen.getByTestId("sw");
const held = (): string => screen.getByTestId("held").textContent ?? "";

afterEach(cleanup);

describe("Switch", () => {
  test("it announces as a switch, states its position, and is named by its own label", () => {
    render(<Harness />);
    expect(control().getAttribute("role")).toBe("switch");
    expect(control().getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("switch", { name: "Snap" })).toBe(control());
  });

  test("a press throws it, and the position announced follows", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(control());
    expect(held()).toBe("true");
    expect(control().getAttribute("aria-checked")).toBe("true");
  });

  test("Space and Enter throw it too — it is a button, so the platform's keys are already right", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    control().focus();
    await user.keyboard(" ");
    expect(held()).toBe("true");
    await user.keyboard("{Enter}");
    expect(held()).toBe("false");
  });

  test("a disabled switch cannot be thrown", async () => {
    const user = userEvent.setup();
    render(<Switch checked={false} onChange={() => expect.unreachable("a disabled switch never reports a change")} label="Snap" data-testid="sw" disabled />);
    await user.click(control());
    expect(control().getAttribute("aria-checked")).toBe("false");
  });
});
