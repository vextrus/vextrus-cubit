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
  type InsertLevelInput,
  type OfferedGroupKey,
  type RepudiateInput,
  type ViewGroupKey,
} from "../../core/acts";
import { isScaleRank, type ScaleRank, type ScaleTolerances, type TwoPointObservation } from "../../core/scale";
import { isDiscipline, type Discipline } from "../../core/sheets";
import { appStorage } from "../../core/storage/app";
import { requestMeasure, type MeasureRefused, type MeasureRequested } from "../../modules/takeoff/measure";
import { viewsOf, type ViewRecord } from "../../modules/takeoff/partition";
import { registerViewOf } from "../../modules/takeoff/register-ui/server";
import type { RegisterView } from "../../modules/takeoff/register-ui/view";
import { scaleProposalsOf, scaleTolerancesOf, type ViewScale } from "../../modules/takeoff/scale";
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
const PROPOSED_VIEW_TYPE = "PROPOSED_VIEW_TYPE" as const;
const MEASURE = "MEASURE" as const;

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
