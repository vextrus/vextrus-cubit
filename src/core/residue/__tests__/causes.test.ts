/**
 * The residue's vocabulary against the refusal register (L-QTY-05, Q-07, R-SPINE-062, I-188).
 *
 * The grid paints a cell by the SEVERITY the register gives its cause and names it by the register's
 * own MESSAGE, so a cause registered without words, without a remedy or with a severity the tint map
 * does not hold is a cell a reader meets with nothing to read. That is the reading proved here, and
 * it is proved by naming each cause: Q-07's register admits a code when an executed test names it.
 *
 * The roster is not transcribed — every question is asked of `RESIDUE_CAUSES` itself (B-19) — but the
 * six causes are named once below, because a name is what the register scans for and a code named
 * nowhere is a code nothing accounts for.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS, type RefusalEntry, type RefusalSeverity } from "../../errors";
import { AXIS_IDLE_READINGS, BILL_CAUSES, IN_BILL, MEASUREMENT_CAUSES, QUANTITY_BEARING, RESIDUE_CAUSES } from "../law";

/** The six causes of this grid, named so the register can account for each (Q-07). */
const NAMED = ["NOT_ESTABLISHED", "INGESTION_TRUNCATED", "NOT_IN_PROJECT_SCOPE", "NO_BEARER_SIGHTED", "KIND_NOT_YET_SEEDED", "NOT_IN_THIS_BILL"];

/** The severities the grid has a tint for (I-188) — a cause outside them paints nothing. */
const PAINTED: readonly RefusalSeverity[] = ["error", "warning", "info"];

const entryOf = (code: string): RefusalEntry | undefined => (REFUSALS as Readonly<Record<string, RefusalEntry | undefined>>)[code];

describe("the residue's causes are the register's codes", () => {
  test("the two axes' causes are exactly the closed set the legend enumerates", () => {
    expect(RESIDUE_CAUSES, "one grid, two axes, one roster of causes over both (L-QTY-05)").toEqual([...MEASUREMENT_CAUSES, ...BILL_CAUSES]);
    expect([...RESIDUE_CAUSES].sort(), "and the six are named by this file, so each is accounted for by name (Q-07)").toEqual([...NAMED].sort());
  });

  test("every cause carries the register's words, its remedy and a severity the grid paints", () => {
    for (const cause of RESIDUE_CAUSES) {
      const entry = entryOf(cause);
      expect(entry, `${cause} is a registered refusal — the residue's vocabulary is the register's (R-SPINE-062)`).toBeDefined();
      expect(entry?.code, `${cause} is registered under its own name`).toBe(cause);
      expect((entry?.message ?? "").trim().length, `${cause} states what happened, in words a reader meets (I-191)`).toBeGreaterThan(0);
      expect((entry?.remedy ?? "").trim().length, `${cause} states what resolves it — every cause a remedy (X-3)`).toBeGreaterThan(0);
      expect(PAINTED, `${cause}'s severity is one the grid has a tint for (I-188)`).toContain(entry?.severity);
    }
  });

  test("the two idle readings are refusal-shaped and are no refusals", () => {
    expect(AXIS_IDLE_READINGS, "an axis at rest reads as measured, or as in this bill").toEqual([QUANTITY_BEARING, IN_BILL]);
    for (const reading of AXIS_IDLE_READINGS) {
      expect(entryOf(reading), `${reading} is not a refusal — a cell that bears quantity is answered with a figure (L-QTY-05)`).toBeUndefined();
    }
  });
});
