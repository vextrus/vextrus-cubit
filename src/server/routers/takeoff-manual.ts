// The takeoff lane's manual measurement doors (S-Measure, docs/design/s-measure.md §2.11): the one
// thing a QS DOES with a hand measurement at S1 — preview what it would record, and record it.
//
// Its own file rather than an append to `./takeoff.ts`, because the lane table in `../root.ts` is the
// registry this tier grows by, and a registry grows by enumeration (AM-11's shape, one tier up).
//
// Thin, as every transport over a seam is: authenticate, resolve the actor through the one guard with
// the permission the act moves (L-ACT-03: MEASURE) and the drawing it names bound to the project
// (R-SPINE-004), read the statement through one schema, and hand it to SEAM-ACT. Everything about
// what a measurement IS, where it may stand and what its digest binds lives in
// `src/core/acts/record-manual-measurement.ts`; a transport-local guard would be a second door to one
// write (B-17).
import { z } from "zod";
import { commit, consequenceDigest, preview, type Consequence, type RecordManualMeasurementInput } from "../../core/acts";
import { BEARS } from "../../core/catalogue/bears";
import { isElementType, type ElementType } from "../../core/catalogue/classes";
import { isKind, type Kind } from "../../core/catalogue/kinds";
import { CUTOUT_ROLES, MANUAL_BOUNDS, MANUAL_GEOMETRIES, READING_BASES, pointCountOf, type Recipe, type StatedGeometry } from "../../core/manual/law";
import { isUnit } from "../../core/units/canon";
import { requestMeasure, type MeasureRefused, type MeasureRequested } from "../../modules/takeoff/measure";
import { verifyStatedOrigin } from "../../modules/spine/tenancy";
import { signedOut } from "../auth/refusals";
import { parsed } from "../call";
import { publicProcedure, router } from "../trpc";
import { projectActorFor } from "./spine";

/** The act these doors render, and the permission L-ACT-03 makes it move. */
const RECORD_MANUAL_MEASUREMENT = "RECORD_MANUAL_MEASUREMENT" as const;
const MEASURE = "MEASURE" as const;

/** A door that needs a session states so once (the spine lane's shape, ARCH-03). */
const signedInProcedure = publicProcedure.use(({ ctx, next }) => {
  if (ctx.session === null) throw signedOut();
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/**
 * What a caller may state at these doors, read once by the one reading this tier has
 * (`@/server/call`). A statement these doors cannot read is refused as the registered
 * REQUEST_MALFORMED — an answer the wire carries at 400 — rather than reaching the error formatter as
 * a plain failure (ARCH-03, B-21). The narrowing happens here and once: what a caller names BECOMES a
 * class, a kind, a unit, a geometry at this door and nowhere earlier.
 */
const text = (name: string) => z.string({ error: `takeoff-manual: "${name}" is required and must be a string` }).min(1, { error: `takeoff-manual: "${name}" must not be blank` });

/** One traced point: the world point the viewer placed it at, and the source keys it was snapped on. */
const point = z.object({
  x: z.number({ error: 'takeoff-manual: a point\'s "x" is a number' }).finite(),
  y: z.number({ error: 'takeoff-manual: a point\'s "y" is a number' }).finite(),
  cites: z.array(z.string(), { error: 'takeoff-manual: a point\'s "cites" is a list of source keys' }).max(MANUAL_BOUNDS.cites),
});

const ring = z.array(point, { error: "takeoff-manual: a ring is a list of points" }).min(1).max(MANUAL_BOUNDS.points);

/**
 * The geometry, by the tool that traced it (R-TO-040's Area, Linear, Count), within the manual law's
 * bounds on a statement: the exact guards' work grows with the product of the rings' sizes, so the
 * points are bounded over every ring together (`MANUAL_BOUNDS`).
 */
const geometry: z.ZodType<StatedGeometry> = z
  .discriminatedUnion(
  "geometry",
  [
    z.object({
      geometry: z.literal("POLYGON"),
      outer: ring,
      cutouts: z.array(z.object({ role: z.enum(CUTOUT_ROLES, { error: "takeoff-manual: a cut-out is an OPENING or a MEMBER" }), ring })).max(MANUAL_BOUNDS.cutouts),
    }),
    z.object({ geometry: z.literal("POLYLINE"), run: ring }),
    z.object({ geometry: z.literal("POINT_SET"), points: ring }),
  ],
  { error: "takeoff-manual: a geometry is a POLYGON, a POLYLINE or a POINT_SET" },
)
  .refine((stated) => pointCountOf(stated) <= MANUAL_BOUNDS.points, { error: `takeoff-manual: a geometry traces at most ${MANUAL_BOUNDS.points} points over all its rings` });

const elementClass = z.custom<ElementType>(isElementType, { error: "takeoff-manual: that is not a class — the catalogue's roster is closed" });
const kind = z.custom<Kind>(isKind, { error: "takeoff-manual: that is not a kind — the catalogue's roster is closed" });

/**
 * The recipe as applied (I-374). A kind the class does not bear is a statement no lawful condition
 * makes — the chest refuses it at authoring — so it is malformed here rather than a question for the
 * act (L-MEA-04).
 */
const recipe: z.ZodType<Recipe> = z
  .object({
    conditionId: z.uuid({ error: 'takeoff-manual: "conditionId" is a condition\'s id or null' }).nullable(),
    conditionName: text("conditionName"),
    geometry: z.enum(MANUAL_GEOMETRIES, { error: "takeoff-manual: a recipe measures a POLYGON, a POLYLINE or a POINT_SET" }),
    elementClass,
    kinds: z.array(z.object({ kind, ruleId: text("ruleId") })).min(1, { error: "takeoff-manual: a recipe measures at least one kind" }),
    readings: z.array(
      z.object({
        attribute: text("attribute"),
        valueAsWritten: z.string({ error: 'takeoff-manual: a reading\'s "valueAsWritten" is a string' }),
        unitAsWritten: z.custom<string>((stated) => typeof stated === "string" && isUnit(stated), { error: "takeoff-manual: that is not a unit of the canon" }),
        basis: z.enum(READING_BASES, { error: "takeoff-manual: a reading is ENTERED or TRANSCRIBED" }),
        sourceKey: z.string().nullable(),
      }),
    ),
  })
  .refine((stated) => stated.kinds.every((entry) => BEARS.some((row) => row.class === stated.elementClass && row.kind === entry.kind)), {
    error: "takeoff-manual: the class does not bear every kind the recipe names (L-MEA-04)",
  });

/** The level stated: a surrogate, a lawful-null slot, or none yet — which the act answers by name (I-377). */
const level = z.union([z.object({ levelId: text("levelId") }), z.object({ slot: text("slot") }), z.null()], {
  error: 'takeoff-manual: "level" is a { levelId }, a { slot } or null',
});

/** The act's input as it arrives on the wire, read into the shape the seam declares. */
const measurementInput: z.ZodType<RecordManualMeasurementInput> = z
  .object({
    projectId: text("projectId"),
    drawingId: text("drawingId"),
    layoutName: text("layoutName"),
    viewKey: text("viewKey"),
    recipe,
    level,
    geometry,
    replaces: z.string({ error: 'takeoff-manual: "replaces" is an object key or null' }).min(1).nullable(),
  })
  .refine((stated) => stated.geometry.geometry === stated.recipe.geometry, { error: "takeoff-manual: the trace is the recipe's own geometry (I-374)" })
  .transform((stated) => ({ type: RECORD_MANUAL_MEASUREMENT, ...stated }));

/** A preview names the act; a commit carries the digest of the preview it confirms (L-ACT-02). */
const previewing = z.object({ input: measurementInput });
const committing = z.object({ input: measurementInput, consequenceDigest: text("consequenceDigest") });

export const takeoffManualRouter = router({
  /**
   * What recording this hand measurement would do (I-373): the register row it adds, the one an edit
   * strikes, and the MEASUREMENT arm's payload — the recipe as applied, the exact figure, the scale —
   * with the digest that binds them. A precondition the measurement cannot stand on is answered by
   * name (s-measure §5).
   */
  preview: signedInProcedure
    .input(parsed(previewing))
    .mutation(async ({ ctx, input }): Promise<{ consequence: Consequence; consequenceDigest: string }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, RECORD_MANUAL_MEASUREMENT, MEASURE, input.input.drawingId);
      const consequence = await preview(actor, input.input);
      return { consequence, consequenceDigest: consequenceDigest(consequence) };
    }),

  /**
   * Record it: the act row, the register row, the measurement and — for an edit — the strike, in one
   * transaction or none (L-ACT-01). Then the campaign's measure run is asked for (s-measure I-384): a
   * hand measurement publishes through the run's rails and the gate, never through a line this door
   * writes (R-TO-040), and the act — core — cannot ask a module for it (ARCH-01). Asking is not an
   * act; a run already queued for the campaign is the same ask (SEAM-JOBS).
   */
  commit: signedInProcedure
    .input(parsed(committing))
    .mutation(async ({ ctx, input }): Promise<{ actId: string; objectKey: string | null; measure: MeasureRequested | MeasureRefused | null }> => {
      verifyStatedOrigin({ statedOrigin: ctx.statedOrigin, requestOrigin: ctx.requestOrigin, configuredOrigin: ctx.origin });
      const actor = await projectActorFor(ctx.session.userId, input.input.projectId, RECORD_MANUAL_MEASUREMENT, MEASURE, input.input.drawingId);
      const written = await commit(actor, input.input, input.consequenceDigest);
      const measurement = written.consequence.measurement;
      const campaignId = measurement?.campaignId;
      const measure = campaignId === undefined ? null : await requestMeasure({ tenantId: actor.tenantId, projectId: input.input.projectId }, campaignId, ctx.session.userId);
      return { actId: written.actId, objectKey: measurement?.objectKey ?? null, measure };
    }),
});
