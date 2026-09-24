// The condition chest's doors (S-Measure, docs/design/s-measure.md §2.6, §2.11; I-374): read a
// project's chest, put a condition in it, take one out of it.
//
// Its own file, because the lane table in `../root.ts` is the registry this tier grows by, and a
// registry grows by enumeration (AM-11's shape, one tier up). The viewer route's server actions
// (`measure-actions.ts`) answer the same three questions for the chest in the drawer, through the
// three resolutions exported here — one resolution per question (B-17).
//
// Thin, as every transport over a seam is: authenticate, resolve the actor through the one guard,
// read the statement through one schema, and hand it to `src/core/manual/conditions.ts`, where what
// a condition may say is judged. Authoring is not an act (I-374), so it names no act type: it is
// project data written behind MEASURE. Reading the chest is a participant's read — every role on the
// project may see what the chest holds; the answer says whether this reader may change it.
import { z } from "zod";
import { isElementType, type ElementType } from "../../core/catalogue/classes";
import { isKind, type Kind } from "../../core/catalogue/kinds";
import { authorCondition, authorableCatalogue, chestOf, retireCondition, CONDITION_NAME_MAX, type AuthorableCatalogue, type ChestCondition, type ConditionStatement } from "../../core/manual/conditions";
import { CONDITION_COLOURS, CONDITION_HATCHES, MANUAL_GEOMETRIES } from "../../core/manual/law";
import { verifyStatedOrigin } from "../../modules/spine/tenancy";
import { authorize } from "../authorize";
import { signedOut } from "../auth/refusals";
import { parsed } from "../call";
import { publicProcedure, router } from "../trpc";
import { projectActorFor, projectReaderFor } from "./spine";

/** The permission L-ACT-03 names for what a QS measures with (I-374: behind MEASURE). */
const MEASURE = "MEASURE" as const;

/** A door that needs a session states so once (the spine lane's shape, ARCH-03). */
const signedInProcedure = publicProcedure.use(({ ctx, next }) => {
  if (ctx.session === null) throw signedOut();
  return next({ ctx: { ...ctx, session: ctx.session } });
});

const text = (name: string) => z.string({ error: `takeoff-conditions: "${name}" is required and must be a string` }).min(1, { error: `takeoff-conditions: "${name}" must not be blank` });

/**
 * A condition as a person states it (§2.6). The narrowing to the closed rosters happens here and
 * once; whether the class bears the kinds, whether a manual method offers them, and which readings
 * they owe is the chest's own judgement (`judgeCondition`), answered by name.
 */
export const CONDITION_STATEMENT: z.ZodType<ConditionStatement> = z.object({
  name: text("name").max(CONDITION_NAME_MAX, { error: `takeoff-conditions: a condition's name is at most ${CONDITION_NAME_MAX} characters` }),
  geometry: z.enum(MANUAL_GEOMETRIES, { error: "takeoff-conditions: a condition measures a POLYGON, a POLYLINE or a POINT_SET" }),
  elementClass: z.custom<ElementType>(isElementType, { error: "takeoff-conditions: that is not a class — the catalogue's roster is closed" }),
  kinds: z.array(z.custom<Kind>(isKind, { error: "takeoff-conditions: that is not a kind — the catalogue's roster is closed" })).min(1, { error: "takeoff-conditions: a condition measures at least one kind" }).max(8),
  readings: z
    .array(z.object({ attribute: text("attribute"), valueAsWritten: z.string().max(32), unitAsWritten: text("unitAsWritten") }))
    .max(8),
  colour: z.enum(CONDITION_COLOURS, { error: "takeoff-conditions: a colour is one of the element palette's eight" }),
  hatch: z.enum(CONDITION_HATCHES, { error: "takeoff-conditions: a hatch is one of the six" }),
});

export const CHEST_READING = z.object({ projectId: text("projectId") });
export const CHEST_AUTHORING = z.object({ projectId: text("projectId"), condition: CONDITION_STATEMENT });
export const CHEST_RETIRING = z.object({ projectId: text("projectId"), conditionId: z.uuid({ error: 'takeoff-conditions: "conditionId" is a condition\'s id' }) });

/** What the chest answers a reader: its conditions, what may be authored into it, and whether this reader may. */
export type ChestAnswer = { readonly conditions: readonly ChestCondition[]; readonly catalogue: AuthorableCatalogue; readonly canAuthor: boolean };

/**
 * Read one project's chest as this person. A participant reads it whatever their role; whether they
 * may change it is the guard's answer to MEASURE, asked and carried — never a second guard (§3's
 * permission-denied cell: the chest is read-only without MEASURE).
 */
export async function readChest(userId: string, projectId: string): Promise<ChestAnswer> {
  const reader = await projectReaderFor(userId, projectId);
  const measuring = await authorize({ userId, projectId, permission: MEASURE });
  const conditions = await chestOf({ tenantId: reader.tenantId, projectId });
  return { conditions, catalogue: authorableCatalogue(), canAuthor: measuring.authorized };
}

/** Put a condition in one project's chest, as this person, behind MEASURE (I-374). */
export async function authorInChest(userId: string, projectId: string, statement: ConditionStatement): Promise<{ conditionId: string }> {
  const actor = await projectActorFor(userId, projectId, null, MEASURE);
  return authorCondition({ tenantId: actor.tenantId, projectId }, actor.userId, statement);
}

/** Take a condition out of one project's chest, as this person, behind MEASURE (I-374: retired, never deleted). */
export async function retireFromChest(userId: string, projectId: string, conditionId: string): Promise<{ retired: true }> {
  const actor = await projectActorFor(userId, projectId, null, MEASURE);
  await retireCondition({ tenantId: actor.tenantId, projectId }, actor.userId, conditionId);
  return { retired: true };
}

export const takeoffConditionsRouter = router({
  /** The chest: its standing conditions in order, each with its hotkey and running totals; the catalogue; whether this reader may author. */
  list: signedInProcedure.input(parsed(CHEST_READING)).query(({ ctx, input }): Promise<ChestAnswer> => readChest(ctx.session.userId, input.projectId)),

  /** Put a condition in the chest. A name taken, a kind not borne or not offered is refused by name. */
  author: signedInProcedure.input(parsed(CHEST_AUTHORING)).mutation(({ ctx, input }): Promise<{ conditionId: string }> => {
    verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
    return authorInChest(ctx.session.userId, input.projectId, input.condition);
  }),

  /** Take a condition out of the chest: retired, and still readable where a measurement cites it. */
  retire: signedInProcedure.input(parsed(CHEST_RETIRING)).mutation(({ ctx, input }): Promise<{ retired: true }> => {
    verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
    return retireFromChest(ctx.session.userId, input.projectId, input.conditionId);
  }),
});
