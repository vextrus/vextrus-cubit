/**
 * One drawing read by the SHIPPED `cad/` CLI (L-CAD-01) and put through the partition's pure stages —
 * views, conventions, grid, schedules, registry, placement — in the order the rebuild runs them
 * (R-TO-030). Mechanics only, and no database: the unit lane grades the reading on it, and the
 * database lane writes what it read through the product's own store. One spelling of the reading
 * serves both (B-17).
 *
 * The placement shares are the platform edition's own — the edition J-000's projects are pinned to —
 * read off the seed rather than typed here (L-MEA-01, B-19).
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { resolve as resolveConventions } from "@/core/rulesets/methods/conventions/resolve";
import { SEED_EDITION_CONTENT } from "@/core/rulesets/seed";
import { ingestDrawing } from "@/modules/takeoff/ingest/cli";
import { censusOf } from "@/modules/takeoff/partition/conventions/census";
import { detectGrid } from "@/modules/takeoff/partition/grid/detect";
import { detectPlacements } from "@/modules/takeoff/partition/placement/detect";
import type { PlacementShares } from "@/modules/takeoff/partition/placement/shares";
import { reconstructSchedules } from "@/modules/takeoff/partition/schedules/reconstruct";
import { registerMemberTypes } from "@/modules/takeoff/partition/schedules/registry";
import { partitionArtifact } from "@/modules/takeoff/partition/views/assign";

/** The two fixtures, never a replacement (AM-01): the M3 yardstick, and the byte-frozen v1.1 corpus. */
export const BNBC_DXF = "fixtures/rcc6-bnbc/rcc6-bnbc.dxf";
export const RCC6_DXF = "fixtures/rcc6/rcc6.dxf";

/** The share each placement band is read off, by the parameter the edition states it under. */
function shareStated(parameter: string): string {
  const stated = SEED_EDITION_CONTENT.parameters[parameter]?.value;
  if (stated === undefined) throw new Error(`the platform edition states no ${parameter}`);
  return stated;
}

/** The placement shares the platform edition states (L-MEA-01). */
export const SEED_SHARES: PlacementShares = {
  containmentMerge: shareStated("placementContainmentMerge"),
  nearAnchor: shareStated("placementNearAnchor"),
  footprintMin: shareStated("placementFootprintMin"),
  footprintMax: shareStated("placementFootprintMax"),
};

/** One drawing, read by the shipped CLI and put through the stages the rebuild runs, in its order. */
export async function stagesOver(relative: string) {
  const outcome = await ingestDrawing(new Uint8Array(readFileSync(join(process.cwd(), relative))), "dxf", { tempDir: mkdtempSync(join(tmpdir(), "cubit-stages-")) });
  if (!outcome.ok) throw new Error(`the shipped cad CLI refused ${relative}: ${outcome.refusal} — ${outcome.detail}`);
  const graph: EntityGraph = outcome.graph;
  const parted = partitionArtifact(graph);
  const census = censusOf(graph, parted.views);
  const profile = census === null ? null : resolveConventions(census);
  const grid = detectGrid({ graph, views: parted.views, assignments: parted.assignments, profile });
  const reconstructed = reconstructSchedules({ graph, views: parted.views, assignments: parted.assignments });
  const registered = registerMemberTypes(reconstructed.tables, profile);
  const placed = detectPlacements({ graph, views: parted.views, assignments: parted.assignments, grid, shares: SEED_SHARES, families: registered.families });
  return { reconstructed, registered, placed };
}

/** What the stages answered over one drawing. */
export type StagesRead = Awaited<ReturnType<typeof stagesOver>>;
