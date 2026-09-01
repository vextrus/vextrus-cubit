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
import { describe, expect, test, vi } from "vitest";
import {
  componentExports,
  galleryBarrels,
  galleryEntries,
  missingEntries,
} from "../../../src/ui/gallery-derivation";
import type { GalleryEntry, GalleryState } from "../../../src/ui/gallery-derivation";
import { REPO_ROOT, barrelIdsOnDisk, derivationPath, rendersComponent } from "./support/gallery-contract";

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

/**
 * The barrel an entry key belongs to, and the export it names — split at the boundary the roster
 * itself fixes, because a barrel id carries slashes of its own ("primitives/core/Button" is the
 * `Button` of `primitives/core`, never the `core/Button` of `primitives`).
 */
function ownerOf(key: string): { barrelId: string; exportName: string } | null {
  for (const barrelId of Object.keys(galleryBarrels)) {
    if (key.startsWith(`${barrelId}/`)) return { barrelId, exportName: key.slice(barrelId.length + 1) };
  }
  return null;
}

/** The value a barrel publishes under an entry key — the component the entry claims to catalogue. */
function componentFor(key: string): unknown {
  const owner = ownerOf(key);
  expect(owner, `${key} names a barrel galleryBarrels holds`).not.toBeNull();
  const { barrelId, exportName } = owner as { barrelId: string; exportName: string };
  const namespace = galleryBarrels[barrelId] ?? {};
  expect(componentExports(namespace), `${key}: ${exportName} is a component ${barrelId} publishes`).toContain(exportName);
  return namespace[exportName];
}

/** The entry keys the derivation owes: every barrel crossed with every component it publishes. */
function requiredKeys(): string[] {
  const keys: string[] = [];
  for (const [barrelId, namespace] of Object.entries(galleryBarrels)) {
    for (const exportName of componentExports(namespace)) keys.push(`${barrelId}/${exportName}`);
  }
  return keys.sort();
}

/* --------------------------- the derivation's own suite, run over a catalogue one entry poorer */

/** A gallery catalogue, as `galleryEntries` is one — the record the completeness rule reads. */
type Catalogue = Record<string, GalleryEntry>;

/** The vitest suites the increment shipped beside the derivation — a scan, never a name. */
function productSuites(): string[] {
  const dir = join(REPO_ROOT, "src/ui/gallery-derivation");
  expect(existsSync(dir), "src/ui/gallery-derivation/ holds the derivation R-UI-011 asks for").toBe(true);
  return readdirSync(dir)
    .filter((name) => /\.test\.tsx?$/.test(name))
    .sort();
}

/**
 * The derivation module's surface with a catalogue of the caller's choosing. Only the catalogue is
 * substituted: `missingEntries` is still the shipped algorithm, reading the record it defaults to —
 * so a suite run over this is exercising the product's own rule against a poorer tree.
 */
function derivationSurface(entries: Catalogue): Record<string, unknown> {
  return {
    galleryBarrels,
    componentExports,
    galleryEntries: entries,
    missingEntries: (given: Catalogue = entries) => missingEntries(given),
  };
}

/**
 * Run a product-owned suite in this process over a substituted derivation, and report what it
 * registered and what threw. `vitest` itself is substituted so the suite's `test()` calls hand
 * their bodies here instead of registering with a collector that has long since finished — the
 * assertions inside them are the real `expect`, so a failure is a genuine failure of that suite.
 */
async function runProductSuite(suite: string, entries: Catalogue): Promise<{ registered: number; failures: string[] }> {
  const cases: { name: string; run: () => unknown }[] = [];
  vi.resetModules();
  vi.doMock(derivationPath(), () => derivationSurface(entries));
  vi.doMock("vitest", async () => {
    const actual = await vi.importActual<Record<string, unknown>>("vitest");
    const register = (name: string, run: () => unknown): void => {
      cases.push({ name, run });
    };
    const group = (_name: string, body: () => unknown): void => {
      void body();
    };
    return { ...actual, describe: group, suite: group, test: register, it: register };
  });

  try {
    await import(join(REPO_ROOT, "src/ui/gallery-derivation", suite));
    const failures: string[] = [];
    for (const one of cases) {
      try {
        await one.run();
      } catch (error) {
        failures.push(`${suite} › ${one.name}: ${String((error as Error).message ?? error).split("\n")[0] ?? ""}`);
      }
    }
    return { registered: cases.length, failures };
  } finally {
    vi.doUnmock("vitest");
    vi.doUnmock(derivationPath());
    vi.resetModules();
  }
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
      const names = states.map((state) => state.name);
      expect(names.length, `${key}: no state name is declared twice — data-state is what names a state in the DOM`).toBe(new Set(names).size);
    }
  });

  test("AC-1: every state renders the barrel export its key names, not a stand-in", () => {
    const keys = Object.keys(galleryEntries);
    expect(keys.length, "there are entries whose samples can be judged").toBeGreaterThan(0);
    for (const key of keys) {
      const component = componentFor(key);
      expect(component, `${key}: the barrel publishes the export the entry catalogues`).toBeDefined();
      for (const state of galleryEntries[key]?.states ?? []) {
        expect(
          rendersComponent(state.render(), component),
          `${key}/${state.name}: render() must put ${key} itself on the screen — the gallery is evidence of the component, so a sample that renders anything else (a string, a bare div, some other component) shows nothing of it (R-UI-011)`,
        ).toBe(true);
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

describe("AC-1 — the derivation carries its own product-owned suite, and it binds", () => {
  test("AC-1: the roster is the disk scan and no component export lacks an entry", () => {
    // R-UI-011's rule, proven here rather than delegated: the completeness surface is the barrels
    // the filesystem holds, and nothing they publish is uncatalogued (B-19, completeness by
    // reflection).
    const onDisk = barrelIdsOnDisk();
    expect(onDisk.length, "src/ui publishes barrels for the scan to find").toBeGreaterThan(0);
    expect(Object.keys(galleryBarrels).sort(), "the roster is what the scan finds — never a list (B-19)").toEqual(onDisk);
    expect(missingEntries(), "a component export without a gallery entry is a missing entry (R-UI-011)").toEqual([]);
  });

  test("AC-1: the suite beside the derivation reds when a component loses its entry", async () => {
    // white-box: AC-1 — R-UI-011 asks that the guard travel with the product tree ("a component
    // without a gallery entry FAILS A TEST"), so the thing judged is a src/ file's behaviour. It is
    // run here twice, over the shipped catalogue and over one entry poorer; a file with the right
    // basename and no assertions registers nothing and passes neither half.
    const suites = productSuites();
    expect(
      suites.length,
      "AC-1 asks for a product-owned suite beside the derivation; the root vitest config collects src/**/*.test.ts{,x}",
    ).toBeGreaterThan(0);

    const keys = Object.keys(galleryEntries).sort();
    expect(keys.length, "the catalogue holds an entry that can be taken away").toBeGreaterThan(0);
    const removed = keys[0] as string;
    const poorer: Catalogue = Object.fromEntries(Object.entries(galleryEntries).filter(([key]) => key !== removed));

    let registered = 0;
    const shipped: string[] = [];
    const mutated: string[] = [];
    for (const suite of suites) {
      const control = await runProductSuite(suite, galleryEntries);
      registered += control.registered;
      shipped.push(...control.failures);
      mutated.push(...(await runProductSuite(suite, poorer)).failures);
    }

    expect(registered, `${suites.join(", ")} register tests — a hollow file guards nothing`).toBeGreaterThan(0);
    expect(shipped, "the shipped catalogue passes the suite that ships beside it").toEqual([]);
    expect(
      mutated.length,
      `dropping ${removed} from the catalogue must red a suite inside src/ui/gallery-derivation/ — that is the test R-UI-011 says a component without an entry fails. Suites run: ${suites.join(", ")}`,
    ).toBeGreaterThan(0);
  });

  test("AC-1: the compile-time shape of GalleryState and GalleryEntry holds", () => {
    expect(STATE_IS_NAMED_AND_RENDERABLE).toBe(true);
    expect(ENTRY_CARRIES_STATES).toBe(true);
  });
});
