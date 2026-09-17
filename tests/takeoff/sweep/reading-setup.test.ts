/**
 * AC-3(e): a reading that cites nothing is no reading of the setup — never one minted with an empty
 * source key (debt-src-modules-1axjj56, L-QTY-03, L-CAD-03).
 *
 * `readingSetupOf` is the one place the partition's readings become the setup's, so it is asked by
 * name: what a rail is handed is a reading a reader can follow back, or nothing at all.
 */
import { describe, expect, test } from "vitest";
import { MODULE, productModule } from "./support/sweep-stage";

/** One stored reading, as the partition hands a rail one. */
type SideReading = { value: string; unit: string; basis: string; sourceKeys: readonly string[] };

/** One reading of the setup: the figure, and the atom it is traced back to. */
type ReadingSetup = { value: string; unit: string; basis: string; source: string } | null;

type Of = (reading: SideReading | null) => ReadingSetup;

async function readingSetupOf(): Promise<Of> {
  const door = await productModule<Record<string, unknown>>(MODULE.measureSetup);
  expect(typeof door["readingSetupOf"], `${MODULE.measureSetup} EXPORTS \`readingSetupOf\` — the one carrying of a partition reading into the setup (interfaces, B-17)`).toBe("function");
  return door["readingSetupOf"] as Of;
}

describe("AC-3: a reading with nothing to cite is answered as none", () => {
  test("AC-3: a reading citing no source key answers null, while one that cites an atom is carried whole", async () => {
    const of = await readingSetupOf();

    expect(
      of({ value: "3000", unit: "mm", basis: "MEASURED", sourceKeys: [] }),
      "a reading with no citation is no reading a line can stand on: minting it with an empty source key publishes a figure nothing in the drawing answers for, and L-QTY-03 asks every measured attribute for the atom it was read from",
    ).toBeNull();

    expect(of(null), "and a partition that read nothing there answers nothing here").toBeNull();

    expect(
      of({ value: "3000", unit: "mm", basis: "MEASURED", sourceKeys: ["S-102:e:7", "S-102:e:8"] }),
      "while a reading that cites the drawing is carried across whole, sourced at the FIRST atom it was read from — a reader follows that one back to the run (L-CAD-03)",
    ).toEqual({ value: "3000", unit: "mm", basis: "MEASURED", source: "S-102:e:7" });
  });
});
