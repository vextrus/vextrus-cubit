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

/** What the one OVER-side repair owes: the figure it is over by, measured, with both its terms. */
type Overage = {
  slab_band_m2: string;
  beam_end_contacts_m2: string;
  beam_end_contacts: number;
  member_end_no_deduct_max_cm2: string;
  total_m2: string;
  column_formwork_m2: string;
  share_pct: string;
  per_level: Record<string, { slab_band_m2: string; beam_end_contacts_m2: string; beam_ends: string }>;
};
type Repair = { id: string; law: string; state: string; side: string; what: string; deferred?: string; overage?: Overage };
type Manifest = { fixture: string; version: string; repairs: Repair[] };

const R7 = "R-7-column-formwork-junction";

/** The rows R-7's share is taken against (AM-01 freezes them; the repair may not move them). */
function columnFormworkM2(): number {
  const golden = JSON.parse(
    readFileSync(join(REPO_ROOT, "fixtures", "rcc6", "takeoff.golden.json"), "utf8"),
  ) as { rows: { class: string; kind: string; quantity: string }[] };
  return golden.rows
    .filter((row) => row.class === "COLUMN" && row.kind === "FORMWORK")
    .reduce((total, row) => total + Number(row.quantity), 0);
}

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
        repair.what.length < 40 ||
        (repair.side === "OVER" && repair.overage === undefined),
    );
    expect(
      malformed.map((repair) => repair.id),
      "a repair does not state law, state, side and what — or is OVER and states no measured overage",
    ).toEqual([]);
  });

  it("states R-7's overage as a measured figure with both its terms, not a prose estimate", () => {
    // P4a: the manifest said "about 8.6 m2 per level", which is only the slab band. The sentence's
    // own second term — the beam-end contacts above memberEndNoDeductMaxCm2, every B1–B4 end being
    // 750–875 cm² and 120 of them landing on a column top per level — was missing from it, and the
    // only test over this file asked that `what` be 40 characters long. The generator measures both
    // terms off the drawn geometry now (fixtures/gen/rcc6.py r7_overage), and this is the number.
    const repair = manifest().repairs.find((entry) => entry.id === R7);
    expect(repair, `${R7} is not declared`).toBeDefined();
    const overage = repair?.overage;
    expect(overage, `${R7} states no measured overage`).toBeDefined();
    if (!overage) return;
    const band = Number(overage.slab_band_m2);
    const ends = Number(overage.beam_end_contacts_m2);
    const total = Number(overage.total_m2);
    expect(band, "the slab-band term").toBeCloseTo(51.48, 3);
    expect(ends, "the beam-end-contact term").toBeCloseTo(60.0, 3);
    expect(overage.beam_end_contacts, "the beam ends counted, 120 per level over six levels").toBe(720);
    expect(Number(overage.member_end_no_deduct_max_cm2), "the threshold the ends are counted against").toBe(500);
    expect(band + ends, "the two terms do not sum to the total declared").toBeCloseTo(total, 3);
    expect(total, "R-7's overage against COLUMN FORMWORK").toBeCloseTo(111.48, 3);
    expect(Number(overage.column_formwork_m2), "the published COLUMN FORMWORK the share is taken of").toBeCloseTo(
      columnFormworkM2(),
      3,
    );
    expect(Number(overage.share_pct), "the share of COLUMN FORMWORK R-7 leaves over").toBeCloseTo(
      (total / columnFormworkM2()) * 100,
      2,
    );
    const levels = Object.entries(overage.per_level);
    expect(levels.map(([level]) => level), "the levels the overage is carried on").toEqual([
      "GF",
      "1F",
      "2F",
      "3F",
      "4F",
      "5F",
    ]);
    for (const [level, terms] of levels) {
      expect(Number(terms.slab_band_m2), `${level} slab band`).toBeCloseTo(8.58, 3);
      expect(Number(terms.beam_end_contacts_m2), `${level} beam-end contacts`).toBeCloseTo(10.0, 3);
      expect(Number(terms.beam_ends), `${level} beam ends`).toBe(120);
    }
    expect(band + ends, "the per-level terms do not add up to the total").toBeCloseTo(
      levels.reduce((sum, [, terms]) => sum + Number(terms.slab_band_m2) + Number(terms.beam_end_contacts_m2), 0),
      3,
    );
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
