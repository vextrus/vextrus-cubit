/**
 * The mechanics S-Viewer's inspector acceptance runs on: how a product module is loaded, the doors
 * this increment's interface list names, and the copy registry every rendered string is compared
 * against.
 *
 * Mechanics only — nothing here judges the product, and nothing here reads product source. Every
 * name below is one the increment's interfaces, its test contract or docs/design/s-viewer-inspector.md
 * publishes, and every expected value is derived from the artifact under test or from the product's
 * own string registry rather than transcribed from a run (B-19).
 *
 * Product modules load by absolute path so a file the Builder has not written yet fails as an
 * assertion naming it rather than as a collection death that would read as a defect in the
 * acceptance. The root is `BUILDER_REPO_ROOT` where a mounted set states one, and the working
 * directory otherwise, so the same helpers serve the public lane and a held-out mount alike.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

/** The homes this increment's interface list names. */
export const SELECTION_MODULE = "src/modules/takeoff/viewer-inspector/selection.ts";
export const FLYTO_MODULE = "src/modules/takeoff/viewer-inspector/flyto.ts";
export const INSPECTOR_PANEL_MODULE = "src/modules/takeoff/viewer-inspector/inspector-panel.tsx";
export const VIEWER_CLIENT_MODULE = "src/modules/takeoff/viewer/client.ts";
export const STRINGS_MODULE = "src/ui/strings/index.ts";

/** The checkout the acceptance drives — a mounted set states it, a lane run stands in it. */
export function repoRoot(): string {
  return process.env["BUILDER_REPO_ROOT"]?.trim() || process.cwd();
}

/** Import a product module by repo-relative path, asserting it exists first. */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(repoRoot(), relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/* ------------------------------------------------------------------ the shapes the interfaces name */

/** A world box as a query and a selection row state one (viewer client: `IndexBox`). */
export type IndexBox = { min: [number, number]; max: [number, number] };

/** The camera a sheet is seen through (viewer client: `Camera`). */
export type Camera = {
  centre: [number, number];
  scale: number;
  viewport: { width: number; height: number };
};

/** The address half of the selection model (increment interfaces: `selection.ts`). */
export type SelectionModule = {
  SELECTION_PARAM: string;
  parseSelection: (value: string | null) => { keys: string[]; malformed: string[] };
  serialiseSelection: (keys: readonly string[]) => string | null;
  unionBox: (boxes: readonly IndexBox[]) => IndexBox | null;
};

/** The Trace target's camera work (increment interfaces: `flyto.ts`). */
export type FlytoModule = {
  revealCamera: (box: IndexBox, viewportPx: { width: number; height: number }) => Camera;
  flyTo: (from: Camera, to: Camera, elapsedMs: number, durationMs: number) => Camera;
};

/** The inherited camera surface these two are judged against (inc-110's published client). */
export type ViewerClient = {
  fitCamera: (extents: { min: [number, number]; max: [number, number] } | null, viewportPx: { width: number; height: number }) => Camera;
  zoomCameraAt: (camera: Camera, factor: number, atPx: { x: number; y: number }) => Camera;
};

export const selectionModule = (): Promise<SelectionModule> => productModule<SelectionModule>(SELECTION_MODULE);
export const flytoModule = (): Promise<FlytoModule> => productModule<FlytoModule>(FLYTO_MODULE);
export const viewerClient = (): Promise<ViewerClient> => productModule<ViewerClient>(VIEWER_CLIENT_MODULE);

/* ------------------------------------------------------------------ the copy, from its own registry */

/**
 * The assembled string registry, read by key at runtime rather than by property: this acceptance is
 * written before the table it names exists, and a compile-time property reference would fail as a
 * type error of the test's own instead of as the missing feature it is reporting.
 */
export async function stringTable(): Promise<Record<string, string>> {
  const module_ = await productModule<{ strings: Record<string, string> }>(STRINGS_MODULE);
  return module_.strings;
}

/** One registered string, refused by name where the registry does not carry it (R-SPINE-060). */
export function registered(table: Record<string, string>, key: string): string {
  const held = table[key];
  expect(typeof held, `the string registry carries \`${key}\` — copy lives in the table, never inline (R-SPINE-060)`).toBe("string");
  expect((held ?? "").length, `\`${key}\` is not an empty string`).toBeGreaterThan(0);
  return held as string;
}

/** A registered string with its named slots filled — the product's own `fill`, restated for the lane. */
export function fillSlots(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (slot, name: string) => values[name] ?? slot);
}

/** The world centre of a box — what a fly-to lands on and what `unionBox` is judged by. */
export function centreOf(box: IndexBox): [number, number] {
  return [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2];
}

/** `minx,miny,maxx,maxy`, the spelling a selection row publishes its box in (AC-1). */
export function bboxAttribute(box: IndexBox): string {
  return [box.min[0], box.min[1], box.max[0], box.max[1]].join(",");
}
