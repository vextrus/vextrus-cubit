// What an act type owes the seam (L-ACT-02): a pair of `preview(input) → Consequence` and
// `commit(input, consequenceDigest)`. The pair is all a rendering writes — the seam itself checks
// the permission, requires the digest and writes the act row, so no act type can be the one that
// forgets (SEAM-ACT, B-17).
import type { TenantTx } from "../db";
import type { Consequence } from "./consequence";
import type { ActorKind } from "./refusals";

/** Who is acting: the tenant they act in, who they are, and what kind of actor that is. */
export type ActorCtx = {
  readonly tenantId: string;
  readonly userId: string;
  readonly actorKind: ActorKind;
};

/** The act row the seam has just written, as the rendering's state write sees it. */
export type WrittenAct = {
  readonly actId: string;
  readonly consequenceDigest: string;
};

/**
 * One act type's rendering. Both halves run on the transaction the seam opened: the preview reads
 * the state its Consequence is computed from, and the commit writes the state change that the act
 * row is committed with — "one transaction or neither" (L-ACT-01).
 */
export type ActRendering<TInput> = {
  preview(ctx: ActorCtx, input: TInput, tx: TenantTx): Promise<Consequence>;
  commit(ctx: ActorCtx, input: TInput, act: WrittenAct, tx: TenantTx): Promise<void>;
};
