// @vitest-environment jsdom
/**
 * The derivation's own suite (R-UI-011, B-19): the one place that binds the hand-written barrel
 * roster to the tree it claims to reflect, and the catalogue to the components the barrels publish.
 *
 * Nothing here is a list. The barrels come from a filesystem scan of `src/ui`, the components from
 * each namespace at runtime, and the required entries from their product — so a barrel or a
 * component the tree grows moves these expectations by itself, and a component export with no
 * gallery entry reds here (R-UI-011).
 *
 * jsdom, because reflecting over the barrels imports live primitives whose modules want a document.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import { componentExports, galleryBarrels, galleryEntries, missingEntries } from "./index";

const UI_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The index-file spellings a barrel may carry. */
const INDEX_FILES = ["index.ts", "index.tsx"];

/** The barrel directory's index file, or null when the directory publishes none. */
function indexOf(dir: string): string | null {
  for (const name of INDEX_FILES) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Every directory under `src/ui` that publishes an index file, as its path relative to `src/ui`. */
function indexedDirsUnderUi(dir: string = UI_DIR, prefix = ""): { id: string; index: string }[] {
  const found: { id: string; index: string }[] = [];
  for (const name of readdirSync(dir).sort()) {
    const child = join(dir, name);
    if (!statSync(child).isDirectory()) continue;
    const id = prefix === "" ? name : `${prefix}/${name}`;
    const index = indexOf(child);
    if (index !== null) found.push({ id, index });
    found.push(...indexedDirsUnderUi(child, id));
  }
  return found;
}

/**
 * Every barrel on disk, at whatever depth under `src/ui` it sits: a directory whose index publishes
 * at least one component the gallery can mount. The predicate is the thing itself — "a barrel is a
 * directory that publishes components" — rather than a written-down set of parent directories, so a
 * barrel under a group nobody anticipated joins the completeness surface by existing (B-19). The
 * directories that publish only helpers or types (`strings`, this module) are not barrels and owe no
 * entry.
 */
async function barrelIdsOnDisk(): Promise<string[]> {
  const found: string[] = [];
  for (const { id, index } of indexedDirsUnderUi()) {
    const ns = (await import(pathToFileURL(index).href)) as Record<string, unknown>;
    if (componentExports(ns).length > 0) found.push(id);
  }
  return found.sort();
}

describe("the barrel roster reflects the tree", () => {
  test("galleryBarrels' keys are the barrel index files on disk", async () => {
    const onDisk = await barrelIdsOnDisk();
    expect(onDisk.length, "src/ui publishes barrels for the scan to find").toBeGreaterThan(0);
    expect(Object.keys(galleryBarrels).sort(), "a barrel with an index owes a roster key, and the roster names no barrel the tree lacks").toEqual(
      onDisk,
    );
  });

  test("every barrel publishes at least one component the gallery can mount", () => {
    for (const [barrelId, ns] of Object.entries(galleryBarrels)) {
      expect(componentExports(ns).length, `${barrelId} publishes components`).toBeGreaterThan(0);
    }
  });

  test("componentExports keeps uppercase mountable names, in code-point order", () => {
    for (const [barrelId, ns] of Object.entries(galleryBarrels)) {
      const names = componentExports(ns);
      expect(names, `${barrelId}: the order is Array#sort's own, never a locale's`).toEqual([...names].sort());
      for (const name of names) {
        expect(/^[A-Z]/.test(name), `${barrelId}: ${name} begins with an uppercase letter`).toBe(true);
      }
      const lowercase = Object.keys(ns).filter((name) => !/^[A-Z]/.test(name));
      for (const name of lowercase) {
        expect(names, `${barrelId}: ${name} is a helper, not a component`).not.toContain(name);
      }
    }
  });
});

describe("the catalogue covers what the barrels publish", () => {
  test("missingEntries() is empty on the shipped tree", () => {
    expect(missingEntries(), "a component export without a gallery entry fails this test (R-UI-011)").toEqual([]);
  });

  test("missingEntries() names what a catalogue lacks, sorted, and reports no extra key", () => {
    const complete = Object.keys(galleryEntries).sort();
    expect(missingEntries({}), "an empty catalogue is missing every required key").toEqual(complete);
    expect(missingEntries({ ...galleryEntries, "probe/none/Absent": { states: [] } }), "an extra key is not a missing one").toEqual([]);
  });

  test("every entry key names a component its barrel publishes, with at least one named state", () => {
    for (const [key, entry] of Object.entries(galleryEntries)) {
      const barrelId = key.slice(0, key.lastIndexOf("/"));
      const exportName = key.slice(key.lastIndexOf("/") + 1);
      const ns = galleryBarrels[barrelId];
      expect(ns, `${key} names a barrel the roster holds`).toBeDefined();
      expect(componentExports(ns ?? {}), `${key}: ${barrelId} publishes ${exportName}`).toContain(exportName);
      expect(entry.states.length, `${key} declares a state`).toBeGreaterThan(0);
      const names = entry.states.map((state) => state.name);
      expect(new Set(names).size, `${key}: a state name is what data-state carries, so it is declared once`).toBe(names.length);
    }
  });
});
