"use server";
// What the Author edition screen asks the server to do: L-ACT-02's pair, and nothing else. Each one
// names the act seam and answers with what the seam answered — a registered refusal is carried back
// to the screen that asked, never turned into a fault and never swallowed (ARCH-03, B-21).
//
// Both doors go through the one server-call seam (`@/server/call`): it reads what the form stated
// against the schema below, resolves the presented session ONCE, and carries a registered refusal
// back in this screen's own answer shape. The actor is derived by the one `authorize()`
// (AM-11) naming the permission AM-04 cuts for this act and the act type it moves, so the
// PERMISSION_NOT_HELD a reader meets here is the same refusal, worded the same way, that the act
// seam answers if the door is reached another way. There is no second guard.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { commit, consequenceDigest, preview, type AuthorRulesetEditionInput, type Consequence } from "@/core/acts";
import type { RefusalCode } from "@/core/errors";
import { isDecimalFigure } from "@/core/projects";
import { serverCall } from "@/server/call";
import { authorizeOrThrow } from "@/server/authorize";
import { rulesetRoute } from "../../home/areas";
import { rulesetAuthorRoute } from "./route-address";

const AUTHOR_RULESET_EDITION = "AUTHOR_RULESET_EDITION" as const;
const AUTHOR_RULE_SET = "AUTHOR_RULE_SET" as const;

/** What an authoring submission states: the project, the version, and a decimal per pinned key. */
export interface AuthorEditionRequest {
  projectId: string;
  version: string;
  values: Record<string, string>;
}

/** What a preview answered: what the act would do and the digest that binds it, or the refusal. */
export type PreviewAnswer = { previewed: true; consequence: Consequence; consequenceDigest: string } | { previewed: false; refusal: RefusalCode };

/** What a commit answered: the act it wrote, or the refusal that stopped it. */
export type CommitAnswer = { committed: true; actId: string } | { committed: false; refusal: RefusalCode };

/**
 * What the screen may state at these two doors. A version is a non-empty run of visible characters
 * — it names an edition beside its scope and name (L-MEA-01), and a blank names nothing — and every
 * authored figure is a decimal the store holds exactly, read by the tree's one decimal grammar
 * (`isDecimalFigure`, B-17). A statement that is neither is REQUEST_MALFORMED at the door rather
 * than a fault behind it (the `serverCall` seam's own answer).
 *
 * What a VALUE means stays the act seam's law: the keys are the pin's and a key the pin lacks is a
 * mistake in the caller, judged where the pin is read. This is the transport declining to read a
 * statement, not a second opinion about what is lawful (B-17).
 */
const AUTHORED = z.object({
  projectId: z.string(),
  version: z
    .string()
    .trim()
    .min(1, { error: "an edition is named by its version, and a blank names nothing (L-MEA-01)" }),
  values: z.record(
    z.string(),
    z.string().refine((stated) => isDecimalFigure(stated.trim()), {
      error: "a rule-set parameter is a quantity the store holds exactly, so its value is a decimal (B-07)",
    }),
  ),
});

/** …and what a commit states beside it: the digest of the consequence it was shown over (L-ACT-02). */
const COMMITTED = AUTHORED.extend({ consequenceDigest: z.string() });

/** The submission read into the shape the seam declares. */
function actInput(request: z.output<typeof AUTHORED>): AuthorRulesetEditionInput {
  return { type: AUTHOR_RULESET_EDITION, projectId: request.projectId, version: request.version, values: request.values };
}

const previewing = serverCall(
  AUTHORED,
  async (request, session): Promise<PreviewAnswer> => {
    const actor = await authorizeOrThrow({ userId: session.userId, projectId: request.projectId, permission: AUTHOR_RULE_SET, actType: AUTHOR_RULESET_EDITION });
    const consequence = await preview(actor, actInput(request));
    return { previewed: true, consequence, consequenceDigest: consequenceDigest(consequence) };
  },
  (refusal): PreviewAnswer => ({ previewed: false, refusal }),
);

const committing = serverCall(
  COMMITTED,
  async (request, session): Promise<CommitAnswer> => {
    const actor = await authorizeOrThrow({ userId: session.userId, projectId: request.projectId, permission: AUTHOR_RULE_SET, actType: AUTHOR_RULESET_EDITION });
    const written = await commit(actor, actInput(request), request.consequenceDigest);
    // The minted edition IS the answer, and both screens that show it are server-rendered off the
    // ledger the act just appended to: the rule set screen now reads the newest row, and this one
    // re-opens on the edition that was just minted as the pin to fork next.
    revalidatePath(rulesetRoute(actor.tenantId, request.projectId));
    revalidatePath(rulesetAuthorRoute(actor.tenantId, request.projectId));
    return { committed: true, actId: written.actId };
  },
  (refusal): CommitAnswer => ({ committed: false, refusal }),
);

export async function previewAuthorEdition(request: AuthorEditionRequest): Promise<PreviewAnswer> {
  return previewing(request);
}

export async function commitAuthorEdition(request: AuthorEditionRequest & { consequenceDigest: string }): Promise<CommitAnswer> {
  return committing(request);
}
