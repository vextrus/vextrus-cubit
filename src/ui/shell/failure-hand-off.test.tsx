// @vitest-environment jsdom
/**
 * A failed action reaches the error boundary whatever it rejected with (ARCH-03, B-21). A rejection
 * whose value is nullish is still a failure: the hand-off holds the cause boxed, so "nothing was
 * thrown" and "null was thrown" are different answers and only the first one is silence.
 */
import { Component, useEffect } from "react";
import type { ReactNode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useFailureHandOff } from "./failure-hand-off";

/** The value a rejection carries when it carries none — the case the box exists for. */
const NOTHING: unknown = null;

class Boundary extends Component<{ onFailure: (cause: unknown) => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(cause: unknown): void {
    this.props.onFailure(cause);
  }

  override render(): ReactNode {
    return this.state.failed ? <p data-testid="boundary-reached">caught</p> : this.props.children;
  }
}

function Acting({ work }: { work: () => Promise<void> }) {
  const handing = useFailureHandOff();
  useEffect(() => {
    void handing(work);
  }, [handing, work]);
  return <p data-testid="acting">ready</p>;
}

async function actOn(work: () => Promise<void>): Promise<unknown[]> {
  const caught: unknown[] = [];
  await act(async () => {
    render(
      <Boundary onFailure={(cause) => caught.push(cause)}>
        <Acting work={work} />
      </Boundary>,
    );
  });
  return caught;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useFailureHandOff", () => {
  test("hands a rejected action to the boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = new Error("the door was shut");
    const caught = await actOn(async () => {
      throw cause;
    });
    expect(screen.getByTestId("boundary-reached")).toBeDefined();
    expect(caught).toEqual([cause]);
  });

  test("hands a rejection whose value is null to the boundary too", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // A transport may reject with any value at all; the discipline under test is that a nullish
    // one is not read as "nothing failed", so the rejection is made the way one really arrives.
    const caught = await actOn(async () => await Promise.reject(NOTHING));
    expect(screen.getByTestId("boundary-reached")).toBeDefined();
    expect(caught).toEqual([null]);
  });

  test("an action that keeps its promise leaves the screen standing", async () => {
    const caught = await actOn(async () => {});
    expect(screen.getByTestId("acting")).toBeDefined();
    expect(caught).toEqual([]);
  });
});
