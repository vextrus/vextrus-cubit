/**
 * The Quantities sheet carries a scan's provenance (L-QTY-03, s-takeoff I-685): a line read off a
 * scan names the trace it was read from — vectoriser, version, parameter set, page raster and the
 * resolution as stated — and who agreed what it was read as. A line read off vector geometry leaves
 * both cells empty rather than inventing either.
 *
 * Judged over the golden roster's own reading, with one line's register evidence carrying what an
 * AGREED line's evidence carries; the composer is the shipped one.
 */
import { describe, expect, test } from "vitest";
import { SCAN_TRACE } from "../../support/raster-trace";
import { rosterReading, specModule, type ExportReadingShape } from "./support/boq-xlsx-stage";

/** Who agreed the scan's line, as the register's reading derives it from the resolving act. */
const AGREED_BY = { actId: "7c9e1f2a-4b3d-4e5f-8a6b-0c1d2e3f4a5b", actorId: "3a4b5c6d-7e8f-4a0b-9c1d-2e3f4a5b6c7d" };

describe("A-BOQ-XLSX: a line read off a scan carries its trace and who agreed it", () => {
  test("the Quantities sheet writes the trace whole and the agreeing act beside the line — and nothing beside a vector line", async () => {
    const spec = await specModule();
    const roster = await rosterReading();
    const [scanned, vector] = roster.evidence;
    expect(scanned !== undefined && vector !== undefined, "the roster reading carries at least two lines").toBe(true);
    const reading: ExportReadingShape = {
      ...roster,
      evidence: roster.evidence.map((held) => (held.lineId === scanned?.lineId ? { ...held, raster: { ...SCAN_TRACE }, agreedBy: AGREED_BY } : held)),
    };

    const sheet = spec.boqQuantitiesSheetOf(reading);
    const at = (header: string): number => {
      const index = sheet.columns.findIndex((column) => column.header === header);
      expect(index, `the Quantities sheet heads a ${header} column`).toBeGreaterThanOrEqual(0);
      return index;
    };
    const [line, trace, agreed] = [at("Line"), at("Trace"), at("Agreed by")];
    const rowOf = (lineId: string) => {
      const row = sheet.rows.find((cells) => cells[line] === lineId);
      expect(row, `${lineId} stands on the Quantities sheet`).toBeDefined();
      return row as NonNullable<typeof row>;
    };

    const scannedRow = rowOf(scanned?.lineId as string);
    const words = String(scannedRow[trace]);
    for (const part of [SCAN_TRACE.tool, SCAN_TRACE.toolVersion, SCAN_TRACE.parameterSetHash, SCAN_TRACE.pageSha256, SCAN_TRACE.dpi, SCAN_TRACE.dpiSource]) {
      expect(words, `the trace names ${part}, whole`).toContain(part);
    }
    expect(String(scannedRow[agreed]), "who agreed it, and the act a checker finds it under").toContain(AGREED_BY.actorId);
    expect(String(scannedRow[agreed])).toContain(AGREED_BY.actId);

    const vectorRow = rowOf(vector?.lineId as string);
    expect([vectorRow[trace], vectorRow[agreed]], "a vector line names no trace and no agreement").toEqual([null, null]);
  });
});
