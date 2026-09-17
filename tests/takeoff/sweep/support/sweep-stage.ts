/**
 * The stage this sweep's acceptance is driven from: the product's own modules, loaded by path, and
 * hand-drawn artifacts for the pure partition stages to read.
 *
 * Nothing here is a fixture of the product's: every artifact is drawn by the case that reads it, so
 * what a stage answers is a function of what was drawn and of nothing else (B-19). A module the
 * sweep has not landed yet fails as an assertion naming the file, which is the red a missing feature
 * owes rather than a collection death.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

/**
 * The checkout this suite runs in. A suite mounted OUTSIDE the checkout is told where it is; the
 * lanes inside it find it from this file's own place in the tree.
 */
const STATED_ROOT = process.env["BUILDER_REPO_ROOT"]?.trim() ?? "";
const REPO_ROOT = STATED_ROOT === "" ? fileURLToPath(new URL("../../../../", import.meta.url)) : STATED_ROOT;

/** One product module, by its path in the tree — asserted present before it is imported. */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/** The modules this sweep reads, by the path each one lives at. */
export const MODULE = Object.freeze({
  reconstruct: "src/modules/takeoff/partition/schedules/reconstruct.ts",
  registry: "src/modules/takeoff/partition/schedules/registry.ts",
  detect: "src/modules/takeoff/partition/grid/detect.ts",
  propose: "src/modules/takeoff/partition/levels-proposal/propose.ts",
  resolve: "src/modules/takeoff/partition/expansion/resolve.ts",
  runs: "src/modules/takeoff/partition/placement/runs.ts",
  offersContract: "src/core/offers/contract.ts",
  frameErrors: "src/core/errors/frame.ts",
  levelErrors: "src/core/errors/takeoff-levels.ts",
  foundationErrors: "src/core/errors/foundations.ts",
  errors: "src/core/errors.ts",
  measureSetup: "src/modules/takeoff/measure/setup.ts",
  basis: "src/modules/takeoff/register-ui/basis.ts",
  origin: "src/modules/takeoff/register-ui/origin.ts",
  citedAct: "src/modules/takeoff/coverage/cited-act.ts",
  kept: "src/modules/takeoff/schedules-ui/kept.ts",
  registerJson: "src/modules/takeoff/export/register-json/schema.ts",
});

/* ------------------------------------------------------------------ an artifact, drawn by hand */

/** A point in the drawing's own plane, as the artifact carries one. */
export type Point = [number, number];

/** One entity of a hand-drawn artifact — the artifact's own record shape (EntityGraph v2). */
export type Entity = {
  key: string;
  type: string;
  space: string;
  layer: string;
  colour: { rgb: [number, number, number]; source: string };
  text?: string;
  height?: number;
  points?: Point[];
  closed?: boolean;
  area?: number;
};

/** The one colour every hand-drawn entity carries; what it is decides nothing. */
const CHANNELS = Object.freeze({ rgb: [0, 0, 0] as [number, number, number], source: "explicit" });

/** The layer a hand-drawn entity stands on unless a case names another. */
export const LAYER = "S-ANNO";

/** The model space a hand-drawn artifact draws in. */
export const MODEL_SPACE = "Model";

/** A source key of the DXF-handle scheme, minted from an ordinal (L-CAD-02). */
export function handle(ordinal: number): string {
  return `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;
}

/** One text of the drawing: what it says, where it was drawn, and how tall it stands. */
export function text(key: string, said: string, at: Point, options: { height?: number; layer?: string } = {}): Entity {
  return { key, type: "TEXT", space: MODEL_SPACE, layer: options.layer ?? LAYER, colour: { ...CHANNELS }, text: said, height: options.height ?? 1, points: [at] };
}

/** One closed ring of the drawing, drawn through the points it was given. */
export function ring(key: string, points: readonly Point[], options: { layer?: string; area?: number } = {}): Entity {
  return {
    key,
    type: "LWPOLYLINE",
    space: MODEL_SPACE,
    layer: options.layer ?? LAYER,
    colour: { ...CHANNELS },
    points: points.map((point) => [point[0], point[1]] as Point),
    closed: true,
    area: options.area ?? 0,
  };
}

/** One straight line of the drawing. */
export function line(key: string, from: Point, to: Point, options: { layer?: string } = {}): Entity {
  return { key, type: "LINE", space: MODEL_SPACE, layer: options.layer ?? LAYER, colour: { ...CHANNELS }, points: [from, to] };
}

/** A ring of `count` vertices about a centre, each vertex at the radius its own index is given. */
export function polygon(centre: Point, radii: readonly number[]): Point[] {
  return radii.map((radius, index) => {
    const angle = (2 * Math.PI * index) / radii.length;
    return [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)] as Point;
  });
}

/** A whole artifact carrying these entities — every other field at the shape the mirror admits. */
export function graphOf(entities: readonly Entity[], options: { unit?: string; code?: number } = {}): Record<string, unknown> {
  return {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "hand", tool_version: "1", parameter_set_hash: "0".repeat(64) },
    insunits: { code: options.code ?? 4, unit: options.unit ?? "mm", unmapped: false },
    layouts: [{ name: MODEL_SPACE, kind: "model", bbox: null, strays_rejected: 0 }],
    dropped_layouts: [],
    entities: entities.map((entity) => ({ ...entity })),
    derived: [],
    block_attributes: [],
    counters: [],
  };
}

/** One partitioned view, as the views stage assigns one. */
export function view(options: { viewKey: string; type: string; caption: string; anchorKey: string | null }): Record<string, unknown> {
  return { viewKey: options.viewKey, type: options.type, reason: null, caption: options.caption, anchorKey: options.anchorKey };
}

/** Every entity assigned to one view — the assignment is what puts an entity in model space at all. */
export function assignedTo(viewKey: string, entities: readonly Entity[]): Map<string, string> {
  return new Map(entities.map((entity) => [entity.key, viewKey]));
}

/* ------------------------------------------------------------------ a rail, driven by hand */

/** One measure of the setup, as a rail reads one. */
export type Measure = { value: string; unit: string; basis: string; source: string };

/** One register object row, as the store holds one and as a rail is handed one (L-REG-01). */
export function registerRow(options: { placementKey: string; levelId: string; viewKey: string; mark?: string; elementType?: string; setRevisionId?: string }): Record<string, unknown> {
  const objectKey = `${options.placementKey}@${options.levelId}`;
  return {
    tenantId: "00000000-0000-4000-8000-000000000001",
    projectId: "00000000-0000-4000-8000-000000000002",
    setRevisionId: options.setRevisionId ?? "11111111-1111-4111-8111-111111111111",
    objectKey,
    discipline: "STRUCTURAL",
    elementType: options.elementType ?? "column",
    mark: options.mark ?? "C1",
    viewKey: options.viewKey,
    placementKey: options.placementKey,
    levelId: options.levelId,
    levelSlot: null,
    levelLabel: null,
    standing: "MEASURED",
    semantic: `semantic:${objectKey}`,
    registeredAt: new Date(0),
  };
}

/** One member-type variant of a family, as the schedules registry recorded it. */
export function variantSetup(options: {
  variantKey: string;
  width: number | null;
  depth: number | null;
  unit?: string | null;
  bandFrom?: string | null;
  bandTo?: string | null;
  sourceKeys?: readonly string[];
  dimensions?: Record<string, Measure>;
}): Record<string, unknown> {
  return {
    variantKey: options.variantKey,
    bandFrom: options.bandFrom ?? null,
    bandTo: options.bandTo ?? null,
    sectionText: `${String(options.width)}x${String(options.depth)}`,
    sectionWidth: options.width,
    sectionDepth: options.depth,
    sectionUnit: options.unit === undefined ? "mm" : options.unit,
    sourceKeys: options.sourceKeys ?? ["S-102:e:7"],
    dimensions: options.dimensions ?? {},
    rebar: [],
  };
}

/** One level of the stack, with the standing its storey height holds (L-MEA-07). */
export function levelSetup(options: { levelId: string; label: string; ordinal: number; height?: { standing: string; value: string | null; unit: string | null; basis: string | null; sourceKey: string | null } }): Record<string, unknown> {
  return {
    levelId: options.levelId,
    label: options.label,
    ordinal: options.ordinal,
    height: options.height ?? { standing: "NONE", value: null, unit: null, basis: null, sourceKey: null },
  };
}

/** A storey height that stands AGREED at a reading, citing whatever the case gives it. */
export function agreedHeight(value: string, unit: string, sourceKey: string | null): { standing: string; value: string | null; unit: string | null; basis: string | null; sourceKey: string | null } {
  return { standing: "AGREED", value, unit, basis: "TRANSCRIBED", sourceKey };
}

/** What a rail is handed: the register's rows, and the read-only setup beside them (L-MEA-08). */
export function railInput(draft: {
  kind: string;
  objects: readonly Record<string, unknown>[];
  placements: Record<string, unknown>;
  memberTypes?: Record<string, Record<string, readonly Record<string, unknown>[]>>;
  levels?: readonly Record<string, unknown>[];
  calibrations?: Record<string, Record<string, string>>;
  grades?: Record<string, Measure>;
  siteFacts?: Record<string, unknown>;
  edition?: unknown;
  setRevisionId?: string;
}): Record<string, unknown> {
  return {
    campaignId: "00000000-0000-4000-8000-0000000000c1",
    setRevisionId: draft.setRevisionId ?? "11111111-1111-4111-8111-111111111111",
    kind: draft.kind,
    objects: draft.objects,
    setup: {
      placements: draft.placements,
      memberTypes: draft.memberTypes ?? {},
      levels: draft.levels ?? [],
      calibrations: draft.calibrations ?? {},
      grades: draft.grades ?? {},
      runs: {},
      lintels: {},
      siteFacts: draft.siteFacts ?? {},
      edition: draft.edition ?? null,
    },
  };
}

/** The view classes this sweep draws, in the vocabulary's own spelling. */
export const VIEW = Object.freeze({
  SCHEDULE: "SCHEDULE",
  LAYOUT_PLAN: "LAYOUT_PLAN",
  LONG_SECTION_STRIP: "LONG_SECTION_STRIP",
  MEMBER_SECTION: "MEMBER_SECTION",
});
