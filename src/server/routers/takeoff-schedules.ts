// The takeoff lane's schedules and notes doors (ARCH-02): S-Schedules' whole reading, and
// TRANSCRIBE_SHEET_NOTES' pair. Its own file rather than an append to `./takeoff.ts`, because the
// lane table in `../root.ts` is the registry this tier grows by, and a registry grows by enumeration.
//
// Thin, as every transport over a seam is: authenticate, resolve the workspace-scoped actor through
// the one resolver, and hand the question to the module or to SEAM-ACT. Every rule about who may read
// a note, what a transcription would do and which digest binds it lives in `src/core/acts` and
// `src/core/notes`; a transport-local guard, verdict or digest would be a second answer to a question
// that has one (B-17).
import { z } from "zod";
import { actChangesNothing, commit, consequenceDigest, movesNothing, preview, type Consequence, type TranscribeSheetNotesInput } from "../../core/acts";
import { NOTE_KINDS } from "../../core/notes/law";
import { schedulesViewOf } from "../../modules/takeoff/schedules-ui/server";
import type { SchedulesView } from "../../modules/takeoff/schedules-ui/view";
import { verifyStatedOrigin } from "../../modules/spine/tenancy";
import { signedOut } from "../auth/refusals";
import { parsed } from "../call";
import { publicProcedure, router } from "../trpc";
import { projectActorFor } from "./spine";

/** The act this lane renders, and the permission L-ACT-03 makes it move. */
const TRANSCRIBE_SHEET_NOTES = "TRANSCRIBE_SHEET_NOTES" as const;
const MEASURE = "MEASURE" as const;

/** A door that needs a session states so once (the spine lane's shape, ARCH-03). */
const signedInProcedure = publicProcedure.use(({ ctx, next }) => {
  if (ctx.session === null) throw signedOut();
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/**
 * What a caller may state at these doors, read once by the one reading this tier has
 * (`@/server/call`). A statement this lane cannot read is refused as the registered REQUEST_MALFORMED
 * — an answer the wire carries at 400 and the fault seam never records — instead of reaching the
 * error formatter as a plain failure and being written down as an outage of ours (ARCH-03, B-21).
 */
const text = (name: string) =>
  z.string({ error: `takeoff-schedules: "${name}" is required and must be a string` }).min(1, { error: `takeoff-schedules: "${name}" must not be blank` });

/** The kind a reading names, judged against R-TO-034's closed roster before it reaches the seam. */
const noteKind = z.enum(NOTE_KINDS, { error: "takeoff-schedules: that is not a note kind — the roster R-TO-034 names is closed" });

/**
 * One figure a person kept off one note, as they wrote it. What was written is carried across
 * verbatim: whether it was kept as proposed or edited is the SEAM's judgement, re-made against the
 * sheet's own words, and a flag stated here would make the record a statement about the client
 * (R-TO-034, B-19).
 */
const noteReading = z.object({
  kind: noteKind,
  sourceKey: text("sourceKey"),
  valueAsWritten: text("valueAsWritten"),
  unitAsWritten: text("unitAsWritten"),
});

/** The act's input as it arrives on the wire, read into the shape the seam declares (L-ACT-02). */
const transcribeSheetNotesInput: z.ZodType<TranscribeSheetNotesInput> = z
  .object({
    projectId: text("projectId"),
    drawingId: text("drawingId"),
    layoutName: text("layoutName"),
    // A transcription of nothing is not a transcription: the seam would refuse it by name, and the
    // door that took it would have opened a dialog over an empty Consequence (L-ACT-01).
    readings: z.array(noteReading).min(1, { error: 'takeoff-schedules: "readings" must state at least one reading' }),
  })
  .transform((stated) => ({ type: TRANSCRIBE_SHEET_NOTES, ...stated }));

/** What a door that previews an act is handed, and what the commit beside it is handed as well. */
const previewing = <S extends z.ZodType>(input: S) => z.object({ input });
const committing = <S extends z.ZodType>(input: S) => z.object({ input, consequenceDigest: text("consequenceDigest") });

/** The project a reading is asked about. */
const project = z.object({ projectId: text("projectId") });

export const takeoffSchedulesRouter = router({
  /**
   * S-Schedules' whole reading (R-TO-034): the pinned revision's sheets, their reconstructed
   * schedules, the member types those named, and how each sheet's general notes stand. It is the
   * reading BEHIND the one act of this screen, so it is resolved for an actor who may make that act
   * — what a reader may DO with it is the act doors' own question (L-ACT-03).
   */
  schedules: signedInProcedure
    .input(parsed(project))
    .query(async ({ ctx, input }): Promise<SchedulesView> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return schedulesViewOf({ tenantId: actor.tenantId, projectId: input.projectId });
    }),

  /**
   * TRANSCRIBE_SHEET_NOTES' preview (L-ACT-02). A statement whose readings all repeat what already
   * stands under their own keys moves nothing: the seam's own reading of that (`movesNothing`) is
   * applied here, at the door the person pressed, rather than letting them confirm a dialog whose
   * commit would refuse (L-ACT-01, I-255).
   */
  previewTranscribeSheetNotes: signedInProcedure
    .input(parsed(previewing(transcribeSheetNotesInput)))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, TRANSCRIBE_SHEET_NOTES, MEASURE);
      const consequence = await preview(actor, input.input);
      if (movesNothing(consequence)) throw actChangesNothing(TRANSCRIBE_SHEET_NOTES, consequence.subjects.map((subject) => subject.subjectId));
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  commitTranscribeSheetNotes: signedInProcedure
    .input(parsed(committing(transcribeSheetNotesInput)))
    .mutation(async ({ ctx, input }): Promise<{ actId: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, TRANSCRIBE_SHEET_NOTES, MEASURE);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId };
    }),
});
