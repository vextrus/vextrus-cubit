// @vitest-environment jsdom
/**
 * AC-4 (the tree's half) — the pattern joins the catalogued surface and declares its seven states.
 *
 * Both are derived, never transcribed (R-UI-011, R-UI-050, B-19): the entries a barrel owes are
 * computed from the barrel's own namespace, and the states a row owes are `STATE_NAMES` itself.
 * The journey half of AC-4 is `tests/e2e/palette.spec.ts`, which the J-021 lane runs.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { componentExports, galleryBarrels, galleryEntries, missingEntries } from "../../../src/ui/gallery-derivation";
import type { GalleryEntry } from "../../../src/ui/gallery-derivation";
import { STATE_NAMES } from "../../../src/ui/screen-states/contract";
import { PALETTE_STATES_MODULE, REPO_ROOT, installDomStubs, productModule, unmountAll } from "./support/palette-stage";

afterEach(() => {
  unmountAll();
});

/** The barrel this increment catalogues, by the key `galleryBarrels` files a barrel under. */
const BARREL_ID = "patterns/command-palette";

/** The one renderer R-UI-020 gives every surface, including inside a dialog (I-142). */
const REFUSAL_RENDERER = "src/ui/patterns/refusal-state/refusal-state.tsx";

/** The Design Decision this pattern is built against (R-UI-011: a screen owes one). */
const DECISION = "docs/design/command-palette.md";

interface StateCell {
  declared?: string;
  to?: string;
  by?: string;
  why?: string;
  testId?: string | null;
}

describe("AC-4: the gallery entry and the declared states", () => {
  test("AC-4: the pattern is a catalogued barrel, and every component it publishes has an entry that renders", async () => {
    installDomStubs();
    expect(Object.keys(galleryBarrels), `galleryBarrels holds \`${BARREL_ID}\` (AC-4, R-UI-011)`).toContain(BARREL_ID);

    const namespace = galleryBarrels[BARREL_ID] ?? {};
    const components = componentExports(namespace);
    expect(components.length, `\`${BARREL_ID}\` publishes components to catalogue`).toBeGreaterThan(0);

    for (const name of components) {
      const key = `${BARREL_ID}/${name}`;
      const entry = (galleryEntries as Record<string, GalleryEntry | undefined>)[key];
      expect(entry, `${key} has a gallery entry (R-UI-011)`).toBeDefined();
      const states = (entry as GalleryEntry).states;
      expect(states.length, `${key} shows at least one state`).toBeGreaterThan(0);
      for (const state of states) {
        // The entry's node is built OUTSIDE a component, which is what "hook-free" means here: an
        // entry that called a hook would throw before anything is mounted (the gallery's I-9).
        const node = state.render();
        render(createElement("div", null, node));
      }
    }

    expect(missingEntries(), "a component export without a gallery entry fails this test (R-UI-011)").toEqual([]);
  });

  test("AC-4: the palette's state row is total over R-UI-050's seven, and hands refusal to the one renderer", async () => {
    expect(existsSync(join(REPO_ROOT, DECISION)), `${DECISION} is the Decision this pattern is built against (AC-4)`).toBe(true);

    const module = await productModule<Record<string, unknown>>(PALETTE_STATES_MODULE);
    const matrix = module["COMMAND_PALETTE_STATES"] as Record<string, Record<string, StateCell>> | undefined;
    expect(typeof matrix, `${PALETTE_STATES_MODULE} publishes \`COMMAND_PALETTE_STATES\` (AC-4)`).toBe("object");

    const row = (matrix as Record<string, Record<string, StateCell>>)["command-palette"];
    expect(row, "`COMMAND_PALETTE_STATES` declares the `command-palette` surface (AC-4)").toBeDefined();
    expect(
      Object.keys(row as Record<string, StateCell>).sort(),
      "the row is total over R-UI-050's seven, and names no eighth state (AC-4, B-19)",
    ).toEqual([...STATE_NAMES].sort());

    for (const state of STATE_NAMES) {
      const cell = (row as Record<string, StateCell>)[state];
      expect(typeof cell?.declared, `the \`${state}\` cell says what the surface does about it (R-UI-050)`).toBe("string");
    }

    for (const state of ["refusal", "permission-denied"]) {
      const cell = (row as Record<string, StateCell>)[state];
      expect(cell?.declared, `the \`${state}\` cell is delegated, never a screen-local block (R-UI-020, B-17)`).toBe("delegated");
      expect(cell?.to, `the \`${state}\` cell hands the state to the one RefusalState (AC-4)`).toBe(REFUSAL_RENDERER);
    }
  });
});
