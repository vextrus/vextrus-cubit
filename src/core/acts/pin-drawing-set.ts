// PIN_DRAWING_SET (L-REG-06: "a campaign pins a drawing-set revision … content-addressed by the
// digest of its members in canonical order"), rendered as L-ACT-02's pair.
//
// The input carries the set key and nothing else: membership is resolved server-side from the draft
// the set stands at, which is what "bulk is offered, never assembled" means here — a caller cannot
// widen or narrow what a pin cites by what it posts. The Consequence is the union of what the set
// names now and what the last pinned revision cited, so a member removed since that pin moves from
// the content it was cited at to nothing, and a pin of a manifest identical to the standing one
// moves nobody and is refused by the seam as an act that changes nothing (L-ACT-01).
//
// What the commit writes is immutable: a changed membership or a re-revved member yields another
// revision beside this one, never an edit of it — "mutation is advance, never drift".
import { and, drawingSetMembers, drawingSetRevisions, drawingSets, eq, isUuid, type TenantTx } from "../db";
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { currentSetRevisionOf, lineagesOf, manifestDigest, orderedManifest, type DrawingLineage, type ManifestMember, type SetRevisionRecord } from "../sets";
import type { Consequence, ConsequenceSubject } from "./consequence";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const PIN_DRAWING_SET = "PIN_DRAWING_SET" as const;

/** The answer for a set that names nothing this project holds, so no manifest could be addressed. */
const SET_NOT_PINNABLE: RefusalCode = "SET_NOT_PINNABLE";

/** The act's input: which project, and which of its sets is being pinned. */
export type PinDrawingSetInput = {
  readonly type: typeof PIN_DRAWING_SET;
  readonly projectId: string;
  readonly setId: string;
};

/** L-REG-06's refusal for a set with no members to cite, carrying the set that named none. */
export function setNotPinnable(setId: string): Error {
  return refusal(SET_NOT_PINNABLE, `${PIN_DRAWING_SET} was asked for a set that names no drawing of this project`, {
    actType: PIN_DRAWING_SET,
    setId,
  });
}

/** What one pin is computed from: the members it would cite, and the revision it advances from. */
type Pinning = {
  readonly members: readonly DrawingLineage[];
  readonly standing: SetRevisionRecord | null;
};

/**
 * The members a set names right now, resolved server-side from the state this transaction read —
 * L-ACT-02's "resolved membership in the Consequence".
 *
 * A set the project does not hold, and a set naming none of its drawings, are both refused by name:
 * there is no manifest to address, and an empty citation list is not something a campaign could be
 * measured against (L-REG-06).
 */
async function pinningOf(ctx: ActorCtx, input: PinDrawingSetInput, tx: TenantTx): Promise<Pinning> {
  if (!isUuid(input.setId) || !isUuid(input.projectId)) throw setNotPinnable(input.setId);
  const scope = { tenantId: ctx.tenantId, projectId: input.projectId };

  const held = await tx
    .select({ setId: drawingSets.setId })
    .from(drawingSets)
    .where(and(eq(drawingSets.tenantId, ctx.tenantId), eq(drawingSets.setId, input.setId), eq(drawingSets.projectId, input.projectId)))
    .limit(1);
  if (held[0] === undefined) throw setNotPinnable(input.setId);

  const named = new Set(
    (
      await tx
        .select({ drawingId: drawingSetMembers.drawingId })
        .from(drawingSetMembers)
        .where(and(eq(drawingSetMembers.tenantId, ctx.tenantId), eq(drawingSetMembers.setId, input.setId)))
    ).map((row) => row.drawingId),
  );

  const members = (await lineagesOf(tx, scope)).filter((lineage) => named.has(lineage.drawingId));
  if (members.length === 0) throw setNotPinnable(input.setId);

  return { members, standing: await currentSetRevisionOf(tx, scope, input.setId) };
}

/** The manifest this pin would record: every member at the revision it stands at now (I-D). */
function manifestOf(pinning: Pinning): ManifestMember[] {
  return orderedManifest(
    pinning.members.map((lineage) => ({
      drawingId: lineage.drawingId,
      revisionId: lineage.current.revisionId,
      sha256: lineage.current.sha256,
      name: lineage.name,
    })),
  );
}

/**
 * One subject per member of the union of what the set names now and what the standing revision
 * cited. A removed member is a subject whose citation goes from the content it was pinned at to
 * nothing — removal moves something, so a pin after one is an act rather than a repetition.
 */
function subjectsOf(pinning: Pinning): ConsequenceSubject[] {
  const cited = new Map(pinning.standing?.manifest.map((member) => [member.drawingId, member]) ?? []);
  const held = new Map(pinning.members.map((lineage) => [lineage.drawingId, lineage]));

  const subjects: ConsequenceSubject[] = [];
  for (const drawingId of orderedIds([...held.keys(), ...cited.keys()])) {
    const lineage = held.get(drawingId);
    const before = cited.get(drawingId);
    subjects.push({
      subjectId: drawingId,
      subjectLabel: lineage?.name ?? before?.name ?? drawingId,
      before: before === undefined ? [] : [before.sha256],
      after: lineage === undefined ? [] : [lineage.current.sha256],
    });
  }
  return subjects;
}

/** The subjects' own order, fixed rather than left to how the two rosters were read (L-ACT-02). */
function orderedIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

export const pinDrawingSet: ActRendering<PinDrawingSetInput> = {
  async preview(ctx: ActorCtx, input: PinDrawingSetInput, tx: TenantTx): Promise<Consequence> {
    return {
      actType: PIN_DRAWING_SET,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      rendering: "SUBJECTS",
      subjects: subjectsOf(await pinningOf(ctx, input, tx)),
    };
  },

  async commit(ctx: ActorCtx, input: PinDrawingSetInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const pinning = await pinningOf(ctx, input, tx);
    const manifest = manifestOf(pinning);
    await tx.insert(drawingSetRevisions).values({
      tenantId: ctx.tenantId,
      setId: input.setId,
      projectId: input.projectId,
      digest: manifestDigest(manifest),
      manifest: manifest.map((member) => ({ drawingId: member.drawingId, revisionId: member.revisionId, sha256: member.sha256, name: member.name })),
      actId: act.actId,
    });
  },
};
