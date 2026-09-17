// AM-04's act: minting a project's next rule-set edition. L-MEA-01 rules that "authoring mints a new
// edition, never updates one, and is its own permission" — the permission is AUTHOR_RULE_SET
// (law.ts), and the "never updates one" half is the store's: `mintProjectEdition` is one insert into
// the append-only ledger, with the edition the author was shown as its parent.
//
// What authoring moves is VALUES. The keys, the units and the (rule id, version) pairs of the
// methods in force are the pin's and are copied verbatim, so a fork with every field left as pinned
// digests to exactly what its parent does (L-MEA-01: "a verbatim fork shares its parent's digest by
// construction"). The reading of "what changed" is the ruleset-authoring module's, which is the same
// one the screen draws its diff from — the author confirms the reading they were shown (B-17).
//
// Identity moves whatever the content does: the new edition is minted under a version the author
// states, so the Consequence's subject always ends somewhere it did not begin and the seam's
// ACT_CHANGES_NOTHING never fires on a lawful submission of this type.
import { refusal } from "../faults/refusal-marker";
import { REFUSALS } from "../errors";
import { authoredContent, currentProjectEdition, editionDigest, mintProjectEdition, projectEditionVersions, type CurrentProjectEdition } from "../rulesets/editions";
import type { TenantTx } from "../db";
import type { Consequence } from "./consequence";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

const AUTHOR_RULESET_EDITION = "AUTHOR_RULESET_EDITION" as const;

/**
 * What an author states: the project whose rule set is being forked, the version the new edition is
 * minted under, and a decimal per parameter key of the pin. Units and methods are absent on purpose
 * (Design Decision I-265) — they are the pin's, and a statement that could move them would be a
 * statement that could change what the digest keys without the author having authored it.
 */
export type AuthorRulesetEditionInput = {
  readonly type: "AUTHOR_RULESET_EDITION";
  readonly projectId: string;
  readonly version: string;
  readonly values: Readonly<Record<string, string>>;
};

/** The edition this project reads today, which is what the new one is forked from (L-REG-07). */
async function pinOf(ctx: ActorCtx, input: AuthorRulesetEditionInput, tx: TenantTx): Promise<CurrentProjectEdition> {
  const pin = await currentProjectEdition(tx, { tenantId: ctx.tenantId, projectId: input.projectId });
  if (pin === undefined) {
    // L-REG-07 pins every project at creation, so this is a store that lost a row rather than an
    // answer the product gives anyone: the screen shows the unpinned teaching and never opens a
    // dialog over a project with nothing to fork (ARCH-03).
    throw new Error(`${AUTHOR_RULESET_EDITION} was asked for a project that is pinned to no rule-set edition — a project pins one at creation (L-REG-07)`);
  }
  return pin;
}

/**
 * The version, held to L-MEA-01's identity: (scope, name, version). A version this project's rule
 * set has already been minted under names an edition that exists, so minting a second one under it
 * would give two editions one identity. Refused by name, with nothing written (R-SPINE-062).
 */
async function refuseVersionAlreadyHeld(ctx: ActorCtx, input: AuthorRulesetEditionInput, tx: TenantTx): Promise<void> {
  const held = await projectEditionVersions(tx, { tenantId: ctx.tenantId, projectId: input.projectId });
  if (!held.includes(input.version)) return;
  throw refusal(REFUSALS.EDITION_VERSION_TAKEN.code, `this project's rule set already holds an edition at version ${input.version}`, {
    refusalCode: REFUSALS.EDITION_VERSION_TAKEN.code,
    version: input.version,
  });
}

/** An edition as a person names one (L-MEA-01): `IS1200_IN @ 2026.09`. */
function editionLabel(name: string, version: string): string {
  return `${name} @ ${version}`;
}

/**
 * The state this act judges and the state it would leave: the identity and the digest, which
 * L-MEA-01 holds apart and neither of which stands for the other. Both are shown, because a
 * verbatim fork moves the identity and leaves the digest exactly where it was — and that is the
 * fact an author most needs to see before confirming.
 */
async function derive(ctx: ActorCtx, input: AuthorRulesetEditionInput, tx: TenantTx): Promise<{ pin: CurrentProjectEdition; digest: string }> {
  const pin = await pinOf(ctx, input, tx);
  await refuseVersionAlreadyHeld(ctx, input, tx);
  return { pin, digest: editionDigest(authoredContent(pin.parameters, input.values, pin.methods)) };
}

export const authorRulesetEdition: ActRendering<AuthorRulesetEditionInput> = {
  async preview(ctx: ActorCtx, input: AuthorRulesetEditionInput, tx: TenantTx): Promise<Consequence> {
    const { pin, digest } = await derive(ctx, input, tx);
    return {
      actType: AUTHOR_RULESET_EDITION,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      rendering: "SUBJECTS",
      subjects: [
        {
          subjectId: input.projectId,
          subjectLabel: editionLabel(pin.name, input.version),
          before: [editionLabel(pin.name, pin.version), pin.digest],
          after: [editionLabel(pin.name, input.version), digest],
        },
      ],
      // The lines measured against the superseded pin re-derive under the edition that supersedes
      // it, and that re-derivation is a later node's: this act states no effects rather than
      // stating an empty roster it has not computed (R-SPINE-012).
    };
  },

  async commit(ctx: ActorCtx, input: AuthorRulesetEditionInput, _act: WrittenAct, tx: TenantTx): Promise<void> {
    const pin = await pinOf(ctx, input, tx);
    await refuseVersionAlreadyHeld(ctx, input, tx);
    const content = authoredContent(pin.parameters, input.values, pin.methods);
    await mintProjectEdition(tx, {
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      parentEditionId: pin.editionId,
      name: pin.name,
      version: input.version,
      parameters: content.parameters,
      methods: content.methods,
    });
  },
};
