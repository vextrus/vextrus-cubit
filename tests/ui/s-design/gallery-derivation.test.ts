// @vitest-environment jsdom
/**
 * AC-1 — the gallery's completeness surface is DERIVED (R-UI-011, B-19).
 *
 * Every assertion here is computed from the tree the moment it runs: the barrel roster from a
 * filesystem scan of the two globs AC-1 spells, the component roster from what each barrel's
 * namespace actually holds at runtime, the required entry set from their product. No roster,
 * count or key list is written down — a barrel or a component added by a later increment moves
 * these expectations by itself, which is exactly the shape B-19 asks acceptance to take.
 *
 * jsdom, because importing the barrels brings live primitives whose modules expect a document.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  componentExports,
  galleryBarrels,
  galleryEntries,
  missingEntries,
} from "../../../src/ui/gallery-derivation";
import type { GalleryEntry, GalleryState } from "../../../src/ui/gallery-derivation";
import { REPO_ROOT, barrelIdsOnDisk } from "./support/gallery-contract";

/**
 * The interfaces line's types, bound at compile time rather than by a runtime shape guess: `tsc`
 * is the runner for this one, and a `GalleryState` that lost its `name` or its `render` fails
 * `pnpm verify` before a single test executes.
 */
type Extends<A, B> = [A] extends [B] ? true : false;
const STATE_IS_NAMED_AND_RENDERABLE: Extends<GalleryState, { name: string; render: () => unknown }> = true;
const ENTRY_CARRIES_STATES: Extends<GalleryEntry, { states: readonly GalleryState[] }> = true;

/**
 * A component export, as AC-1 defines it: a function, or a React exotic object (`forwardRef`,
 * `memo`) — those carry a symbol `$$typeof` and nothing else in a barrel does.
 */
function isRenderableComponent(value: unknown): boolean {
  if (typeof value === "function") return true;
  if (typeof value !== "object" || value === null) return false;
  return typeof (value as { $$typeof?: unknown }).$$typeof === "symbol";
}

/** The entry keys the derivation owes: every barrel crossed with every component it publishes. */
function requiredKeys(): string[] {
  const keys: string[] = [];
  for (const [barrelId, namespace] of Object.entries(galleryBarrels)) {
    for (const exportName of componentExports(namespace)) keys.push(`${barrelId}/${exportName}`);
  }
  return keys.sort();
}

describe("AC-1 — the barrel roster is a filesystem scan, not a transcription", () => {
  test("AC-1: galleryBarrels' keys are exactly the barrel index files on disk", () => {
    const onDisk = barrelIdsOnDisk();
    expect(onDisk.length, "src/ui publishes barrels for the scan to find").toBeGreaterThan(0);
    expect(
      Object.keys(galleryBarrels).sort(),
      "every barrel with an index file owes a galleryBarrels key, and galleryBarrels names no barrel the tree lacks",
    ).toEqual(onDisk);
  });

  test("AC-1: every barrel value is the barrel's namespace and publishes at least one component", () => {
    for (const [barrelId, namespace] of Object.entries(galleryBarrels)) {
      expect(typeof namespace, `${barrelId} maps to a namespace object`).toBe("object");
      expect(componentExports(namespace).length, `${barrelId} publishes components for the gallery to render`).toBeGreaterThan(0);
    }
  });
});

describe("AC-1 — componentExports is the rule, applied to whatever the barrel holds", () => {
  test("AC-1: componentExports returns every uppercase renderable export and nothing else", () => {
    for (const [barrelId, namespace] of Object.entries(galleryBarrels)) {
      const returned = componentExports(namespace);
      const expected = Object.keys(namespace)
        .filter((name) => /^[A-Z]/.test(name))
        .filter((name) => isRenderableComponent(namespace[name]))
        .sort();
      expect(returned, `${barrelId}: the uppercase renderable exports, no more and no fewer`).toEqual(expected);
    }
  });

  test("AC-1: componentExports orders by code point, never by locale", () => {
    for (const [barrelId, namespace] of Object.entries(galleryBarrels)) {
      const returned = componentExports(namespace);
      expect(returned, `${barrelId}: default Array#sort order is the code-point order the contract fixes`).toEqual([...returned].sort());
    }
  });
});

describe("AC-1 — galleryEntries carries one entry per component, with sample data", () => {
  test("AC-1: every entry key names a real barrel export", () => {
    const required = requiredKeys();
    expect(required.length, "the barrels publish components, so entries are owed").toBeGreaterThan(0);
    for (const key of Object.keys(galleryEntries)) {
      expect(required, `${key} must be a "<barrelId>/<ExportName>" the barrels actually publish`).toContain(key);
    }
  });

  test("AC-1: every entry declares at least one named state that renders sample data", () => {
    const keys = Object.keys(galleryEntries);
    expect(keys.length, "the gallery holds entries").toBeGreaterThan(0);
    for (const key of keys) {
      const entry = galleryEntries[key];
      expect(entry, `${key} resolves to an entry`).toBeDefined();
      const states = entry?.states ?? [];
      expect(states.length, `${key} declares at least one state (R-UI-011: every state, with sample data)`).toBeGreaterThan(0);
      for (const state of states) {
        expect(state.name.trim().length, `${key}: a state's name is the label and the data-state value`).toBeGreaterThan(0);
        expect(typeof state.render, `${key}/${state.name}: render is a function`).toBe("function");
        const rendered = state.render();
        expect(
          rendered === null || rendered === undefined,
          `${key}/${state.name}: render() returns sample data to show, not nothing`,
        ).toBe(false);
      }
    }
  });

  test("AC-1: missingEntries() is empty on the shipped tree", () => {
    expect(
      missingEntries(),
      "a component export without a gallery entry fails a test computed from the tree (R-UI-011)",
    ).toEqual([]);
  });
});

describe("AC-1 — the derivation carries its own product-owned suite", () => {
  test("AC-1: a vitest suite lives inside src/ui/gallery-derivation/", () => {
    const dir = join(REPO_ROOT, "src/ui/gallery-derivation");
    expect(existsSync(dir), "src/ui/gallery-derivation/ exists").toBe(true);
    const suites = readdirSync(dir).filter((name) => name.endsWith(".test.ts") || name.endsWith(".test.tsx"));
    expect(
      suites.length,
      "AC-1 asks for a product-owned suite beside the derivation; the root vitest config collects src/**/*.test.ts{,x}",
    ).toBeGreaterThan(0);
  });

  test("AC-1: the compile-time shape of GalleryState and GalleryEntry holds", () => {
    expect(STATE_IS_NAMED_AND_RENDERABLE).toBe(true);
    expect(ENTRY_CARRIES_STATES).toBe(true);
  });
});
