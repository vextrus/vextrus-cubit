/**
 * The one synthetic sheet this increment's acceptance is driven on (test contract:
 * `syntheticEntityGraph({ entities, layers, seed })`), and its one identity (Q-17): the unit suites,
 * the held-out sets and the J-011 stage all take their 100 000-entity sheet from here rather than
 * each inventing one.
 *
 * It is a generator, not a committed blob: R-TO-010's budget is stated at 100 000 entities and a
 * 15 MB artifact in the tree would be a fixture nobody could read. Everything it emits is derived
 * from the seed, so two calls with the same options are byte-identical — which is what makes
 * `manifestDigest` comparable across builds and what makes the journey's staged sheet reproducible.
 *
 * The shape is EntityGraph v2 exactly as `src/core/entitygraph/schema.ts` mirrors it (L-CAD-05); the
 * suites parse what this emits through that schema rather than trusting this file, so a graph that
 * drifted from the mirror fails as a fixture defect and never as the product's.
 *
 * Nothing here reads product source. The type is imported as a type alone so this module carries no
 * value import of `src/` and can be loaded before any product module opens a pool.
 */
import { createHash } from "node:crypto";
import type { EntityGraph } from "../../../../src/core/entitygraph/schema";

/** How a caller asks for a sheet: how much of it, spread over how many layers, from which seed. */
export type SyntheticOptions = {
  entities: number;
  layers?: number;
  seed?: number;
};

/** The sheet's world box, in drawing units — every generated point falls inside it. */
export const SYNTHETIC_EXTENTS: { readonly min: readonly [number, number]; readonly max: readonly [number, number] } = Object.freeze({
  min: Object.freeze([0, 0] as [number, number]),
  max: Object.freeze([1000, 700] as [number, number]),
});

/**
 * The world heights the text records are drawn at, smallest to largest (AC-5: "heights from 0.1 to
 * 100 drawing units"). A geometric spread is what makes level-of-detail observable: at any one
 * camera some of these are below `LEGIBLE_TEXT_PX` and some above it, and a zoom of 8 always moves
 * the boundary across several of them.
 */
export const SYNTHETIC_TEXT_HEIGHTS: readonly number[] = Object.freeze([0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100]);

/** The space the generated sheet lives in — one model layout, as L-CAD-05 shapes a layout inventory. */
export const SYNTHETIC_LAYOUT = "model";

/**
 * Every tenth record *of each layer* is text, so a 100 000-entity sheet carries 10 000 of them to
 * hide and reveal and no layer is left with none. Counted within the layer rather than across the
 * whole sheet: a stride taken on the global index aliases with the round-robin whenever the layer
 * count shares a factor with it, and every layer would then be either all text or none.
 */
const TEXT_EVERY = 10;

/**
 * How far the height ladder advances between one text record of a layer and its next. Coprime with
 * `SYNTHETIC_TEXT_HEIGHTS.length`, so a layer's texts walk the whole ladder — smallest and largest
 * included — rather than settling on one arm of it.
 */
const HEIGHT_STRIDE = 3;

/** The three drawn types the sheet is made of — a path, a longer path, and a piece of text. */
const TEXT_TYPE = "TEXT";
const LINE_TYPE = "LINE";
const POLYLINE_TYPE = "LWPOLYLINE";

/** A small deterministic generator: the same seed gives the same sheet on every machine. */
function lcg(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** A coordinate rounded to three decimals, so the artifact is exact text rather than float noise. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** The layer names, derived from the count asked for — `SYN-00`, `SYN-01`, … */
export function syntheticLayerNames(layers: number): string[] {
  return Array.from({ length: layers }, (_, index) => `SYN-${String(index).padStart(2, "0")}`);
}

/** A layer's resolved colour: BYLAYER, spread around the wheel so no two layers paint alike. */
function layerColour(index: number, layers: number): [number, number, number] {
  const turn = (index / Math.max(layers, 1)) * 6;
  const channel = (offset: number): number => {
    const wave = Math.cos(((turn + offset) * Math.PI) / 3);
    return Math.min(240, Math.max(20, Math.round(128 + 100 * wave)));
  };
  return [channel(0), channel(2), channel(4)];
}

/** The key a record at this index is minted under: the scheme, then the handle in uppercase hex. */
export function syntheticKey(index: number): string {
  return `DXF_HANDLE:${(index + 0x100).toString(16).toUpperCase()}`;
}

/**
 * A deterministic EntityGraph v2 of the size asked for.
 *
 * Layers are round-robin, and what a record *is* — text or geometry, at which height, of which
 * type — is decided by its position within its own layer's turn (`within`), never by its position
 * in the sheet. That is what makes the promise true rather than merely intended: every layer
 * carries both kinds of geometry and the same spread of text heights, smallest and largest
 * included, for every layer count. A criterion that isolates one layer or hides one therefore gets
 * a comparable sheet whichever layer it picks.
 */
export function syntheticEntityGraph(options: SyntheticOptions): EntityGraph {
  const count = options.entities;
  const layers = Math.max(options.layers ?? 4, 1);
  const random = lcg(options.seed ?? 20260904);
  const names = syntheticLayerNames(layers);
  const colours = names.map((_, index) => layerColour(index, layers));

  const [minX, minY] = SYNTHETIC_EXTENTS.min;
  const [maxX, maxY] = SYNTHETIC_EXTENTS.max;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const entities: EntityGraph["entities"] = [];

  for (let index = 0; index < count; index += 1) {
    const layerIndex = index % layers;
    // The record's place in its own layer's run: index = layerIndex + within * layers, so `within`
    // counts 0, 1, 2, … within every layer alike whatever the layer count is.
    const within = Math.floor(index / layers);
    const type = within % TEXT_EVERY === TEXT_EVERY - 1 ? TEXT_TYPE : within % 2 === 0 ? LINE_TYPE : POLYLINE_TYPE;
    const x = round(minX + random() * spanX);
    const y = round(minY + random() * spanY);
    const colour = { rgb: colours[layerIndex] ?? [0, 0, 0], source: "bylayer" as const };
    const base = { key: syntheticKey(index), type, space: SYNTHETIC_LAYOUT, layer: names[layerIndex] ?? "", colour };

    if (type === TEXT_TYPE) {
      const height = SYNTHETIC_TEXT_HEIGHTS[(Math.floor(within / TEXT_EVERY) * HEIGHT_STRIDE) % SYNTHETIC_TEXT_HEIGHTS.length] ?? 1;
      // The anchor: text carries a single point so the sheet can place it, and the world height the
      // extractor read (L-CAD-05: "text carries world height").
      entities.push({ ...base, text: `N${index}`, height, points: [[x, y]] });
      continue;
    }

    const toX = round(Math.min(x + round(1 + random() * 40), maxX));
    const toY = round(Math.min(y + round(1 + random() * 40), maxY));
    const points: [number, number][] =
      type === LINE_TYPE
        ? [
            [x, y],
            [toX, toY],
          ]
        : [
            [x, y],
            [toX, y],
            [toX, toY],
          ];
    entities.push({ ...base, points, ...(type === POLYLINE_TYPE ? { closed: false } : {}) });
  }

  return {
    entitygraph_version: 2,
    ingest: {
      scheme: "DXF_HANDLE",
      tool: "synthetic-graph",
      tool_version: "1",
      parameter_set_hash: createHash("sha256").update(`${count}:${layers}:${options.seed ?? 20260904}`).digest("hex"),
    },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      {
        name: SYNTHETIC_LAYOUT,
        kind: "model",
        bbox: { min: [...SYNTHETIC_EXTENTS.min], max: [...SYNTHETIC_EXTENTS.max] },
        strays_rejected: 0,
      },
    ],
    dropped_layouts: ["SYN-EMPTY"],
    entities,
    derived: [],
    block_attributes: [],
    counters: [{ space: SYNTHETIC_LAYOUT, explode_truncated: false, explode_losses: {}, flatten_capped: {} }],
  } as EntityGraph;
}

/** The same sheet as the bytes an artifact is stored as — what SEAM-STORAGE holds and the CLI emits. */
export function syntheticArtifact(options: SyntheticOptions): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(syntheticEntityGraph(options)));
}
