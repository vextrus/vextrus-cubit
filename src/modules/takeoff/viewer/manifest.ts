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
//
// A paper sheet is its own paint and what its viewports show of model space. The inventory carries
// each window as the drawing states it; `./projection` moves the model-space records a window frames
// onto the paper, clipped to the frame, each named by the model entity it shows (`src`) and the
// window that showed it (`via`). Those pieces join the sheet's layers under the layer the model
// entity names, so the layers panel of a sheet lists what the sheet shows, as a plot of it would.
import { createHash } from "node:crypto";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { projectedRecords, unionOfFrames, windowsOf } from "./projection";
import type { RenderLayer, RenderManifest, RenderRecord } from "./types";

/** The name the artifact gives model space (`vextrus_cad.ingest.MODEL_SPACE`). */
const MODEL_SPACE = "model";

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
  const closed = "closed" in record && record.closed === true ? { closed: true } : {};
  if (record.text !== undefined) {
    const anchor = record.points?.[0];
    return {
      ...common,
      ...closed,
      text: record.text,
      ...(record.height === undefined ? {} : { height: record.height }),
      ...(anchor === undefined ? {} : { anchor }),
    };
  }
  return { ...common, ...closed, ...(record.points === undefined ? {} : { points: record.points }) };
}

/**
 * The swatch a layer is shown by: the colour most of its records resolved to, first appearance
 * winning a tie. A layer's records mostly resolve BYLAYER and answer one colour, but nothing in the
 * artifact promises that — an entity may carry its own true colour — so the swatch is derived from
 * what the layer actually holds rather than asserted.
 *
 * A layer of the manifest is a layer something is drawn on: the grouping below only mints one when
 * a record names it. So the reading takes a first record and the rest, and there is no empty case to
 * stand a colour in for — a black returned for "we had nothing to read" is indistinguishable from a
 * layer really drawn in black.
 */
function swatchOf(first: RenderRecord, ...rest: readonly RenderRecord[]): readonly [number, number, number] {
  const tally = new Map<string, { rgb: readonly [number, number, number]; count: number }>();
  for (const record of [first, ...rest]) {
    const at = record.rgb.join(",");
    const held = tally.get(at);
    if (held === undefined) tally.set(at, { rgb: record.rgb, count: 1 });
    else held.count += 1;
  }
  let winner = { rgb: first.rgb, count: 0 };
  for (const entry of tally.values()) if (entry.count > winner.count) winner = entry;
  return winner.rgb;
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
      record.closed ?? null,
      record.text ?? null,
      record.height ?? null,
      record.anchor ?? null,
      record.via ?? null,
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
 * The render manifest of one sheet: every record whose space is that layout, then every piece of
 * model space its windows show, grouped under the layer each names, in the artifact's own order,
 * and nothing else. The layers partition the sheet — a record is carried once, under one layer,
 * and Σ of the counts is the sheet's own record count. Model space itself opens no windows.
 */
export function buildRenderManifest(graph: EntityGraph, layoutName: string): RenderManifest {
  // Typed non-empty: a layer exists because a record named it, and the swatch reading takes that
  // first record rather than a list it would have to invent a colour for (B-17).
  const grouped = new Map<string, [RenderRecord, ...RenderRecord[]]>();
  const add = (layer: string, record: RenderRecord): void => {
    const held = grouped.get(layer);
    if (held === undefined) grouped.set(layer, [record]);
    else held.push(record);
  };
  const drawn = [...graph.entities, ...graph.derived] as DrawnRecord[];
  for (const record of drawn) {
    if (record.space === layoutName) add(record.layer, renderRecordOf(record));
  }

  const inventory = graph.layouts.find((layout) => layout.name === layoutName);
  const windows = inventory?.kind === "paper" && layoutName !== MODEL_SPACE ? windowsOf(inventory) : [];
  if (windows.length > 0) {
    const modelRecords = drawn.filter((record) => record.space === MODEL_SPACE);
    for (const { record, layer } of projectedRecords(modelRecords, windows, renderRecordOf)) add(layer, record);
  }

  const layers: RenderLayer[] = [...grouped.entries()].map(([name, records]) => ({
    name,
    rgb: swatchOf(...records),
    entityCount: records.length,
    records,
  }));

  // A sheet of windows and nothing else still has a place its windows stand: their frames.
  const draft = {
    version: MANIFEST_VERSION,
    layoutName,
    extents: inventory?.bbox ?? unionOfFrames(windows),
    insunits: graph.insunits,
    layers,
  } as const satisfies Omit<RenderManifest, "digest">;

  return { ...draft, digest: manifestDigest(draft) };
}
