/**
 * I-684 — the render manifest carries a background reference for every scan a sheet was traced
 * from, and a drawn sheet's manifest is the manifest it always was.
 *
 * Over the committed corpus (every artifact a drawn one, none carrying `rasters`) and over one of
 * them given a scan record on one sheet: the backdrops are read back from that record, only on its
 * sheet, and the digest moves exactly when what a painter would draw under the lines does (B-19).
 */
import { describe, expect, test } from "vitest";
import type { EntityGraph, RasterRecord } from "../../../src/core/entitygraph/schema";
import { buildRenderManifest, manifestDigest } from "../../../src/modules/takeoff/viewer/manifest";
import { committedArtifactNames, committedGraph, layoutNamesOf } from "./support/viewer-support";

/** A scan record on `space`, as the vectoriser writes one (I-584). */
function scanRecord(space: string, placement: [number, number][]): RasterRecord {
  return {
    space,
    sha256: "a".repeat(64),
    width: 720,
    height: 480,
    dpi: null,
    dpi_source: "unstated",
    deskew_degrees: 0,
    placement,
    traced: 1,
    dropped_short: 0,
  };
}

const PLACEMENT: [number, number][] = [
  [0, 480],
  [720, 480],
  [720, 0],
  [0, 0],
];

describe("the manifest's backdrops (I-684)", () => {
  test("no drawn sheet of the corpus carries a backdrop, and its digest is spelled as before", () => {
    for (const name of committedArtifactNames()) {
      const graph = committedGraph(name);
      for (const layout of layoutNamesOf(graph)) {
        const manifest = buildRenderManifest(graph, layout);
        expect("backdrops" in manifest, `${name} / ${layout}`).toBe(false);
        // The digest of a manifest with an explicit empty key would differ; one without the key is the old subject.
        expect(manifest.digest).toBe(manifestDigest({ version: manifest.version, layoutName: manifest.layoutName, extents: manifest.extents, insunits: manifest.insunits, layers: manifest.layers }));
      }
    }
  });

  test("a scanned sheet names its scan at the recorded corners, and no other sheet does", () => {
    const [name] = committedArtifactNames();
    const graph = committedGraph(name as string);
    const [scanned, other] = layoutNamesOf(graph);
    const record = scanRecord(scanned as string, PLACEMENT);
    const withScan = { ...graph, rasters: [record] } as EntityGraph;

    const manifest = buildRenderManifest(withScan, scanned as string);
    expect(manifest.backdrops).toEqual([{ index: 0, sha256: record.sha256, width: record.width, height: record.height, placement: PLACEMENT }]);
    if (other !== undefined) expect("backdrops" in buildRenderManifest(withScan, other), "a sheet the scan is not on carries none").toBe(false);

    const drawn = buildRenderManifest(graph, scanned as string);
    expect(manifest.digest, "a scan under the lines is part of what is painted").not.toBe(drawn.digest);
    const moved = buildRenderManifest({ ...graph, rasters: [scanRecord(scanned as string, PLACEMENT.map(([x, y]) => [x + 1, y] as [number, number]))] } as EntityGraph, scanned as string);
    expect(moved.digest, "and where it stands is too").not.toBe(manifest.digest);
  });
});
