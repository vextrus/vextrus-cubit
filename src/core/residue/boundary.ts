// R-TO-052's two boundary acts, as one rendering (L-ACT-02). Holding a kind out of THIS BILL and
// declaring one out of the PROJECT SCOPE are the same shape of judgement over the same cell on
// L-QTY-05's two orthogonal axes, so they are rendered once and bound to their cause — a second copy
// of the pair would be a second answer to what a declaration does (B-17, ARCH-02).
//
// Both write exactly one `scope_declarations` row, in the transaction the act row is written in
// (L-ACT-01). Neither withdraws anything: `in_force` is written true and never flipped here, and the
// screen offers no door that would (Decision § 8).
import { and, campaigns, eq, recordModelOutcome, scopeDeclarations, type TenantTx } from "../db";
import type { ElementType } from "../catalogue/classes";
import type { Kind } from "../catalogue/kinds";
import { REFUSALS, type ScopeDeclarationCause } from "../errors";
import { refusal } from "../faults/refusal-marker";
import type { Consequence, ConsequenceSubject } from "../acts/consequence";
import type { ActRendering, ActorCtx, WrittenAct } from "../acts/rendering";
import type { ActType } from "../acts/law";
import { residueCellsIn } from "./residue";
import { IN_BILL, QUANTITY_BEARING, cellRef, type ResidueCell } from "./law";

/** The cell one declaration stands over — L-QTY-05's (class × kind × level). */
export type DeclarationCell = {
  readonly class: ElementType;
  readonly kind: Kind;
  readonly levelId: string;
};

/**
 * The boundary a model proposed for this cell, where the person carrying the act was shown one
 * (L-AI-02: a classification held until confirmed). It is carried INTO the act so the act can judge
 * it: what a person did with a proposal is the labeled outcome the calibration line is read over,
 * and only the act knows whether they took it or drew the boundary on the other axis instead.
 */
export type BoundaryProposal = {
  readonly callId: string;
  readonly cause: ScopeDeclarationCause;
};

/** What either boundary act is asked to do: one cell of one campaign of one project. */
export type BoundaryInput<TType extends ActType> = DeclarationCell & {
  readonly type: TType;
  readonly projectId: string;
  readonly campaignId: string;
  /** Absent where the person declared unaided — and then no outcome is written at all (I-297). */
  readonly proposal?: BoundaryProposal;
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

/** The cause a declaration on the MEASUREMENT axis stands under; the other axis is the bill's. */
const NOT_IN_PROJECT_SCOPE = "NOT_IN_PROJECT_SCOPE" as const satisfies ScopeDeclarationCause;

/**
 * The cell the act stands over, as the residue itself holds it — or the refusal that there is none.
 *
 * Whether an address names a cell is the residue's own question (L-QTY-05): a class no channel
 * sighted and a level the project's stack does not hold are both addresses the query answers nothing
 * at, and a declaration written over one would be a row no reading ever shows anybody. So the cells
 * are read through the same arms the grid is painted from rather than re-derived here (B-17), inside
 * the transaction the act is being rendered in.
 */
async function cellOf<TType extends ActType>(tx: TenantTx, ctx: ActorCtx, input: BoundaryInput<TType>, setRevisionId: string, address: string): Promise<ResidueCell> {
  const cells = await residueCellsIn(tx, { tenantId: ctx.tenantId, projectId: input.projectId }, { campaignId: input.campaignId, setRevisionId });
  const held = cells.find((cell) => cellRef(cell) === address);
  if (held === undefined) {
    throw refusal(REFUSALS.CELL_NOT_IN_RESIDUE.code, "a boundary was declared over an address this campaign's residue holds no cell at", {
      projectId: input.projectId,
      campaignId: input.campaignId,
      cell: address,
    });
  }
  return held;
}

/**
 * How the axis this act moves reads before it moves. The arm this act itself writes is read first:
 * a declaration already in force IS the reading, whatever the grid displays over it, because an act
 * cannot move what it has already written — asked a second time it would leave the cell exactly as
 * it found it, and the seam refuses it by name (L-ACT-01). Only where no declaration stands does the
 * grid's own arm order speak: published lines above everything (so the actor confirming a
 * declaration over a measured cell sees the contradiction they are about to author, risk note 3),
 * then the idle reading of this axis. A sheet read only in part is beaten by the very arm this act
 * writes, so it is not a reading this act could move and does not enter the Consequence.
 */
function readingBefore(cell: ResidueCell, cause: ScopeDeclarationCause, axisIdle: string): string {
  const standing = (cause === NOT_IN_PROJECT_SCOPE ? cell.measurementActId : cell.billActId) !== null;
  if (standing) return cause;
  if (cell.measurement === QUANTITY_BEARING) return QUANTITY_BEARING;
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
    // A campaign this project does not hold names no residue to declare anything about, so the act
    // is answered rather than attempted — an address is a fact about the address (L-REG-07, B-21).
    if (campaign === null) {
      throw refusal(REFUSALS.CAMPAIGN_NOT_FOUND.code, "a boundary was declared under a campaign this project does not hold", {
        projectId: input.projectId,
        campaignId: input.campaignId,
      });
    }

    const address = cellRef({ kind: input.kind, class: input.class, levelId: input.levelId });
    const cell = await cellOf(tx, ctx, input, campaign.setRevisionId, address);

    return [
      {
        subjectId: address,
        subjectLabel: [input.kind, input.class, cell.levelLabel].filter((part) => part !== "").join(" · "),
        before: [readingBefore(cell, cause, axisIdle)],
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

      // A person who was shown a proposed boundary has just judged it, and this is the only place
      // that knows how: CONFIRMED where the cause they carried is the cause proposed, OVERRULED
      // where they drew the boundary on the OTHER axis instead. It lands in this transaction, with
      // the act row and the declaration, or none of the three does (L-ACT-01, L-AI-02).
      //
      // A person who declared unaided judged no proposal and writes no outcome: `awaiting` on the
      // calibration line is the truth about a proposal nobody acted on. REPUDIATED and AFFIRMED are
      // never written here — S-Coverage offers no door that dismisses a proposal and no second
      // reading that corroborates one, so a row for either would be a record nothing made (I-297).
      if (input.proposal === undefined) return;
      await recordModelOutcome(tx, {
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        callId: input.proposal.callId,
        outcome: input.proposal.cause === cause ? "CONFIRMED" : "OVERRULED",
        actId: act.actId,
        actorUserId: ctx.userId,
      });
    },
  };
}

/** The reading the bill axis stands at while nobody has held the cell out (L-QTY-05). */
export const BILL_IDLE = IN_BILL;

/** The reading the measurement axis falls through to while nothing explains an absence. */
export const MEASUREMENT_IDLE = "NOT_ESTABLISHED";
