// @vitest-environment jsdom
/**
 * AC-6's catalogue half — the pattern joins the living gallery, and the completeness surface stays
 * derived (R-UI-011, B-19).
 *
 * The required entry keys are computed from the barrels themselves: the roster is asked what the
 * new barrel publishes, and every component it publishes owes an entry. Nothing here freezes a
 * component list — a fifth export added to the pattern later joins the required set by existing.
 *
 * jsdom, because importing the barrels brings live primitives whose modules expect a document.
 */
import { describe, expect, test } from "vitest";
import { componentExports, galleryBarrels, galleryEntries, missingEntries } from "../../../src/ui/gallery-derivation";

/** The barrel this increment adds, keyed as `galleryBarrels` keys a barrel under `src/ui`. */
const PATTERN_BARREL = "patterns/command-palette";

/** The shell barrel, which gains the bar's new occupant. */
const SHELL_BARREL = "shell";

/** What each barrel must publish for the palette to be catalogued at all (AC-6). */
const OWED: Readonly<Record<string, readonly string[]>> = {
  [PATTERN_BARREL]: ["CommandPalette", "CommandPaletteProvider", "ShortcutSheet"],
  [SHELL_BARREL]: ["CommandPaletteTrigger"],
};

describe("AC-6 — the pattern is a barrel of the gallery's roster", () => {
  test("AC-6: `galleryBarrels` gains `patterns/command-palette`, publishing the pattern's components", () => {
    for (const [barrelId, owed] of Object.entries(OWED)) {
      const namespace = galleryBarrels[barrelId];
      expect(namespace, `${barrelId} is one of the barrels the gallery renders (R-UI-011)`).toBeTruthy();
      const published = componentExports(namespace ?? {});
      for (const name of owed) expect(published, `${barrelId} publishes ${name}`).toContain(name);
    }
  });

  test("AC-6: every component the two barrels publish holds a gallery entry that renders it", () => {
    for (const [barrelId, owed] of Object.entries(OWED)) {
      // The owed names AND whatever else the barrel publishes: a component joins the required set by
      // existing (B-19), and the four AC-6 names are required whether the barrel holds them yet or not.
      for (const name of new Set([...owed, ...componentExports(galleryBarrels[barrelId] ?? {})])) {
        const key = `${barrelId}/${name}`;
        const entry = galleryEntries[key];
        expect(entry, `${key} owes a gallery entry — a component joins the required set by existing (B-19)`).toBeTruthy();
        const states = entry?.states ?? [];
        expect(states.length, `${key} declares at least one state with sample data`).toBeGreaterThan(0);
        for (const state of states) {
          expect(state.name.trim().length, `${key}: a state's name is its label and its data-state value`).toBeGreaterThan(0);
          const rendered = state.render();
          expect(rendered === null || rendered === undefined, `${key}/${state.name}: render() shows the component, not nothing`).toBe(false);
        }
      }
    }
  });

  test("AC-6: `missingEntries()` is empty with the palette's barrel in the roster", () => {
    // Stated together, because "nothing is missing" is trivially true of a roster the pattern has
    // not joined: the derivation is only evidence once the barrel it must cover is in it (R-UI-011).
    expect(Object.keys(galleryBarrels), "the pattern's barrel is one the derivation walks").toContain(PATTERN_BARREL);
    expect(missingEntries(), "a component export without a gallery entry fails a test computed from the tree").toEqual([]);
  });
});
