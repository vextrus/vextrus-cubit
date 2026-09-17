// The takeoff lane's draft-BOQ door (ARCH-02): the one thing a reader may DO on S-BOQ — ask for the
// draft to be rendered and filed.
//
// Its own file rather than an append to `./takeoff.ts`, because the lane table in `../root.ts` is the
// registry this tier grows by, and a registry grows by enumeration (AM-11's shape, one tier up).
//
// EXPORTING IS NOT AN ACT (AM-05, I-270). A draft is unsigned by definition, so there is no
// consequence to preview and no digest to bind: the door resolves the actor through the one guard,
// refuses by registered code where there is nothing to draft, and enqueues the render under the key
// that makes a second press the same render. Everything about what the draft SAYS is the module's
// and the document kind's; this file is transport (B-17).
import { z } from "zod";
import { campaignsOf } from "../../core/campaigns";
import { REFUSALS } from "../../core/errors";
import { refusal } from "../../core/faults/refusal-marker";
import { enqueue } from "../../core/jobs";
import { BOQ_RENDER_DRAFT_KIND, boqDraftJobKey } from "../../modules/takeoff/boq/job";
import { verifyStatedOrigin } from "../../modules/spine/tenancy";
import { signedOut } from "../auth/refusals";
import { parsed } from "../call";
import { publicProcedure, router } from "../trpc";
import { projectActorFor } from "./spine";

/** The permission L-ACT-03 makes the measuring lane's own door move. */
const MEASURE = "MEASURE" as const;

/** A door that needs a session states so once (the spine lane's shape, ARCH-03). */
const signedInProcedure = publicProcedure.use(({ ctx, next }) => {
  if (ctx.session === null) throw signedOut();
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/**
 * What a caller may state at this door, read once by the one reading this tier has
 * (`@/server/call`). A statement this lane cannot read is refused as the registered REQUEST_MALFORMED
 * rather than reaching the error formatter as a plain failure (ARCH-03, B-21).
 */
const project = z.object({
  projectId: z
    .string({ error: 'takeoff-boq: "projectId" is required and must be a string' })
    .min(1, { error: 'takeoff-boq: "projectId" must not be blank' }),
});

/** What the door answers: the run being watched, and whether it was already running (SEAM-JOBS). */
export type BoqExportAnswer = { readonly jobId: string; readonly deduplicated: boolean };

export const takeoffBoqRouter = router({
  /**
   * Render this project's draft and file it in Documents (R-TO-053, A-BOQ-PDF).
   *
   * A project with no campaign open is REFUSED by name rather than enqueued: there is no register to
   * draft from, and a job that would find nothing is not work (ARCH-03, R-SPINE-062). A second press
   * while the first render is queued or running is answered with the first job's id, because the key
   * is the campaign's — one live draft per campaign, however many times the primary is pressed.
   */
  exportDraft: signedInProcedure
    .input(parsed(project))
    .mutation(async ({ ctx, input }): Promise<BoqExportAnswer> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);

      const open = await campaignsOf({ tenantId: actor.tenantId, projectId: input.projectId });
      const campaign = open[open.length - 1];
      if (campaign === undefined) {
        throw refusal(REFUSALS.BOQ_NO_CAMPAIGN.code, "a draft was asked for a project with no campaign open", { projectId: input.projectId });
      }

      return enqueue(
        BOQ_RENDER_DRAFT_KIND,
        {
          tenantId: actor.tenantId,
          projectId: input.projectId,
          campaignId: campaign.campaignId,
          requestedBy: ctx.session.userId,
        },
        { key: boqDraftJobKey(actor.tenantId, campaign.campaignId) },
      );
    }),
});
