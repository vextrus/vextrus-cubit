// @vitest-environment jsdom
/**
 * The takeoff tabs row's right half is DRAWN IN PLACE by the surface standing in the lane, through a
 * portal into the row's own host — not handed over by an effect (session 5, the M3 leg's runs 8 and
 * 9): the register hydrates through a window in which two of it stand in the frame, and when the
 * slot was a value set on mount and nulled on unmount, the ordering emptied what the live mount had
 * set — a customer's second visit to the register had no Measure door. A portal has no ordering:
 * what a surface draws stands while the surface stands and is gone with it (R-UI-080: nothing is
 * drawn to state an absence).
 *
 * Proved through the frame's own toolbar slot, which is where the row is mounted (Direction §3.1).
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(cleanup);
import { ShellSlotsProvider, useShellSlots } from "@/ui/shell/slots";
import { TakeoffTabs, useTakeoffTabsAside } from "@/app/(app)/t/[tenant]/p/[project]/takeoff/nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/t/x/p/y/takeoff/register" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

/** Where the frame draws the toolbar it was handed. */
function Toolbar() {
  const { toolbar } = useShellSlots();
  return <div data-testid="frame-toolbar">{toolbar}</div>;
}

/** One surface's half of the row. */
function Surface({ says }: { says: string }) {
  return useTakeoffTabsAside(<span>{says}</span>);
}

/** Two surfaces standing at once, each of which can be taken down on its own. */
function Stage({ first, second }: { first: boolean; second: boolean }) {
  return (
    <ShellSlotsProvider>
      <Toolbar />
      <TakeoffTabs entries={[]}>
        {first ? <Surface says="first says Measure" /> : null}
        {second ? <Surface says="second says Measure" /> : null}
      </TakeoffTabs>
    </ShellSlotsProvider>
  );
}

function asideText(): string {
  return screen.getByTestId("frame-toolbar").textContent?.trim() ?? "";
}

describe("the takeoff tabs aside is a registry of live mounts", () => {
  test("a surface's contribution stands in the row, and leaving the surface empties it", () => {
    const view = render(<Stage first={true} second={false} />);
    expect(asideText()).toBe("first says Measure");
    view.rerender(<Stage first={false} second={false} />);
    expect(asideText(), "leaving the surface empties the slot — nothing is drawn to state an absence").toBe("");
  });

  test("the transient mount's leaving does not empty what the live mount drew (the register's hydration window)", () => {
    const view = render(<Stage first={true} second={true} />);
    expect(asideText(), "every standing surface draws its own half in place").toContain("second says Measure");
    view.rerender(<Stage first={false} second={true} />);
    expect(asideText(), "the first mount took only what it drew away").toBe("second says Measure");
  });

  test("when the newest leaves, the one still standing is what shows", () => {
    const view = render(<Stage first={true} second={true} />);
    view.rerender(<Stage first={true} second={false} />);
    expect(asideText()).toBe("first says Measure");
  });

  test("a contribution that changes its node is replaced in place, never doubled", () => {
    function Changing() {
      const [n, setN] = useState(1);
      const drawn = useTakeoffTabsAside(<button type="button" onClick={() => setN((held) => held + 1)}>{`press ${n}`}</button>);
      return (
        <>
          {drawn}
          <button type="button" data-testid="bump" onClick={() => setN((held) => held + 1)}>bump</button>
        </>
      );
    }
    render(
      <ShellSlotsProvider>
        <Toolbar />
        <TakeoffTabs entries={[]}>
          <Changing />
        </TakeoffTabs>
      </ShellSlotsProvider>,
    );
    expect(asideText()).toBe("press 1");
    act(() => screen.getByTestId("bump").click());
    expect(asideText()).toBe("press 2");
  });
});
