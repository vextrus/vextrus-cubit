// CONFIRM_DISCIPLINE (L-REG-03: "discipline is drawing-scoped, machine-proposed, human-confirmed,
// fails closed"), rendered as L-ACT-02's pair.
//
// L-ACT-02: "Bulk is offered, never assembled: the machine offers groups keyed on the fact judged
// (typed grouping key over a closed enum + resolved membership in the Consequence)." So the input
// carries a key and nothing else — no list of subjects a caller could widen — and the membership in
// the Consequence is resolved here, from the state the seam's own transaction read. A key the
// current state offers no members for is refused by name rather than confirmed as an empty act.
//
// Nothing is overwritten (L-ACT-01: "before-images are rejected"): the machine's proposal is not
// stored at all, so a confirmation is a row appended beside it naming the act that carried it.
import { sheetDisciplines, type TenantTx } from "../db";
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { confirmationsOf, isDiscipline, parseSheetId, projectDrawingsOf, sheetsOfRecord, type Discipline, type SheetFacts } from "../sheets";
import { appStorage } from "../storage/app";
import type { Consequence } from "./consequence";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const CONFIRM_DISCIPLINE = "CONFIRM_DISCIPLINE" as const;

/** L-ACT-02's answer for a key whose membership the current state does not carry (R-SPINE-062). */
const GROUP_NOT_OFFERED: RefusalCode = "GROUP_NOT_OFFERED";

/**
 * The facts a group can be keyed on. R-UI-023 names groups by what their members have in common:
 * every unconfirmed sheet of one drawing that the grammar proposed at one discipline, or one named
 * sheet on its own — which is still a typed key with server-resolved membership, never a selection.
 */
export const GROUP_KINDS = ["PROPOSED_DISCIPLINE", "SHEET"] as const;

/** One group kind, drawn from the closed enum above. */
export type GroupKind = (typeof GROUP_KINDS)[number];

/** The typed grouping key L-ACT-02 asks for: the fact judged, in the shape that fact takes. */
export type OfferedGroupKey =
  | { readonly kind: "PROPOSED_DISCIPLINE"; readonly drawingId: string; readonly discipline: Discipline }
  | { readonly kind: "SHEET"; readonly sheetId: string; readonly discipline: Discipline };

/** The act's input: which project, and which group of it is being confirmed. */
export type ConfirmDisciplineInput = {
  readonly type: typeof CONFIRM_DISCIPLINE;
  readonly projectId: string;
  readonly group: OfferedGroupKey;
};

/** L-ACT-02's refusal for a group the machine is not offering, carrying the key that named none. */
export function groupNotOffered(group: OfferedGroupKey): Error {
  return refusal(GROUP_NOT_OFFERED, `${CONFIRM_DISCIPLINE} was asked for a group the project does not offer now`, {
    actType: CONFIRM_DISCIPLINE,
    groupKind: group.kind,
    discipline: group.discipline,
  });
}

/**
 * The sheets a key names, resolved server-side from the state this transaction read — the whole of
 * what L-ACT-02 means by "resolved membership in the Consequence".
 *
 * A confirmed sheet leaves every group: L-ACT-01 gives a second, disagreeing reading its own path
 * (a competing observation, not an overwrite), and nothing here re-confirms a sheet.
 */
export async function membersOf(ctx: ActorCtx, input: ConfirmDisciplineInput, tx: TenantTx): Promise<SheetFacts[]> {
  const scope = { tenantId: ctx.tenantId, projectId: input.projectId };
  const group = input.group;
  // A key naming a discipline the closed enum does not hold names a group nothing could belong to.
  if (typeof group.discipline !== "string" || !isDiscipline(group.discipline)) return [];

  const drawings = await projectDrawingsOf(tx, scope);
  const confirmed = new Set((await confirmationsOf(tx, scope)).map((row) => row.sheetId));
  const storage = appStorage();

  if (group.kind === "SHEET") {
    const named = parseSheetId(group.sheetId);
    if (named === null) return [];
    const carrying = drawings.find((drawing) => drawing.record?.ingestId === named.ingestId);
    if (carrying?.record === undefined || carrying.record === null) return [];
    const sheets = await sheetsOfRecord(ctx.tenantId, carrying.record, storage);
    // I-84: the discipline is the person's judgement inside the closed enum, so the offer test is
    // "carried by a current record and unconfirmed" — not "the grammar proposed this one".
    return sheets.filter((sheet) => sheet.sheetId === group.sheetId && !confirmed.has(sheet.sheetId));
  }

  const drawing = drawings.find((candidate) => candidate.drawingId === group.drawingId);
  if (drawing?.record === undefined || drawing.record === null) return [];
  const sheets = await sheetsOfRecord(ctx.tenantId, drawing.record, storage);
  return sheets.filter((sheet) => sheet.proposal.discipline === group.discipline && !confirmed.has(sheet.sheetId));
}

export const confirmDiscipline: ActRendering<ConfirmDisciplineInput> = {
  async preview(ctx: ActorCtx, input: ConfirmDisciplineInput, tx: TenantTx): Promise<Consequence> {
    const members = await membersOf(ctx, input, tx);
    if (members.length === 0) throw groupNotOffered(input.group);

    return {
      actType: CONFIRM_DISCIPLINE,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      // N sheets moving from no confirmed discipline to one is the shipped SUBJECTS arm: a group is
      // how the subjects were chosen, not a different kind of thing to show (L-ACT-02).
      rendering: "SUBJECTS",
      subjects: members.map((sheet) => ({
        subjectId: sheet.sheetId,
        // The proposed title is what a reader recognises a sheet by; the id is what the act moves.
        subjectLabel: sheet.proposal.title,
        before: [],
        after: [input.group.discipline],
      })),
    };
  },

  async commit(ctx: ActorCtx, input: ConfirmDisciplineInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const members = await membersOf(ctx, input, tx);
    if (members.length === 0) throw groupNotOffered(input.group);

    await tx.insert(sheetDisciplines).values(
      members.map((sheet) => ({
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        drawingId: sheet.drawingId,
        ingestId: sheet.ingestId,
        layoutName: sheet.layoutName,
        discipline: input.group.discipline,
        actId: act.actId,
      })),
    );
  },
};
