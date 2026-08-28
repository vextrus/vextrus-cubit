// @vitest-environment jsdom
/**
 * AC-2 — /design renders the derivation, and only through the barrels (R-UI-011, B-17, C-13).
 *
 * The DOM is judged against `galleryBarrels` / `galleryEntries` as they are at run time, so the
 * page cannot satisfy this by holding a hand-written list that happens to agree today: add a
 * component to a barrel and this suite reds until the page renders it (B-19).
 *
 * No JSX: the page's default export is built with `React.createElement`, so this file needs
 * nothing of the transform and stays a plain `.ts` under tests/, where `tsc` still reads it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { galleryBarrels, galleryEntries } from "../../../src/ui/gallery-derivation";
import DesignPage from "../../../src/app/(app)/design/page";
import {
  REPO_ROOT,
  barrelInternalImports,
  colourLiterals,
  filesUnder,
  installGalleryDomStubs,
} from "./support/gallery-contract";

/** The four test ids the Design Decision's closed contract fixes (C-05, s-design.md §7). */
const TESTIDS = {
  shell: "gallery-shell",
  barrel: "gallery-barrel",
  entry: "gallery-entry",
  state: "gallery-state",
} as const;

/** The route this screen introduces. */
const ROUTE = "/design";

/** The two trees AC-2's scans bind. */
const SCANNED_DIRS = ["src/app/(app)/design", "src/ui/gallery-derivation"];

function mountGallery(): HTMLElement {
  installGalleryDomStubs();
  const { container } = render(React.createElement(DesignPage as React.ComponentType));
  return container;
}

function testidNodes(root: ParentNode, testid: string): HTMLElement[] {
  return [...root.querySelectorAll(`[data-testid="${testid}"]`)] as HTMLElement[];
}

/** The entry keys a barrel owes, taken from the derivation rather than from the page. */
function entryKeysFor(barrelId: string): string[] {
  return Object.keys(galleryEntries)
    .filter((key) => key.startsWith(`${barrelId}/`))
    .sort();
}

afterEach(() => {
  cleanup();
});

describe("AC-2 — the page's structure is the derivation's structure", () => {
  test("AC-2: a gallery-shell chrome region holds the page's h1", () => {
    const container = mountGallery();
    const shells = testidNodes(container, TESTIDS.shell);
    expect(shells.length, "exactly one gallery-shell chrome region — it is what the baselines capture").toBe(1);
    const heading = shells[0]?.querySelector("h1");
    expect(heading, "the gallery-shell holds the page's h1").not.toBeNull();
    expect((heading?.textContent ?? "").trim().length, "the h1 carries copy").toBeGreaterThan(0);
  });

  test("AC-2: one gallery-barrel section per key of galleryBarrels", () => {
    const container = mountGallery();
    const rendered = testidNodes(container, TESTIDS.barrel).map((node) => node.getAttribute("data-barrel") ?? "");
    const expected = Object.keys(galleryBarrels).sort();
    expect(expected.length, "the derivation names barrels for the page to render").toBeGreaterThan(0);
    expect([...rendered].sort(), "every barrel is a section, and no section names a barrel the derivation lacks").toEqual(expected);
    expect(rendered.length, "no barrel is rendered twice").toBe(new Set(rendered).size);
  });

  test("AC-2: each barrel section holds exactly the entries that belong to it", () => {
    const container = mountGallery();
    for (const section of testidNodes(container, TESTIDS.barrel)) {
      const barrelId = section.getAttribute("data-barrel") ?? "";
      const rendered = testidNodes(section, TESTIDS.entry).map((node) => node.getAttribute("data-entry") ?? "");
      expect(
        [...rendered].sort(),
        `the ${barrelId} section renders the galleryEntries keys prefixed with "${barrelId}/", and only those`,
      ).toEqual(entryKeysFor(barrelId));
    }
  });

  test("AC-2: each entry renders one gallery-state cell per declared state, in declared order", () => {
    const container = mountGallery();
    for (const node of testidNodes(container, TESTIDS.entry)) {
      const key = node.getAttribute("data-entry") ?? "";
      const declared = (galleryEntries[key]?.states ?? []).map((state) => state.name);
      expect(declared.length, `${key} is a declared entry with states`).toBeGreaterThan(0);
      const rendered = testidNodes(node, TESTIDS.state).map((cell) => cell.getAttribute("data-state") ?? "");
      expect(rendered, `${key}: one gallery-state per declared state, data-state naming it`).toEqual(declared);
    }
  });
});

describe("AC-2 — the gallery is evidence, never a second implementation", () => {
  test("AC-2: nothing under the page or the derivation imports past a barrel's index", () => {
    const files = SCANNED_DIRS.flatMap((dir) => filesUnder(dir)).filter((file) => /\.(ts|tsx|mts|js|mjs)$/.test(file));
    expect(files.length, `${SCANNED_DIRS.join(" and ")} hold the increment's modules`).toBeGreaterThan(0);
    const offences = files.flatMap((file) => barrelInternalImports(file));
    expect(offences, "a primitive is reached through its barrel, never through the module behind it (B-17, R-UI-011)").toEqual([]);
  });

  test("AC-2: nothing under the page or the derivation spells a colour", () => {
    const files = SCANNED_DIRS.flatMap((dir) => filesUnder(dir));
    expect(files.length, "there are files to scan").toBeGreaterThan(0);
    const offences = files.flatMap((file) => colourLiterals(file));
    expect(offences, "colour lives only in the token source; the gallery reads tokens (R-UI-001)").toEqual([]);
  });
});

describe("AC-2 — the Design Decision is committed and names the contract", () => {
  test("AC-2: docs/design/s-design.md names the route and all four test ids", () => {
    const decision = readFileSync(join(REPO_ROOT, "docs/design/s-design.md"), "utf8");
    expect(decision, `the Decision names the ${ROUTE} route it introduces (C-13)`).toContain(ROUTE);
    for (const testid of Object.values(TESTIDS)) {
      expect(decision, `the Decision names the ${testid} hook the suites drive (C-13, C-05)`).toContain(testid);
    }
  });
});
