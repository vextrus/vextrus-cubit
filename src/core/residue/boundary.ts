// R-TO-052's two boundary acts, as one rendering (L-ACT-02). Holding a kind out of THIS BILL and
// declaring one out of the PROJECT SCOPE are the same shape of judgement over the same cell on
// L-QTY-05's two orthogonal axes, so they are rendered once and bound to their cause — a second copy
// of the pair would be a second answer to what a declaration does (B-17, ARCH-02).
//
// Both write exactly one `scope_declarations` row, in the transaction the act row is written in
// (L-ACT-01). Neither withdraws anything: `in_force` is written true and never flipped here, and the
// screen offers no door that would (Decision § 8).
import { and, campaigns, eq, levels, quantityLines, registerObjects, scopeDeclarations, type TenantTx } from "../db";
import type { ElementType } from "../catalogue/classes";
import type { Kind } from "../catalogue/kinds";
import type { ScopeDeclarationCause } from "../errors";
import type { Consequence, ConsequenceSubject } from "../acts/consequence";
import type { ActRendering, ActorCtx, WrittenAct } from "../acts/rendering";
import type { ActType } from "../acts/law";
import { IN_BILL, QUANTITY_BEARING, cellRef } from "./law";

/** The cell one declaration stands over — L-QTY-05's (class × kind × level). */
export type DeclarationCell = {
  readonly class: ElementType;
  readonly kind: Kind;
  readonly levelId: string;
};

/** What either boundary act is asked to do: one cell of one campaign of one project. */
export type BoundaryInput<TType extends ActType> = DeclarationCell & {
  readonly type: TType;
  readonly projectId: string;
  readonly campaignId: string;
};

/** The campaign a declaration is made under, as this project holds it (L-REG-07). */
async function campaignHeld(tx: TenantTx, ctx: ActorCtx, projectId: string, campaignId: string): Promise<{ setRevisionId: string } | null> {
  const held = await tx
    .select({ setRevisionId: campaigns.setRevisionId })
    .from(campaigns)
    .where(and(eq(campaigns.tenantId, ctx.tenantId), eq(campaigns.projectId, projectId), eq(campaigns.campaignId, campaignId)))
    .limit(1);
  return held[0] ?? null;
}

/** The level's own label, as a reader recognises the cell by it (I-25). */
async function levelLabelOf(tx: TenantTx, ctx: ActorCtx, projectId: string, levelId: string): Promise<string> {
  const held = await tx
    .select({ label: levels.label })
    .from(levels)
    .where(and(eq(levels.tenantId, ctx.tenantId), eq(levels.projectId, projectId), eq(levels.levelId, levelId)))
    .limit(1);
  return held[0]?.label ?? "";
}

/** Whether this campaign published a line in this cell — the arm that stands above every other. */
async function bearsQuantity(tx: TenantTx, ctx: ActorCtx, campaignId: string, setRevisionId: string, cell: DeclarationCell): Promise<boolean> {
  const held = await tx
    .select({ lineId: quantityLines.lineId })
    .from(quantityLines)
    .innerJoin(
      registerObjects,
      and(
        eq(registerObjects.tenantId, quantityLines.tenantId),
        eq(registerObjects.setRevisionId, setRevisionId),
        eq(registerObjects.objectKey, quantityLines.objectKey),
        eq(registerObjects.levelId, cell.levelId),
      ),
    )
    .where(
      and(
        eq(quantityLines.tenantId, ctx.tenantId),
        eq(quantityLines.campaignId, campaignId),
        eq(quantityLines.class, cell.class),
        eq(quantityLines.kind, cell.kind),
      ),
    )
    .limit(1);
  return held.length > 0;
}

/** The declaration already standing over this cell under this cause, or nothing. */
async function declarationHeld(tx: TenantTx, ctx: ActorCtx, campaignId: string, cell: DeclarationCell, cause: ScopeDeclarationCause): Promise<{ actId: string } | null> {
  const held = await tx
    .select({ actId: scopeDeclarations.actId })
    .from(scopeDeclarations)
    .where(
      and(
        eq(scopeDeclarations.tenantId, ctx.tenantId),
        eq(scopeDeclarations.campaignId, campaignId),
        eq(scopeDeclarations.class, cell.class),
        eq(scopeDeclarations.kind, cell.kind),
        eq(scopeDeclarations.levelId, cell.levelId),
        eq(scopeDeclarations.cause, cause),
        eq(scopeDeclarations.inForce, true),
      ),
    )
    .limit(1);
  return held[0] ?? null;
}

/**
 * How the axis this act moves reads before it moves: the arm order L-QTY-05 fixes, as far as this
 * act reaches. Published lines stand above everything, then the declaration already in force — and
 * a sheet read only in part is beaten by the very arm this act writes, so it is not a reading this
 * act could move and does not enter the Consequence the actor confirms.
 */
function readingBefore(hasLines: boolean, standing: boolean, cause: ScopeDeclarationCause, axisIdle: string): string {
  if (hasLines) return QUANTITY_BEARING;
  if (standing) return cause;
  return axisIdle;
}

/**
 * One boundary act's pair, bound to the cause it declares (L-ACT-02). The subject names the cell —
 * its address as the id, and the kind, class and level a reader recognises it by as the label — and
 * carries the axis' reading before and after, so a commit computed against moved state carries a
 * different digest.
 */
export function boundaryRendering<TType extends ActType>(actType: TType, cause: ScopeDeclarationCause, axisIdle: string): ActRendering<BoundaryInput<TType>> {
  async function subjectsOf(ctx: ActorCtx, input: BoundaryInput<TType>, tx: TenantTx): Promise<ConsequenceSubject[]> {
    const campaign = await campaignHeld(tx, ctx, input.projectId, input.campaignId);
    // A campaign this project does not hold is no subject at all — there is nothing to name — so the
    // act moves nothing and the seam refuses it by name (L-ACT-01).
    if (campaign === null) return [];

    const cell: DeclarationCell = { class: input.class, kind: input.kind, levelId: input.levelId };
    const [hasLines, standing, label] = await Promise.all([
      bearsQuantity(tx, ctx, input.campaignId, campaign.setRevisionId, cell),
      declarationHeld(tx, ctx, input.campaignId, cell, cause),
      levelLabelOf(tx, ctx, input.projectId, input.levelId),
    ]);

    return [
      {
        subjectId: cellRef({ kind: input.kind, class: input.class, levelId: input.levelId }),
        subjectLabel: [input.kind, input.class, label].filter((part) => part !== "").join(" · "),
        before: [readingBefore(hasLines, standing !== null, cause, axisIdle)],
        after: [cause],
      },
    ];
  }

  return {
    async preview(ctx: ActorCtx, input: BoundaryInput<TType>, tx: TenantTx): Promise<Consequence> {
      return {
        actType,
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        rendering: "SUBJECTS",
        subjects: await subjectsOf(ctx, input, tx),
      };
    },

    async commit(ctx: ActorCtx, input: BoundaryInput<TType>, act: WrittenAct, tx: TenantTx): Promise<void> {
      await tx.insert(scopeDeclarations).values({
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        campaignId: input.campaignId,
        class: input.class,
        kind: input.kind,
        levelId: input.levelId,
        cause,
        actId: act.actId,
        inForce: true,
      });
    },
  };
}

/** The reading the bill axis stands at while nobody has held the cell out (L-QTY-05). */
export const BILL_IDLE = IN_BILL;

/** The reading the measurement axis falls through to while nothing explains an absence. */
export const MEASUREMENT_IDLE = "NOT_ESTABLISHED";
