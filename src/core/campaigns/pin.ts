// The rule-set edition a project is pinned to, whole — the row the machinery needs rather than the
// view a surface reads (R-SPINE-012's `projectRulesetView` shows a person the identity, the digest
// and the parameters; a campaign has to copy the edition's IDENTITY too, and the gate has to resolve
// a method version out of the pairs it cites).
//
// One home for the question (ARCH-02): the campaign's open and the gate both ask here, on the
// caller's own transaction, so what a campaign snapshots and what the gate measures under are read
// from the same row in the same breath.
import { and, eq, tenantRulesetEditions, type TenantTx } from "../db";
import type { EditionParameter, MethodPair } from "../rulesets/editions/content";
import type { CampaignScope } from "./scope";

/** The pinned edition, as the machinery reads one: identity, content digest, and what it holds. */
export type PinnedEdition = {
  readonly editionId: string;
  readonly digest: string;
  readonly parameters: Readonly<Record<string, EditionParameter>>;
  readonly methods: readonly MethodPair[];
};

/** The columns an edition is read by, wherever it is reached from — one reading, one home (B-17). */
const EDITION_COLUMNS = {
  editionId: tenantRulesetEditions.editionId,
  digest: tenantRulesetEditions.contentDigest,
  parameters: tenantRulesetEditions.parameters,
  methods: tenantRulesetEditions.methods,
} as const;

/**
 * One edition of this workspace by its id — what a campaign snapshotted rather than what the project
 * is pinned to now. A campaign is measured under the edition it copied at creation (L-REG-07), so
 * this is the reading the gate resolves a method version through.
 */
export async function editionOf(tx: TenantTx, tenantId: string, editionId: string): Promise<PinnedEdition | null> {
  const held = await tx
    .select(EDITION_COLUMNS)
    .from(tenantRulesetEditions)
    .where(and(eq(tenantRulesetEditions.tenantId, tenantId), eq(tenantRulesetEditions.editionId, editionId)))
    .limit(1);
  return held[0] ?? null;
}

/**
 * The edition this project's pin cites, or nothing where the address names no pin of this workspace.
 *
 * L-REG-07 makes an unpinned project unrepresentable — creation forks the pin in the same
 * transaction — so `null` here means the scope names no project this workspace holds, which is an
 * answer rather than a fault (the caller decides what to say about it).
 */
export async function pinnedEditionOf(tx: TenantTx, scope: CampaignScope): Promise<PinnedEdition | null> {
  const held = await tx
    .select(EDITION_COLUMNS)
    .from(tenantRulesetEditions)
    .where(
      and(
        eq(tenantRulesetEditions.tenantId, scope.tenantId),
        eq(tenantRulesetEditions.projectId, scope.projectId),
        eq(tenantRulesetEditions.scope, "project"),
      ),
    )
    .limit(1);
  return held[0] ?? null;
}
