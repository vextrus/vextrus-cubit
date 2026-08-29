// @vitest-environment jsdom
/**
 * The derivation's own suite (R-UI-011, B-19): the one place that binds the hand-written barrel
 * roster to the tree it claims to reflect, and the catalogue to the components the barrels publish.
 *
 * Nothing here is a list. The barrels come from `./barrel-scan`'s filesystem scan — the one place
 * that says what a barrel is, so this suite cannot drift into a second answer (B-17) — the
 * components from each namespace at runtime, and the required entries from their product: a barrel
 * or a component the tree grows moves these expectations by itself, and a component export with no
 * gallery entry reds here (R-UI-011).
 *
 * jsdom, because reflecting over the barrels imports live primitives whose modules want a document.
 */
import { describe, expect, test } from "vitest";
import { barrelIdsOnDisk } from "./barrel-scan";
import { componentExports, galleryBarrels, galleryEntries, missingEntries } from "./index";

describe("the barrel roster reflects the tree", () => {
  test("galleryBarrels' keys are the barrel index files on disk", () => {
    const onDisk = barrelIdsOnDisk();
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
