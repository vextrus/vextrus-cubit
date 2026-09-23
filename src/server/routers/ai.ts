// The ai lane's one home (ARCH-02): ai's procedures are added here, never at the
// composition root, so the root never changes hands (ARCH-01).
//
// `ai.ask` is S-Ask's door (R-AI-003, docs/design/s-ask.md §6). Asking needs a place on the project
// and nothing more (I-406): an answer reads nothing the register, the levels, the schedules and the
// sheets do not already show a participant, and asking moves no act — so the door authorises exactly
// as the register's readers do, through the one guard with `participation: true`, and a reader who is
// not on the project is refused `PERMISSION_NOT_HELD` by name. It is a mutation because a question the
// machine routes (ASK-2) writes a ledger row; a grammar-routed answer writes nothing at all.
//
// The door is transport (B-17): the statement is read by one zod schema — a blank question, one over
// 300 characters or a reading outside the rosters is `REQUEST_MALFORMED`, never a 500 — and a reading
// that names subjects is RESOLVED by the engine against what the project holds, never trusted.
import { z } from "zod";
import { ELEMENT_TYPES } from "../../core/catalogue/classes";
import { KINDS } from "../../core/catalogue/kinds";
import { NOTE_KINDS } from "../../core/notes/law";
import { DISCIPLINES } from "../../core/sheets/law";
import { ASK_BREAKDOWNS, ASK_INTENTS, ASK_QUESTION_MAX, askTheDrawings, type AskAnswer, type AskReading } from "../../modules/takeoff/ask";
import { verifyStatedOrigin } from "../../modules/spine/tenancy";
import { signedOut } from "../auth/refusals";
import { parsed } from "../call";
import { publicProcedure, router } from "../trpc";
import { projectReaderFor } from "./spine";

/** A door that needs a session states so once (the spine lane's shape, ARCH-03). */
const signedInProcedure = publicProcedure.use(({ ctx, next }) => {
  if (ctx.session === null) throw signedOut();
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/** A subject named by the project's own label: short text, or none. */
const label = (name: string) => z.string({ error: `ai.ask: "${name}" must be a label or null` }).trim().min(1).max(80).nullable();

/**
 * A reading as it crosses the wire (a clarify's choice, a kept reading, a follow-up's previous): every
 * closed slot judged against its roster here, every label resolved against the project by the engine.
 */
const reading: z.ZodType<AskReading> = z.object({
  intent: z.enum(ASK_INTENTS, { error: "ai.ask: that is not an intent of the roster (§1.2)" }),
  class: z.enum(ELEMENT_TYPES, { error: "ai.ask: that is not a class — the catalogue's roster is closed" }).nullable(),
  kind: z.enum(KINDS, { error: "ai.ask: that is not a kind — the catalogue's roster is closed" }).nullable(),
  mark: label("mark"),
  level: label("level"),
  by: z.enum(ASK_BREAKDOWNS, { error: "ai.ask: a breakdown is by level or by mark" }).nullable(),
  noteKind: z.enum(NOTE_KINDS, { error: "ai.ask: that is not a note kind (R-TO-034)" }).nullable(),
  discipline: z.enum(DISCIPLINES, { error: "ai.ask: that is not a discipline" }).nullable(),
  unitAsked: label("unitAsked"),
});

/** What a caller may state at this door, read once by the one reading this tier has (`@/server/call`). */
const statement = z.object({
  projectId: z.string({ error: 'ai.ask: "projectId" is required and must be a string' }).min(1, { error: 'ai.ask: "projectId" must not be blank' }),
  question: z
    .string({ error: 'ai.ask: "question" is required and must be a string' })
    .trim()
    .min(1, { error: "ai.ask: a question must not be blank" })
    .max(ASK_QUESTION_MAX, { error: `ai.ask: a question is at most ${ASK_QUESTION_MAX} characters` }),
  reading: reading.optional(),
  previous: reading.optional(),
});

export const aiRouter = router({
  /** Ask the drawings one question (R-AI-003, J-043): the facts of the answer, never a sentence (I-398). */
  ask: signedInProcedure.input(parsed(statement)).mutation(async ({ ctx, input }): Promise<AskAnswer> => {
    verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
    const actor = await projectReaderFor(ctx.session.userId, input.projectId);
    return askTheDrawings(
      { tenantId: actor.tenantId, projectId: input.projectId },
      { question: input.question, ...(input.reading === undefined ? {} : { reading: input.reading }), ...(input.previous === undefined ? {} : { previous: input.previous }) },
    );
  }),
});
