// @vitest-environment node
/**
 * RES-1 — a cell read in part never paints as published (§4.3, risk note 4; s-coverage I-548).
 *
 * The residue attributes a cell to truncation by DRAWING (every sighting on a drawing read only in
 * part), and since RES-1 a sighting names the sheet its key stands on (`S-10 COLUMN LAYOUT PLAN`)
 * while a truncated sheet is still named as the manifest names the drawing (`rcc6-bnbc.dxf`). The
 * heat once reckoned what survived by matching those two names, which can no longer meet: an
 * INGESTION_TRUNCATED cell would have painted at share 1, ramp step 4 — whole. It is reckoned by
 * drawing now, as the residue attributes it.
 *
 * The cell is the residue's own resolution of the staged input (`resolveResidue`), never a hand-built
 * reading, so the heat is judged against what the grid is actually handed.
 */
import { describe, expect, test } from "vitest";
import { rampStep, sharePublished } from "@/modules/takeoff/coverage/heat";
import type { ResidueCell } from "@/core/residue/law";
import { GF, INGESTION_TRUNCATED, REGISTER, residueSeam, type ResidueCellShape, type ResidueInputShape, type SightingShape } from "./support/coverage-stage";

/** The seam under `residue.ts` opens a pool at import time; the address is stated, never dialled. */
process.env["DATABASE_URL"] ??= "postgresql://cubit_app:cubit_app@127.0.0.1:5544/postgres";

const COLUMN = "column";
const CONCRETE = "rcc.concrete";

/** The drawing read in part, as the manifest names it — a FILE. */
const TRUNCATED_DRAWING = { drawingId: "dwg-structural", layoutName: "rcc6-bnbc.dxf" };

/** A drawing of the same manifest that was read whole. */
const WHOLE_DRAWING = "dwg-architectural";

/** A sighting of the column on the ground floor, on the sheet its key stands on. */
function seen(drawingId: string, layoutName: string, sourceKey: string): SightingShape {
  return { class: COLUMN, levelId: GF.levelId, channel: REGISTER, drawingId, layoutName, sourceKey };
}

function staged(sightings: SightingShape[]): ResidueInputShape {
  return {
    bears: [{ class: COLUMN, kind: CONCRETE }],
    workItems: [CONCRETE],
    levels: [{ ...GF }],
    sightings,
    lines: [],
    declarations: [],
    truncated: [{ ...TRUNCATED_DRAWING }],
    observations: [],
  };
}

async function cellOf(input: ResidueInputShape): Promise<ResidueCellShape> {
  const cells = (await residueSeam()).resolveResidue(input);
  const found = cells.filter((cell) => cell.kind === CONCRETE && cell.class === COLUMN && cell.levelId === GF.levelId);
  expect(found.length, `one cell for the column's concrete on GF: ${JSON.stringify(cells)}`).toBe(1);
  return found[0] as ResidueCellShape;
}

describe("RES-1: the heat reckons a truncated cell by drawing, as the residue attributes it", () => {
  test("RES-1: a cell whose sightings name their sheets, on a drawing read in part, paints at 0 — never whole", async () => {
    const cell = await cellOf(staged([seen(TRUNCATED_DRAWING.drawingId, "S-10 COLUMN LAYOUT PLAN", "v:LAYOUT_PLAN:DXF_HANDLE:20B6|C1|0,0@GF")]));
    expect(cell.measurement, "every sighting stands on the drawing read in part, so the residue says so").toBe(INGESTION_TRUNCATED);
    const share = sharePublished(cell as unknown as ResidueCell, [{ ...TRUNCATED_DRAWING }]);
    expect(share, "nothing of it survived ingestion whole: the sheet's name and the manifest's name differ, and the drawing is the same").toBe(0);
    expect(rampStep(share), "so the ramp paints it at the empty step, not the published one").toBe(0);
  });

  test("RES-1: a sighting on a drawing that was read whole still counts toward the share", () => {
    const cell = {
      measurement: INGESTION_TRUNCATED,
      lineIds: [],
      sightings: [seen(TRUNCATED_DRAWING.drawingId, "S-10 COLUMN LAYOUT PLAN", "a"), seen(WHOLE_DRAWING, "A-101 GROUND FLOOR PLAN", "b")],
    } as unknown as ResidueCell;
    expect(sharePublished(cell, [{ ...TRUNCATED_DRAWING }]), "one of two sightings survived: the one on the drawing read whole").toBe(0.5);
  });
});
