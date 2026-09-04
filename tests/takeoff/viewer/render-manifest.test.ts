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
function judgeManifest(manifest: RenderManifest, graph: ReturnType<typeof syntheticEntityGraph>, layoutName: string, what: string): void {
  const expected = recordsInLayout(graph, layoutName);
  const counts = expectedLayerCounts(graph, layoutName);

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
