/**
 * AC-1 — the render manifest, over every committed artifact and over the synthetic 100 000-entity
 * sheet: `layers` partition exactly the records of the layout asked for, every record keyed, every
 * colour the one the reading resolved, every text at its world height, and a digest that is stable
 * for one sheet and moves when the geometry does (R-UI-040, L-CAD-05).
 *
 * Every expectation is derived from the artifact under test rather than transcribed: the corpus is
 * read from its directory, the layouts from the records' own `space`, the layer roster from the
 * records' own `layer`. A corpus that grows a fixture, a layout or a layer grows this suite with it
 * (B-19), and nothing here freezes a roster or a count a later increment may lawfully change.
 */
import { describe, expect, test } from "vitest";
import { syntheticEntityGraph } from "./support/synthetic-graph";
import {
  ENTITYGRAPH_MODULE,
  committedArtifactNames,
  committedGraph,
  expectedComposites,
  expectedLayerCounts,
  layoutNamesOf,
  manifestComposites,
  productModule,
  recordsInLayout,
  viewerSeam,
  type GraphSchemaModule,
  type RenderManifest,
} from "./support/viewer-support";
import { V3_RECORD_FIELDS, type EntityGraph } from "../../../src/core/entitygraph/schema";
import type { RenderRecord } from "../../../src/modules/takeoff/viewer/types";

/** A sha256, as every digest in this tree is spelled. */
const SHA256 = /^[0-9a-f]{64}$/;

/** The synthetic sheet the criterion names: 100 000 entities over at least four layers. */
const SYNTHETIC = { entities: 100_000, layers: 4, seed: 110 } as const;

/** What Σ over a manifest's layers answers, for the two totals a partition has. */
function totals(manifest: RenderManifest): { counted: number; carried: number } {
  return {
    counted: manifest.layers.reduce((sum, layer) => sum + layer.entityCount, 0),
    carried: manifest.layers.reduce((sum, layer) => sum + layer.records.length, 0),
  };
}

/**
 * The whole of AC-1's manifest half, applied to one graph and one of its layouts. It is one function
 * because the criterion is one rule stated over "every committed artifact (each of its layouts) and
 * the synthetic graph" — a rule spelled twice is a rule that can drift.
 */
function judgeManifest(built: RenderManifest, graph: ReturnType<typeof syntheticEntityGraph>, layoutName: string, what: string): void {
  const expected = recordsInLayout(graph, layoutName);
  const counts = expectedLayerCounts(graph, layoutName);

  // A sheet's layers carry its own paint and, through its viewports, pieces of model space (`via`).
  // The partition below is stated over the sheet's own records; the projected pieces are judged by
  // tests/takeoff/viewer/projection.test.ts, and here only for being counted where they are carried.
  for (const layer of built.layers) {
    expect(layer.entityCount, `${what}: layer ${layer.name} counts the records it carries, projected pieces included`).toBe(layer.records.length);
  }
  const ownLayers = built.layers
    .map((layer) => ({ ...layer, records: layer.records.filter((record) => record.via === undefined) }))
    .map((layer) => ({ ...layer, entityCount: layer.records.length }))
    .filter((layer) => layer.records.length > 0);
  const manifest: RenderManifest = { ...built, layers: ownLayers };

  expect(manifest.layoutName, `${what}: the manifest names the layout it was built for`).toBe(layoutName);
  expect(totals(manifest).counted, `${what}: Σ layers[].entityCount is the count of records whose space is ${layoutName}`).toBe(expected.length);
  expect(totals(manifest).carried, `${what}: the layers carry exactly those records — no record dropped, none carried twice`).toBe(expected.length);

  expect(
    manifest.layers.map((layer) => layer.name).sort(),
    `${what}: the layers are the layers those records name, each once — no key appears in two layers`,
  ).toEqual([...counts.keys()].sort());

  for (const layer of manifest.layers) {
    expect(layer.entityCount, `${what}: layer ${layer.name} counts the records it carries`).toBe(layer.records.length);
    expect(layer.entityCount, `${what}: layer ${layer.name} carries every record of the artifact that names it`).toBe(counts.get(layer.name));
    expect(layer.rgb.length, `${what}: layer ${layer.name} publishes a swatch colour as [r,g,b]`).toBe(3);
  }

  // The one comparison that carries the rest of the criterion: source key (or `src` for derived
  // paint), type, the layer the record is grouped under, the resolved rgb, and the world height of
  // every text — for every record, as a multiset.
  expect(manifestComposites(manifest), `${what}: every record is carried once, keyed, in its own layer, at the resolved colour and world height`).toEqual(
    expectedComposites(graph, layoutName),
  );

  expect(manifest.digest, `${what}: the manifest carries a sha256 digest`).toMatch(SHA256);
}

describe("AC-1: buildRenderManifest over the committed corpus and the synthetic sheet", () => {
  test("AC-1: every committed artifact, every one of its layouts, is partitioned by layer", async () => {
    const { buildRenderManifest } = await viewerSeam();
    const names = committedArtifactNames();

    for (const name of names) {
      const graph = committedGraph(name);
      const layouts = layoutNamesOf(graph);
      expect(layouts.length, `${name}: the artifact carries records in at least one space (L-CAD-05)`).toBeGreaterThan(0);
      for (const layoutName of layouts) {
        judgeManifest(buildRenderManifest(graph, layoutName) as RenderManifest, graph, layoutName, `${name} / ${layoutName}`);
      }
    }
  });

  test("AC-1: the synthetic 100 000-entity sheet is partitioned the same way", async () => {
    const { entityGraphSchema } = await productModule<GraphSchemaModule>(ENTITYGRAPH_MODULE);
    const graph = syntheticEntityGraph(SYNTHETIC);
    expect(entityGraphSchema.safeParse(graph).success, "the synthetic sheet is an EntityGraph v2 the mirror parses (L-CAD-05)").toBe(true);
    expect(graph.entities.length, "the synthetic sheet is the 100 000 entities the budget is stated at").toBe(SYNTHETIC.entities);
    expect(new Set(graph.entities.map((entity) => entity.layer)).size, "over at least four layers").toBeGreaterThanOrEqual(4);

    const { buildRenderManifest } = await viewerSeam();
    const layoutName = layoutNamesOf(graph)[0] as string;
    judgeManifest(buildRenderManifest(graph, layoutName) as RenderManifest, graph, layoutName, `synthetic / ${layoutName}`);
  });

  test("AC-1: the digest is one sheet's identity — stable across builds, moved by one entity's points", async () => {
    const { buildRenderManifest, manifestDigest } = await viewerSeam();
    const layoutName = layoutNamesOf(syntheticEntityGraph({ entities: 40, layers: 4, seed: 7 }))[0] as string;

    const first = buildRenderManifest(syntheticEntityGraph({ entities: 40, layers: 4, seed: 7 }), layoutName) as RenderManifest;
    const second = buildRenderManifest(syntheticEntityGraph({ entities: 40, layers: 4, seed: 7 }), layoutName) as RenderManifest;
    expect(manifestDigest(first), "the digest of a manifest is a sha256").toMatch(SHA256);
    expect(manifestDigest(second), "two builds of the same graph answer the same digest — this is what a content-keyed cache is keyed on").toBe(
      manifestDigest(first),
    );

    const moved = syntheticEntityGraph({ entities: 40, layers: 4, seed: 7 });
    const subject = moved.entities.find((entity) => entity.points !== undefined && entity.points.length > 0);
    expect(subject, "the synthetic sheet carries geometry to move").toBeDefined();
    const points = subject?.points as [number, number][];
    points[0] = [(points[0]?.[0] ?? 0) + 13.5, (points[0]?.[1] ?? 0) - 7.25];

    expect(
      manifestDigest(buildRenderManifest(moved, layoutName) as RenderManifest),
      "moving one entity's points is a different sheet, so it is a different digest",
    ).not.toBe(manifestDigest(first));
  });
});

/* ------------------------------------------------ how a text is turned and set (I-462) */

type Drawn = EntityGraph["entities"][number];

/** The committed sheet of windows, with a text of every placement a drawing can state added to it. */
function placedGraph(): EntityGraph {
  const graph = committedGraph("viewports");
  const colour = { rgb: [255, 255, 255] as [number, number, number], source: "bylayer" as const };
  const single = (key: string, space: string, fields: Partial<Drawn>): Drawn => ({
    key,
    type: "TEXT",
    space,
    layer: "S-TEXT",
    colour,
    height: 200,
    rotation: 0,
    halign: 0,
    valign: 0,
    ...fields,
  });
  const block = (key: string, fields: Partial<Drawn>): Drawn => ({ key, type: "MTEXT", space: "model", layer: "S-TEXT", colour, height: 200, rotation: 0, ...fields });
  // Region A, which the on-window frames at 1:50; every placement once, on its own handle.
  const added: Drawn[] = [
    single("DXF_HANDLE:F01", "model", { text: "C1", points: [[4000, 4000]] }),
    // ezdxf writes a justified text's insert equal to its alignment point — the file BNBC is.
    single("DXF_HANDLE:F02", "model", { text: "C2", points: [[5000, 5000]], halign: 1, valign: 2, align_point: [5000, 5000] }),
    single("DXF_HANDLE:F03", "model", { text: "C3", points: [[5500, 5000]], halign: 2, valign: 3, align_point: [6000, 5000] }),
    single("DXF_HANDLE:F04", "model", { text: "C4", points: [[7000, 5000]], halign: 4, valign: 0, align_point: [7100, 5100] }),
    single("DXF_HANDLE:F05", "model", { text: "2B7", points: [[8000, 3000]], rotation: 90, halign: 1, valign: 0, align_point: [8000, 3500] }),
    single("DXF_HANDLE:F06", "model", { text: "ALIGNED", points: [[1000, 1000]], rotation: 45, halign: 3, valign: 0, align_point: [3000, 3000] }),
    single("DXF_HANDLE:F07", "model", { text: "FIT", points: [[1000, 8000]], halign: 5, valign: 0, align_point: [4000, 8000] }),
    block("DXF_HANDLE:F08", { text: "NOTE\\PLINE", points: [[9000, 9000]], attachment: 1 }),
    block("DXF_HANDLE:F09", { text: "DIM", points: [[9000, 7000]], attachment: 5 }),
    block("DXF_HANDLE:F0A", { text: "END", points: [[9000, 6000]], attachment: 9, rotation: 270 }),
    // The sheet's own paint, turned: a sheet number running up the paper.
    single("DXF_HANDLE:F0B", "SHEET", { text: "S-10", points: [[800, 40]], rotation: 90 }),
  ];
  return { ...graph, entities: [...graph.entities, ...added] };
}

/** Every text a manifest carries, by the key it is selected under. */
function textsOf(manifest: RenderManifest): Map<string, RenderRecord> {
  const found = new Map<string, RenderRecord>();
  for (const layer of manifest.layers) for (const record of layer.records as RenderRecord[]) if (record.text !== undefined) found.set(record.key ?? record.src ?? "", record);
  return found;
}

/** One text of a manifest, which the test has just placed there. */
function textAt(texts: Map<string, RenderRecord>, handle: string): RenderRecord {
  const found = texts.get(`DXF_HANDLE:${handle}`);
  expect(found, `the manifest carries DXF_HANDLE:${handle}`).toBeDefined();
  return found as RenderRecord;
}

describe("AC-1: a text is carried turned and set as the drawing states it (L-CAD-05 v3, I-462)", () => {
  test("the placed graph is a lawful v3 artifact", async () => {
    const { entityGraphSchema } = await productModule<GraphSchemaModule>(ENTITYGRAPH_MODULE);
    expect(entityGraphSchema.safeParse(placedGraph()).success, "every added text carries the facts v3 requires of it").toBe(true);
  });

  test("model space: each placement is carried as the one the painter lays, and a square text left on its baseline carries none", async () => {
    const { buildRenderManifest } = await viewerSeam();
    const texts = textsOf(buildRenderManifest(placedGraph(), "model") as RenderManifest);
    const at = (handle: string): RenderRecord => textAt(texts, handle);

    expect(at("F01").anchor, "left on its baseline and square: the insert").toEqual([4000, 4000]);
    expect([at("F01").justify, at("F01").rotation, at("F01").fit], "and nothing else").toEqual([undefined, undefined, undefined]);
    expect(at("F02"), "centred on its middle: set by the alignment point").toMatchObject({ anchor: [5000, 5000], justify: { x: "centre", y: "middle" } });
    expect(at("F03"), "right on its top: the alignment point, never the insert beside it").toMatchObject({ anchor: [6000, 5000], justify: { x: "right", y: "top" } });
    expect(at("F04"), "DXF's 'middle' is centred both ways, whatever the vertical code says").toMatchObject({ anchor: [7100, 5100], justify: { x: "centre", y: "middle" } });
    expect(at("F05"), "a turned mark keeps its turn and its centring").toMatchObject({ anchor: [8000, 3500], rotation: 90, justify: { x: "centre", y: "baseline" } });
    expect(at("F06"), "an aligned text runs from its insert to its alignment point, its height scaled").toMatchObject({
      anchor: [1000, 1000],
      fit: { to: [3000, 3000], height: "scaled" },
      rotation: 45,
    });
    expect(at("F07"), "a fitted text runs the same way, its height kept").toMatchObject({ anchor: [1000, 8000], fit: { to: [4000, 8000], height: "kept" } });
    expect(at("F08"), "an MTEXT attached top left is set by that corner — never on its baseline").toMatchObject({ anchor: [9000, 9000], justify: { x: "left", y: "top" } });
    expect(at("F09").justify, "attachment 5 is the middle of the block").toEqual({ x: "centre", y: "middle" });
    expect(at("F0A"), "attachment 9 is the bottom right, and the block keeps its turn").toMatchObject({ justify: { x: "right", y: "bottom" }, rotation: 270 });
    expect(at("F08").text, "the words stay verbatim in the manifest: what they show is the display reading's").toBe("NOTE\\PLINE");
  });

  test("through a window: the turn and the setting ride along, and a fitted text's second point is projected with its first", async () => {
    const { buildRenderManifest } = await viewerSeam();
    const graph = placedGraph();
    const window = graph.layouts.find((layout) => layout.name === "SHEET")?.viewports?.find((each) => each.on && each.twist === 0);
    expect(window, "the sheet opens one square window").toBeDefined();
    const open = window as NonNullable<typeof window>;
    const scale = open.size[1] / open.view_height;
    const paper = (point: readonly [number, number]): [number, number] => [
      open.centre[0] + (point[0] - open.view_centre[0]) * scale,
      open.centre[1] + (point[1] - open.view_centre[1]) * scale,
    ];
    const texts = textsOf(buildRenderManifest(graph, "SHEET") as RenderManifest);
    const shown = (handle: string): RenderRecord => textAt(texts, handle);

    expect(shown("F05").via, "the turned mark is seen through the window").toBe(open.handle);
    expect(shown("F05")).toMatchObject({ rotation: 90, justify: { x: "centre", y: "baseline" } });
    expect(shown("F05").anchor?.[0]).toBeCloseTo(paper([8000, 3500])[0], 9);
    expect(shown("F05").anchor?.[1]).toBeCloseTo(paper([8000, 3500])[1], 9);
    expect(shown("F05").height).toBeCloseTo(200 * scale, 12);
    expect(shown("F06").fit?.height).toBe("scaled");
    expect(shown("F06").fit?.to[0]).toBeCloseTo(paper([3000, 3000])[0], 9);
    expect(shown("F06").fit?.to[1]).toBeCloseTo(paper([3000, 3000])[1], 9);
    expect(shown("F0B"), "the sheet's own turned number is carried as the sheet states it").toMatchObject({ anchor: [800, 40], rotation: 90 });
    expect(shown("F0B").via, "and it is the sheet's own paint").toBeUndefined();
  });

  test("a text read at v2 carries no turn and no setting — it is laid where it always was", async () => {
    const { buildRenderManifest } = await viewerSeam();
    const graph = placedGraph();
    const v2: EntityGraph = {
      ...graph,
      entitygraph_version: 2,
      entities: graph.entities.map((record) => Object.fromEntries(Object.entries(record).filter(([field]) => !(V3_RECORD_FIELDS as readonly string[]).includes(field))) as Drawn),
    };
    const texts = textsOf(buildRenderManifest(v2, "model") as RenderManifest);
    for (const [key, record] of texts) {
      expect([record.rotation, record.justify, record.fit], `${key}: nothing v2 does not state`).toEqual([undefined, undefined, undefined]);
    }
    expect(textAt(texts, "F03").anchor, "and it is set at its insert").toEqual([5500, 5000]);
  });

  test("the digest moves when a text is turned or set otherwise — the painter would draw it differently", async () => {
    const { buildRenderManifest, manifestDigest } = await viewerSeam();
    const graph = placedGraph();
    const first = manifestDigest(buildRenderManifest(graph, "model") as RenderManifest);
    const changed = (fields: Partial<Drawn>): EntityGraph => ({
      ...graph,
      entities: graph.entities.map((record) => (record.key === "DXF_HANDLE:F02" ? { ...record, ...fields } : record)),
    });
    expect(manifestDigest(buildRenderManifest(changed({ rotation: 30 }), "model") as RenderManifest), "a turn").not.toBe(first);
    expect(manifestDigest(buildRenderManifest(changed({ halign: 2 }), "model") as RenderManifest), "a setting").not.toBe(first);
    expect(manifestDigest(buildRenderManifest(graph, "model") as RenderManifest), "and the same graph, the same digest").toBe(first);
  });
});
