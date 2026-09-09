// L-REG-07's three snapshots, each derived from what is in force right now: the rule-set edition key
// the project is pinned to, the work-item catalogue digest over `bears`, and the level-stack digest.
//
// A campaign copies these at creation and never again; the freshness gate diffs the copy against
// what this file answers now. Both sides ask the same function, so a snapshot and the state it is
// compared with can never be computed two different ways (B-17).
import { createHash } from "node:crypto";
import { canonical } from "../acts/consequence";
import type { BearsRow } from "../catalogue/bears";
import { BEARS } from "../catalogue/bears";
import type { TenantTx } from "../db";
import { levelStackDigest } from "../levels/digest";
import { liveLevelsOf } from "../levels/store";
import { pinnedEditionOf } from "./pin";
import type { CampaignScope } from "./scope";

/** The three digests a campaign carries, in force at one moment. */
export type CampaignDigests = {
  readonly editionId: string;
  readonly editionDigest: string;
  readonly catalogueDigest: string;
  readonly levelStackDigest: string;
};

/** Code-point order over the canonical spelling of a pair — a set has no order of its own. */
function byPair(left: readonly string[], right: readonly string[]): number {
  const leftKey = left.join("");
  const rightKey = right.join("");
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

/**
 * The work-item catalogue digest (L-REG-07): sha-256 hex over the canonical form of the (class,
 * kind) pairs the relation holds, canonically sorted and taken as a set — so the order the rows were
 * read in cannot change it, and a pair added or removed does.
 *
 * `canonical` is the tree's one canonical-JSON home, the same reading an act digest and the level
 * stack digest are taken over (B-17): three digests of this product cannot disagree about what a
 * value says.
 */
export function catalogueDigest(rows: readonly BearsRow[]): string {
  const pairs = [...new Set(rows.map((row) => JSON.stringify([row.class, row.kind])))]
    .map((spelling) => JSON.parse(spelling) as string[])
    .sort(byPair);
  return createHash("sha256").update(canonical(pairs), "utf8").digest("hex");
}

/**
 * What a campaign opened right now would snapshot, or nothing at all where this transaction can see
 * no pin for the project.
 *
 * The absent arm is the same answer `projectRulesetView` gives a surface (R-SPINE-012): an address
 * that names no pin of this workspace is answered, never thrown at — L-REG-07 makes an unpinned
 * project unrepresentable through the product's own door, so `null` here says the address names no
 * project this workspace pinned, and the caller decides what to say about it (B-17, ARCH-03).
 */
export async function campaignDigestsIfPinned(tx: TenantTx, scope: CampaignScope): Promise<CampaignDigests | null> {
  const pin = await pinnedEditionOf(tx, scope);
  if (pin === null) return null;
  const stack = await liveLevelsOf(tx, scope);
  return {
    editionId: pin.editionId,
    editionDigest: pin.digest,
    catalogueDigest: catalogueDigest(BEARS),
    levelStackDigest: levelStackDigest(stack.map((level) => ({ levelId: level.levelId, ordinal: level.ordinal }))),
  };
}

/**
 * The same three digests, for a caller that already knows the project is pinned — the freshness gate,
 * which is diffing a campaign that was opened against them. Reaching here without a pin is the store
 * having lost what a landed campaign was measured under, which is an inconsistency rather than an
 * answer anybody is owed (ARCH-03).
 */
export async function campaignDigestsOf(tx: TenantTx, scope: CampaignScope): Promise<CampaignDigests> {
  const digests = await campaignDigestsIfPinned(tx, scope);
  if (digests === null) {
    throw new Error(`the project ${scope.projectId} holds no pinned rule-set edition — an unpinned project is unrepresentable, so a campaign over one snapshots nothing (L-REG-07)`);
  }
  return digests;
}
