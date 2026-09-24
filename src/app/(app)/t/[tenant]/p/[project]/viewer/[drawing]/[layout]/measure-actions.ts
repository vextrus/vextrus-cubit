"use server";
// S-Measure's doors for the viewer route (docs/design/s-measure.md §2.6, §2.11): the condition
// chest in the drawer — read it, put a condition in it, take one out.
//
// The shapes are `scale-actions.ts`'s: each answer is the thing asked for or the registered refusal
// that stopped it, carried back to the region that asked rather than thrown (ARCH-03, B-21). Every
// door is opened through the one server-call seam (`@/server/call`), which reads the statement
// against the chest's own schemas and resolves the presented session once; a statement that is not
// the shape a door is asked in is answered REQUEST_MALFORMED.
//
// Nothing is decided here: the three resolutions are the chest's lane's (`takeoff-conditions.ts`),
// which ask the one guard and hand what was stated to `src/core/manual/conditions.ts` (B-17).
import type { RefusalCode } from "@/core/errors";
import { serverCall } from "@/server/call";
import { CHEST_AUTHORING, CHEST_READING, CHEST_RETIRING, authorInChest, readChest, retireFromChest, type ChestAnswer } from "@/server/routers/takeoff-conditions";

/** What the chest's read answered: the chest, or the refusal. */
export type ChestReadAnswer = ({ read: true } & ChestAnswer) | { read: false; refusal: RefusalCode };

/** What authoring answered: the condition's id, or the refusal that named why not. */
export type AuthorAnswer = { authored: true; conditionId: string } | { authored: false; refusal: RefusalCode };

/** What retiring answered. */
export type RetireAnswer = { retired: true } | { retired: false; refusal: RefusalCode };

const reading = serverCall(
  CHEST_READING,
  async (request, session): Promise<ChestReadAnswer> => ({ read: true, ...(await readChest(session.userId, request.projectId)) }),
  (refusal): ChestReadAnswer => ({ read: false, refusal }),
);

const authoring = serverCall(
  CHEST_AUTHORING,
  async (request, session): Promise<AuthorAnswer> => ({ authored: true, ...(await authorInChest(session.userId, request.projectId, request.condition)) }),
  (refusal): AuthorAnswer => ({ authored: false, refusal }),
);

const retiring = serverCall(
  CHEST_RETIRING,
  async (request, session): Promise<RetireAnswer> => retireFromChest(session.userId, request.projectId, request.conditionId),
  (refusal): RetireAnswer => ({ retired: false, refusal }),
);

/** The chest of the project this sheet belongs to (§2.6). */
export async function readConditionChest(request: unknown): Promise<ChestReadAnswer> {
  return reading(request);
}

/** Put a condition in the chest (I-374: data behind MEASURE, not an act). */
export async function authorConditionInChest(request: unknown): Promise<AuthorAnswer> {
  return authoring(request);
}

/** Take a condition out of the chest: retired, never deleted (I-374). */
export async function retireConditionFromChest(request: unknown): Promise<RetireAnswer> {
  return retiring(request);
}
