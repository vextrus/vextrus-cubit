// The takeoff lane's one home (ARCH-02): takeoff's procedures are added here, never at the
// composition root, so the root never changes hands (ARCH-01).
//
// The sheet index's four doors are thin, as every transport over a seam is: authenticate, resolve the
// workspace-scoped actor through the one resolver, and hand the question to the module or to
// SEAM-ACT. Every rule about who may confirm, what a confirmation would do and which digest binds it
// lives in `src/core/acts`; a transport-local guard or digest would be a second answer to a question
// that has one (B-17).
import { z } from "zod";
import {
  commit,
  consequenceDigest,
  preview,
  type AffirmScaleInput,
  type ConfirmDisciplineInput,
  type ConfirmViewTypeInput,
  type Consequence,
  type CorroborateInput,
  type DeclareNotInProjectScopeInput,
  type HoldOutOfBillInput,
  type InsertLevelInput,
  type OfferedGroupKey,
  type RepudiateInput,
  type ViewGroupKey,
} from "../../core/acts";
import { isElementType, type ElementType } from "../../core/catalogue/classes";
import { isKind, type Kind } from "../../core/catalogue/kinds";
import { isScaleRank, type ScaleRank, type ScaleTolerances, type TwoPointObservation } from "../../core/scale";
import { isDiscipline, type Discipline } from "../../core/sheets";
import { appStorage } from "../../core/storage/app";
import { certificatePreviewOf, coverageCellOf, coverageViewOf } from "../../modules/takeoff/coverage/server";
import type { CertificatePreview, CoverageCellView, CoverageView } from "../../modules/takeoff/coverage/view";
import { requestMeasure, type MeasureRefused, type MeasureRequested } from "../../modules/takeoff/measure";
import { viewsOf, type ViewRecord } from "../../modules/takeoff/partition";
import { registerViewOf } from "../../modules/takeoff/register-ui/server";
import type { RegisterView } from "../../modules/takeoff/register-ui/view";
import { scaleProposalsOf, scaleTolerancesOf, type ViewScale } from "../../modules/takeoff/scale";
import { lineEvidence, linesCiting, type LineEvidence } from "../../modules/takeoff/trace";
import { offeredGroupsOf, sheetIndexOf, type OfferedGroup, type SheetCard } from "../../modules/takeoff/sheets";
import { verifyStatedOrigin } from "../../modules/spine/tenancy";
import { signedOut } from "../auth/refusals";
import { parsed } from "../call";
import { publicProcedure, router } from "../trpc";
import { projectActorFor } from "./spine";

/** The act this lane renders, and the permission L-ACT-03 makes it move. */
const CONFIRM_DISCIPLINE = "CONFIRM_DISCIPLINE" as const;
const CONFIRM_VIEW_TYPE = "CONFIRM_VIEW_TYPE" as const;
const AFFIRM_SCALE = "AFFIRM_SCALE" as const;
const CORROBORATE = "CORROBORATE" as const;
const REPUDIATE = "REPUDIATE" as const;
const INSERT_LEVEL = "INSERT_LEVEL" as const;
const HOLD_OUT_OF_BILL = "HOLD_OUT_OF_BILL" as const;
const DECLARE_NOT_IN_PROJECT_SCOPE = "DECLARE_NOT_IN_PROJECT_SCOPE" as const;
const PROPOSED_VIEW_TYPE = "PROPOSED_VIEW_TYPE" as const;
const MEASURE = "MEASURE" as const;
/** The permission both boundary acts move — the same LEAD-held decision on either axis (L-ACT-03). */
const SET_BILL_BOUNDARY = "SET_BILL_BOUNDARY" as const;

/** A door that needs a session states so once (the spine lane's shape, ARCH-03). */
const signedInProcedure = publicProcedure.use(({ ctx, next }) => {
  if (ctx.session === null) throw signedOut();
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/**
 * What a caller may state at this lane's doors, read once by the one reading this tier has
 * (`@/server/call`). Every door below hands `parsed(...)` its schema, so a statement this lane
 * cannot read is refused as the registered MALFORMED — an answer the wire carries at 400 and the
 * fault seam never records — instead of reaching the error formatter as a plain failure and being
 * written down as an outage of ours (ARCH-03, B-21).
 *
 * Each schema says exactly what the coercers it replaced said, in one language: the field a caller
 * must state, and the closed roster a name has to be a member of before it becomes a class, a kind,
 * a discipline or a rank. The narrowing stays here and happens once — what a reader pointed at
 * BECOMES a member of the catalogue at this door and nowhere earlier (B-17, ARCH-03).
 */
const text = (name: string) => z.string({ error: `takeoff: "${name}" is required and must be a string` });

/** A whole number as it arrives on the wire — a precedence is declared, never inferred (R-TO-051). */
const figure = (name: string) => z.number({ error: `takeoff: "${name}" is required and must be a number` }).finite();

/** A list of keys as it arrives on the wire, every one of them text. */
const keys = (name: string) => z.array(z.string(), { error: `takeoff: "${name}" is required and must be an array of strings` });

/** The discipline a key names, judged against the closed enum before it reaches the seam (L-REG-03). */
const discipline = z.custom<Discipline>((stated) => typeof stated === "string" && isDiscipline(stated), {
  error: "takeoff: that is not a discipline — the roster R-TO-004 names is closed",
});

/** The class a cell names, judged against the catalogue's closed roster before it reaches the seam. */
const elementType = z.custom<ElementType>(isElementType, { error: "takeoff: that is not a class — the catalogue's roster is closed" });

/** The kind a cell names, judged against the catalogue's closed roster before it reaches the seam. */
const workItemKind = z.custom<Kind>(isKind, { error: "takeoff: that is not a work item — the catalogue's roster is closed" });

/** The rank an affirmation states, judged against L-MEA-05's closed precedence before the seam. */
const scaleRank = z.custom<ScaleRank>(isScaleRank, { error: "takeoff: that is not a rank — L-MEA-05's precedence is closed" });

/** The typed grouping key as it arrives on the wire, read into the shape the seam declares. */
const groupKey: z.ZodType<OfferedGroupKey> = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("PROPOSED_DISCIPLINE"), drawingId: text("drawingId"), discipline }),
    z.object({ kind: z.literal("SHEET"), sheetId: text("sheetId"), discipline }),
  ],
  { error: "takeoff: that is not a group kind — L-ACT-02's grouping key is over a closed enum" },
);

/**
 * The view group's key as it arrives on the wire. The class itself is not judged here: what a view
 * may be confirmed as is L-CAD-06's law, and the seam resolves membership against what the machine
 * really proposed — a class it proposed for nothing offers no group, which is the one answer either
 * way (B-17).
 */
const viewGroupKey: z.ZodType<ViewGroupKey> = z.object({
  kind: z.literal(PROPOSED_VIEW_TYPE, { error: "takeoff: that is not a view-group kind — L-ACT-02's grouping key is over a closed enum" }),
  drawingId: text("drawingId"),
  viewType: text("viewType"),
});

/** The act's input as it arrives on the wire, read into the shape the seam declares. */
const confirmInput: z.ZodType<ConfirmDisciplineInput> = z
  .object({ projectId: text("projectId"), group: groupKey })
  .transform((stated) => ({ type: CONFIRM_DISCIPLINE, ...stated }));

/** The view act's input as it arrives on the wire, read into the shape the seam declares. */
const confirmViewTypeInput: z.ZodType<ConfirmViewTypeInput> = z
  .object({ projectId: text("projectId"), group: viewGroupKey })
  .transform((stated) => ({ type: CONFIRM_VIEW_TYPE, ...stated }));

/**
 * The scale act's input as it arrives on the wire, read into the shape the seam declares. The
 * observations are carried across as they were stated: `citeObservation` in `src/core/scale` is what
 * reads each field of one as a person's input crossing a transport and refuses what the law does not
 * admit, and a second reading of them here would be a second answer to that question (B-17).
 */
const affirmScaleInput: z.ZodType<AffirmScaleInput> = z
  .object({
    projectId: text("projectId"),
    drawingId: text("drawingId"),
    rank: scaleRank,
    // The views one affirmation names — a scale group is the subject set of one act (L-MEA-05).
    viewKeys: keys("viewKeys"),
    observations: z.custom<readonly TwoPointObservation[]>(Array.isArray).optional(),
  })
  .transform((stated) => ({ type: AFFIRM_SCALE, ...stated }));

/** One reading of one attribute of one object, read into the shape the seam declares (AC-5). */
const corroborateInput: z.ZodType<CorroborateInput> = z
  .object({
    projectId: text("projectId"),
    objectKey: text("objectKey"),
    attribute: text("attribute"),
    valueAsWritten: text("valueAsWritten"),
    unitAsWritten: text("unitAsWritten"),
    precedence: figure("precedence"),
    sourceKey: text("sourceKey"),
  })
  .transform((stated) => ({ type: CORROBORATE, ...stated }));

/** One judgement that an object is nothing, read into the shape the seam declares (R-TO-051). */
const repudiateInput: z.ZodType<RepudiateInput> = z
  .object({ projectId: text("projectId"), objectKey: text("objectKey") })
  .transform((stated) => ({ type: REPUDIATE, ...stated }));

/**
 * The levels one offered stack proposes, carried across as they were offered. What a level may be is
 * L-MEA-07's law and the seam's own guard; a second reading of it here would be a second answer to a
 * question that has one (B-17).
 */
const insertLevelInput: z.ZodType<InsertLevelInput> = z
  .object({
    projectId: text("projectId"),
    levels: z.custom<InsertLevelInput["levels"]>(Array.isArray, { error: 'takeoff: "levels" is required and must be an array' }),
  })
  .transform((stated) => ({ type: INSERT_LEVEL, ...stated }));

/**
 * The cell a boundary act stands over, as it arrives on the wire. Both acts name a cell the same way
 * — L-QTY-05's three coordinates, under one campaign — so it is read once and the act type is what
 * differs (B-17).
 */
const boundaryCell = z.object({
  projectId: text("projectId"),
  campaignId: text("campaignId"),
  class: elementType,
  kind: workItemKind,
  levelId: text("levelId"),
});

/** The hold's input, in the shape the seam declares. */
const holdOutInput: z.ZodType<HoldOutOfBillInput> = boundaryCell.transform((cell) => ({ type: HOLD_OUT_OF_BILL, ...cell }));

/** The scope declaration's input, in the shape the seam declares. */
const declareOutOfScopeInput: z.ZodType<DeclareNotInProjectScopeInput> = boundaryCell.transform((cell) => ({ type: DECLARE_NOT_IN_PROJECT_SCOPE, ...cell }));

/** What a door that previews an act is handed, and what the commit beside it is handed as well. */
const previewing = <S extends z.ZodType>(input: S) => z.object({ input });
const committing = <S extends z.ZodType>(input: S) => z.object({ input, consequenceDigest: text("consequenceDigest") });

/** The project a reading is asked about, and the addresses some readings name inside it. */
const project = z.object({ projectId: text("projectId") });
const line = z.object({ projectId: text("projectId"), lineId: text("lineId") });
const citing = z.object({ projectId: text("projectId"), drawingId: text("drawingId"), sourceKeys: keys("sourceKeys") });
const cellAt = z.object({ projectId: text("projectId"), cell: text("cell") });
const campaign = z.object({ projectId: text("projectId"), campaignId: text("campaignId") });
const sheet = z.object({ projectId: text("projectId"), drawingId: text("drawingId") });

export const takeoffRouter = router({
  /**
   * S-Takeoff's whole reading, in one answer (R-TO-050). Reading the register needs no permission
   * beyond membership of the workspace, which the resolver settles; what a reader may DO with it is
   * each act's own question, asked at its own door (L-ACT-03).
   */
  register: signedInProcedure
    .input(parsed(project))
    .query(async ({ ctx, input }): Promise<RegisterView> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return registerViewOf({ tenantId: actor.tenantId, projectId: input.projectId });
    }),

  /**
   * The Trace, from a published quantity to the entities it was read at (R-UI-022, X-2). Reading it
   * needs what reading the register needs and nothing more; a lineId this project does not hold is a
   * fact and answers `null` — the module decides that, and this door only carries it (I-88).
   */
  lineEvidence: signedInProcedure
    .input(parsed(line))
    .query(async ({ ctx, input }): Promise<LineEvidence | null> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return lineEvidence({ tenantId: actor.tenantId, projectId: input.projectId }, input.lineId);
    }),

  /** The Trace's other direction: the published lines of that sheet citing the keys a reader holds. */
  linesCiting: signedInProcedure
    .input(parsed(citing))
    .query(async ({ ctx, input }): Promise<LineEvidence[]> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return linesCiting({ tenantId: actor.tenantId, projectId: input.projectId }, { drawingId: input.drawingId, sourceKeys: input.sourceKeys });
    }),

  /**
   * S-Coverage's whole reading (R-TO-052): the residue as a grid, and the two boundary statements
   * computed off exactly those cells. Reading it needs what reading the register needs — membership,
   * which the resolver settles — because a coverage grid states what the project already holds.
   */
  coverage: signedInProcedure
    .input(parsed(project))
    .query(async ({ ctx, input }): Promise<CoverageView> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return coverageViewOf({ tenantId: actor.tenantId, projectId: input.projectId });
    }),

  /** One cell of the residue, addressed. An address this residue holds no cell for answers `null`. */
  coverageCell: signedInProcedure
    .input(parsed(cellAt))
    .query(async ({ ctx, input }): Promise<CoverageCellView | null> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return coverageCellOf({ tenantId: actor.tenantId, projectId: input.projectId }, input.cell);
    }),

  /** The certificate's two boundary statements as they will print (L-QTY-07) — enumerations, no counts. */
  certificatePreview: signedInProcedure
    .input(parsed(project))
    .query(async ({ ctx, input }): Promise<CertificatePreview> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return certificatePreviewOf({ tenantId: actor.tenantId, projectId: input.projectId });
    }),

  previewHoldOutOfBill: signedInProcedure
    .input(parsed(previewing(holdOutInput)))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, HOLD_OUT_OF_BILL, SET_BILL_BOUNDARY);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  commitHoldOutOfBill: signedInProcedure
    .input(parsed(committing(holdOutInput)))
    .mutation(async ({ ctx, input }): Promise<{ actId: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, HOLD_OUT_OF_BILL, SET_BILL_BOUNDARY);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId };
    }),

  previewDeclareNotInProjectScope: signedInProcedure
    .input(parsed(previewing(declareOutOfScopeInput)))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, DECLARE_NOT_IN_PROJECT_SCOPE, SET_BILL_BOUNDARY);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  commitDeclareNotInProjectScope: signedInProcedure
    .input(parsed(committing(declareOutOfScopeInput)))
    .mutation(async ({ ctx, input }): Promise<{ actId: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, DECLARE_NOT_IN_PROJECT_SCOPE, SET_BILL_BOUNDARY);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId };
    }),

  previewCorroborate: signedInProcedure
    .input(parsed(previewing(corroborateInput)))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, CORROBORATE, MEASURE);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  commitCorroborate: signedInProcedure
    .input(parsed(committing(corroborateInput)))
    .mutation(async ({ ctx, input }): Promise<{ actId: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, CORROBORATE, MEASURE);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId };
    }),

  previewRepudiate: signedInProcedure
    .input(parsed(previewing(repudiateInput)))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, REPUDIATE, MEASURE);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  commitRepudiate: signedInProcedure
    .input(parsed(committing(repudiateInput)))
    .mutation(async ({ ctx, input }): Promise<{ actId: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, REPUDIATE, MEASURE);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId };
    }),

  previewInsertLevel: signedInProcedure
    .input(parsed(previewing(insertLevelInput)))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, INSERT_LEVEL, MEASURE);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  commitInsertLevel: signedInProcedure
    .input(parsed(committing(insertLevelInput)))
    .mutation(async ({ ctx, input }): Promise<{ actId: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, INSERT_LEVEL, MEASURE);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId };
    }),

  /**
   * The Measure door. Enqueueing a job is not an act, so this door writes none and answers inc-209's
   * measure seam verbatim — a project with no campaign is that seam's own registered refusal, carried
   * through rather than re-worded here (SEAM-JOBS, B-17).
   */
  requestMeasure: signedInProcedure
    .input(parsed(campaign))
    .mutation(async ({ ctx, input }): Promise<MeasureRequested | MeasureRefused> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return requestMeasure({ tenantId: actor.tenantId, projectId: input.projectId }, input.campaignId, ctx.session.userId);
    }),

  sheetIndex: signedInProcedure
    .input(parsed(project))
    .query(async ({ ctx, input }): Promise<SheetCard[]> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return sheetIndexOf({ tenantId: actor.tenantId, projectId: input.projectId });
    }),

  offeredGroups: signedInProcedure
    .input(parsed(project))
    .query(async ({ ctx, input }): Promise<OfferedGroup[]> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return offeredGroupsOf({ tenantId: actor.tenantId, projectId: input.projectId });
    }),

  views: signedInProcedure
    .input(parsed(sheet))
    .query(async ({ ctx, input }): Promise<ViewRecord[]> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return viewsOf({ tenantId: actor.tenantId, projectId: input.projectId, drawingId: input.drawingId });
    }),

  scaleProposals: signedInProcedure
    .input(parsed(sheet))
    .query(async ({ ctx, input }): Promise<{ views: ViewScale[]; tolerances: ScaleTolerances }> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      const scope = { tenantId: actor.tenantId, projectId: input.projectId, drawingId: input.drawingId };
      const views = await scaleProposalsOf(scope, { storage: appStorage() });
      return { views, tolerances: await scaleTolerancesOf({ tenantId: actor.tenantId, projectId: input.projectId }) };
    }),

  previewAffirmScale: signedInProcedure
    .input(parsed(previewing(affirmScaleInput)))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, AFFIRM_SCALE, MEASURE);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  commitAffirmScale: signedInProcedure
    .input(parsed(committing(affirmScaleInput)))
    .mutation(async ({ ctx, input }): Promise<{ actId: string; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, AFFIRM_SCALE, MEASURE);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId, consequenceDigest: written.consequenceDigest };
    }),

  previewConfirmViewType: signedInProcedure
    .input(parsed(previewing(confirmViewTypeInput)))
    .mutation(async ({ ctx, input }): Promise<Consequence> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, CONFIRM_VIEW_TYPE, MEASURE);
      return preview(actor, input.input);
    }),

  confirmViewType: signedInProcedure
    .input(parsed(committing(confirmViewTypeInput)))
    .mutation(async ({ ctx, input }): Promise<{ actId: string; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, CONFIRM_VIEW_TYPE, MEASURE);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId, consequenceDigest: written.consequenceDigest };
    }),

  previewConfirmDiscipline: signedInProcedure
    .input(parsed(previewing(confirmInput)))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      // R-SPINE-006 unqualified: "cookie-authenticated mutations verify origin" — by the rule's one
      // home, never a comparison of this transport's own (B-17).
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, CONFIRM_DISCIPLINE, MEASURE);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  confirmDiscipline: signedInProcedure
    .input(parsed(committing(confirmInput)))
    .mutation(async ({ ctx, input }): Promise<{ actId: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, CONFIRM_DISCIPLINE, MEASURE);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId };
    }),
});
