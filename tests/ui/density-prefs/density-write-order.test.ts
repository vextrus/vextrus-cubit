// @vitest-environment jsdom
/**
 * The write order of `DensityToggle` (R-UI-005, docs/design/density-and-prefs.md §1).
 *
 * Two rapid activations are two upserts of one row, and nothing promises they settle in the order
 * they were sent: fired in parallel, the store can end on the mode chosen first while the control
 * shows the mode chosen last. The control therefore queues its writes end to end, and this file
 * observes exactly that — the second write is not sent until the first has settled, and the modes
 * reach the action in the order they were chosen.
 *
 * Product modules are loaded by absolute path, as the acceptance suite next door loads them.
 */
import { createElement, type ReactElement } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { productModule } from "../../server/support/wire";

const SHELL_BARREL = "src/ui/shell/index.ts";
const OPTION_TESTID: Readonly<Record<string, string>> = {
  comfortable: "density-option-comfortable",
  compact: "density-option-compact",
};

afterEach(() => {
  cleanup();
});

/** A write whose settling this file decides, so the second activation lands while the first is open. */
interface Deferred {
  mode: string;
  settle: () => void;
}

test("two rapid activations reach the seam in the order they were chosen, one at a time", async () => {
  const barrel = await productModule<Record<string, unknown>>(SHELL_BARREL);
  const Toggle = barrel["DensityToggle"] as (props: { density: string; action: (next: string) => Promise<void> }) => ReactElement;

  const open: Deferred[] = [];
  const action = (next: string): Promise<void> =>
    new Promise<void>((resolve) => {
      open.push({ mode: next, settle: resolve });
    });

  const { container } = render(createElement(Toggle, { density: "comfortable", action }));
  const option = (mode: string): HTMLElement => container.querySelector(`[data-testid="${OPTION_TESTID[mode]}"]`) as HTMLElement;

  await act(async () => {
    fireEvent.click(option("compact"));
  });
  expect(open.map((write) => write.mode), "the first activation writes at once, as a single click always did").toStrictEqual(["compact"]);

  // The second choice arrives while the first write is still open.
  await act(async () => {
    fireEvent.click(option("comfortable"));
  });
  expect(
    open.map((write) => write.mode),
    "the second write must wait behind the first — two upserts of one row settle in no guaranteed order, so they are not sent in parallel",
  ).toStrictEqual(["compact"]);

  await act(async () => {
    open[0]?.settle();
  });
  expect(
    open.map((write) => write.mode),
    "once the first write has settled the queued one is sent, so the mode chosen last is the mode written last",
  ).toStrictEqual(["compact", "comfortable"]);

  await act(async () => {
    open[1]?.settle();
  });
  expect(option("comfortable").getAttribute("aria-checked"), "and the control still shows the mode chosen last").toBe("true");
});
