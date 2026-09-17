// AUTHOR_RULESET_EDITION (AM-04, L-MEA-01, R-SPINE-012), rendered as L-ACT-02's pair: the act that
// mints a project's next rule-set edition.
//
// What it moves is VALUES and a version. The parameter keys, their units and the (rule id, version)
// pairs of the methods in force are the current edition's and are copied verbatim (I-265), so the
// digest — which keys CONTENT — moves exactly when a decimal moves, and a verbatim fork carries its
// parent's digest by construction (L-MEA-01).
//
// Nothing is ever updated: the commit appends a project-scope row whose parent is the edition the
// project reads today, and the project reads the newest one from the moment it lands. The creation
// pin L-REG-07 wrote stands untouched, as the head of the chain this edition is a step on.
import type { TenantTx } from "../db";
import { refusal } from "../faults/refusal-marker";
import { authoredContent, mintProjectEdition, projectHoldsVersion } from "../rulesets/editions/mint";
import { currentProjectEdition, type CurrentProjectEdition } from "../rulesets/editions/view";
import { editionDigest } from "../rulesets/editions/content";
import type { Consequence } from "./consequence";
import { actChangesNothing } from "./refusals";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const AUTHOR_RULESET_EDITION = "AUTHOR_RULESET_EDITION" as const;

/**
 * The act's input: whose project, the version the author states, and the decimals they state under
 * the pin's own parameter keys. Units and methods are never stated — they are copied from the pin.
 */
export type AuthorRulesetEditionInput = {
  readonly type: typeof AUTHOR_RULESET_EDITION;
  readonly projectId: string;
  readonly version: string;
  readonly values: Readonly<Record<string, string>>;
};

/** An edition as L-MEA-01 spells one, for the line a reader confirms in the dialog. */
function identityLine(name: string, version: string): string {
  return `${name} @ ${version}`;
}

/** What the act would do, judged against the edition this transaction read. */
interface Derived {
  readonly pin: CurrentProjectEdition;
  readonly digest: string;
  readonly content: ReturnType<typeof authoredContent>;
}

/**
 * The act, judged against the state this transaction read.
 *
 * Three things are refused before a Consequence is computed, in the order the seam judges them: a
 * project with no edition to fork (which is an address naming no pinned project of this workspace,
 * L-REG-07's unrepresentable case reached another way), a version this project has already minted
 * an edition under (identity is (scope, name, version) — a second edition behind one name), and an
 * authored content identical to the pin's, which mints a row that changes no figure anybody reads
 * (I-265, L-ACT-01's "an act changes what the machine would derive").
 */
async function derive(ctx: ActorCtx, input: AuthorRulesetEditionInput, tx: TenantTx): Promise<Derived> {
  const pin = await currentProjectEdition(tx, { tenantId: ctx.tenantId, projectId: input.projectId });
  if (pin === undefined) {
    throw refusal("REQUEST_MALFORMED", `the project ${input.projectId} reads no rule-set edition, so there is nothing to fork (L-REG-07)`);
  }
  if (await projectHoldsVersion(tx, { tenantId: ctx.tenantId, projectId: input.projectId, version: input.version })) {
    throw refusal("EDITION_VERSION_TAKEN", `this project already holds a rule-set edition at version ${input.version} (L-MEA-01: identity is (scope, name, version))`);
  }

  const content = authoredContent(pin.content, input.values);
  const digest = editionDigest(content);
  if (digest === pin.digest) throw actChangesNothing(AUTHOR_RULESET_EDITION, [input.projectId]);
  return { pin, digest, content };
}

export const authorRulesetEdition: ActRendering<AuthorRulesetEditionInput> = {
  async preview(ctx: ActorCtx, input: AuthorRulesetEditionInput, tx: TenantTx): Promise<Consequence> {
    const derived = await derive(ctx, input, tx);
    return {
      actType: AUTHOR_RULESET_EDITION,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      rendering: "SUBJECTS",
      // The subject is the project, because what moves is which edition the project reads. Identity
      // and digest stand beside one another on both sides and neither substitutes for the other
      // (L-MEA-01): a reader confirms the version they are minting AND the content it fingerprints.
      subjects: [
        {
          subjectId: input.projectId,
          subjectLabel: identityLine(derived.pin.identity.name, input.version),
          before: [identityLine(derived.pin.identity.name, derived.pin.identity.version), derived.pin.digest],
          after: [identityLine(derived.pin.identity.name, input.version), derived.digest],
        },
      ],
    };
  },

  async commit(ctx: ActorCtx, input: AuthorRulesetEditionInput, _act: WrittenAct, tx: TenantTx): Promise<void> {
    const derived = await derive(ctx, input, tx);
    await mintProjectEdition(tx, {
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      parentEditionId: derived.pin.editionId,
      // The name is the parent's: authoring states a version, never a new name — the rule set a
      // project reads is the one it was pinned to, at a later edition of it (L-MEA-01).
      name: derived.pin.identity.name,
      version: input.version,
      content: derived.content,
    });
  },
};
