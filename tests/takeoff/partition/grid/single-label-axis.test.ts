/**
 * AC-5(f) — the axis of a family too small to have spread of its own.
 *
 * A family georeferences along the world axis its own bubbles spread along. A family of ONE bubble
 * has no spread, and the detection falls back to x whatever the drawing says
 * (debt-src-modules-19kpb4g) — an arbitrary default that no acceptance ever exercised. Grid families
 * cross each other: the family that stands still runs perpendicular to the family that spreads, and
 * that is what a lone bubble's axis is read from. Only where nothing spreads at all is there nothing
 * to read, and x is then a stated convention rather than an accident.
 *
 * Both orientations are drawn, because a drawing whose letters happen to run across the page cannot
 * tell the rule from the habit.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { REPO_ROOT } from "../support/partition-stage";

const ASSIGN_MODULE = "src/modules/takeoff/partition/views/assign.ts";
const CENSUS_MODULE = "src/modules/takeoff/partition/conventions/census.ts";
const RESOLVE_MODULE = "src/core/rulesets/methods/conventions/resolve.ts";
const DETECT_MODULE = "src/modules/takeoff/partition/grid/detect.ts";

const LAYER_CAPTIONS = "CAPTIONS";
const LAYER_BUBBLES = "GRID-BUBBLES";
const LAYER_LABELS = "GRID-LABELS";
const LAYER_LINES = "GRID-LINES";
const CAPTION_HEIGHT = 5;
const LABEL_HEIGHT = 1.5;
const RADIUS = 3;
const VERTICES = 16;

/** The two families a grid is bubbled in, and the two world axes they can run along. */
const LETTER = "letter";
const NUMERAL = "numeral";
const AXIS_X = "x";
const AXIS_Y = "y";

type Drawn = { key: string; type: string; space: string; layer: string; text?: string; height?: number; points: number[][]; closed?: boolean };
type AxisRow = { viewKey: string; family: string; label: string; axis: string; position: number; bubbleKey: string; labelKey: string; minSpacing: number };
type Bubble = { text: string; centre: readonly [number, number] };

async function moduleAt<T>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  return (await import(absolute)) as T;
}

/** A plan whose bubbles stand exactly where they are asked to stand. */
function sheet(bubbles: readonly Bubble[]): unknown {
  const entities: Drawn[] = [{ key: "T1", type: "TEXT", space: "Model", layer: LAYER_CAPTIONS, text: "TYPICAL FLOOR PLAN", height: CAPTION_HEIGHT, points: [[0, 0]] }];
  bubbles.forEach((bubble, index) => {
    entities.push({
      key: `RING-${index}`,
      type: "LWPOLYLINE",
      space: "Model",
      layer: LAYER_BUBBLES,
      closed: true,
      points: Array.from({ length: VERTICES }, (_unused, vertex) => {
        const angle = (2 * Math.PI * vertex) / VERTICES;
        return [bubble.centre[0] + RADIUS * Math.cos(angle), bubble.centre[1] + RADIUS * Math.sin(angle)];
      }),
    });
    entities.push({ key: `LABEL-${index}`, type: "TEXT", space: "Model", layer: LAYER_LABELS, text: bubble.text, height: LABEL_HEIGHT, points: [[...bubble.centre]] });
  });
  entities.push({ key: "L1", type: "LINE", space: "Model", layer: LAYER_LINES, points: [[-40, -25], [30, -25]] });
  entities.push({ key: "L2", type: "LINE", space: "Model", layer: LAYER_LINES, points: [[0, -45], [0, -5]] });

  return {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [{ name: "Model", kind: "model", bbox: { min: [-50, -50], max: [50, 10] }, strays_rejected: 0 }],
    dropped_layouts: [],
    entities: entities.map((record) => ({ ...record, colour: { rgb: [0, 0, 0], source: "bylayer" } })),
    derived: [],
    block_attributes: [],
    counters: [],
  };
}

async function detect(graph: unknown): Promise<readonly AxisRow[]> {
  const assign = await moduleAt<{ partitionArtifact: (graph: unknown) => { views: readonly unknown[]; assignments: ReadonlyMap<string, string> } }>(ASSIGN_MODULE);
  const census = await moduleAt<{ censusOf: (graph: unknown, views: readonly unknown[]) => unknown }>(CENSUS_MODULE);
  const conventions = await moduleAt<{ resolve: (census: unknown) => unknown }>(RESOLVE_MODULE);
  const grid = await moduleAt<{ detectGrid: (evidence: unknown) => { axes: readonly AxisRow[] } }>(DETECT_MODULE);

  const partitioned = assign.partitionArtifact(graph);
  const profile = conventions.resolve(census.censusOf(graph, partitioned.views));
  return grid.detectGrid({ graph, views: partitioned.views, assignments: partitioned.assignments, profile }).axes;
}

/** The axes one family's rows were all georeferenced along — a family speaks with one voice. */
function axisOf(rows: readonly AxisRow[], family: string): string[] {
  return [...new Set(rows.filter((row) => row.family === family).map((row) => row.axis))];
}

test("AC-5(f): a lone numeral crosses letters that run down the page", async () => {
  const rows = await detect(sheet([
    { text: "A", centre: [0, -10] },
    { text: "B", centre: [0, -40] },
    { text: "1", centre: [-30, -25] },
  ]));

  expect(rows.length, "three bubbles, three axis rows").toBe(3);
  expect(axisOf(rows, LETTER), "the letters spread along y, so that is the axis they georeference along").toEqual([AXIS_Y]);
  expect(axisOf(rows, NUMERAL), "one numeral has no spread of its own, so it runs across the family that has").toEqual([AXIS_X]);
});

test("AC-5(f): a lone numeral crosses letters that run across the page too", async () => {
  const rows = await detect(sheet([
    { text: "A", centre: [0, -30] },
    { text: "B", centre: [20, -30] },
    { text: "1", centre: [-30, -10] },
  ]));

  expect(rows.length, "three bubbles, three axis rows").toBe(3);
  expect(axisOf(rows, LETTER), "these letters spread along x").toEqual([AXIS_X]);
  expect(axisOf(rows, NUMERAL), "so the lone numeral runs down the page — perpendicular to the family that spreads, not x by default").toEqual([AXIS_Y]);
});
