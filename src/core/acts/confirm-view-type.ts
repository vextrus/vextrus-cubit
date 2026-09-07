// CONFIRM_VIEW_TYPE (L-CAD-06 with R-TO-030: "the model may propose captions/classes where the
// grammar is silent (cited)" and "each stage's result is visible and confirmable"), rendered as
// L-ACT-02's pair.
//
// L-ACT-02: "Bulk is offered, never assembled: the machine offers groups keyed on the fact judged
// (typed grouping key over a closed enum + resolved membership in the Consequence)." So the input
// carries a key and nothing else — no list of subjects a caller could widen — and the membership in
// the Consequence is resolved here, from the state the seam's own transaction read. A key the current
// state offers no members for is refused by name rather than confirmed as an empty act.
//
// Nothing is overwritten (L-ACT-01: "before-images are rejected"): the grammar's own reading stays in
// the view's `type` and the model's proposal stays beside it, so a confirmation is a row appended
// naming the act that carried it — a fact about what a person judged, never a rewrite of what the
// drawing says.
import { viewTypeConfirmations, type TenantTx } from "../db";
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { projectDrawingsOf } from "../sheets";
import { viewRecordsOf, type ViewRecord } from "../views";
import type { Consequence } from "./consequence";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const CONFIRM_VIEW_TYPE = "CONFIRM_VIEW_TYPE" as const;

/** L-ACT-02's answer for a key whose membership the current state does not carry (R-SPINE-062). */
const GROUP_NOT_OFFERED: RefusalCode = "GROUP_NOT_OFFERED";

/**
 * The fact a view-type group is keyed on: every unconfirmed view of one drawing that a model
 * proposed at one class. R-UI-023 names groups by what their members have in common, and what these
 * have in common is a proposal nobody has ruled on yet.
 */
export type ViewGroupKey = { readonly kind: "PROPOSED_VIEW_TYPE"; readonly drawingId: string; readonly viewType: string };

/** The act's input: which project, and which group of it is being confirmed. */
export type ConfirmViewTypeInput = {
  readonly type: typeof CONFIRM_VIEW_TYPE;
  readonly projectId: string;
  readonly group: ViewGroupKey;
};

/** What one member of the group is: the view, and the record it belongs to. */
type ViewMember = { readonly view: ViewRecord; readonly drawingId: string; readonly ingestId: string };

/** L-ACT-02's refusal for a group the machine is not offering, carrying the key that named none. */
export function viewGroupNotOffered(group: ViewGroupKey): Error {
  return refusal(GROUP_NOT_OFFERED, `${CONFIRM_VIEW_TYPE} was asked for a group the project does not offer now`, {
    actType: CONFIRM_VIEW_TYPE,
    groupKind: group.kind,
    viewType: group.viewType,
  });
}

/**
 * The views a key names, resolved server-side from the state this transaction read — the whole of
 * what L-ACT-02 means by "resolved membership in the Consequence".
 *
 * A confirmed view leaves the group: L-ACT-01 gives a second, disagreeing reading its own path (a
 * competing observation, not an overwrite), and nothing here re-confirms a view. A class the
 * vocabulary does not hold names no proposal either, so it resolves to nobody rather than being
 * judged against a law core may not import (ARCH-01) — the offer test is the state's own.
 */
export async function membersOf(ctx: ActorCtx, input: ConfirmViewTypeInput, tx: TenantTx): Promise<ViewMember[]> {
  const drawings = await projectDrawingsOf(tx, { tenantId: ctx.tenantId, projectId: input.projectId });
  const drawing = drawings.find((candidate) => candidate.drawingId === input.group.drawingId);
  if (drawing?.record === undefined || drawing.record === null) return [];

  const record = drawing.record;
  const scope = { tenantId: ctx.tenantId, ingestId: record.ingestId };
  const views = await viewRecordsOf(tx, scope);
  return views
    .filter((view) => view.proposed !== null && view.proposed.type === input.group.viewType && view.confirmed === null)
    .map((view) => ({ view, drawingId: drawing.drawingId, ingestId: record.ingestId }));
}

export const confirmViewType: ActRendering<ConfirmViewTypeInput> = {
  async preview(ctx: ActorCtx, input: ConfirmViewTypeInput, tx: TenantTx): Promise<Consequence> {
    const members = await membersOf(ctx, input, tx);
    if (members.length === 0) throw viewGroupNotOffered(input.group);

    return {
      actType: CONFIRM_VIEW_TYPE,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      // N views moving from no confirmed class to one is the shipped SUBJECTS arm: a group is how
      // the subjects were chosen, not a different kind of thing to show (L-ACT-02).
      rendering: "SUBJECTS",
      subjects: members.map((member) => ({
        subjectId: member.view.viewKey,
        // The caption is what a reader recognises a view by; the key is what the act moves.
        subjectLabel: member.view.caption,
        before: [],
        after: [input.group.viewType],
      })),
    };
  },

  async commit(ctx: ActorCtx, input: ConfirmViewTypeInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const members = await membersOf(ctx, input, tx);
    if (members.length === 0) throw viewGroupNotOffered(input.group);

    await tx.insert(viewTypeConfirmations).values(
      members.map((member) => ({
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        drawingId: member.drawingId,
        ingestId: member.ingestId,
        viewKey: member.view.viewKey,
        type: input.group.viewType,
        actId: act.actId,
      })),
    );
  },
};
