// @vitest-environment jsdom
/**
 * AC-1(c): the catalogue mounts its refusal samples through the one sample module — observed by
 * rendering the gallery's own entries and reading what a journey and an operator read, the
 * `data-code` and `data-surface` the renderer publishes (R-UI-020's contract testids).
 *
 * Nothing here re-compares the register's sentences: AC-1(a)'s suite is the one drift guard
 * (B-17), and a second comparison would be the copy ARCH-02 refuses. What this proves is the
 * wiring — that the state the gallery renders at a severity is the sample the module names for it.
 */
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { productModule } from "./support/sources";

const REFUSAL_ENTRY_KEY = "patterns/refusal-state/RefusalState";
const DENIED_ENTRY_KEY = "shell/ShellDenied";

interface GalleryState {
  readonly name: string;
  readonly render: () => ReactNode;
}

interface Gallery {
  readonly galleryEntries: Readonly<Record<string, { readonly states: readonly GalleryState[] } | undefined>>;
}

interface SampleRefusals {
  readonly SAMPLE_REFUSALS: Readonly<Record<string, unknown>>;
  readonly SAMPLE_REFUSAL_BY_SEVERITY: Readonly<Record<string, string>>;
}

const gallery = (): Promise<Gallery> => productModule<Gallery>("src/ui/gallery-derivation/index.ts", "the gallery catalogue is what /design renders");

const samples = (): Promise<SampleRefusals> =>
  productModule<SampleRefusals>("src/ui/gallery-derivation/sample-refusals.ts", "AC-1(c) reads the sample the catalogue must mount from it");

/** The one refusal cell a sample renders, and the attributes it publishes. */
function refusalCellOf(state: GalleryState): HTMLElement {
  const { container } = render(<>{state.render()}</>);
  const cells = container.querySelectorAll<HTMLElement>('[data-testid="refusal-state"]');
  expect(cells.length, `the ${state.name} sample renders exactly one refusal`).toBe(1);
  return cells[0] as HTMLElement;
}

afterEach(() => {
  cleanup();
});

describe("AC-1c: the gallery's refusal cells are mounted from the sample module", () => {
  test("AC-1c: every RefusalState state renders the sample its severity names, on its own surface", async () => {
    const { galleryEntries } = await gallery();
    const { SAMPLE_REFUSAL_BY_SEVERITY } = await samples();
    const entry = galleryEntries[REFUSAL_ENTRY_KEY];
    expect(entry, `${REFUSAL_ENTRY_KEY} is catalogued`).toBeDefined();
    expect(entry?.states.length, "the refusal entry declares states").toBeGreaterThan(0);

    for (const state of entry?.states ?? []) {
      const [severity, surface] = state.name.split("-");
      const expected = SAMPLE_REFUSAL_BY_SEVERITY[severity ?? ""];
      expect(expected, `${state.name}: ${severity} is a severity the sample module names a code for`).toBeDefined();

      const cell = refusalCellOf(state);
      expect(cell.getAttribute("data-code"), `${state.name} renders the sample named for ${severity}`).toBe(expected);
      expect(cell.getAttribute("data-surface"), `${state.name} renders on the surface its state name states`).toBe(surface);
      cleanup();
    }
  });

  test("AC-1c: the denied frame's sample is the register's permission refusal", async () => {
    const { galleryEntries } = await gallery();
    const { SAMPLE_REFUSALS } = await samples();
    const entry = galleryEntries[DENIED_ENTRY_KEY];
    expect(entry, `${DENIED_ENTRY_KEY} is catalogued`).toBeDefined();

    const rest = entry?.states.find((state) => state.name === "rest");
    expect(rest, `${DENIED_ENTRY_KEY} declares its rest state`).toBeDefined();

    const cell = refusalCellOf(rest as GalleryState);
    expect(cell.getAttribute("data-code"), "the denied frame stands on PERMISSION_NOT_HELD").toBe("PERMISSION_NOT_HELD");
    expect(Object.keys(SAMPLE_REFUSALS), "the denied frame's refusal is one the sample module holds").toContain("PERMISSION_NOT_HELD");
  });
});
