// @vitest-environment jsdom
/**
 * The frame's own slots (tool row, readout, crumb) are CLAIMS held by the screens that fill them,
 * not a value each screen writes in turn (src/ui/shell/slots.tsx).
 *
 * Hydration stands a screen twice for ~100 ms. While a slot was `set(value)` on mount and
 * `set(null)` on unmount, the first copy's leaving erased what the second had just put there: J-000's
 * m2 leg opened the register with no takeoff tabs row (session 7), and the craft look read "Register
 * crumb missing". The crumb shows why comparing values cannot help — both copies write the same
 * string — so each hook instance holds a claim of its own, and a cleanup withdraws only its own.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { useMemo } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { ShellSlotsProvider, useShellPage, useShellSlots, useShellStatus, useShellToolbar } from "@/ui/shell/slots";

afterEach(cleanup);

/** Where the frame draws what it was handed. */
function Frame() {
  const { toolbar, status, page } = useShellSlots();
  return (
    <>
      <div data-testid="frame-toolbar">{toolbar}</div>
      <div data-testid="frame-status">{status}</div>
      <div data-testid="frame-page">{page ?? ""}</div>
    </>
  );
}

/**
 * One copy of a screen: it claims all three slots for as long as it stands. Its nodes are MEMOISED,
 * as `TakeoffTabs` memoises its row — an unmemoised node re-runs its effect on every render and so
 * re-sets the slot by accident, which is how the defect hid for as long as it did.
 */
function Screen({ says }: { says: string }) {
  const tools = useMemo(() => <span>{`${says} tools`}</span>, [says]);
  const readout = useMemo(() => <span>{`${says} readout`}</span>, [says]);
  useShellToolbar(tools);
  useShellStatus(readout);
  useShellPage("Register");
  return null;
}

function Stage({ first, second, secondSays = "second" }: { first: boolean; second: boolean; secondSays?: string }) {
  return (
    <ShellSlotsProvider>
      <Frame />
      {first ? <Screen says="first" /> : null}
      {second ? <Screen says={secondSays} /> : null}
    </ShellSlotsProvider>
  );
}

const read = (id: string): string => screen.getByTestId(id).textContent ?? "";

describe("the frame's slots are claims, withdrawn only by their owner", () => {
  test("the transient copy's leaving does not empty what the live copy claimed (the hydration window)", () => {
    const view = render(<Stage first={true} second={false} />);
    expect(read("frame-toolbar")).toBe("first tools");
    view.rerender(<Stage first={true} second={true} />);
    expect(read("frame-toolbar"), "the latest claim still standing is what the frame shows").toBe("second tools");
    view.rerender(<Stage first={false} second={true} />);
    expect(read("frame-toolbar"), "the first copy's leaving withdraws its own claim and nobody else's").toBe("second tools");
    expect(read("frame-status")).toBe("second readout");
    expect(read("frame-page"), "the crumb stands although both copies wrote the same string").toBe("Register");
  });

  test("a claim that changes keeps its place, and the last copy's leaving empties the slot", () => {
    const view = render(<Stage first={true} second={true} />);
    view.rerender(<Stage first={true} second={true} secondSays="second, changed" />);
    expect(read("frame-toolbar"), "the changed claim is shown where it stood").toBe("second, changed tools");
    view.rerender(<Stage first={true} second={false} />);
    expect(read("frame-toolbar"), "the copy beneath stands again once the top one leaves").toBe("first tools");
    view.rerender(<Stage first={false} second={false} />);
    expect(read("frame-toolbar"), "nothing claims the row, so nothing is drawn (R-UI-080)").toBe("");
    expect(read("frame-page")).toBe("");
  });
});
