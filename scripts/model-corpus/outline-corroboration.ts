// The outline-corroboration question's recorder (L-QTY-04, Q-08): every mark-anchored outline one
// drawing's layout plans place, once each, asked exactly as the product asks it
// (`outlineCorroborationRequest` over `outlineEvidenceOf` — B-17: one evidence, one home, and the
// recording is an answer to the question production puts).
//
// The drawing is this recorder's own flag — `--drawing <path>` — with `--limit N` for how many
// subjects are asked. `--limit 0` is the listing: every subject and its request hash are printed and
// NOTHING is posted, which is how the count is read before a single call is paid for.
//
// No database: the stages run as `partition/rebuild.ts` runs them, and the four placement shares are
// the SEEDED platform edition's own parameters, which is what every lane's project is pinned to — so
// a hash recorded here is the hash a lane replays. A project pinned to some other edition asks a
// different question, and a question nobody recorded refuses as FIXTURE_MISSING rather than reaching
// a network (L-AI-01).
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { requestHash } from "../../src/core/model";
import { outlineCorroborationRequest } from "../../src/core/outline-corroboration";
import { SEED_EDITION_CONTENT } from "../../src/core/rulesets/seed";
import { resolve as resolveConventions } from "../../src/core/rulesets/methods/conventions/resolve";
import { ingestDrawing } from "../../src/modules/takeoff/ingest/job";
import { censusOf } from "../../src/modules/takeoff/partition/conventions/census";
import { detectGrid } from "../../src/modules/takeoff/partition/grid/detect";
import { outlineEvidenceOf } from "../../src/modules/takeoff/partition/placement/evidence";
import { detectPlacements } from "../../src/modules/takeoff/partition/placement/detect";
import type { PlacementShares } from "../../src/modules/takeoff/partition/placement/shares";
import { reconstructSchedules } from "../../src/modules/takeoff/partition/schedules/reconstruct";
import { registerMemberTypes } from "../../src/modules/takeoff/partition/schedules/registry";
import { partitionArtifact } from "../../src/modules/takeoff/partition/views/assign";
import type { Asked, RecorderContext } from "./recorder";

/** How many subjects are asked when the command line names no limit. */
const DEFAULT_LIMIT = "200";

/**
 * Which edition parameter each placement share is read off, as `placement/shares.ts` reads them off a
 * PINNED edition. The recorder has no project and no store, so it reads the same four parameters off
 * the seeded platform edition's own content — the edition every lane's project is pinned to.
 */
const SHARE_PARAMETER: Readonly<Record<keyof PlacementShares, string>> = Object.freeze({
  containmentMerge: "placementContainmentMerge",
  nearAnchor: "placementNearAnchor",
  footprintMin: "placementFootprintMin",
  footprintMax: "placementFootprintMax",
});

/** The seed edition's four shares, or a refusal by name: a share nobody stated measures nothing. */
export function seededShares(fail: (message: string) => never): PlacementShares {
  const stated: Partial<Record<keyof PlacementShares, string>> = {};
  for (const share of Object.keys(SHARE_PARAMETER) as (keyof PlacementShares)[]) {
    const held = SEED_EDITION_CONTENT.parameters[SHARE_PARAMETER[share]];
    if (held === undefined) fail(`the seeded edition states no \`${SHARE_PARAMETER[share]}\`, so no placement band can be asked about (L-MEA-01)`);
    stated[share] = held?.value;
  }
  return stated as PlacementShares;
}

/** Every mark-anchored outline one drawing places, as the product would ask about it. */
export async function subjectsOf(ctx: RecorderContext): Promise<Asked[]> {
  const drawing = ctx.option("--drawing") ?? ctx.fail("--drawing <path> names the drawing whose placed outlines are asked about");
  const limit = Number(ctx.option("--limit") ?? DEFAULT_LIMIT);
  const bytes = new Uint8Array(readFileSync(drawing));
  const tempDir = mkdtempSync(join(tmpdir(), "cubit-model-corpus-ingest-"));
  const format = drawing.toLowerCase().endsWith(".dwg") ? "dwg" : "dxf";
  const outcome = await ingestDrawing(bytes, format as Parameters<typeof ingestDrawing>[1], { tempDir });
  if (!outcome.ok) ctx.fail(`the extractor refused ${drawing}: ${outcome.refusal} — ${outcome.detail}`);

  /* --- the stages, in the order `partition/rebuild.ts` runs them, and nothing else --- */
  const graph = outcome.graph;
  const partition = partitionArtifact(graph);
  const census = censusOf(graph, partition.views);
  const profile = census === null ? null : resolveConventions(census);
  const grid = detectGrid({ graph, views: partition.views, assignments: partition.assignments, profile });
  const schedules = reconstructSchedules({ graph, views: partition.views, assignments: partition.assignments });
  // The profile is handed to the registry exactly as `partition/rebuild.ts` hands it, so the
  // recorder composes what the product composes — a section whose unit the drawing DECLARED reads
  // here as it reads in production (I-302, L-AI-01).
  const families = registerMemberTypes(schedules.tables, profile).families;
  const shares = seededShares(ctx.fail);
  const placed = detectPlacements({ graph, views: partition.views, assignments: partition.assignments, grid, shares, families });
  const evidence = outlineEvidenceOf({ graph, grid, shares, families, placements: placed.placements });

  const asked = evidence.map((held): Asked => {
    const request = outlineCorroborationRequest(held);
    // Each request's hash is printed so the orchestrator can diff what was recorded against what a
    // lane's ledger refuses as FIXTURE_MISSING — a recording is a fact about the drawing, and the
    // diff is how we know the two are the same fact (L-AI-01).
    ctx.say(`  ${requestHash(request)}  ${held.mark} · ${held.outlineKey}`);
    return { request, subject: `${basename(drawing)} · ${held.mark} · ${held.outlineKey}`, artifact: drawing };
  });

  ctx.say(
    `${basename(drawing)}: ${placed.placements.length} placements, ${asked.length} mark-anchored outlines to ask about (shares ${shares.nearAnchor}/${shares.footprintMin}-${shares.footprintMax})`,
  );
  if (!Number.isFinite(limit) || limit < 0) ctx.fail(`--limit ${String(ctx.option("--limit"))} is no count of subjects`);
  const taken = asked.slice(0, limit);
  ctx.say(limit === 0 ? "--limit 0: the subjects above were listed and nothing was posted" : `asking ${taken.length} of ${asked.length}`);
  return taken;
}
