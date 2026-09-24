// The rooms panel's reading and its one ask (viewer.md Part 7, I-687, I-688).
//
// It composes rather than decides. Which rooms a record stands under is the partition's store; which
// of them a person may confirm, and at what type, is CONFIRM_ROOMS' own resolution (`@/core/acts`) —
// read here through the very functions the act resolves its members with, so the count a person sees
// on the offer is the count the act's Consequence names (B-17). What a caption says is the views
// store's.
//
// The ask is the one thing here that writes: a room whose labels the grammar reads no type in is put
// to the model once, through the seam, and the answer lands on the ledger (L-AI-01) — where the next
// reading, and the act, find it. A question the seam refuses (a missing recording, an unresolved
// citation) leaves the room untyped and says so; nothing here guesses a type (L-AI-02).
import { answersFor, readRoomType, unconfirmedRoomsOf } from "@/core/acts";
import { and, eq, forTenant, roomConfirmations, roomOutlines, type TenantTx } from "@/core/db";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { sourceKeyResolver } from "@/core/model";
import { proposeRoomType, roomTypeReadingOf, type RoomTypeAsk } from "@/core/rooms/room-type-question";
import { projectDrawingsOf } from "@/core/sheets";
import { viewAddressOf, viewRecordsOf } from "@/core/views";
import type { RoomsPanelPlan, RoomsPanelRefused, RoomsPanelRoom, RoomsPanelView } from "./view";

/** Which drawing's rooms are being read, in which project and workspace. */
export type RoomsScope = { readonly tenantId: string; readonly projectId: string; readonly drawingId: string };

/** Who is asking, as the model ledger names a caller (L-AI-01). */
export type RoomsCaller = { readonly actor: string; readonly requestId: string };

/** The statuses a region is listed under without being a room a person confirms. */
const LISTED = new Set(["NOT_CLOSED", "DROPPED"]);

type StoredRoom = typeof roomOutlines.$inferSelect;

/** The current record of the drawing, or null where it has none yet. */
async function recordOf(tx: TenantTx, scope: RoomsScope): Promise<{ ingestId: string; artifactSha256: string } | null> {
  const drawings = await projectDrawingsOf(tx, { tenantId: scope.tenantId, projectId: scope.projectId });
  const record = drawings.find((drawing) => drawing.drawingId === scope.drawingId)?.record ?? null;
  return record === null ? null : { ingestId: record.ingestId, artifactSha256: record.artifactSha256 };
}

/**
 * The whole reading of one drawing's rooms (test contract: `roomsPanelOf`). Plans are in the order
 * their captions read, rooms in the order of their names, so two readings answer one list (L-REG-05).
 */
export async function roomsPanelOf(scope: RoomsScope): Promise<RoomsPanelView> {
  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const record = await recordOf(tx, scope);
    if (record === null) return { state: "UNREAD" } as const;
    const recordScope = { tenantId: scope.tenantId, ingestId: record.ingestId };
    const all = await tx.select().from(roomOutlines).where(and(eq(roomOutlines.tenantId, scope.tenantId), eq(roomOutlines.ingestId, record.ingestId)));
    if (all.length === 0) return { state: "EMPTY" } as const;

    const open = await unconfirmedRoomsOf(tx, recordScope);
    const answers = await answersFor(tx, { tenantId: scope.tenantId, projectId: scope.projectId }, open);
    const confirmed = await tx.select().from(roomConfirmations).where(and(eq(roomConfirmations.tenantId, scope.tenantId), eq(roomConfirmations.ingestId, record.ingestId)));
    const views = await viewRecordsOf(tx, recordScope);
    const captions = new Map(views.map((view) => [viewAddressOf(view), view.caption]));

    const byPlan = new Map<string, { rooms: RoomsPanelRoom[]; refused: RoomsPanelRefused[] }>();
    const planOf = (viewKey: string) => {
      const held = byPlan.get(viewKey) ?? { rooms: [], refused: [] };
      byPlan.set(viewKey, held);
      return held;
    };
    for (const row of confirmed) {
      const room = all.find((one) => one.roomKey === row.roomKey);
      planOf(row.viewKey).rooms.push({ roomKey: row.roomKey, name: row.name, areaM2: room?.areaM2 ?? null, state: "CONFIRMED", type: row.roomType, basis: row.basis, confidence: null, why: null });
    }
    let unasked = 0;
    for (const room of open) {
      const read = readRoomType(room, answers);
      const answer = read.read && read.basis === "MODEL" ? [...answers.values()].find((one) => one.callId === read.callId) : undefined;
      if (read.read) {
        planOf(room.viewKey).rooms.push({ roomKey: room.roomKey, name: room.name ?? room.roomKey, areaM2: room.areaM2, state: "OFFERED", type: read.type, basis: read.basis, confidence: answer?.confidence === undefined || answer.confidence === null ? null : String(answer.confidence), why: null });
        continue;
      }
      if (read.why === "UNNAMED") continue;
      if (read.why === "UNASKED") unasked += 1;
      planOf(room.viewKey).rooms.push({ roomKey: room.roomKey, name: room.name ?? room.roomKey, areaM2: room.areaM2, state: "WAITING", type: null, basis: null, confidence: null, why: read.why });
    }
    for (const room of all) {
      if (!LISTED.has(room.status) || room.reason === null) continue;
      planOf(room.viewKey).refused.push({ name: room.name, reason: room.reason });
    }

    const plans: RoomsPanelPlan[] = [...byPlan.entries()].map(([viewKey, held]) => {
      const rooms = [...held.rooms].sort((a, b) => byCodePoint(a.name, b.name) || byCodePoint(a.roomKey, b.roomKey));
      const offered = rooms.filter((room) => room.state === "OFFERED").length;
      return {
        viewKey,
        caption: captions.get(viewKey) ?? viewKey,
        rooms,
        group: offered === 0 ? null : { kind: "PROPOSED_ROOMS", drawingId: scope.drawingId, viewKey },
        offered,
        confirmed: rooms.filter((room) => room.state === "CONFIRMED").length,
        untyped: rooms.filter((room) => room.state === "WAITING").length,
        refused: held.refused,
      };
    });
    plans.sort((a, b) => byCodePoint(a.caption, b.caption) || byCodePoint(a.viewKey, b.viewKey));
    return { state: "READ", plans, unasked } as const;
  });
}

/** An order that is the strings' own, so two readings answer one list whatever the locale (L-REG-05). */
function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** What an ask did: how many rooms were put to the model, and the codes of those the seam refused. */
export type RoomsAsked = { readonly put: number; readonly refused: readonly string[] };

/**
 * Put every unconfirmed room of the drawing whose type neither the grammar nor an earlier answer
 * reads to the model, once each (R-TO-036, I-688). The answer is filed on the ledger by the seam;
 * a refusal is counted by its code and the room stays untyped — the caller says so, never guesses.
 */
export async function askRoomTypes(scope: RoomsScope, caller: RoomsCaller): Promise<RoomsAsked> {
  const pending = await forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const record = await recordOf(tx, scope);
    if (record === null) return null;
    const open = await unconfirmedRoomsOf(tx, { tenantId: scope.tenantId, ingestId: record.ingestId });
    const answers = await answersFor(tx, { tenantId: scope.tenantId, projectId: scope.projectId }, open);
    const asks: { ask: RoomTypeAsk; room: StoredRoom }[] = [];
    for (const room of open) {
      const read = readRoomType(room, answers);
      const reading = roomTypeReadingOf(room);
      if (!read.read && read.why === "UNASKED" && reading.kind === "ASK") asks.push({ ask: reading.ask, room });
    }
    return { record, asks };
  });
  if (pending === null) return { put: 0, refused: [] };
  const refused: string[] = [];
  const ctx = { tenantId: scope.tenantId, projectId: scope.projectId, actor: caller.actor, requestId: caller.requestId };
  for (const { ask, room } of pending.asks) {
    // The answer may cite only the room's own labels: the evidence a type rests on is the words written in it.
    const artifact = sourceKeyResolver(pending.record.artifactSha256, room.labels.map((label) => label.key));
    try {
      await proposeRoomType(ctx, ask, artifact);
    } catch (failure) {
      const code = refusalCodeOf(failure);
      if (code === null) throw failure;
      refused.push(code);
    }
  }
  return { put: pending.asks.length, refused };
}
