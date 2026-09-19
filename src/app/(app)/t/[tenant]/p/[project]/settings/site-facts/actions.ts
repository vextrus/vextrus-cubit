"use server";
// What the Site facts panel asks the server to do: L-ACT-02's pair, and nothing else. Each one names
// the act seam and answers with what the seam answered — a registered refusal is carried back to the
// screen that asked, never turned into a fault and never swallowed (ARCH-03, B-21).
//
// Both doors go through the one server-call seam (`@/server/call`), which reads the statement against
// the schema below and resolves the presented session once, and through the one `authorize()`
// (AM-11), which is what tests AUTHOR_PROJECT_FACT before anything is read or written. The panel's
// own PERMISSION_NOT_HELD and this door's are therefore the same sentence about the same grant.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { commit, consequenceDigest, preview, type AuthorSiteFactInput, type Consequence } from "@/core/acts";
import type { RefusalCode } from "@/core/errors";
import { authorizeOrThrow } from "@/server/authorize";
import { serverCall } from "@/server/call";
import { siteFactsRoute } from "./route-address";

const AUTHOR_SITE_FACT = "AUTHOR_SITE_FACT" as const;
const AUTHOR_PROJECT_FACT = "AUTHOR_PROJECT_FACT" as const;

/** What a preview answered: what the act would do and the digest that binds it, or the refusal. */
export type PreviewAnswer = { previewed: true; consequence: Consequence; consequenceDigest: string } | { previewed: false; refusal: RefusalCode };

/** What a commit answered: the act it wrote, or the refusal that stopped it. */
export type CommitAnswer = { committed: true; actId: string } | { committed: false; refusal: RefusalCode };

/**
 * What the panel may state at these two doors.
 *
 * Everything a reader writes arrives as the text they wrote: the reading, the unit spelled as it was
 * written, and the note it was read from (L-QTY-03, L-REG-01). What each of them MEANS — whether the
 * fact is one this ledger records, whether the note says anything at all, whether the canon carries a
 * length factor for that spelling — is the ledger's own law and is asked at the act, so a statement
 * that is merely the wrong shape is REQUEST_MALFORMED here and never a 500 (`serverCall`'s answer).
 */
const STATED = z.object({
  projectId: z.string(),
  fact: z.string().min(1),
  valueAsWritten: z.string().min(1).max(64),
  unitAsWritten: z.string().min(1).max(16),
  sourceNote: z.string().max(280),
});

const CARRIED = STATED.extend({ consequenceDigest: z.string() });

const previewing = serverCall(
  STATED,
  async (request, session): Promise<PreviewAnswer> => {
    const actor = await authorizeOrThrow({
      userId: session.userId,
      projectId: request.projectId,
      permission: AUTHOR_PROJECT_FACT,
      actType: AUTHOR_SITE_FACT,
    });
    const consequence = await preview(actor, actInput(request));
    return { previewed: true, consequence, consequenceDigest: consequenceDigest(consequence) };
  },
  (refusal): PreviewAnswer => ({ previewed: false, refusal }),
);

const committing = serverCall(
  CARRIED,
  async (request, session): Promise<CommitAnswer> => {
    const actor = await authorizeOrThrow({
      userId: session.userId,
      projectId: request.projectId,
      permission: AUTHOR_PROJECT_FACT,
      actType: AUTHOR_SITE_FACT,
    });
    const written = await commit(actor, actInput(request), request.consequenceDigest);
    // The entered fact IS the answer, and the panel shows it by re-reading: the row comes back
    // ENTERED with the act that entered it, and its deferral is gone (AM-06 §1).
    revalidatePath(siteFactsRoute(actor.tenantId, request.projectId));
    return { committed: true, actId: written.actId };
  },
  (refusal): CommitAnswer => ({ committed: false, refusal }),
);

export async function previewSiteFactAction(request: z.input<typeof STATED>): Promise<PreviewAnswer> {
  return previewing(request);
}

export async function commitSiteFactAction(request: z.input<typeof CARRIED>): Promise<CommitAnswer> {
  return committing(request);
}

/** The submission read into the shape the seam declares. */
function actInput(request: z.output<typeof STATED>): AuthorSiteFactInput {
  return {
    type: AUTHOR_SITE_FACT,
    projectId: request.projectId,
    fact: request.fact,
    valueAsWritten: request.valueAsWritten,
    unitAsWritten: request.unitAsWritten,
    sourceNote: request.sourceNote,
  };
}
