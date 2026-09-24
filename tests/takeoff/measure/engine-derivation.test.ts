/**
 * OPEN-4 — the engine a placement was read by is derived, never stamped (L-QTY-03, L-QTY-06;
 * s-drawings I-654).
 *
 * A placement stands on atoms of a drawing (its outline, its mark, its note), each a source key whose
 * scheme names who minted it (L-CAD-02). Where any atom is the vectoriser's (`RASTER_TRACE`), the
 * line it publishes says RASTER and carries the trace's identity — the vectoriser, its version and
 * parameter set, the page raster and the DPI it was read at (I-584). A drawing whose atoms are all a
 * CAD handle or a PDF object stays VECTOR, and its artifact is never opened for this. And the rails
 * carry what the setup derived onto every offer, through the one door (`sightedBy`).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT, productModule } from "../../server/support/wire";

/** The engine seam's module and the offers contract, loaded as the product ships them. */
const ENGINE_MODULE = "src/modules/takeoff/measure/engine.ts";
const CONTRACT_MODULE = "src/core/offers/contract.ts";

type Atoms = { outlineKey: string; markKey: string; noteKey: string | null };
type Identity = { tool: string; toolVersion: string; parameterSetHash: string; pageSha256: string; dpi: string | null; dpiSource: string };
type Sighting = { engine: string; raster?: Identity };
type EngineRecord = {
  extractor: { scheme: string; tool: string; toolVersion: string; parameterSetHash: string };
  trace: { tool: string; toolVersion: string; parameterSetHash: string } | null;
};
type Picture = { space: string; sha256: string; width: number; height: number; dpi: number | null; dpi_source: string; deskew_degrees: number; placement: [number, number][]; traced: number; dropped_short: number; image?: string };
type Graph = { entities: { key: string; type: string; space: string; layer: string; colour: unknown; points?: [number, number][] }[]; rasters?: Picture[] };
type EngineDoor = {
  engineOf: (atoms: Atoms) => string;
  sightingOf: (atoms: Atoms, record: EngineRecord, graph: () => Promise<Graph>) => Promise<Sighting>;
};
type ContractDoor = { sightedBy: (placement: { engine: string; raster?: Identity }) => Sighting };

/** A whole sha256 in the digest schemes' own spelling (uppercase), as a key half is minted. */
const digest = (seed: string): string => seed.repeat(64).slice(0, 64).toUpperCase();
const TRACED_OUTLINE = `RASTER_TRACE:${digest("a1")}`;
const TRACED_MARK = `RASTER_TRACE:${digest("b2")}`;
const PDF_MARK = `PDF_OBJECT:${digest("c3")}`;
const PDF_OUTLINE = `PDF_OBJECT:${digest("d4")}`;

/** The vectoriser's identity as I-584 pins it, and pdfium's beside it on a mixed page. */
const VECTORISER = { tool: "opencv-lsd", toolVersion: "4.13.0.90", parameterSetHash: "f".repeat(64) };
const PDFIUM = { scheme: "PDF_OBJECT", tool: "pypdfium2", toolVersion: "5.13.0", parameterSetHash: "e".repeat(64) };

/** A standalone scan: the record's own extractor is the vectoriser. */
const SCAN_RECORD: EngineRecord = { extractor: { scheme: "RASTER_TRACE", ...VECTORISER }, trace: null };
/** A PDF page carrying a pasted scan: pdfium's identity, with the vectoriser's beside it (I-518). */
const MIXED_RECORD: EngineRecord = { extractor: PDFIUM, trace: VECTORISER };
/** A DXF: ezdxf's identity, no trace. */
const DXF_RECORD: EngineRecord = { extractor: { scheme: "DXF_HANDLE", tool: "ezdxf", toolVersion: "1.4.4", parameterSetHash: "d".repeat(64) }, trace: null };

const square = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
  [x0, y1],
  [x1, y1],
  [x1, y0],
  [x0, y0],
];

function picture(sha: string, placement: [number, number][], dpi: number | null, source: string): Picture {
  return { space: "Page 1", sha256: sha.repeat(64).slice(0, 64), width: 1000, height: 1000, dpi, dpi_source: source, deskew_degrees: 0, placement, traced: 10, dropped_short: 0 };
}

function line(key: string, points: [number, number][], space = "Page 1"): Graph["entities"][number] {
  return { key, type: "LINE", space, layer: "TRACE", colour: 7, points };
}

/** A graph thunk that fails the case if the seam opens the artifact at all. */
const unopened = (): Promise<Graph> => {
  throw new Error("the artifact was opened for a placement no trace stands under");
};

describe("OPEN-4: a placement's engine is the scheme of what it was read off", () => {
  test("a DXF placement is VECTOR, carries no identity, and opens no artifact", async () => {
    const door = await productModule<EngineDoor>(ENGINE_MODULE);
    const atoms = { outlineKey: "DXF_HANDLE:1A2", markKey: "DXF_HANDLE:1A3", noteKey: "DXF_HANDLE:9BA" };
    expect(door.engineOf(atoms)).toBe("VECTOR");
    const sighting = await door.sightingOf(atoms, DXF_RECORD, unopened);
    expect(sighting).toEqual({ engine: "VECTOR" });
    expect(Object.hasOwn(sighting, "raster"), "a vector sighting has no raster key at all, so a vector offer's shape is the one it always was").toBe(false);
  });

  test("a vector PDF's placement is VECTOR, and so is one on a mixed page read off pdfium's objects", async () => {
    const door = await productModule<EngineDoor>(ENGINE_MODULE);
    expect(await door.sightingOf({ outlineKey: PDF_OUTLINE, markKey: PDF_MARK, noteKey: null }, MIXED_RECORD, unopened)).toEqual({ engine: "VECTOR" });
  });

  test("a standalone scan's placement is RASTER, with the vectoriser, its page raster and the DPI the file states", async () => {
    const door = await productModule<EngineDoor>(ENGINE_MODULE);
    const graph: Graph = { entities: [line(TRACED_OUTLINE, [[10, 10], [20, 10]]), line(TRACED_MARK, [[12, 12], [14, 12]])], rasters: [picture("9", square(0, 0, 1000, 1000), 300, "file")] };
    const atoms = { outlineKey: TRACED_OUTLINE, markKey: TRACED_MARK, noteKey: null };
    expect(door.engineOf(atoms)).toBe("RASTER");
    expect(await door.sightingOf(atoms, SCAN_RECORD, () => Promise.resolve(graph))).toEqual({
      engine: "RASTER",
      raster: { ...VECTORISER, pageSha256: "9".repeat(64), dpi: "300", dpiSource: "file" },
    });
  });

  test("a trace on a mixed PDF page is RASTER under the vectoriser beside pdfium's — its mark may be a PDF text, its outline was traced", async () => {
    const door = await productModule<EngineDoor>(ENGINE_MODULE);
    const graph: Graph = { entities: [line(TRACED_OUTLINE, [[100, 100], [140, 100]])], rasters: [picture("7", square(50, 50, 400, 400), 152.4, "placement")] };
    const sighting = await door.sightingOf({ outlineKey: TRACED_OUTLINE, markKey: PDF_MARK, noteKey: null }, MIXED_RECORD, () => Promise.resolve(graph));
    expect(sighting).toEqual({ engine: "RASTER", raster: { ...VECTORISER, pageSha256: "7".repeat(64), dpi: "152.4", dpiSource: "placement" } });
    expect(sighting.raster?.tool, "never pdfium's identity for a traced atom (I-518)").not.toBe(PDFIUM.tool);
  });

  test("any traced atom makes the placement RASTER — a traced mark over a drawn outline too", async () => {
    const door = await productModule<EngineDoor>(ENGINE_MODULE);
    expect(door.engineOf({ outlineKey: PDF_OUTLINE, markKey: TRACED_MARK, noteKey: null })).toBe("RASTER");
    expect(door.engineOf({ outlineKey: PDF_OUTLINE, markKey: PDF_MARK, noteKey: TRACED_MARK })).toBe("RASTER");
  });

  test("a DPI nobody stated is carried as null under `unstated`, never inferred (I-584 §4)", async () => {
    const door = await productModule<EngineDoor>(ENGINE_MODULE);
    const graph: Graph = { entities: [line(TRACED_OUTLINE, [[1, 1], [2, 2]])], rasters: [picture("5", square(0, 0, 1000, 1000), null, "unstated")] };
    const sighting = await door.sightingOf({ outlineKey: TRACED_OUTLINE, markKey: TRACED_MARK, noteKey: null }, SCAN_RECORD, () => Promise.resolve(graph));
    expect(sighting.raster).toEqual({ ...VECTORISER, pageSha256: "5".repeat(64), dpi: null, dpiSource: "unstated" });
  });

  test("two scans pasted on one page: the one whose placement holds the atom answers; where none or both do, RASTER with no identity", async () => {
    const door = await productModule<EngineDoor>(ENGINE_MODULE);
    const left = picture("1", square(0, 0, 100, 100), 200, "placement");
    const right = picture("2", square(200, 0, 300, 100), 150, "placement");
    const atoms = { outlineKey: TRACED_OUTLINE, markKey: PDF_MARK, noteKey: null };
    const on = (points: [number, number][], rasters: Picture[]) => door.sightingOf(atoms, MIXED_RECORD, () => Promise.resolve({ entities: [line(TRACED_OUTLINE, points)], rasters }));

    expect((await on([[210, 10], [290, 10]], [left, right])).raster?.pageSha256, "the right-hand scan holds the traced line").toBe("2".repeat(64));
    expect((await on([[10, 10], [90, 10]], [left, right])).raster?.dpi, "and the left-hand one at its own DPI").toBe("200");
    const straddling = await on([[50, 10], [250, 10]], [left, right]);
    expect(straddling, "a line neither picture holds whole is RASTER, and its identity is not guessed").toEqual({ engine: "RASTER" });
    const overlapping = await on([[210, 10], [290, 10]], [right, { ...right, sha256: "3".repeat(64) }]);
    expect(overlapping, "two pictures both holding it: no single one answers").toEqual({ engine: "RASTER" });
  });

  test("a traced atom the artifact does not hold, or a record pinning no vectoriser, stays RASTER with no identity — never VECTOR", async () => {
    const door = await productModule<EngineDoor>(ENGINE_MODULE);
    const atoms = { outlineKey: TRACED_OUTLINE, markKey: TRACED_MARK, noteKey: null };
    const empty: Graph = { entities: [], rasters: [picture("9", square(0, 0, 10, 10), 300, "file")] };
    expect(await door.sightingOf(atoms, SCAN_RECORD, () => Promise.resolve(empty))).toEqual({ engine: "RASTER" });
    const held: Graph = { entities: [line(TRACED_OUTLINE, [[1, 1], [2, 2]])], rasters: [picture("9", square(0, 0, 10, 10), 300, "file")] };
    expect(await door.sightingOf(atoms, DXF_RECORD, () => Promise.resolve(held))).toEqual({ engine: "RASTER" });
  });
});

/** The column rail, and one column on one level as a hand-built input (the rail is a pure function). */
const COLUMN_RAIL_MODULE = "src/modules/takeoff/rails/columns/index.ts";
const REVISION = "11111111-1111-4111-8111-111111111111";
const INGEST = "33333333-3333-4333-8333-333333333333";
const VIEW = "PLAN:S-102:t:4";
const LEVEL = "44444444-4444-4444-8444-444444444444";
const PLACED = "PLACEMENT:S-102:C1:1000:2000";

function columnInput(sighted: Record<string, unknown>): unknown {
  const objectKey = `${PLACED}@${LEVEL}`;
  return {
    campaignId: "00000000-0000-4000-8000-0000000000c1",
    setRevisionId: REVISION,
    kind: "rcc.concrete",
    objects: [
      {
        tenantId: "00000000-0000-4000-8000-000000000001",
        setRevisionId: REVISION,
        objectKey,
        projectId: "00000000-0000-4000-8000-000000000002",
        discipline: "STRUCTURAL",
        elementType: "column",
        mark: "C1",
        viewKey: VIEW,
        placementKey: PLACED,
        levelId: LEVEL,
        levelSlot: null,
        levelLabel: null,
        standing: "MEASURED",
        semantic: `semantic:${objectKey}`,
        registeredAt: new Date(0),
      },
    ],
    setup: {
      placements: {
        [PLACED]: { drawingId: "22222222-2222-4222-8222-222222222222", ingestId: INGEST, viewKey: VIEW, memberFamily: "C1", sourceEntity: PLACED, outline: null, noteShape: null, noteKey: null, ...sighted },
      },
      memberTypes: {
        [INGEST]: { C1: [{ variantKey: "C1", bandFrom: null, bandTo: null, sectionText: "300x450", sectionWidth: 300, sectionDepth: 450, sectionUnit: "mm", sourceKeys: ["S-102:e:7"], dimensions: {}, rebar: [] }] },
      },
      levels: [{ levelId: LEVEL, label: "L1", ordinal: 1, height: { standing: "AGREED", value: "3", unit: "M", basis: "TRANSCRIBED", sourceKey: "S-105:e:3" } }],
      calibrations: { [INGEST]: { [VIEW]: "cal-1" } },
      grades: {},
      runs: {},
      lintels: {},
    },
  };
}

describe("OPEN-4: the rails carry the sighting onto every offer", () => {
  const IDENTITY: Identity = { ...VECTORISER, pageSha256: "9".repeat(64), dpi: "300", dpiSource: "file" };

  test("sightedBy answers the engine alone under VECTOR and the identity beside it under RASTER", async () => {
    const contract = await productModule<ContractDoor>(CONTRACT_MODULE);
    const vector = contract.sightedBy({ engine: "VECTOR" });
    expect(vector).toEqual({ engine: "VECTOR" });
    expect(Object.hasOwn(vector, "raster")).toBe(false);
    expect(contract.sightedBy({ engine: "RASTER", raster: IDENTITY })).toEqual({ engine: "RASTER", raster: IDENTITY });
  });

  test("a column sighted on a scan is offered RASTER with the trace's identity; the same column on a DXF is offered VECTOR with none", async () => {
    const door = await productModule<{ columnConcreteRail: (input: unknown) => { offers: readonly Record<string, unknown>[] } }>(COLUMN_RAIL_MODULE);
    const offerAt = (sighted: Record<string, unknown>): Record<string, unknown> => {
      const offers = door.columnConcreteRail(columnInput(sighted)).offers;
      expect(offers.length, "one column on one level is one offer").toBe(1);
      return offers[0] as Record<string, unknown>;
    };

    const scanned = offerAt({ engine: "RASTER", raster: IDENTITY });
    expect(scanned["engine"]).toBe("RASTER");
    expect(scanned["raster"], "the offer carries the vectoriser, its version, its parameter set, the page raster and its DPI (L-QTY-03)").toEqual(IDENTITY);

    const drawn = offerAt({ engine: "VECTOR" });
    expect(drawn["engine"]).toBe("VECTOR");
    expect(Object.hasOwn(drawn, "raster"), "a vector offer carries no raster key").toBe(false);
  });

  test("no rail offers the engine but through sightedBy, and the setup stamps no engine constant", () => {
    const takeoff = join(REPO_ROOT, "src", "modules", "takeoff");
    const sources: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) sources.push(path);
      }
    };
    walk(takeoff);
    const copying = sources.filter((path) => /engine:\s*[\w.]*placement\.engine\b/u.test(readFileSync(path, "utf8")));
    expect(copying.map((path) => path.slice(REPO_ROOT.length + 1)), "a rail that copies the engine alone would drop a scan's identity (B-17)").toEqual([]);
    const setup = readFileSync(join(takeoff, "measure", "setup.ts"), "utf8");
    expect(/engine:\s*(VECTOR|"VECTOR"|'VECTOR')/u.test(setup), "the setup derives the engine from the atoms (engine.ts), never stamps VECTOR").toBe(false);
    expect(setup, "and it derives it through the engine seam").toContain("sightingOf(placement, record, graph)");
  });
});
