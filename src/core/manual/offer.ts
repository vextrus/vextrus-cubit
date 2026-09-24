// A hand measurement, offered to the gate (R-TO-040: "offers to the gate under a chosen kind, never
// lines the tool writes"; s-measure I-384, I-389, I-539).
//
// ONE builder, asked from two places: the campaign's measure run, through each kind's rail (its
// manual arm, `src/modules/takeoff/rails/manual.ts`), and the act's own preview, which asks the gate's
// `judgeOffer` of what this builder offers and shows the figure it answers (I-373). The card and the
// bill therefore read one figure: what the preview confirmed is what the run publishes (B-17).
//
// What the builder binds is `MANUAL_RULES`' to say, variable by variable (I-539): the trace supplies
// the ring's area (or the run's length, or the count), the multiplier the count of like items, the
// recipe the readings a person entered or a note states, the edition the threshold in force (DERIVED),
// and the gate the channel sums — the builder enumerates each channel's candidates and adds nothing
// (L-MEA-08). A cut-out traced as an OPENING stands in the opening channel, which the edition's
// threshold partitions; a cut-out traced as a MEMBER, and every register member standing through the
// ring (`./junctions`), stands in the junction channel, deducted whole (I-389, I-538).
//
// A kind `MANUAL_RULES` holds no pairing for is not offered, and no rule is guessed for it (I-539).
// A ring whose standing members cannot all be laid on it is refused `MANUAL_JUNCTION_UNPROVEN` for
// every kind that deducts junctions: its figure could hold members it never took off (I-389).
//
// The reads the builder is handed are this file's too (`manualSetupIn`, `junctionFactsIn`), each on
// a transaction the caller opened, so the run and the preview read the members one way.
import type { ElementType } from "../catalogue/classes";
import type { Kind } from "../catalogue/kinds";
import { and, eq, grids, inArray, ingests, placements, registerObjects, type TenantTx } from "../db";
import { artifactAt } from "../entitygraph/artifact";
import { REFUSALS, type RefusalCode } from "../errors";
import { actSourceOf, editionSourceOf } from "../identity";
import { liveLevelsOf } from "../levels/store";
import type { DeductionCandidate, ManualMeasurementSetup, ManualSetup, Measure, Offer } from "../offers/contract";
import { weakestBasis, type DeductionChannel, type QuantityBasis } from "../offers/law";
import { repudiatedObjectsIn, type RegisterScope } from "../register/store";
import { manualRuleOf, type ManualRule } from "../rulesets/methods/manual/rules";
import { affirmationsOfRecord } from "../scale/store";
import { appStorage } from "../storage/app";
import type { Unit } from "../units/canon";
import { viewAddressOf, viewRecordsOf } from "../views";
import { JUNCTION_MEMBER_CLASSES, junctionsOf, planOf, type FrameAxis, type FrameScale, type JunctionFacts, type PlanFrame, type StandingMember } from "./junctions";
import { figureOf, geometryBasis, normalisedGeometry, ringsOf, type CutoutRole, type HandLevel, type JudgedPoint, type MeasuredGeometry, type Recipe } from "./law";
import { measurementsIn, type StoredMeasurement } from "./store";

/** The engines an offer names (L-QTY-03): a trace over raster content is the raster's reading. */
const VECTOR = "VECTOR" as const;
const RASTER = "RASTER" as const;

/** The unit a count of like items is carried in. */
const PIECES: Unit = "pcs";

/** The channel each cut-out role deducts through (I-389): an opening by the threshold, a member whole. */
const CUTOUT_CHANNEL: Readonly<Record<CutoutRole, DeductionChannel>> = Object.freeze({ OPENING: "opening", MEMBER: "junction" });

/** The edition an offer is built under: its digest (what a DERIVED reading cites) and its parameters. */
export type ManualEdition = { readonly digest: string; readonly parameters: Readonly<Record<string, { readonly value: string; readonly unit: string }>> };

// One hand measurement as the builder reads it, declared into the setup's seam (`ManualMeasurementSetup`,
// which states the register key): what it is, where it stands, and what it traced.
declare module "../offers/contract" {
  interface ManualMeasurementSetup {
    readonly setRevisionId: string;
    /**
     * The act that recorded it, which an ENTERED reading is cited at (`actSourceOf`) — or null in the
     * preview, before the act exists, when the reading cites the measurement's own register row. The
     * source never enters a figure, a formula or the digest the person confirms.
     */
    readonly actId: string | null;
    readonly drawingId: string;
    /** The register's view key the row stands under (I-375). */
    readonly viewKey: string;
    readonly recipe: Recipe;
    readonly traced: MeasuredGeometry;
    readonly figureUnit: Unit;
    readonly calibrationKey: string;
    /** How many like items the one trace stands for: "1", or a typical's ×n (S9). */
    readonly multiplier: string;
    /** The members its ring runs past, as the reader found them; null where its class runs past none. */
    readonly junctions: JunctionFacts | null;
  }
}

/** One hand measurement as the builder reads it. */
export type OfferableMeasurement = ManualMeasurementSetup;

/** What the builder answers for one kind of a recipe. */
export type KindOffering =
  | { readonly kind: Kind; readonly state: "offered"; readonly offer: Offer }
  | { readonly kind: Kind; readonly state: "not-offered" }
  | { readonly kind: Kind; readonly state: "refused"; readonly code: RefusalCode; readonly detail: Readonly<Record<string, unknown>> };

/** The first source key any point of these rings reproduced on — the entity the ring was snapped to. */
function citedIn(rings: readonly (readonly JudgedPoint[])[]): string | null {
  for (const ring of rings) for (const point of ring) if (point.sources[0] !== undefined) return point.sources[0];
  return null;
}

/**
 * The offer(s) one hand measurement makes, one answer per kind of its recipe (I-384). Pure: every read
 * it needs is in what it is handed.
 */
export function manualOffersOf(measurement: OfferableMeasurement, edition: ManualEdition): KindOffering[] {
  return measurement.recipe.kinds.map(({ kind, ruleId }) => {
    const rule = manualRuleOf(measurement.recipe.geometry, measurement.recipe.elementClass, kind);
    // A pairing nothing holds is not offered, and a recipe naming another rule than the pairing's is
    // not the pairing — no rule is guessed for either (I-539).
    if (rule === undefined || rule.ruleId !== ruleId) return { kind, state: "not-offered" as const };
    return offerUnder(measurement, rule, edition);
  });
}

/** The offer one pairing makes of one measurement, or the refusal that stops it. */
function offerUnder(measurement: OfferableMeasurement, rule: ManualRule, edition: ManualEdition): KindOffering {
  const kind = rule.kind;
  const traced = normalisedGeometry(measurement.traced);
  const basis = geometryBasis(traced);
  const figure = figureOf(traced);
  const ownSource = measurement.actId === null ? measurement.objectKey : actSourceOf(measurement.actId);
  const traceSource = citedIn(ringsOf(traced).slice(0, 1)) ?? ownSource;
  const refused = (code: RefusalCode, detail: Record<string, unknown>): KindOffering => ({ kind, state: "refused", code, detail });

  const bindings: Record<string, Measure> = {};
  const channels = new Set<DeductionChannel>();
  for (const [variable, supply] of Object.entries(rule.supply)) {
    switch (supply.from) {
      case "trace":
        bindings[variable] = { value: figure.gross, unit: measurement.figureUnit, basis, source: traceSource, calibration: measurement.calibrationKey };
        break;
      case "multiplier":
        bindings[variable] = { value: measurement.multiplier, unit: PIECES, basis, source: traceSource };
        break;
      case "recipe": {
        const reading = measurement.recipe.readings.find((held) => held.attribute === variable);
        // A recipe that states no reading the rule declares is an offer that cannot carry what its
        // rule asks, never a figure over a number somebody would have to invent (L-MEA-06).
        if (reading === undefined) return refused(REFUSALS.OFFER_NOT_TO_CONTRACT.code, { variable });
        bindings[variable] = {
          value: reading.valueAsWritten,
          unit: reading.unitAsWritten,
          basis: reading.basis,
          source: reading.basis === "TRANSCRIBED" && reading.sourceKey !== null ? reading.sourceKey : ownSource,
        };
        break;
      }
      case "edition": {
        const stated = edition.parameters[supply.parameter];
        // An edition that states no such figure is the gate's to answer by name; nothing is guessed.
        if (stated !== undefined) bindings[variable] = { value: stated.value, unit: stated.unit, basis: "DERIVED", source: editionSourceOf(edition.digest, supply.parameter) };
        break;
      }
      case "gate":
        channels.add(supply.channel);
        break;
    }
  }

  const deductions: DeductionCandidate[] = [];
  if (traced.geometry === "POLYGON" && figure.measure === "AREA") {
    for (const [index, cutout] of traced.cutouts.entries()) {
      const channel = CUTOUT_CHANNEL[cutout.role];
      // A cut-out the rule has no channel for could come off nothing, and the ring would bill it.
      if (!channels.has(channel)) return refused(REFUSALS.OFFER_NOT_TO_CONTRACT.code, { cutout: index + 1, role: cutout.role });
      const area = figure.cutouts[index]?.area ?? "0";
      const ringBasis: QuantityBasis = weakestBasis(cutout.ring.map((point) => point.basis));
      deductions.push({
        channel,
        measure: { value: area, unit: measurement.figureUnit, basis: ringBasis, source: citedIn([cutout.ring]) ?? ownSource, calibration: measurement.calibrationKey },
      });
    }
  }
  if (channels.has("junction") && measurement.junctions !== null) {
    const reading = junctionsOf(traced, measurement.junctions);
    // I-389's fail-closed arm: a member the ring may hold and nobody could lay on it would stand
    // undeducted, and the figure would be over. Refused, by name, with the members named.
    if (reading.unplaced.length > 0) return refused(REFUSALS.MANUAL_JUNCTION_UNPROVEN.code, { members: reading.unplaced });
    for (const candidate of reading.candidates) {
      deductions.push({ channel: "junction", measure: { value: candidate.area, unit: measurement.figureUnit, basis: "DERIVED", source: candidate.source } });
    }
  }

  return {
    kind,
    state: "offered",
    offer: {
      ruleId: rule.ruleId,
      kind,
      class: measurement.recipe.elementClass,
      register: { setRevisionId: measurement.setRevisionId, objectKey: measurement.objectKey },
      drawing: { drawingId: measurement.drawingId, viewKey: measurement.viewKey },
      engine: basis === "INTERPRETED" ? RASTER : VECTOR,
      geometry: { type: measurement.recipe.geometry, basis, calibration: measurement.calibrationKey },
      bindings,
      selectors: {},
      deductions,
      omitted: [],
      coverage: "COMPLETE",
    },
  };
}

/* ------------------------------------------------------------------ the reads */

export type { ManualSetup };

/**
 * The register rows the MACHINE's rails read (I-384): every row but a hand measurement's. A hand row is
 * the person's sighting, measured by the kind's manual arm; a machine rail that read it would report
 * the placement nobody placed for it, as though the drawing had failed it.
 */
export function machineRowsOf<R extends { readonly objectKey: string }>(rows: readonly R[], manual: ManualSetup | undefined): R[] {
  if (manual === undefined || manual.origin.length === 0) return [...rows];
  const hand = new Set(manual.origin);
  return rows.filter((row) => !hand.has(row.objectKey));
}

/** The scale of record one view stands under now, or null where no act affirmed one. */
type Affirmed = FrameScale & { readonly calibrationKey: string };

/**
 * The reads `junctionFactsIn` makes of one ingest record, each once per transaction: its views'
 * addresses, its affirmations, its artifact's closed rings.
 */
type RecordReads = {
  addressed(ingestId: string): Promise<ReadonlyMap<string, string>>;
  affirmed(ingestId: string): Promise<ReadonlyMap<string, Affirmed>>;
  ring(ingestId: string, entityKey: string): Promise<readonly (readonly [number, number])[] | null>;
};

function recordReadsOn(tx: TenantTx, tenantId: string): RecordReads {
  const addresses = new Map<string, Promise<ReadonlyMap<string, string>>>();
  const affirmations = new Map<string, Promise<ReadonlyMap<string, Affirmed>>>();
  const artifacts = new Map<string, Promise<ReadonlyMap<string, readonly (readonly [number, number])[]>>>();
  const once = <T>(held: Map<string, Promise<T>>, key: string, read: () => Promise<T>): Promise<T> => {
    let promise = held.get(key);
    if (promise === undefined) {
      promise = read();
      held.set(key, promise);
    }
    return promise;
  };
  return {
    // Address → the partition's own key: a placement names its view by address, a grid by the key.
    addressed: (ingestId) => once(addresses, ingestId, async () => new Map((await viewRecordsOf(tx, { tenantId, ingestId })).map((view) => [viewAddressOf(view), view.viewKey]))),
    affirmed: (ingestId) => once(affirmations, ingestId, async () => await affirmationsOfRecord(tx, { tenantId, ingestId })),
    async ring(ingestId, entityKey) {
      const rings = await once(artifacts, ingestId, async () => {
        const held = await tx.select({ artifactSha256: ingests.artifactSha256 }).from(ingests).where(and(eq(ingests.tenantId, tenantId), eq(ingests.ingestId, ingestId))).limit(1);
        const sha = held[0]?.artifactSha256;
        const closed = new Map<string, readonly (readonly [number, number])[]>();
        if (sha === undefined) return closed;
        const graph = await artifactAt(tenantId, sha, appStorage(), `ingest ${ingestId}`);
        for (const entity of graph.entities) {
          if (entity.closed === true && entity.points !== undefined && entity.points.length > 0) closed.set(entity.key, entity.points.map((point) => [point[0] ?? 0, point[1] ?? 0] as const));
        }
        return closed;
      });
      return rings.get(entityKey) ?? null;
    },
  };
}

/** The ring whose members are read: its class and level, the view it was traced in, and the scale it was measured at. */
export type JunctionRing = {
  readonly elementClass: ElementType;
  readonly level: HandLevel;
  readonly ingestId: string;
  readonly partitionViewKey: string;
  readonly calibrationKey: string;
};

/**
 * What a slab-class ring at level L runs past (I-389): the standing columns and walls of the storey
 * whose top is L — the level just below L in the live stack — each with the plan it was placed by, in
 * its own view's frame and at its own view's scale, and the grids of every view involved. Null where
 * the ring's class runs past nothing a hand ring deducts. A member no plan could be read for is
 * handed on WITHOUT one, so the builder can refuse by name rather than leave it out.
 */
export async function junctionFactsIn(tx: TenantTx, scope: RegisterScope, ring: JunctionRing, hand: readonly StoredMeasurement[], struck: ReadonlySet<string>, reads: RecordReads = recordReadsOn(tx, scope.tenantId)): Promise<JunctionFacts | null> {
  const classes = JUNCTION_MEMBER_CLASSES[ring.elementClass];
  if (classes === undefined || classes.length === 0) return null;
  const affirmedRing = (await reads.affirmed(ring.ingestId)).get(ring.partitionViewKey);
  // The ring's scale is the one it was measured at; a view re-affirmed since stands under another,
  // and a frame nobody can vouch for lays no member on it (each member then answers unplaced).
  const ringScale: FrameScale | null = affirmedRing !== undefined && affirmedRing.calibrationKey === ring.calibrationKey ? { factorX: affirmedRing.factorX, factorY: affirmedRing.factorY } : null;
  const facts = (members: StandingMember[], axes: FrameAxis[]): JunctionFacts => ({
    ring: { ingestId: ring.ingestId, viewKey: ring.partitionViewKey, scale: ringScale },
    members,
    axes,
  });
  if (!("levelId" in ring.level)) return facts([], []);
  const levelId = ring.level.levelId;
  const stack = [...(await liveLevelsOf(tx, { tenantId: scope.tenantId, projectId: scope.projectId }))].sort((a, b) => a.ordinal - b.ordinal);
  const at = stack.findIndex((level) => level.levelId === levelId);
  const below = at > 0 ? stack[at - 1] : undefined;
  if (below === undefined) return facts([], []);

  const rows = (
    await tx
      .select({ objectKey: registerObjects.objectKey, placementKey: registerObjects.placementKey })
      .from(registerObjects)
      .where(
        and(
          eq(registerObjects.tenantId, scope.tenantId),
          eq(registerObjects.setRevisionId, scope.setRevisionId),
          eq(registerObjects.levelId, below.levelId),
          inArray(registerObjects.elementType, [...classes]),
        ),
      )
  ).filter((row) => !struck.has(row.objectKey));
  const handByKey = new Map(hand.map((row) => [row.objectKey, row]));
  const machineKeys = rows.filter((row) => !handByKey.has(row.objectKey)).map((row) => row.placementKey);
  const placed =
    machineKeys.length === 0
      ? []
      : await tx
          .select({ placementKey: placements.placementKey, ingestId: placements.ingestId, viewKey: placements.viewKey, outlineKey: placements.outlineKey })
          .from(placements)
          .where(and(eq(placements.tenantId, scope.tenantId), eq(placements.projectId, scope.projectId), inArray(placements.placementKey, [...new Set(machineKeys)])));

  const members: StandingMember[] = [];
  for (const row of rows) {
    const handRow = handByKey.get(row.objectKey);
    if (handRow !== undefined) {
      // A column measured by hand is a register object too: its plan is its own traced outline.
      const frame: PlanFrame = { ingestId: handRow.ingestId, viewKey: handRow.partitionViewKey };
      const scale = (await reads.affirmed(handRow.ingestId)).get(handRow.partitionViewKey);
      const outline = handRow.traced.geometry === "POLYGON" ? handRow.traced.outer.map((point) => ({ x: point.x, y: point.y })) : null;
      members.push({ objectKey: row.objectKey, source: row.objectKey, frame, scale: scale !== undefined && scale.calibrationKey === handRow.calibrationKey ? scale : null, plan: outline });
      continue;
    }
    const held = placed.filter((one) => one.placementKey === row.placementKey);
    const one = held.length === 1 ? held[0] : undefined;
    if (one === undefined) {
      members.push({ objectKey: row.objectKey, source: row.placementKey, frame: null, scale: null, plan: null });
      continue;
    }
    const viewKey = (await reads.addressed(one.ingestId)).get(one.viewKey) ?? null;
    const scale = viewKey === null ? undefined : (await reads.affirmed(one.ingestId)).get(viewKey);
    const points = await reads.ring(one.ingestId, one.outlineKey);
    members.push({
      objectKey: row.objectKey,
      source: row.placementKey,
      frame: viewKey === null ? null : { ingestId: one.ingestId, viewKey },
      scale: scale ?? null,
      plan: points === null ? null : planOf(points),
    });
  }

  const ingestIds = [...new Set([ring.ingestId, ...members.flatMap((member) => (member.frame === null ? [] : [member.frame.ingestId]))])];
  const axes = (
    await tx
      .select({ ingestId: grids.ingestId, viewKey: grids.viewKey, family: grids.family, axis: grids.axis, label: grids.label, position: grids.position })
      .from(grids)
      .where(and(eq(grids.tenantId, scope.tenantId), inArray(grids.ingestId, ingestIds)))
  ).map((axis) => ({ ...axis, family: String(axis.family), axis: String(axis.axis) }));
  return facts(members, axes);
}

/** A stored measurement as the builder reads it. */
export function offerableOf(row: StoredMeasurement, setRevisionId: string, junctions: JunctionFacts | null): OfferableMeasurement {
  return {
    objectKey: row.objectKey,
    setRevisionId,
    actId: row.actId,
    drawingId: row.drawingId,
    viewKey: row.viewKey,
    recipe: row.recipe,
    traced: row.traced,
    figureUnit: row.figureUnit,
    calibrationKey: row.calibrationKey,
    multiplier: "1",
    junctions,
  };
}

/**
 * The hand measurements a campaign's run offers (I-384): the manual-origin fact over every row, and
 * the standing ones — a repudiated measurement is nothing (L-ACT-01), and a superseded one stands
 * repudiated by the edit that replaced it (I-379) — each with what its ring runs past.
 */
export async function manualSetupIn(tx: TenantTx, scope: RegisterScope): Promise<ManualSetup> {
  const hand = await measurementsIn(tx, scope);
  if (hand.length === 0) return { origin: [], measurements: [] };
  const struck = new Set((await repudiatedObjectsIn(tx, scope)).map((row) => row.objectKey));
  const reads = recordReadsOn(tx, scope.tenantId);
  const measurements: OfferableMeasurement[] = [];
  for (const row of hand) {
    if (struck.has(row.objectKey)) continue;
    const junctions = await junctionFactsIn(
      tx,
      scope,
      { elementClass: row.elementClass, level: row.levelRef, ingestId: row.ingestId, partitionViewKey: row.partitionViewKey, calibrationKey: row.calibrationKey },
      hand,
      struck,
      reads,
    );
    measurements.push(offerableOf(row, scope.setRevisionId, junctions));
  }
  return { origin: hand.map((row) => row.objectKey), measurements };
}

export type { RecordReads };
