// The takeoff lane's one home (ARCH-02): takeoff's procedures are added here, never at the
// composition root, so the root never changes hands (ARCH-01).
//
// The sheet index's four doors are thin, as every transport over a seam is: authenticate, resolve the
// workspace-scoped actor through the one resolver, and hand the question to the module or to
// SEAM-ACT. Every rule about who may confirm, what a confirmation would do and which digest binds it
// lives in `src/core/acts`; a transport-local guard or digest would be a second answer to a question
// that has one (B-17).
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

/** The bag a caller sent, or an empty one — a body that is not an object supplies no field. */
function bagOf(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

function text(input: unknown, name: string): string {
  const value = bagOf(input)[name];
  if (typeof value !== "string") throw new Error(`takeoff: "${name}" is required and must be a string`);
  return value;
}

/** The discipline a key names, judged against the closed enum before it reaches the seam (L-REG-03). */
function discipline(raw: unknown): Discipline {
  const stated = text(raw, "discipline");
  if (!isDiscipline(stated)) throw new Error(`takeoff: "${stated}" is not a discipline — the roster R-TO-004 names is closed`);
  return stated;
}

/** The typed grouping key as it arrives on the wire, read into the shape the seam declares. */
function groupKey(raw: unknown): OfferedGroupKey {
  const named = bagOf(raw);
  const kind = text(named, "kind");
  if (kind === "PROPOSED_DISCIPLINE") return { kind, drawingId: text(named, "drawingId"), discipline: discipline(named) };
  if (kind === "SHEET") return { kind, sheetId: text(named, "sheetId"), discipline: discipline(named) };
  throw new Error(`takeoff: "${kind}" is not a group kind — L-ACT-02's grouping key is over a closed enum`);
}

/** The act's input as it arrives on the wire, read into the shape the seam declares. */
function confirmInput(raw: unknown): ConfirmDisciplineInput {
  const named = bagOf(raw);
  return { type: CONFIRM_DISCIPLINE, projectId: text(named, "projectId"), group: groupKey(named["group"]) };
}

/** The view group's key as it arrives on the wire, read into the shape the seam declares. */
function viewGroupKey(raw: unknown): ViewGroupKey {
  const named = bagOf(raw);
  const kind = text(named, "kind");
  if (kind !== PROPOSED_VIEW_TYPE) throw new Error(`takeoff: "${kind}" is not a view-group kind — L-ACT-02's grouping key is over a closed enum`);
  // The class itself is not judged here: what a view may be confirmed as is L-CAD-06's law, and the
  // seam resolves membership against what the machine really proposed — a class it proposed for
  // nothing offers no group, which is the one answer either way (B-17).
  return { kind, drawingId: text(named, "drawingId"), viewType: text(named, "viewType") };
}

/** The view act's input as it arrives on the wire, read into the shape the seam declares. */
function confirmViewTypeInput(raw: unknown): ConfirmViewTypeInput {
  const named = bagOf(raw);
  return { type: CONFIRM_VIEW_TYPE, projectId: text(named, "projectId"), group: viewGroupKey(named["group"]) };
}

/** The rank an affirmation states, judged against L-MEA-05's closed precedence before the seam. */
function scaleRank(raw: unknown): ScaleRank {
  const stated = text(raw, "rank");
  if (!isScaleRank(stated)) throw new Error(`takeoff: "${stated}" is not a rank — L-MEA-05's precedence is closed`);
  return stated;
}

/** The keys a Trace holds, as the other direction of X-2 is asked about them. */
function sourceKeys(raw: unknown): string[] {
  const stated = bagOf(raw)["sourceKeys"];
  if (!Array.isArray(stated) || stated.some((key) => typeof key !== "string")) throw new Error(`takeoff: "sourceKeys" is required and must be an array of strings`);
  return stated as string[];
}

/** The views one affirmation names — a scale group is the subject set of one act (L-MEA-05). */
function viewKeys(raw: unknown): string[] {
  const stated = bagOf(raw)["viewKeys"];
  if (!Array.isArray(stated) || stated.some((key) => typeof key !== "string")) throw new Error(`takeoff: "viewKeys" is required and must be an array of strings`);
  return stated as string[];
}

/**
 * The scale act's input as it arrives on the wire, read into the shape the seam declares. The
 * observations are carried across as they were stated: `citeObservation` in `src/core/scale` is what
 * reads each field of one as a person's input crossing a transport and refuses what the law does not
 * admit, and a second reading of them here would be a second answer to that question (B-17).
 */
function affirmScaleInput(raw: unknown): AffirmScaleInput {
  const named = bagOf(raw);
  const observations = named["observations"];
  return {
    type: AFFIRM_SCALE,
    projectId: text(named, "projectId"),
    drawingId: text(named, "drawingId"),
    rank: scaleRank(named),
    viewKeys: viewKeys(named),
    ...(Array.isArray(observations) ? { observations: observations as readonly TwoPointObservation[] } : {}),
  };
}

/** A whole number as it arrives on the wire — a precedence is declared, never inferred (R-TO-051). */
function figure(input: unknown, name: string): number {
  const value = bagOf(input)[name];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`takeoff: "${name}" is required and must be a number`);
  return value;
}

/** One reading of one attribute of one object, read into the shape the seam declares (AC-5). */
function corroborateInput(raw: unknown): CorroborateInput {
  const named = bagOf(raw);
  return {
    type: CORROBORATE,
    projectId: text(named, "projectId"),
    objectKey: text(named, "objectKey"),
    attribute: text(named, "attribute"),
    valueAsWritten: text(named, "valueAsWritten"),
    unitAsWritten: text(named, "unitAsWritten"),
    precedence: figure(named, "precedence"),
    sourceKey: text(named, "sourceKey"),
  };
}

/** One judgement that an object is nothing, read into the shape the seam declares (R-TO-051). */
function repudiateInput(raw: unknown): RepudiateInput {
  const named = bagOf(raw);
  return { type: REPUDIATE, projectId: text(named, "projectId"), objectKey: text(named, "objectKey") };
}

/**
 * The levels one offered stack proposes, carried across as they were offered. What a level may be is
 * L-MEA-07's law and the seam's own guard; a second reading of it here would be a second answer to a
 * question that has one (B-17).
 */
function insertLevelInput(raw: unknown): InsertLevelInput {
  const named = bagOf(raw);
  const levels = named["levels"];
  if (!Array.isArray(levels)) throw new Error(`takeoff: "levels" is required and must be an array`);
  return { type: INSERT_LEVEL, projectId: text(named, "projectId"), levels: levels as InsertLevelInput["levels"] };
}

/** The class a cell names, judged against the catalogue's closed roster before it reaches the seam. */
function elementType(raw: Readonly<Record<string, unknown>>): ElementType {
  const stated = text(raw, "class");
  if (!isElementType(stated)) throw new Error(`takeoff: "${stated}" is not a class — the catalogue's roster is closed`);
  return stated;
}

/** The kind a cell names, judged against the catalogue's closed roster before it reaches the seam. */
function workItemKind(raw: Readonly<Record<string, unknown>>): Kind {
  const stated = text(raw, "kind");
  if (!isKind(stated)) throw new Error(`takeoff: "${stated}" is not a work item — the catalogue's roster is closed`);
  return stated;
}

/**
 * The cell a boundary act stands over, as it arrives on the wire. Both acts name a cell the same way
 * — L-QTY-05's three coordinates, under one campaign — so it is read once and the act type is what
 * differs (B-17).
 */
function boundaryCell(raw: unknown): { projectId: string; campaignId: string; class: ElementType; kind: Kind; levelId: string } {
  const named = bagOf(raw);
  return {
    projectId: text(named, "projectId"),
    campaignId: text(named, "campaignId"),
    class: elementType(named),
    kind: workItemKind(named),
    levelId: text(named, "levelId"),
  };
}

/** The hold's input, in the shape the seam declares. */
const holdOutInput = (raw: unknown): HoldOutOfBillInput => ({ type: HOLD_OUT_OF_BILL, ...boundaryCell(raw) });

/** The scope declaration's input, in the shape the seam declares. */
const declareOutOfScopeInput = (raw: unknown): DeclareNotInProjectScopeInput => ({ type: DECLARE_NOT_IN_PROJECT_SCOPE, ...boundaryCell(raw) });

export const takeoffRouter = router({
  /**
   * S-Takeoff's whole reading, in one answer (R-TO-050). Reading the register needs no permission
   * beyond membership of the workspace, which the resolver settles; what a reader may DO with it is
   * each act's own question, asked at its own door (L-ACT-03).
   */
  register: signedInProcedure
    .input((raw: unknown) => ({ projectId: text(raw, "projectId") }))
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
    .input((raw: unknown) => ({ projectId: text(raw, "projectId"), lineId: text(raw, "lineId") }))
    .query(async ({ ctx, input }): Promise<LineEvidence | null> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return lineEvidence({ tenantId: actor.tenantId, projectId: input.projectId }, input.lineId);
    }),

  /** The Trace's other direction: the published lines of that sheet citing the keys a reader holds. */
  linesCiting: signedInProcedure
    .input((raw: unknown) => ({ projectId: text(raw, "projectId"), drawingId: text(raw, "drawingId"), sourceKeys: sourceKeys(raw) }))
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
    .input((raw: unknown) => ({ projectId: text(raw, "projectId") }))
    .query(async ({ ctx, input }): Promise<CoverageView> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return coverageViewOf({ tenantId: actor.tenantId, projectId: input.projectId });
    }),

  /** One cell of the residue, addressed. An address this residue holds no cell for answers `null`. */
  coverageCell: signedInProcedure
    .input((raw: unknown) => ({ projectId: text(raw, "projectId"), cell: text(raw, "cell") }))
    .query(async ({ ctx, input }): Promise<CoverageCellView | null> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return coverageCellOf({ tenantId: actor.tenantId, projectId: input.projectId }, input.cell);
    }),

  /** The certificate's two boundary statements as they will print (L-QTY-07) — enumerations, no counts. */
  certificatePreview: signedInProcedure
    .input((raw: unknown) => ({ projectId: text(raw, "projectId") }))
    .query(async ({ ctx, input }): Promise<CertificatePreview> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return certificatePreviewOf({ tenantId: actor.tenantId, projectId: input.projectId });
    }),

  previewHoldOutOfBill: signedInProcedure
    .input((raw: unknown) => ({ input: holdOutInput(bagOf(raw)["input"]) }))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, HOLD_OUT_OF_BILL, SET_BILL_BOUNDARY);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  commitHoldOutOfBill: signedInProcedure
    .input((raw: unknown) => ({ input: holdOutInput(bagOf(raw)["input"]), consequenceDigest: text(raw, "consequenceDigest") }))
    .mutation(async ({ ctx, input }): Promise<{ actId: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, HOLD_OUT_OF_BILL, SET_BILL_BOUNDARY);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId };
    }),

  previewDeclareNotInProjectScope: signedInProcedure
    .input((raw: unknown) => ({ input: declareOutOfScopeInput(bagOf(raw)["input"]) }))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, DECLARE_NOT_IN_PROJECT_SCOPE, SET_BILL_BOUNDARY);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  commitDeclareNotInProjectScope: signedInProcedure
    .input((raw: unknown) => ({ input: declareOutOfScopeInput(bagOf(raw)["input"]), consequenceDigest: text(raw, "consequenceDigest") }))
    .mutation(async ({ ctx, input }): Promise<{ actId: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, DECLARE_NOT_IN_PROJECT_SCOPE, SET_BILL_BOUNDARY);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId };
    }),

  previewCorroborate: signedInProcedure
    .input((raw: unknown) => ({ input: corroborateInput(bagOf(raw)["input"]) }))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, CORROBORATE, MEASURE);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  commitCorroborate: signedInProcedure
    .input((raw: unknown) => ({ input: corroborateInput(bagOf(raw)["input"]), consequenceDigest: text(raw, "consequenceDigest") }))
    .mutation(async ({ ctx, input }): Promise<{ actId: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, CORROBORATE, MEASURE);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId };
    }),

  previewRepudiate: signedInProcedure
    .input((raw: unknown) => ({ input: repudiateInput(bagOf(raw)["input"]) }))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, REPUDIATE, MEASURE);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  commitRepudiate: signedInProcedure
    .input((raw: unknown) => ({ input: repudiateInput(bagOf(raw)["input"]), consequenceDigest: text(raw, "consequenceDigest") }))
    .mutation(async ({ ctx, input }): Promise<{ actId: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, REPUDIATE, MEASURE);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId };
    }),

  previewInsertLevel: signedInProcedure
    .input((raw: unknown) => ({ input: insertLevelInput(bagOf(raw)["input"]) }))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, INSERT_LEVEL, MEASURE);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  commitInsertLevel: signedInProcedure
    .input((raw: unknown) => ({ input: insertLevelInput(bagOf(raw)["input"]), consequenceDigest: text(raw, "consequenceDigest") }))
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
    .input((raw: unknown) => ({ projectId: text(raw, "projectId"), campaignId: text(raw, "campaignId") }))
    .mutation(async ({ ctx, input }): Promise<MeasureRequested | MeasureRefused> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return requestMeasure({ tenantId: actor.tenantId, projectId: input.projectId }, input.campaignId, ctx.session.userId);
    }),

  sheetIndex: signedInProcedure
    .input((raw: unknown) => ({ projectId: text(raw, "projectId") }))
    .query(async ({ ctx, input }): Promise<SheetCard[]> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return sheetIndexOf({ tenantId: actor.tenantId, projectId: input.projectId });
    }),

  offeredGroups: signedInProcedure
    .input((raw: unknown) => ({ projectId: text(raw, "projectId") }))
    .query(async ({ ctx, input }): Promise<OfferedGroup[]> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return offeredGroupsOf({ tenantId: actor.tenantId, projectId: input.projectId });
    }),

  views: signedInProcedure
    .input((raw: unknown) => ({ projectId: text(raw, "projectId"), drawingId: text(raw, "drawingId") }))
    .query(async ({ ctx, input }): Promise<ViewRecord[]> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      return viewsOf({ tenantId: actor.tenantId, projectId: input.projectId, drawingId: input.drawingId });
    }),

  scaleProposals: signedInProcedure
    .input((raw: unknown) => ({ projectId: text(raw, "projectId"), drawingId: text(raw, "drawingId") }))
    .query(async ({ ctx, input }): Promise<{ views: ViewScale[]; tolerances: ScaleTolerances }> => {
      const actor = await projectActorFor(ctx.session.userId, input.projectId, null, MEASURE);
      const scope = { tenantId: actor.tenantId, projectId: input.projectId, drawingId: input.drawingId };
      const views = await scaleProposalsOf(scope, { storage: appStorage() });
      return { views, tolerances: await scaleTolerancesOf({ tenantId: actor.tenantId, projectId: input.projectId }) };
    }),

  previewAffirmScale: signedInProcedure
    .input((raw: unknown) => ({ input: affirmScaleInput(bagOf(raw)["input"]) }))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, AFFIRM_SCALE, MEASURE);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  commitAffirmScale: signedInProcedure
    .input((raw: unknown) => ({ input: affirmScaleInput(bagOf(raw)["input"]), consequenceDigest: text(raw, "consequenceDigest") }))
    .mutation(async ({ ctx, input }): Promise<{ actId: string; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, AFFIRM_SCALE, MEASURE);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId, consequenceDigest: written.consequenceDigest };
    }),

  previewConfirmViewType: signedInProcedure
    .input((raw: unknown) => ({ input: confirmViewTypeInput(bagOf(raw)["input"]) }))
    .mutation(async ({ ctx, input }): Promise<Consequence> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, CONFIRM_VIEW_TYPE, MEASURE);
      return preview(actor, input.input);
    }),

  confirmViewType: signedInProcedure
    .input((raw: unknown) => ({ input: confirmViewTypeInput(bagOf(raw)["input"]), consequenceDigest: text(raw, "consequenceDigest") }))
    .mutation(async ({ ctx, input }): Promise<{ actId: string; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, CONFIRM_VIEW_TYPE, MEASURE);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId, consequenceDigest: written.consequenceDigest };
    }),

  previewConfirmDiscipline: signedInProcedure
    .input((raw: unknown) => ({ input: confirmInput(bagOf(raw)["input"]) }))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      // R-SPINE-006 unqualified: "cookie-authenticated mutations verify origin" — by the rule's one
      // home, never a comparison of this transport's own (B-17).
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, CONFIRM_DISCIPLINE, MEASURE);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  confirmDiscipline: signedInProcedure
    .input((raw: unknown) => ({ input: confirmInput(bagOf(raw)["input"]), consequenceDigest: text(raw, "consequenceDigest") }))
    .mutation(async ({ ctx, input }): Promise<{ actId: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, CONFIRM_DISCIPLINE, MEASURE);
      const written = await commit(actor, input.input, input.consequenceDigest);
      return { actId: written.actId };
    }),
});
