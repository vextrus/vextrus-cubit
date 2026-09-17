"use server";
// What the Author edition screen asks the server to do: L-ACT-02's pair, and nothing else. Each one
// names the act seam and answers with what the seam answered — a registered refusal is carried back
// to the screen that asked, never turned into a fault and never swallowed (ARCH-03, B-21).
//
// Both doors are opened through the one server-call seam (`@/server/call`), which reads what the
// screen stated against the schema below, resolves the presented session ONCE, and carries a
// registered refusal back in this screen's own answer shape. The actor is resolved by the ONE
// `authorize()` (AM-11): the door names `AUTHOR_RULE_SET` and the act it moves, so the
// `PERMISSION_NOT_HELD` this screen renders is the refusal the guard itself builds, carrying the act
// type and the missing permission (L-ACT-03) — never a second guard's opinion.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { commit, consequenceDigest, preview, type AuthorRulesetEditionInput, type Consequence } from "@/core/acts";
import type { RefusalCode } from "@/core/errors";
import { authorizeOrThrow } from "@/server/authorize";
import { serverCall } from "@/server/call";
import { rulesetRoute } from "../../home/areas";
import { rulesetAuthorRoute } from "./route-address";

const AUTHOR_RULESET_EDITION = "AUTHOR_RULESET_EDITION" as const;
const AUTHOR_RULE_SET = "AUTHOR_RULE_SET" as const;

/** What the author stated: which project, the version they are minting under, and the decimals. */
export interface AuthorEditionRequest {
  projectId: string;
  version: string;
  values: Readonly<Record<string, string>>;
}

/** What a preview answered: what the act would do and the digest that binds it, or the refusal. */
export type PreviewAnswer = { previewed: true; consequence: Consequence; consequenceDigest: string } | { previewed: false; refusal: RefusalCode };

/** What a commit answered: the act it wrote, or the refusal that stopped it. */
export type CommitAnswer = { committed: true; actId: string } | { committed: false; refusal: RefusalCode };

/**
 * The shape of a statement either door will read. A version is a non-empty word after trimming — a
 * version nobody stated names no edition — and every value is a decimal, because a rule-set
 * parameter is one from the store to the page (B-07). A statement that is neither is `REQUEST_MALFORMED`
 * at the transport, never a 500 and never a string the seam has to guess at.
 */
const DECIMAL = /^-?\d+(\.\d+)?$/;

const STATED = z.object({
  projectId: z.string(),
  version: z
    .string()
    .transform((stated) => stated.trim())
    .refine((trimmed) => trimmed.length > 0, { error: "an edition is minted under a version somebody stated (L-MEA-01)" }),
  values: z.record(z.string(), z.string().regex(DECIMAL, { error: "a rule-set parameter value is a decimal (B-07)" })),
});

/** …and what a commit states beside it: the digest of the consequence it was shown over. */
const COMMITTED = STATED.extend({ consequenceDigest: z.string() });

const previewing = serverCall(
  STATED,
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
  COMMITTED,
  async (request, session): Promise<CommitAnswer> => {
    const actor = await authorizeOrThrow({
      userId: session.userId,
      projectId: request.projectId,
      permission: AUTHOR_RULE_SET,
      actType: AUTHOR_RULESET_EDITION,
    });
    const written = await commit(actor, actInput(request), request.consequenceDigest);
    // The minted edition IS the answer, and both screens that show it are server-rendered from the
    // store the act just appended to: the rule set the project now reads, and this screen, whose
    // parent line and whose diff are now the NEW pin's.
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

/** The statement read into the shape the seam declares. */
function actInput(request: z.output<typeof STATED>): AuthorRulesetEditionInput {
  return {
    type: AUTHOR_RULESET_EDITION,
    projectId: request.projectId,
    version: request.version,
    values: request.values,
  };
}
