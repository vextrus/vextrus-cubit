// R-UI-040's first half: the server builds a render manifest per sheet — colour already resolved,
// text already carrying its world height, every record keyed, grouped by layer — so the browser
// tessellates and never interprets. Nothing here reads a camera, a viewport or a token: what a
// manifest holds is the drawing, and how much of it is drawn is the client's question.
//
// The manifest re-states no fact the artifact does not carry. Colour comes from `colour.rgb`, which
// L-CAD-05 already resolved through true colour → explicit → BYLAYER → BYBLOCK; heights come from
// the record's own `height`; the world box comes from the layout inventory's bbox, robust and
// stray-free as the reading left it (L-CAD-05). A second answer to any of those would be a second
// reading, and a drawing has one (ARCH-02).
import { createHash } from "node:crypto";
import type { EntityGraph } from "../../../core/entitygraph/schema";
import type { RenderLayer, RenderManifest, RenderRecord } from "./types";

/** The manifest shape's own version — a client reads it before it trusts the rest. */
const MANIFEST_VERSION = 1;

/** A drawn record of an artifact, original or derived paint: the two lists a sheet is painted from. */
type DrawnRecord = EntityGraph["entities"][number] | EntityGraph["derived"][number];

/** The identity a record is painted under: its own source key, or the instance key it was painted from. */
function identityOf(record: DrawnRecord): { key: string } | { src: string } {
  return "key" in record ? { key: record.key } : { src: record.src };
}

/** One artifact record as the client paints it. Text keeps its world height and its single anchor. */
function renderRecordOf(record: DrawnRecord): RenderRecord {
  const common = { ...identityOf(record), type: record.type, rgb: record.colour.rgb };
  if (record.text !== undefined) {
    const anchor = record.points?.[0];
    return {
      ...common,
      text: record.text,
      ...(record.height === undefined ? {} : { height: record.height }),
      ...(anchor === undefined ? {} : { anchor }),
    };
  }
  return { ...common, ...(record.points === undefined ? {} : { points: record.points }) };
}

/**
 * The swatch a layer is shown by: the colour most of its records resolved to, first appearance
 * winning a tie. A layer's records mostly resolve BYLAYER and answer one colour, but nothing in the
 * artifact promises that — an entity may carry its own true colour — so the swatch is derived from
 * what the layer actually holds rather than asserted, and a layer holding nothing shows black.
 */
function swatchOf(records: readonly RenderRecord[]): readonly [number, number, number] {
  const tally = new Map<string, { rgb: readonly [number, number, number]; count: number }>();
  for (const record of records) {
    const at = record.rgb.join(",");
    const held = tally.get(at);
    if (held === undefined) tally.set(at, { rgb: record.rgb, count: 1 });
    else held.count += 1;
  }
  let winner: { rgb: readonly [number, number, number]; count: number } | undefined;
  for (const entry of tally.values()) if (winner === undefined || entry.count > winner.count) winner = entry;
  return winner?.rgb ?? [0, 0, 0];
}

/**
 * Every record of a sheet, in one comparable string per record — what the digest is taken over.
 * It carries exactly what a painter would draw differently if it changed: the identity, the type,
 * the colour, the geometry, the copy and the world height.
 */
function digestSubject(manifest: Omit<RenderManifest, "digest">): string {
  const layers = manifest.layers.map((layer) => [
    layer.name,
    layer.rgb,
    layer.entityCount,
    layer.records.map((record) => [
      record.key ?? "",
      record.src ?? "",
      record.type,
      record.rgb,
      record.points ?? null,
      record.text ?? null,
      record.height ?? null,
      record.anchor ?? null,
    ]),
  ]);
  return JSON.stringify([manifest.version, manifest.layoutName, manifest.extents, manifest.insunits, layers]);
}

/**
 * One sheet's identity as a sha256 (R-UI-043: the manifest is cached by content hash). Two builds of
 * one graph answer the same digest and a sheet whose geometry moved answers another, which is what
 * makes a cached manifest safe to serve and a stale one impossible to mistake for a fresh one.
 */
export function manifestDigest(manifest: Omit<RenderManifest, "digest"> & { digest?: string }): string {
  return createHash("sha256").update(digestSubject(manifest)).digest("hex");
}

/**
 * The key one sheet's manifest is cached under: the bytes it was built from and the layout it is of.
 * Content-addressed on both halves — a re-ingest writes new bytes and therefore a new key, and two
 * sheets of one drawing never share an entry (R-UI-043).
 */
export function manifestCacheKey(artifactSha256: string, layoutName: string): string {
  return `${artifactSha256}:${encodeURIComponent(layoutName)}`;
}

/** Whether an artifact knows a layout at all: its inventory names it, or records stand in it. */
export function graphHoldsLayout(graph: EntityGraph, layoutName: string): boolean {
  if (graph.layouts.some((layout) => layout.name === layoutName)) return true;
  return graph.entities.some((entity) => entity.space === layoutName) || graph.derived.some((record) => record.space === layoutName);
}

/**
 * The render manifest of one sheet: every record whose space is that layout, grouped under the layer
 * it names, in the artifact's own order, and nothing else. The layers partition the sheet — a record
 * is carried once, under one layer, and Σ of the counts is the sheet's own record count.
 */
export function buildRenderManifest(graph: EntityGraph, layoutName: string): RenderManifest {
  const grouped = new Map<string, RenderRecord[]>();
  for (const record of [...graph.entities, ...graph.derived] as DrawnRecord[]) {
    if (record.space !== layoutName) continue;
    const held = grouped.get(record.layer);
    if (held === undefined) grouped.set(record.layer, [renderRecordOf(record)]);
    else held.push(renderRecordOf(record));
  }

  const layers: RenderLayer[] = [...grouped.entries()].map(([name, records]) => ({
    name,
    rgb: swatchOf(records),
    entityCount: records.length,
    records,
  }));

  const inventory = graph.layouts.find((layout) => layout.name === layoutName);
  const draft = {
    version: MANIFEST_VERSION,
    layoutName,
    extents: inventory?.bbox ?? null,
    insunits: graph.insunits,
    layers,
  } as const satisfies Omit<RenderManifest, "digest">;

  return { ...draft, digest: manifestDigest(draft) };
}
