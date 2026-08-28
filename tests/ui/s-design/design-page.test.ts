// @vitest-environment jsdom
/**
 * AC-2 — /design renders the derivation, and only through the barrels (R-UI-011, B-17, C-13).
 *
 * "Renders the derivation" is not a claim a same-instant comparison can settle: a page that
 * transcribed today's keys into hand-written JSX matches `galleryEntries` exactly, for exactly as
 * long as nobody adds a component. So the page is mounted twice — once over the derivation the
 * tree ships, and once over a synthetic derivation naming barrels and components that exist
 * nowhere — and the structure must follow the module both times (B-19). The barrel-only import
 * rule and the Design Decision's contract are read off the files the increment ships.
 *
 * No JSX: the page is mounted with `React.createElement`, so this file stays a plain `.ts` under
 * tests/, where `tsc` still reads it.
 */
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { galleryBarrels, galleryEntries } from "../../../src/ui/gallery-derivation";
import {
  type DerivationShape,
  type MountedPage,
  REPO_ROOT,
  barrelInternalImports,
  colourLiterals,
  derivationPath,
  filesUnder,
  importSpecifiers,
  mountDesignPage,
  readRepoFile,
  syntheticDerivation,
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

/** Module-ish files — the ones an import scan has anything to say about. */
const MODULE_FILES = /\.(ts|tsx|mts|js|mjs)$/;

let mounted: MountedPage | null = null;

/** Mount the page over the tree's own derivation, or over one this test supplies. */
async function mount(derivation?: DerivationShape): Promise<HTMLElement> {
  mounted = await mountDesignPage(derivation);
  return mounted.container;
}

function testidNodes(root: ParentNode, testid: string): HTMLElement[] {
  return [...root.querySelectorAll(`[data-testid="${testid}"]`)] as HTMLElement[];
}

function attributes(root: ParentNode, testid: string, attribute: string): string[] {
  return testidNodes(root, testid).map((node) => node.getAttribute(attribute) ?? "");
}

/** The entry keys a barrel owes, taken from a derivation rather than from the page. */
function entryKeysFor(entries: Record<string, unknown>, barrelId: string): string[] {
  return Object.keys(entries)
    .filter((key) => key.startsWith(`${barrelId}/`))
    .sort();
}

afterEach(() => {
  mounted?.cleanup();
  mounted = null;
});

describe("AC-2 — the page's structure is the derivation's structure", () => {
  test("AC-2: a gallery-shell chrome region holds the page's h1", async () => {
    const container = await mount();
    const shells = testidNodes(container, TESTIDS.shell);
    expect(shells.length, "exactly one gallery-shell chrome region — it is what the baselines capture").toBe(1);
    const heading = shells[0]?.querySelector("h1");
    expect(heading, "the gallery-shell holds the page's h1").not.toBeNull();
    expect((heading?.textContent ?? "").trim().length, "the h1 carries copy").toBeGreaterThan(0);
  });

  test("AC-2: one gallery-barrel section per key of galleryBarrels", async () => {
    const container = await mount();
    const rendered = attributes(container, TESTIDS.barrel, "data-barrel");
    const expected = Object.keys(galleryBarrels).sort();
    expect(expected.length, "the derivation names barrels for the page to render").toBeGreaterThan(0);
    expect([...rendered].sort(), "every barrel is a section, and no section names a barrel the derivation lacks").toEqual(expected);
    expect(rendered.length, "no barrel is rendered twice").toBe(new Set(rendered).size);
  });

  test("AC-2: each barrel section holds exactly the entries that belong to it", async () => {
    const container = await mount();
    for (const section of testidNodes(container, TESTIDS.barrel)) {
      const barrelId = section.getAttribute("data-barrel") ?? "";
      const rendered = attributes(section, TESTIDS.entry, "data-entry");
      expect(
        [...rendered].sort(),
        `the ${barrelId} section renders the galleryEntries keys prefixed with "${barrelId}/", and only those`,
      ).toEqual(entryKeysFor(galleryEntries, barrelId));
    }
  });

  test("AC-2: each entry renders one gallery-state cell per declared state, in declared order", async () => {
    const container = await mount();
    for (const node of testidNodes(container, TESTIDS.entry)) {
      const key = node.getAttribute("data-entry") ?? "";
      const declared = (galleryEntries[key]?.states ?? []).map((state) => state.name);
      expect(declared.length, `${key} is a declared entry with states`).toBeGreaterThan(0);
      const rendered = attributes(node, TESTIDS.state, "data-state");
      expect(rendered, `${key}: one gallery-state per declared state, data-state naming it`).toEqual(declared);
    }
  });
});

describe("AC-2 — the page follows the derivation module, wherever it points", () => {
  test("AC-2: mounted over a synthetic derivation, the page renders that one and nothing of the tree's", async () => {
    const synthetic = syntheticDerivation();
    const container = await mount(synthetic);

    expect(
      [...attributes(container, TESTIDS.barrel, "data-barrel")].sort(),
      "the barrel sections are the synthetic derivation's barrels — a page carrying a hand-written list would still be rendering the tree's",
    ).toEqual(Object.keys(synthetic.galleryBarrels).sort());

    const renderedEntries = attributes(container, TESTIDS.entry, "data-entry");
    expect([...renderedEntries].sort(), "the entries are the synthetic derivation's entries, exactly").toEqual(Object.keys(synthetic.galleryEntries).sort());
    expect(
      renderedEntries.filter((key) => key in galleryEntries),
      "no key of the shipped derivation survives a mount over a derivation that does not declare it (B-19)",
    ).toEqual([]);

    for (const barrelId of Object.keys(synthetic.galleryBarrels)) {
      const section = testidNodes(container, TESTIDS.barrel).find((node) => node.getAttribute("data-barrel") === barrelId);
      expect(section, `the ${barrelId} section is rendered`).toBeDefined();
      expect(
        [...attributes(section as HTMLElement, TESTIDS.entry, "data-entry")].sort(),
        `the ${barrelId} section groups the synthetic entries that belong to it`,
      ).toEqual(entryKeysFor(synthetic.galleryEntries, barrelId));
    }

    for (const node of testidNodes(container, TESTIDS.entry)) {
      const key = node.getAttribute("data-entry") ?? "";
      const declared = (synthetic.galleryEntries[key]?.states ?? []).map((state) => state.name);
      expect(attributes(node, TESTIDS.state, "data-state"), `${key}: the cells are the states this derivation declares`).toEqual(declared);
    }

    // The samples themselves reach the DOM: the synthetic states render an <output>, which nothing
    // else on the page does, so a page that laid out the cells and dropped `render()` is caught.
    expect(
      container.querySelectorAll("output").length,
      "each gallery-state cell mounts its state's render() — the sample is the evidence (R-UI-011)",
    ).toBe(Object.values(synthetic.galleryEntries).reduce((total, entry) => total + entry.states.length, 0));
  });

  test("AC-2: the page's own modules import the derivation they render", () => {
    // white-box: AC-2 — "renders the derivation, not a hand list" is a claim about where the page's
    // structure comes from; the criterion names a source scan of these two trees for exactly that.
    const files = filesUnder(SCANNED_DIRS[0] as string).filter((file) => MODULE_FILES.test(file));
    expect(files.length, `${SCANNED_DIRS[0]} holds the route's modules`).toBeGreaterThan(0);
    const derivationDir = dirname(derivationPath());
    const importsDerivation = files.some((file) =>
      importSpecifiers(readRepoFile(file)).some((specifier) => {
        // The house form is relative (nothing under src/ spells the "@/" alias); the alias is
        // accepted all the same, because what this asserts is which module the page consumes.
        if (specifier.startsWith("@/")) return specifier.replace(/^@\//, "").replace(/\/index(\.tsx?)?$/, "") === "ui/gallery-derivation";
        if (!specifier.startsWith(".")) return false;
        return resolve(dirname(join(REPO_ROOT, file)), specifier).replace(/\/index(\.tsx?)?$/, "") === derivationDir;
      }),
    );
    expect(importsDerivation, "a module under the /design route imports src/ui/gallery-derivation — the page renders the derivation, it does not restate it").toBe(true);
  });
});

describe("AC-2 — the gallery is evidence, never a second implementation", () => {
  test("AC-2: nothing under the page or the derivation imports past a barrel's index", () => {
    const files = SCANNED_DIRS.flatMap((dir) => filesUnder(dir)).filter((file) => MODULE_FILES.test(file));
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
    const decision = readRepoFile("docs/design/s-design.md");
    expect(decision, `the Decision names the ${ROUTE} route it introduces (C-13)`).toContain(ROUTE);
    for (const testid of Object.values(TESTIDS)) {
      expect(decision, `the Decision names the ${testid} hook the suites drive (C-13, C-05)`).toContain(testid);
    }
  });
});
