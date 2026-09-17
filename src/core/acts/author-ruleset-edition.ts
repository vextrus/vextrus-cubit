// AUTHOR_RULESET_EDITION (AM-04's act, R-SPINE-012's "authoring a new edition is an act with a diff
// view", L-MEA-01's "authoring mints a new edition, never updates one"), rendered as L-ACT-02's pair.
//
// The act forks the edition the project reads RIGHT NOW — the newest project-scope row — into a new
// immutable row whose parent is that edition. Nothing is updated and the creation pin is never
// touched: the project's current edition is the newest row, so the fork chain grows by a step and
// every earlier edition a quantity line cites still stands exactly as it was.
//
// Only VALUES are authored (I-265). The keys, the units and the (rule id, version) pairs in force
// are copied from the pin verbatim, which is what makes a verbatim fork share its parent's digest by
// construction — and why identity, not content, is what the act always moves.
import { and, eq, tenantRulesetEditions, type TenantTx } from "../db";
import { authoredContent, currentProjectEdition, editionDigest, mintProjectEdition, type StoredProjectEdition } from "../rulesets/editions";
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";
import type { Consequence } from "./consequence";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const AUTHOR_RULESET_EDITION = "AUTHOR_RULESET_EDITION" as const;

/** The registered code this act answers a collided identity with, read from the one register (Q-07). */
const EDITION_VERSION_TAKEN: RefusalCode = "EDITION_VERSION_TAKEN";

/**
 * L-MEA-01's identity refusal, carrying the version that collided and the rule set it collided in.
 * The copy a reader sees is the register's; this is the marker that makes it an ANSWER rather than a
 * fault, so the transport carries it back to the screen that asked (ARCH-03).
 */
export function editionVersionTaken(version: string, name: string): Error {
  return refusal(EDITION_VERSION_TAKEN, `${AUTHOR_RULESET_EDITION} was asked for a version this project's rule set already holds`, {
    actType: AUTHOR_RULESET_EDITION,
    name,
    version,
  });
}

/**
 * The act's input: whose project, the version the author states, and the decimals they stated,
 * keyed by the pin's own parameter keys. Units and methods are never stated — they are the pin's.
 */
export type AuthorRulesetEditionInput = {
  readonly type: typeof AUTHOR_RULESET_EDITION;
  readonly projectId: string;
  readonly version: string;
  readonly values: Readonly<Record<string, string>>;
};

/** What the act would write: the edition being forked, and the content the fork would hold. */
interface Derived {
  readonly pin: StoredProjectEdition;
  readonly content: ReturnType<typeof authoredContent>;
  readonly digest: string;
}

/**
 * The act judged against the state this transaction read.
 *
 * A project with no edition at all is unrepresentable (L-REG-07 pins at creation), so an address
 * that names none names no project of this workspace: there is nothing to fork, and the Consequence
 * says so by naming no subject — which the seam refuses as `ACT_CHANGES_NOTHING`, the answer an act
 * whose subject does not stand already gives (L-ACT-01).
 *
 * A version this project has already authored under is a registered refusal rather than a uniqueness
 * fault out of the store: identity is (scope, name, version), and the author is told which half of
 * it collided (L-MEA-01).
 */
async function derive(ctx: ActorCtx, input: AuthorRulesetEditionInput, tx: TenantTx): Promise<Derived | undefined> {
  const pin = await currentProjectEdition(tx, { tenantId: ctx.tenantId, projectId: input.projectId });
  if (pin === undefined) return undefined;

  if (await versionHeld(tx, ctx, input)) throw editionVersionTaken(input.version, pin.name);

  // The content is built through the authoring module's one home for "what the fork holds", so the
  // rows a reader checked and the content the digest is taken over are the same computation (B-17).
  // A key the pin lacks, or a value that is not a decimal, throws there: the screen offers exactly
  // the pin's keys, so neither is an answer anyone is given.
  const content = authoredContent(pin.parameters, input.values, pin.methods);
  return { pin, content, digest: editionDigest(content) };
}

/** Whether this project already holds a project-scope edition under the stated version. */
async function versionHeld(tx: TenantTx, ctx: ActorCtx, input: AuthorRulesetEditionInput): Promise<boolean> {
  const held = await tx
    .select({ editionId: tenantRulesetEditions.editionId })
    .from(tenantRulesetEditions)
    .where(
      and(
        eq(tenantRulesetEditions.tenantId, ctx.tenantId),
        eq(tenantRulesetEditions.projectId, input.projectId),
        eq(tenantRulesetEditions.scope, "project"),
        eq(tenantRulesetEditions.version, input.version),
      ),
    )
    .limit(1);
  return held.length > 0;
}

export const authorRulesetEdition: ActRendering<AuthorRulesetEditionInput> = {
  async preview(ctx: ActorCtx, input: AuthorRulesetEditionInput, tx: TenantTx): Promise<Consequence> {
    const derived = await derive(ctx, input, tx);
    return {
      actType: AUTHOR_RULESET_EDITION,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      rendering: "SUBJECTS",
      // ONE subject: the project, whose rule set this act moves. `before` is the identity it reads
      // today beside the digest that keys it, and `after` the identity it will read beside the
      // digest of what is being authored — L-MEA-01 keeps the two apart, so both are stated and
      // neither substitutes for the other. A verbatim fork moves the identity, so the subject always
      // says something and the act is never ACT_CHANGES_NOTHING for a fork that changed no value.
      subjects:
        derived === undefined
          ? []
          : [
              {
                subjectId: input.projectId,
                subjectLabel: `${derived.pin.name} @ ${input.version}`,
                before: [`${derived.pin.name} @ ${derived.pin.version}`, derived.pin.contentDigest],
                after: [`${derived.pin.name} @ ${input.version}`, derived.digest],
              },
            ],
    };
  },

  async commit(ctx: ActorCtx, input: AuthorRulesetEditionInput, _act: WrittenAct, tx: TenantTx): Promise<void> {
    const derived = await derive(ctx, input, tx);
    if (derived === undefined) {
      throw new Error(`${AUTHOR_RULESET_EDITION} reached its write with no edition to fork, which the seam refuses before it gets here (L-ACT-01)`);
    }
    await mintProjectEdition(tx, {
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      parentEditionId: derived.pin.editionId,
      name: derived.pin.name,
      version: input.version,
      parameters: derived.content.parameters,
      methods: derived.content.methods,
    });
  },
};
