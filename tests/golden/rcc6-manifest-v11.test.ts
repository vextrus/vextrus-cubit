// @vitest-environment node
// F-RCC6 v1.1 records itself: the corpus manifest carries the version and a repairs list in which
// every change v1.1 made, and every item it left for a later version, is named with the side its
// published figure falls on. AM-02 admits a deferral only where the figure is then UNDER, so an
// OVER-side entry must say so in the open and say why (here: AM-01 freezes the M2 column rows).
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFEST = join(REPO_ROOT, "fixtures", "rcc6", "manifest.json");

type Repair = { id: string; law: string; state: string; side: string; what: string; deferred?: string };
type Manifest = { fixture: string; version: string; repairs: Repair[] };

function manifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
}

/** What AM-01's repair list names, each of which must appear as a repairs[] entry. */
const OWED = ["b5", "openings", "gf-slab", "column-neck", "junction"];

describe("F-RCC6 v1.1: the manifest records the repair", () => {
  it("calls itself version 1.1", () => {
    expect(manifest().version).toBe("1.1");
    expect(manifest().fixture).toBe("F-RCC6");
  });

  it("names every one of AM-01's five repairs, with a law, a state and a side", () => {
    const repairs = manifest().repairs;
    expect(Array.isArray(repairs), "manifest.repairs is not a list").toBe(true);
    const ids = repairs.map((repair) => repair.id).join(" ");
    expect(OWED.filter((owed) => !ids.includes(owed)), `repairs[] does not name: ${ids}`).toEqual([]);
    const malformed = repairs.filter(
      (repair) =>
        !["REPAIRED", "DEFERRED"].includes(repair.state) ||
        !["UNDER", "OVER", "EXACT"].includes(repair.side) ||
        typeof repair.law !== "string" ||
        repair.what.length < 40,
    );
    expect(malformed.map((repair) => repair.id), "a repair does not state law, state, side and what").toEqual([]);
  });

  it("keeps every deferral on the under side but one, and that one says why it is over", () => {
    const over = manifest().repairs.filter((repair) => repair.side === "OVER");
    expect(over.length, "more than one OVER-side figure — AM-02 makes an over figure a hard block").toBeLessThanOrEqual(1);
    for (const repair of over) {
      expect(repair.state, `${repair.id} is over and not declared as a deferral`).toBe("DEFERRED");
      expect(repair.what, `${repair.id} is over and does not name AM-01's freeze as the reason`).toMatch(/AM-01/u);
    }
    const deferred = manifest().repairs.filter((repair) => repair.state === "DEFERRED");
    expect(deferred.length, "v1.1 defers nothing — the deferred-UNDER items are not recorded").toBeGreaterThan(0);
  });
});
