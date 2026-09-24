// The takeoff lane's rooms doors (viewer.md Part 7, I-687): the rooms panel's reading, the ask
// that puts a room the grammar cannot type to the model, and CONFIRM_ROOMS' pair. Its own file, as
// every lane of `../root.ts` is, so the registry grows by enumeration.
//
// Thin, as every transport over a seam is: authenticate, resolve the actor through the one guard, and
// hand the question to the module or to SEAM-ACT. Who may confirm what, what a group holds and which
// digest binds it are `src/core/acts`' — a guard or a membership here would be a second answer (B-17).
//
// The resolutions are exported beside the schemas they read, so the viewer route's server actions and
// this router are one door per question (`takeoff-manual.ts`'s shape).
import { z } from "zod";
import { commit, consequenceDigest, preview, type Consequence, type ConfirmRoomsInput, type RoomsGroupKey } from "../../core/acts";
import { ROOM_TYPES } from "../../core/rooms/room-types";
import { askRoomTypes, roomsPanelOf, type RoomsAsked } from "../../modules/takeoff/rooms-ui/server";
import type { RoomsPanelView } from "../../modules/takeoff/rooms-ui/view";
import { verifyStatedOrigin } from "../../modules/spine/tenancy";
import { signedOut } from "../auth/refusals";
import { parsed } from "../call";
import { publicProcedure, router } from "../trpc";
import { projectActorFor, projectReaderFor } from "./spine";

/** The act this lane renders, and the permission L-ACT-03 makes it move. */
const CONFIRM_ROOMS = "CONFIRM_ROOMS" as const;
const MEASURE = "MEASURE" as const;

/** The two kinds of group this lane offers, as L-ACT-02's closed enum spells them. */
const PROPOSED_ROOMS = "PROPOSED_ROOMS" as const satisfies RoomsGroupKey["kind"];
const ROOM = "ROOM" as const satisfies RoomsGroupKey["kind"];

/** A door that needs a session states so once (the spine lane's shape, ARCH-03). */
const signedInProcedure = publicProcedure.use(({ ctx, next }) => {
  if (ctx.session === null) throw signedOut();
  return next({ ctx: { ...ctx, session: ctx.session } });
});

const text = (name: string) => z.string({ error: `takeoff-rooms: "${name}" is required and must be a string` }).min(1, { error: `takeoff-rooms: "${name}" must not be blank` });

/**
 * The group, whole, over the closed enum — never a list of rooms. A type is judged against the
 * closed roster before it reaches the seam; what the rooms of a plan ARE is the seam's question.
 */
const group: z.ZodType<RoomsGroupKey> = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal(PROPOSED_ROOMS), drawingId: text("drawingId"), viewKey: text("viewKey") }),
    z.object({ kind: z.literal(ROOM), drawingId: text("drawingId"), roomKey: text("roomKey"), roomType: z.enum(ROOM_TYPES, { error: "takeoff-rooms: that is not a room type — the roster is closed" }) }),
  ],
  { error: "takeoff-rooms: a rooms group is PROPOSED_ROOMS or ROOM (L-ACT-02's grouping key is over a closed enum)" },
);

/** What a confirmation asks for: which project, and which offered group of it. */
export const ROOMS_PREVIEWING = z.object({ projectId: text("projectId"), group });

/** …and what a commit states beside it: the digest of the consequence it was shown over. */
export const ROOMS_COMMITTING = z.object({ projectId: text("projectId"), group, consequenceDigest: text("consequenceDigest") });

/** Which drawing's rooms are read, or asked about. */
export const ROOMS_READING = z.object({ projectId: text("projectId"), drawingId: text("drawingId") });

/** What a preview answers: the consequence and the digest that binds it. */
export type RoomsPreviewed = { consequence: Consequence; consequenceDigest: string };

function actInput(stated: z.output<typeof ROOMS_PREVIEWING>): ConfirmRoomsInput {
  return { type: CONFIRM_ROOMS, projectId: stated.projectId, group: stated.group };
}

/** The rooms panel's reading: a read of what the project holds, so a participant's (knowledge is not permission). */
export async function readRoomsPanel(userId: string, asked: z.output<typeof ROOMS_READING>): Promise<RoomsPanelView> {
  const actor = await projectReaderFor(userId, asked.projectId, asked.drawingId);
  return roomsPanelOf({ tenantId: actor.tenantId, projectId: asked.projectId, drawingId: asked.drawingId });
}

/** Put the rooms the grammar cannot type to the model: a write to the takeoff's ledger, so MEASURE's. */
export async function askRoomsModel(userId: string, requestId: string, asked: z.output<typeof ROOMS_READING>): Promise<RoomsAsked> {
  const actor = await projectActorFor(userId, asked.projectId, null, MEASURE, asked.drawingId);
  return askRoomTypes({ tenantId: actor.tenantId, projectId: asked.projectId, drawingId: asked.drawingId }, { actor: userId, requestId });
}

export async function previewConfirmRooms(userId: string, stated: z.output<typeof ROOMS_PREVIEWING>): Promise<RoomsPreviewed> {
  const actor = await projectActorFor(userId, stated.projectId, CONFIRM_ROOMS, MEASURE, stated.group.drawingId);
  const consequence = await preview(actor, actInput(stated));
  return { consequence, consequenceDigest: consequenceDigest(consequence) };
}

export async function commitConfirmRooms(userId: string, stated: z.output<typeof ROOMS_COMMITTING>): Promise<{ actId: string }> {
  const actor = await projectActorFor(userId, stated.projectId, CONFIRM_ROOMS, MEASURE, stated.group.drawingId);
  const written = await commit(actor, actInput(stated), stated.consequenceDigest);
  return { actId: written.actId };
}

export const takeoffRoomsRouter = router({
  rooms: signedInProcedure.input(parsed(ROOMS_READING)).query(async ({ ctx, input }): Promise<RoomsPanelView> => readRoomsPanel(ctx.session.userId, input)),

  ask: signedInProcedure.input(parsed(ROOMS_READING)).mutation(async ({ ctx, input }): Promise<RoomsAsked> => {
    verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
    return askRoomsModel(ctx.session.userId, ctx.requestId, input);
  }),

  preview: signedInProcedure.input(parsed(ROOMS_PREVIEWING)).mutation(async ({ ctx, input }): Promise<RoomsPreviewed> => {
    verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
    return previewConfirmRooms(ctx.session.userId, input);
  }),

  commit: signedInProcedure.input(parsed(ROOMS_COMMITTING)).mutation(async ({ ctx, input }): Promise<{ actId: string }> => {
    verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
    return commitConfirmRooms(ctx.session.userId, input);
  }),
});
