// The rooms panel's reading (viewer.md Part 7), as one value the panel renders: every plan of the
// drawing's current record, each with its rooms as read, the ones a person has confirmed, and why a
// room is not in its plan's confirmation where it is not. Types only, so the browser half of the panel
// imports what it renders without the server half that composes it.
import type { RoomsGroupKey } from "@/core/acts";
import type { RoomTypeBasis } from "@/core/rooms/law";
import type { RoomType } from "@/core/rooms/room-types";

/** Why a room's type is not read: its labels name none and the model is still to be asked, or answered none of the roster. */
export type RoomUntypedReason = "UNASKED" | "NONE_OF_THESE";

/** One room as the panel lists it. */
export type RoomsPanelRoom = {
  readonly roomKey: string;
  readonly name: string;
  /** Its floor area as the outline states it, in square metres, as a decimal string — or null. */
  readonly areaM2: string | null;
  /**
   * CONFIRMED: a person confirmed it (the type is theirs). OFFERED: its type is read and it is in its
   * plan's group. WAITING: its type is not read, and a person types it on its own.
   */
  readonly state: "CONFIRMED" | "OFFERED" | "WAITING";
  /** The type confirmed, or read; null where none is. */
  readonly type: RoomType | null;
  /** How that type was read — off its labels, by the model, or by a person. */
  readonly basis: RoomTypeBasis | null;
  /** The model's stated confidence in a type it proposed, 0–1 as a decimal string, or null. */
  readonly confidence: string | null;
  readonly why: RoomUntypedReason | null;
};

/** A region of the plan the rooms stage listed and registered no room for, with its named reason (L-MEA-01). */
export type RoomsPanelRefused = { readonly name: string | null; readonly reason: string };

/** One plan: its caption, its rooms, its offered group and what it leaves out. */
export type RoomsPanelPlan = {
  readonly viewKey: string;
  readonly caption: string;
  readonly rooms: readonly RoomsPanelRoom[];
  /** The plan's group — every room of it whose type is read and nobody has confirmed — or null where none is. */
  readonly group: Extract<RoomsGroupKey, { kind: "PROPOSED_ROOMS" }> | null;
  readonly offered: number;
  readonly confirmed: number;
  readonly untyped: number;
  readonly refused: readonly RoomsPanelRefused[];
};

/**
 * The whole reading. UNREAD: the drawing has no record yet. EMPTY: its partition read no room.
 * READ: its plans, and how many rooms still wait for the model to be asked.
 */
export type RoomsPanelView =
  | { readonly state: "UNREAD" }
  | { readonly state: "EMPTY" }
  | { readonly state: "READ"; readonly plans: readonly RoomsPanelPlan[]; readonly unasked: number };
