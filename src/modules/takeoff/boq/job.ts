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
import type { BoqDraftPayload } from "@/core/documents/kinds/boq-draft";
import { BOQ_DRAFT } from "@/core/documents/kinds/boq-draft";
import { storeDocument, type DocumentStoreDeps } from "@/core/documents/store";
import { forTenant, recordModelOutcome, type TenantTx } from "@/core/db";
import { REFUSALS } from "@/core/errors";
import { refusal } from "@/core/faults/refusal-marker";
import type { JobPayloads, JobProgress } from "@/core/jobs";
import type { BoqDescriptionPort } from "./description-question";
import { groupKeyOf, INTERPRETED, type GroupDescriptions } from "./description-basis";
import { boqViewOf } from "./server";
import { BILL_TAXONOMY } from "./taxonomy";

/**
 * The kind and the key, re-published beside the run that uses them. They are DECLARED in the barrel
 * next door, which a screen may import without pulling the renderer's process boundary in behind it
 * (ARCH-01, AS-01) — and read here, where the run stands, so a caller holding either file reads one
 * spelling of both (B-17).
 */
export { BOQ_RENDER_DRAFT_KIND, boqDraftJobKey } from "./index";

/**
 * The steps one render reports, in the order they run: the campaign read, the document rendered, the
 * issue filed. A step is a member of this list or it is not reported at all — the list is the roster
 * (B-19, SEAM-JOBS: "workers report progress events").
 */
export const BOQ_DRAFT_STEPS = ["boq:read", "boq:render", "boq:file"] as const;

const [STEP_READ, STEP_RENDER, STEP_FILE] = BOQ_DRAFT_STEPS;

/**
 * What a render is run with: where the bytes go, — for a lane — what compiles them, and the port
 * the draft's item-description question goes through (B-23; the seam's own `propose` by default).
 */
export type BoqDraftDeps = RenderDeps & { readonly storage: DocumentStoreDeps["storage"]; readonly descriptions?: BoqDescriptionPort };

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
  // The one place the draft's item descriptions are ASKED (I-298): a description reaches a reader
  // when the draft is issued, so the question is put where the issue is, under the person who asked
  // for it and the job's own request id (L-AI-01's ledger row).
  const view = await boqViewOf(scope, {
    ctx: { tenantId: payload.tenantId, projectId: payload.projectId, actor: payload.requestedBy, requestId: progress.jobId },
    port: deps.descriptions,
  });
  const issued = view.payload;
  if (issued === null) {
    throw refusal(REFUSALS.BOQ_NO_PUBLISHED_LINE.code, "a draft was asked for a campaign that has published no line", {
      projectId: payload.projectId,
      campaignId: payload.campaignId,
    });
  }

  // SEAM-DOC: the one path to the renderer, given the very payload the screen read (I-269, I-271).
  await progress.step(STEP_RENDER, { lines: view.items.size });
  const rendered = await renderDocument(BOQ_DRAFT, issued, { requestId: progress.jobId, actor: payload.requestedBy }, deps);

  await progress.step(STEP_FILE, { sha256: rendered.sha256 });
  const row = await forTenant({ tenantId: payload.tenantId }).transaction(async (tx) => {
    const stored = await storeDocument({ tx, storage: deps.storage }, rendered, {
      tenantId: payload.tenantId,
      projectId: payload.projectId,
      // The taxonomy the sections were resolved under, stamped on the row the way it is stamped on
      // the page: an issued draft states the taxonomy it was drafted under (L-BD-08, AM-14 §1).
      taxonomyVersion: BILL_TAXONOMY.version,
      issuedBy: payload.requestedBy,
      actIds: [],
    });
    await confirmIssuedDescriptions(tx, payload, issued, view.descriptions);
    return stored;
  });

  return { documentId: row.id, version: row.version };
}

/**
 * The judgment the ISSUE passes on every description it took (L-AI-02, I-298).
 *
 * CONFIRMED is written for a call whose chosen description the issued payload actually carries: a
 * person asked for this draft on a screen showing that sentence, and the document went out with it —
 * "taken as proposed". Nothing is written where the answer was the no-match outcome and the plain
 * description stood: no reading of the model's reached the document, so the call waits on the
 * calibration line rather than being counted as agreed with.
 *
 * It is a RECORD and not an act: a draft is not signed and `ACT_TYPES` holds no issue (AM-05,
 * I-270), so `act_id` is null and the actor is the person who asked for the render. It lands in the
 * document's OWN transaction — the outcome and the issue stand or fall together (L-ACT-01's habit).
 *
 * Published so the live lane can judge the judgment itself without compiling a document to get at
 * it (test contract: `confirmIssuedDescriptions`, tests/takeoff/boq/issue-outcome.db.test.ts).
 */
export async function confirmIssuedDescriptions(
  tx: TenantTx,
  payload: JobPayloads["boq-render-draft"],
  issued: BoqDraftPayload,
  descriptions: GroupDescriptions | undefined,
): Promise<void> {
  if (descriptions === undefined) return;
  const carried = new Set(issued.sections.flatMap((section) => section.groups.map((group) => `${groupKeyOf(group.class, group.kind)}\u0000${group.description}`)));
  for (const [key, described] of descriptions) {
    if (described.basis !== INTERPRETED || described.callId === null || described.text === null) continue;
    if (!carried.has(`${key}\u0000${described.text}`)) continue;
    await recordModelOutcome(tx, {
      tenantId: payload.tenantId,
      projectId: payload.projectId,
      callId: described.callId,
      outcome: "CONFIRMED",
      actId: null,
      actorUserId: payload.requestedBy,
    });
  }
}
