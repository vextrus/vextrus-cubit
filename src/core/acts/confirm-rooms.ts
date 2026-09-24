// CONFIRM_ROOMS (R-TO-036: rooms from closed wall outlines with labels, "the model proposing names from
// labels (cited)"; R-TO-030: "each stage's result is visible and confirmable"), rendered as L-ACT-02's
// pair (viewer.md I-687).
//
// L-ACT-02: "Bulk is offered, never assembled." The input carries a typed key and nothing else: one
// plan's rooms (`PROPOSED_ROOMS`), or one named room at the type a person gives it (`ROOM`). The
// membership is resolved here, from the state the seam's own transaction read — the rooms the record's
// partition stored, the confirmations already written, and the answers the model already gave — so
// what a person is shown and what is written are one list, and a key the state offers nobody under is
// refused by name.
//
// What a room IS is read in one place (`../rooms/room-type-question`): off its labels by the grammar,
// or where the grammar reads none, by the model's recorded proposal. A room whose type neither reads —
// the model not yet asked, asked and answered "none of these", or refused — is NOT in its plan's group:
// it is listed by the panel with the reason, and a person types it on its own. Measure less,
// completely, and say so.
//
// Nothing is overwritten (L-ACT-01): the partition's reading stays in `room_outlines` and the model's
// proposal in its ledger row; a confirmation is a row appended beside them naming the act.
import { and, eq, recordModelOutcome, roomConfirmations, roomOutlines, type TenantTx } from "../db";
import type { RoomTypeBasis } from "../rooms/law";
import { violatesConstraint } from "../db/violations";
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { recordedRoomTypes, roomTypeReadingOf, roomTypeRequestHash, type RecordedRoomType } from "../rooms/room-type-question";
import { isRoomType, type RoomType } from "../rooms/room-types";
import { projectDrawingsOf } from "../sheets";
import type { GroupKind } from "./confirm-discipline";
import type { Consequence } from "./consequence";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const CONFIRM_ROOMS = "CONFIRM_ROOMS" as const;

/** L-ACT-02's answer for a key whose membership the current state does not carry (R-SPINE-062). */
const GROUP_NOT_OFFERED: RefusalCode = "GROUP_NOT_OFFERED";

/** The store's own statement that a room is confirmed once — the race this act can lose by name. */
const CONFIRMED_ONCE = "room_confirmations_once";

/** The status a room must stand at to be confirmed: a closed region a label names (s-takeoff I-643). */
const CLOSED = "CLOSED";

/** The kinds this act's groups are keyed on, drawn out of the seam's closed roster (B-17). */
type RoomsGroupKind = Extract<GroupKind, "PROPOSED_ROOMS" | "ROOM">;

/**
 * The fact a rooms group is keyed on: every unconfirmed room of one plan whose type is read, or one
 * named room on its own at the type a person gives it — which may differ from what was read.
 */
export type RoomsGroupKey =
  | { readonly kind: Extract<RoomsGroupKind, "PROPOSED_ROOMS">; readonly drawingId: string; readonly viewKey: string }
  | { readonly kind: Extract<RoomsGroupKind, "ROOM">; readonly drawingId: string; readonly roomKey: string; readonly roomType: RoomType };

/** The act's input: which project, and which group of it is being confirmed. */
export type ConfirmRoomsInput = {
  readonly type: typeof CONFIRM_ROOMS;
  readonly projectId: string;
  readonly group: RoomsGroupKey;
};

/** One stored room, whole. */
type StoredRoom = typeof roomOutlines.$inferSelect;

/** One member: the room, the type it is confirmed at, how that type was read, and the model call behind it. */
export type RoomMember = {
  readonly room: StoredRoom;
  readonly type: RoomType;
  readonly basis: RoomTypeBasis;
  /** The call whose proposal is confirmed (basis MODEL), or null. */
  readonly callId: string | null;
  /** The call a person's type overrules — a proposal they typed otherwise — or null. */
  readonly overruledCallId: string | null;
};

/** L-ACT-02's refusal for a group the machine is not offering, carrying the key that named none. */
export function roomsGroupNotOffered(group: RoomsGroupKey): Error {
  return refusal(GROUP_NOT_OFFERED, `${CONFIRM_ROOMS} was asked for a group the project does not offer now`, {
    actType: CONFIRM_ROOMS,
    groupKind: group.kind,
  });
}

/** What a room's type reads to, before any person has typed it: the type, its basis and its call — or why none. */
export type ReadRoomType =
  | { readonly read: true; readonly type: RoomType; readonly basis: Exclude<RoomTypeBasis, "PERSON">; readonly callId: string | null }
  | { readonly read: false; readonly why: "UNNAMED" | "UNASKED" | "NONE_OF_THESE"; readonly callId: string | null };

/**
 * One room's type as read now: off its labels, or off the model's recorded answer to its question.
 * `answers` is what `recordedRoomTypes` read for the plan; a question with no answer there has not been
 * asked (or its asking was refused), and a room is never typed by a guess.
 */
export function readRoomType(room: StoredRoom, answers: ReadonlyMap<string, RecordedRoomType>): ReadRoomType {
  const reading = roomTypeReadingOf(room);
  if (reading.kind === "UNNAMED") return { read: false, why: "UNNAMED", callId: null };
  if (reading.kind === "LABEL") return { read: true, type: reading.type, basis: "LABEL", callId: null };
  const answer = answers.get(roomTypeRequestHash(reading.ask));
  if (answer === undefined) return { read: false, why: "UNASKED", callId: null };
  if (answer.type === null) return { read: false, why: "NONE_OF_THESE", callId: answer.callId };
  return { read: true, type: answer.type, basis: "MODEL", callId: answer.callId };
}

/** The rooms one record stands under that a person may confirm: closed, named, and not yet confirmed. */
export async function unconfirmedRoomsOf(tx: TenantTx, scope: { readonly tenantId: string; readonly ingestId: string }): Promise<StoredRoom[]> {
  const rooms = await tx
    .select()
    .from(roomOutlines)
    .where(and(eq(roomOutlines.tenantId, scope.tenantId), eq(roomOutlines.ingestId, scope.ingestId), eq(roomOutlines.status, CLOSED)));
  const confirmed = await tx
    .select({ roomKey: roomConfirmations.roomKey })
    .from(roomConfirmations)
    .where(and(eq(roomConfirmations.tenantId, scope.tenantId), eq(roomConfirmations.ingestId, scope.ingestId)));
  const done = new Set(confirmed.map((row) => row.roomKey));
  return rooms.filter((room) => room.name !== null && !done.has(room.roomKey)).sort((a, b) => (a.roomKey < b.roomKey ? -1 : a.roomKey > b.roomKey ? 1 : 0));
}

/** The model's answers already given for these rooms' questions (L-AI-01: read off the ledger, never re-asked). */
export async function answersFor(tx: TenantTx, scope: { readonly tenantId: string; readonly projectId: string }, rooms: readonly StoredRoom[]): Promise<ReadonlyMap<string, RecordedRoomType>> {
  const asks = rooms.flatMap((room) => {
    const reading = roomTypeReadingOf(room);
    return reading.kind === "ASK" ? [reading.ask] : [];
  });
  return recordedRoomTypes(tx, scope, asks);
}

/**
 * The rooms a key names, resolved server-side from the state this transaction read — the whole of
 * what L-ACT-02 means by "resolved membership in the Consequence".
 */
export async function membersOf(ctx: ActorCtx, input: ConfirmRoomsInput, tx: TenantTx): Promise<RoomMember[]> {
  const group = input.group;
  const drawings = await projectDrawingsOf(tx, { tenantId: ctx.tenantId, projectId: input.projectId });
  const drawing = drawings.find((candidate) => candidate.drawingId === group.drawingId);
  if (drawing?.record === undefined || drawing.record === null) return [];
  const rooms = await unconfirmedRoomsOf(tx, { tenantId: ctx.tenantId, ingestId: drawing.record.ingestId });
  const scope = { tenantId: ctx.tenantId, projectId: input.projectId };

  if (group.kind === "ROOM") {
    // A type the closed roster does not hold names a group nothing could belong to.
    if (!isRoomType(group.roomType)) return [];
    const room = rooms.find((candidate) => candidate.roomKey === group.roomKey);
    if (room === undefined) return [];
    const read = readRoomType(room, await answersFor(tx, scope, [room]));
    if (read.read && read.type === group.roomType) return [{ room, type: read.type, basis: read.basis, callId: read.callId, overruledCallId: null }];
    return [{ room, type: group.roomType, basis: "PERSON", callId: null, overruledCallId: read.callId }];
  }

  const onPlan = rooms.filter((room) => room.viewKey === group.viewKey);
  const answers = await answersFor(tx, scope, onPlan);
  return onPlan.flatMap((room) => {
    const read = readRoomType(room, answers);
    return read.read ? [{ room, type: read.type, basis: read.basis, callId: read.callId, overruledCallId: null }] : [];
  });
}

export const confirmRooms: ActRendering<ConfirmRoomsInput> = {
  async preview(ctx: ActorCtx, input: ConfirmRoomsInput, tx: TenantTx): Promise<Consequence> {
    const members = await membersOf(ctx, input, tx);
    if (members.length === 0) throw roomsGroupNotOffered(input.group);
    return {
      actType: CONFIRM_ROOMS,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      // N rooms moving from unconfirmed to confirmed at a type is the shipped SUBJECTS arm: a group is
      // how the subjects were chosen, not a different kind of thing to show (L-ACT-02). The name is
      // what a reader recognises a room by; the key is what the act moves; the type, and how it was
      // read, are what is written — so both are in `after`, and the digest binds them.
      rendering: "SUBJECTS",
      subjects: members.map((member) => ({
        subjectId: member.room.roomKey,
        subjectLabel: member.room.name ?? member.room.roomKey,
        before: [],
        after: [member.type, member.basis],
      })),
    };
  },

  async commit(ctx: ActorCtx, input: ConfirmRoomsInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const members = await membersOf(ctx, input, tx);
    if (members.length === 0) throw roomsGroupNotOffered(input.group);

    try {
      await tx.insert(roomConfirmations).values(
        members.map((member) => ({
          tenantId: ctx.tenantId,
          projectId: input.projectId,
          drawingId: member.room.drawingId,
          ingestId: member.room.ingestId,
          roomKey: member.room.roomKey,
          viewKey: member.room.viewKey,
          name: member.room.name ?? member.room.roomKey,
          roomType: member.type,
          basis: member.basis,
          callId: member.callId,
          actId: act.actId,
        })),
      );
    } catch (failure) {
      // Two people confirming one plan at once: the second is refused by the store's own statement
      // that a room is confirmed once, and what happened to them is that the group stopped being
      // offered between their read and their write (L-ACT-02, the CONFIRM_VIEW_TYPE precedent).
      if (violatesConstraint(failure, CONFIRMED_ONCE)) throw roomsGroupNotOffered(input.group);
      throw failure;
    }

    // A proposal confirmed as proposed is the CONFIRMED outcome of the call that made it; one a person
    // typed otherwise is OVERRULED — the labeled outcomes the calibration line reads (L-AI-02). Both
    // land in this transaction with the act row, or neither (L-ACT-01).
    for (const member of members) {
      const judged = member.callId ?? member.overruledCallId;
      if (judged === null) continue;
      await recordModelOutcome(tx, {
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        callId: judged,
        outcome: member.callId !== null ? "CONFIRMED" : "OVERRULED",
        actId: act.actId,
        actorUserId: ctx.userId,
      });
    }
  },
};
