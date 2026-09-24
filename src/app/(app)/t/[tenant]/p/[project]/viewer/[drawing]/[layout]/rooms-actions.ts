"use server";
// The rooms panel's doors for the viewer route (viewer.md Part 7): read the panel, ask Jev about the
// rooms the labels cannot type, and CONFIRM_ROOMS' pair. Each is the takeoff lane's own resolution
// over its one schema (`takeoff-rooms.ts`), opened through the one server-call seam, so the router
// and this screen are one door per question; each answers the thing asked for or the registered
// refusal that stopped it, carried back rather than thrown (ARCH-03, B-21).
import { randomUUID } from "node:crypto";
import type { Consequence } from "@/core/acts";
import type { RefusalCode } from "@/core/errors";
import type { RoomsAsked } from "@/modules/takeoff/rooms-ui/server";
import type { RoomsPanelView } from "@/modules/takeoff/rooms-ui/view";
import { serverCall } from "@/server/call";
import { ROOMS_COMMITTING, ROOMS_PREVIEWING, ROOMS_READING, askRoomsModel, commitConfirmRooms, previewConfirmRooms, readRoomsPanel } from "@/server/routers/takeoff-rooms";

export type RoomsReadAnswer = { read: true; view: RoomsPanelView } | { read: false; refusal: RefusalCode };
export type RoomsAskAnswer = ({ asked: true } & RoomsAsked) | { asked: false; refusal: RefusalCode };
export type RoomsPreviewAnswer = { previewed: true; consequence: Consequence; consequenceDigest: string } | { previewed: false; refusal: RefusalCode };
export type RoomsCommitAnswer = { committed: true; actId: string } | { committed: false; refusal: RefusalCode };

const reading = serverCall(
  ROOMS_READING,
  async (request, session): Promise<RoomsReadAnswer> => ({ read: true, view: await readRoomsPanel(session.userId, request) }),
  (refusal): RoomsReadAnswer => ({ read: false, refusal }),
);

const asking = serverCall(
  ROOMS_READING,
  // The ledger names the request a call was made under (L-AI-01); a server action carries no transport
  // request id of its own, so each ask mints one.
  async (request, session): Promise<RoomsAskAnswer> => ({ asked: true, ...(await askRoomsModel(session.userId, randomUUID(), request)) }),
  (refusal): RoomsAskAnswer => ({ asked: false, refusal }),
);

const previewing = serverCall(
  ROOMS_PREVIEWING,
  async (request, session): Promise<RoomsPreviewAnswer> => ({ previewed: true, ...(await previewConfirmRooms(session.userId, request)) }),
  (refusal): RoomsPreviewAnswer => ({ previewed: false, refusal }),
);

const committing = serverCall(
  ROOMS_COMMITTING,
  async (request, session): Promise<RoomsCommitAnswer> => ({ committed: true, ...(await commitConfirmRooms(session.userId, request)) }),
  (refusal): RoomsCommitAnswer => ({ committed: false, refusal }),
);

/** The rooms panel of this drawing. */
export async function readRooms(request: unknown): Promise<RoomsReadAnswer> {
  return reading(request);
}

/** Put the rooms the labels cannot type to Jev, once each (I-688). */
export async function askRooms(request: unknown): Promise<RoomsAskAnswer> {
  return asking(request);
}

/** CONFIRM_ROOMS' preview: the consequence and the digest that binds it. */
export async function previewRooms(request: unknown): Promise<RoomsPreviewAnswer> {
  return previewing(request);
}

/** CONFIRM_ROOMS' commit, carrying the digest the person was shown. */
export async function commitRooms(request: unknown): Promise<RoomsCommitAnswer> {
  return committing(request);
}
