"use server";
// What the Author edition screen asks the server to do: L-ACT-02's pair, and nothing else. Each one
// names the act seam and answers with what the seam answered — a registered refusal is carried back
// to the screen that asked, never turned into a fault and never swallowed (ARCH-03, B-21).
//
// Both doors go through the one server-call seam (`@/server/call`), which reads the statement against
// the schema below and resolves the presented session once, and through the one `authorize()`
// (AM-11), which is what tests AUTHOR_RULE_SET before anything is read or written. The screen's
// PERMISSION_NOT_HELD and this door's are therefore the same sentence about the same grant.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { commit, consequenceDigest, preview, type AuthorRulesetEditionInput, type Consequence } from "@/core/acts";
import type { RefusalCode } from "@/core/errors";
import { authorizeOrThrow } from "@/server/authorize";
import { serverCall } from "@/server/call";
import { rulesetAuthorRoute } from "./route-address";
import { rulesetRoute } from "../../home/areas";

const AUTHOR_RULESET_EDITION = "AUTHOR_RULESET_EDITION" as const;
const AUTHOR_RULE_SET = "AUTHOR_RULE_SET" as const;

/** What a preview answered: what the act would do and the digest that binds it, or the refusal. */
export type PreviewAnswer = { previewed: true; consequence: Consequence; consequenceDigest: string } | { previewed: false; refusal: RefusalCode };

/** What a commit answered: the act it wrote, or the refusal that stopped it. */
export type CommitAnswer = { committed: true; actId: string } | { committed: false; refusal: RefusalCode };

/**
 * What the screen may state at these two doors. A version is a line of text a person types, so it is
 * read as one — stated, non-empty and short enough to be a version rather than a paragraph; a
 * statement that is not one is REQUEST_MALFORMED and never a 500 (`serverCall`'s own answer). The
 * values are decimal strings under the pin's own keys: what a key MEANS stays the edition's law, and
 * a key the pin does not hold is dropped where the content is built (I-265).
 */
const AUTHORED = z.object({
  projectId: z.string(),
  version: z.string().trim().min(1).max(64),
  values: z.record(z.string(), z.string()),
});

const CARRIED = AUTHORED.extend({ consequenceDigest: z.string() });

const previewing = serverCall(
  AUTHORED,
  async (request, session): Promise<PreviewAnswer> => {
    const actor = await authorizeOrThrow({
      userId: session.userId,
      projectId: request.projectId,
      permission: AUTHOR_RULE_SET,
      actType: AUTHOR_RULESET_EDITION,
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
      permission: AUTHOR_RULE_SET,
      actType: AUTHOR_RULESET_EDITION,
    });
    const written = await commit(actor, actInput(request), request.consequenceDigest);
    // The minted edition IS the answer, and both screens show it by re-reading: this one forks the
    // new pin, and the rule-set screen names the edition the project now reads (R-SPINE-012).
    revalidatePath(rulesetAuthorRoute(actor.tenantId, request.projectId));
    revalidatePath(rulesetRoute(actor.tenantId, request.projectId));
    return { committed: true, actId: written.actId };
  },
  (refusal): CommitAnswer => ({ committed: false, refusal }),
);

export async function previewAuthorEdition(request: z.input<typeof AUTHORED>): Promise<PreviewAnswer> {
  return previewing(request);
}

export async function commitAuthorEdition(request: z.input<typeof CARRIED>): Promise<CommitAnswer> {
  return committing(request);
}

/** The submission read into the shape the seam declares. */
function actInput(request: z.output<typeof AUTHORED>): AuthorRulesetEditionInput {
  return {
    type: AUTHOR_RULESET_EDITION,
    projectId: request.projectId,
    version: request.version,
    values: request.values,
  };
}
