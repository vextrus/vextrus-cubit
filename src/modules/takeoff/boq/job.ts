// The draft's render, run as a job (I-270, R-SPINE-030): one campaign read, one document rendered
// through the one path, one issue filed in Documents.
//
// A DRAFT IS NOT AN ACT. Nothing is signed and nothing is committed here, so the run carries no
// consequence and no act id (AM-05): it renders what the register already published and records that
// it did. What it files is superseded by the next export of the same project's draft, which is the
// documents store's own rule (R-SPINE-040).
//
// The renderer and the store arrive as dependencies rather than as imports of this file's own: the
// worker's handler is the composition root that hands the real storage in, and the lanes that judge
// this run hand their own (ARCH-02, the measure job's precedent).
import { renderDocument, type RenderDeps } from "@/core/documents";
import { BOQ_DRAFT } from "@/core/documents/kinds/boq-draft";
import { storeDocument, type DocumentStoreDeps } from "@/core/documents/store";
import { forTenant } from "@/core/db";
import { REFUSALS } from "@/core/errors";
import { refusal } from "@/core/faults/refusal-marker";
import type { JobPayloads, JobProgress } from "@/core/jobs";
import { boqViewOf } from "./server";
import { BILL_TAXONOMY } from "./taxonomy";

/** The kind this run is enqueued under (`src/core/jobs/kinds/boq.ts`). */
export const BOQ_RENDER_DRAFT_KIND = "boq-render-draft" as const;

/**
 * The steps one render reports, in the order they run: the campaign read, the document rendered, the
 * issue filed. A step is a member of this list or it is not reported at all — the list is the roster
 * (B-19, SEAM-JOBS: "workers report progress events").
 */
export const BOQ_DRAFT_STEPS = ["boq:read", "boq:render", "boq:file"] as const;

const [STEP_READ, STEP_RENDER, STEP_FILE] = BOQ_DRAFT_STEPS;

/**
 * The key a draft's render is idempotent on: one live render per campaign, per workspace. A second
 * press while the first is queued or running is answered with the first job's id rather than a
 * second render of the same draft (SEAM-JOBS, I-270).
 */
export function boqDraftJobKey(tenantId: string, campaignId: string): string {
  return `boq-draft:${tenantId}:${campaignId}`;
}

/** What a render is run with: where the bytes go, and — for a lane — what compiles them. */
export type BoqDraftDeps = RenderDeps & { readonly storage: DocumentStoreDeps["storage"] };

/** What the run answers: the issue it filed, and which issue of this project's draft it is. */
export type BoqDraftIssued = { readonly documentId: string; readonly version: number };

/**
 * Render one campaign's draft and file it.
 *
 * A campaign that published no line is REFUSED by its registered code rather than failed: there is
 * nothing to draft, which is an answer about what was asked for and not a fault of the run (ARCH-03,
 * B-21, R-SPINE-062).
 */
export async function runBoqDraftJob(
  payload: JobPayloads["boq-render-draft"],
  progress: JobProgress,
  deps: BoqDraftDeps,
): Promise<BoqDraftIssued> {
  const scope = { tenantId: payload.tenantId, projectId: payload.projectId };
  await progress.step(STEP_READ, { campaignId: payload.campaignId });
  const view = await boqViewOf(scope);
  if (view.payload === null) {
    throw refusal(REFUSALS.BOQ_NO_PUBLISHED_LINE.code, "a draft was asked for a campaign that has published no line", {
      projectId: payload.projectId,
      campaignId: payload.campaignId,
    });
  }

  // SEAM-DOC: the one path to the renderer, given the very payload the screen read (I-269, I-271).
  await progress.step(STEP_RENDER, { lines: view.items.size });
  const rendered = await renderDocument(BOQ_DRAFT, view.payload, { requestId: progress.jobId, actor: payload.requestedBy }, deps);

  await progress.step(STEP_FILE, { sha256: rendered.sha256 });
  const row = await forTenant({ tenantId: payload.tenantId }).transaction((tx) =>
    storeDocument({ tx, storage: deps.storage }, rendered, {
      tenantId: payload.tenantId,
      projectId: payload.projectId,
      // The taxonomy the sections were resolved under, stamped on the row the way it is stamped on
      // the page: an issued draft states the taxonomy it was drafted under (L-BD-08, AM-14 §1).
      taxonomyVersion: BILL_TAXONOMY.version,
      issuedBy: payload.requestedBy,
      actIds: [],
    }),
  );

  return { documentId: row.id, version: row.version };
}
