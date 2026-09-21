// The bar schedule's render, run as a job (R-TO-054, A-BBS-PDF, R-SPINE-030): one campaign read, one
// document rendered through the one path, one issue filed in Documents — the draft BOQ's run
// (`../boq/job.ts`), one kind over.
//
// A SCHEDULE IS NOT AN ACT. Nothing is signed and nothing is committed here, so the run carries no
// consequence and no act id (AM-05): it renders the bars the measurement already wrote and records
// that it did. What it files is superseded by the next export of the same project's schedule, which
// is the documents store's own rule (R-SPINE-040).
//
// ONE DERIVATION, TWO FACES (I-bbs-2). The payload is `bbsPayloadOf` over `bbsViewOf`'s document —
// the very reading the screen paints — so what a reader reads and what the document prints cannot
// differ; nothing here re-sums, re-rounds or re-reads a bar.
//
// The renderer and the store arrive as dependencies rather than as imports of this file's own: the
// worker's handler is the composition root that hands the real storage in, and the lanes that judge
// this run hand their own (ARCH-02, the measure job's precedent).
import { renderDocument, type RenderDeps } from "@/core/documents";
import { BBS, BBS_TITLE } from "@/core/documents/kinds/bbs";
import { storeDocument, type DocumentStoreDeps } from "@/core/documents/store";
import { forTenant } from "@/core/db";
import { REFUSALS } from "@/core/errors";
import { refusal } from "@/core/faults/refusal-marker";
import type { JobPayloads, JobProgress } from "@/core/jobs";
import { projectNameOf } from "../boq/server";
import { BILL_TAXONOMY } from "../boq/taxonomy";
import { bbsPayloadOf } from "./emission";
import { bbsViewOf } from "./server";

/**
 * The kind and the key, re-published beside the run that uses them. They are DECLARED in the barrel
 * next door, which a screen may import without pulling the renderer's process boundary in behind it
 * (ARCH-01, AS-01) — and read here, where the run stands, so a caller holding either file reads one
 * spelling of both (B-17).
 */
export { BBS_RENDER_KIND, bbsRenderJobKey } from "./index";

/**
 * The steps one render reports, in the order they run: the campaign read, the document rendered, the
 * issue filed. A step is a member of this list or it is not reported at all — the list is the roster
 * (B-19, SEAM-JOBS: "workers report progress events").
 */
export const BBS_RENDER_STEPS = ["bbs:read", "bbs:render", "bbs:file"] as const;

const [STEP_READ, STEP_RENDER, STEP_FILE] = BBS_RENDER_STEPS;

/** What a render is run with: where the bytes go, and — for a lane — what compiles them. */
export type BbsRenderDeps = RenderDeps & { readonly storage: DocumentStoreDeps["storage"] };

/** What the run answers: the issue it filed, and which issue of this project's schedule it is. */
export type BbsIssued = { readonly documentId: string; readonly version: number };

/**
 * Render one campaign's bill of bars and file it.
 *
 * A campaign that scheduled no bar is REFUSED by its registered code rather than failed: there is
 * nothing to render, which is an answer about what was asked for and not a fault of the run
 * (ARCH-03, B-21, R-SPINE-062).
 */
export async function runBbsRenderJob(payload: JobPayloads["bbs-render"], progress: JobProgress, deps: BbsRenderDeps): Promise<BbsIssued> {
  const scope = { tenantId: payload.tenantId, projectId: payload.projectId };
  await progress.step(STEP_READ, { campaignId: payload.campaignId });
  const view = await bbsViewOf(scope);
  if (view.campaignId === null || view.document === null || view.document.rows.length === 0) {
    throw refusal(REFUSALS.BBS_NO_BAR_ROW.code, "a schedule was asked for a campaign that scheduled no bar", {
      projectId: payload.projectId,
      campaignId: payload.campaignId,
    });
  }

  // SEAM-DOC: the one path to the renderer, given the very document the screen read (I-bbs-2).
  await progress.step(STEP_RENDER, { rows: view.document.rows.length });
  const project = await projectNameOf(scope);
  const rendered = await renderDocument(
    BBS,
    bbsPayloadOf(view.document, { title: BBS_TITLE, project, setRevisionId: view.setRevisionId ?? "" }),
    { requestId: progress.jobId, actor: payload.requestedBy },
    deps,
  );

  await progress.step(STEP_FILE, { sha256: rendered.sha256 });
  const row = await forTenant({ tenantId: payload.tenantId }).transaction((tx) =>
    storeDocument({ tx, storage: deps.storage }, rendered, {
      tenantId: payload.tenantId,
      projectId: payload.projectId,
      // The store stamps every issue with the taxonomy in force when it was issued (R-SPINE-040): a
      // schedule is grouped by member and mark rather than by section, so the stamp is a fact about
      // the campaign's edition of the taxonomy and nothing the document prints.
      taxonomyVersion: BILL_TAXONOMY.version,
      issuedBy: payload.requestedBy,
      actIds: [],
    }),
  );

  return { documentId: row.id, version: row.version };
}
