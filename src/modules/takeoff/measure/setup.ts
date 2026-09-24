// The read-only setup every rail of one campaign is handed (L-MEA-08: "rails share only setup, the
// register and the document stage").
//
// A rail is a pure function that reaches no store, so everything it would have had to ask for is
// read here, once, for the whole roster: the placements of the pinned revision's drawings, the
// member-type variants their schedules registered, the project's live level stack with each level's
// storey height, and the affirmed calibration of every view. Read once and shared, so two rails over
// one campaign cannot disagree about what the drawings said.
//
// Nothing is judged here and nothing is derived: a view no act has affirmed is simply absent from
// the calibrations, and what a rail makes of that absence is the rail's (riskNotes (3)). Nothing is
// converted either — every reading is carried as the drawing wrote it, and the canon is reached at
// the gate (B-17, L-FRM-06). The one relation read here rather than carried is which piles each pile
// cap stands on (`./cap-junctions`, I-547): the revision's stored plans laid over one grid, and
// the cap's own ring asked which pile centres it holds — a relation between stored readings, often of
// two drawings, which no single store states and no rail may reach a store to ask.
import { editionOf } from "@/core/campaigns";
import { drawingSetRevisions, eq, and, forTenant, type TenantTx } from "@/core/db";
import { artifactAt } from "@/core/entitygraph/artifact";
import { manualSetupIn } from "@/core/manual/offer";
import { appStorage } from "@/core/storage/app";
import { levelStackOf } from "@/modules/takeoff/levels";
import { siteFactsOf, type SiteFact } from "@/modules/takeoff/site-facts";
import { appliedDetailingValuesOf, type AppliedDetailingValues } from "@/modules/takeoff/notes";
import type {
  CapJunctionSetup,
  DetailingSetup,
  LevelSetup,
  Measure,
  MemberVariantSetup,
  OutlineSetup,
  PlacementSetup,
  RailSetup,
  ReadingSetup,
  RunSetup,
  SiteFactSetup,
  WallSetup,
} from "@/core/offers/contract";
import { affirmationsOfRecord } from "@/core/scale/store";
import { viewAddressOf, viewRecordsOf } from "@/core/views";
import { ingestRecordOf } from "@/modules/takeoff/ingest";
import {
  gridOf,
  memberTypesOf,
  outlinesOf,
  placementsOf,
  runsOf,
  wallOpeningsOf,
  wallsOf,
  type MemberDimension,
  type MemberVariant,
  type SideReading,
  type StoredOutline,
  type StoredPlacement,
  type ViewsScope,
} from "@/modules/takeoff/partition";
import { capJunctionSetupOf, pilesHeldOverRevision, ringsOf, type DrawingReading, type Point } from "./cap-junctions";
import { wallSetupsOf } from "./walls";
// The notation grammar registers its storey reading with core's band placement at load (`sameStorey`,
// `useStoreyEquivalence`): the rails place a schedule's band ("3RD & 4TH") on the stack ("3F") through
// it, and a measure run that never loaded the grammar would place by letters alone. Loaded here, where
// the rails' setup is made, so the reading stands in every process that measures.
import "@/modules/takeoff/partition/notation";

/** Which campaign's revision a setup is read for, in which project of which workspace. */
export type RailSetupScope = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly setRevisionId: string;
  /**
   * The edition the CAMPAIGN was opened under, never the one the project is pinned to now: a
   * DERIVED reading cites the edition the figure stood on, and a campaign measures under what it
   * snapshotted (L-REG-07, L-MEA-01).
   */
  readonly editionId: string;
};

/**
 * The engine that read these placements. This lane ingests vector CAD and nothing else, so what a
 * placement of it was read by is the vector engine — a raster reading arrives with the vectoriser
 * that produces one, and would carry its own engine and its own INTERPRETED basis (L-QTY-03).
 */
const VECTOR = "VECTOR";

/**
 * What the notes door answered, as the setup carries it: a figure it HAS becomes a reading whose
 * value is the drawing's own and whose basis is TRANSCRIBED — a note is read off a drawing, which
 * is what TRANSCRIBED means (L-QTY-01) — and a figure it has not becomes a null. Nothing is
 * defaulted here: what the edition states is the RAIL's to fall back on and to cite, and a default
 * folded in at this seam would be a number nobody could trace to a clause (L-MEA-06).
 */
function detailingSetupOf(applied: AppliedDetailingValues): DetailingSetup {
  // The FIRST text the door cited, as every other reading of this setup does (`readingSetupOf`):
  // one atom to follow back, with the whole citation carried beside it in `sourceKeys`.
  const source = applied.sourceKeys[0] ?? "";
  const figure = (held: { readonly value: number; readonly unit: string } | undefined): Measure | null =>
    held === undefined ? null : { value: String(held.value), unit: held.unit, basis: "TRANSCRIBED", source };
  return {
    fy: figure(applied.fy),
    fc: figure(applied.fc),
    lapMultiplier: applied.lapMultiplier ?? null,
    hookExtension: applied.hookExtension ?? null,
    suspended: applied.suspended,
    sourceKeys: applied.sourceKeys,
  };
}

/**
 * One stored reading as a rail is handed one, or null where the partition read none — and null, too,
 * where it read one that cites nothing. The source is the FIRST entity the reading was read from: a
 * binding cites one atom of the drawing, and a reader who wants the rest follows it back to the run
 * (L-QTY-03, L-CAD-03).
 */
export function readingSetupOf(reading: SideReading | null): ReadingSetup | null {
  // A reading that cites nothing is no reading a line can stand on: minting it with an empty source
  // key publishes a figure nothing in the drawing answers for, where L-QTY-03 asks every measured
  // attribute for the atom it was read from. The partition's silence is carried across as silence
  // (L-CAD-03), and the rail declares what it could not bind (L-QTY-02).
  const source = reading === null ? undefined : reading.sourceKeys[0];
  if (reading === null || source === undefined || source.length === 0) return null;
  return { value: reading.value, unit: reading.unit, basis: reading.basis, source };
}

/**
 * One stored member-type variant as a rail is handed it — the ONE mapping from the registry's store
 * to the setup, exported so a proof of what a rail binds reads the same mapping `railSetupOf` does
 * (B-17). Nothing is converted: every reading is carried as the schedule wrote it.
 */
export function memberVariantSetupOf(variant: MemberVariant): MemberVariantSetup {
  return {
    variantKey: variant.variantKey,
    bandFrom: variant.bandFrom,
    bandTo: variant.bandTo,
    sectionText: variant.sectionText,
    sectionWidth: variant.sectionWidth,
    sectionDepth: variant.sectionDepth,
    sectionUnit: variant.sectionUnit,
    sourceKeys: variant.sourceKeys,
    // What the family's own schedule states beside its section — a pile's diameter and its length
    // (I-322, AM-06 §2) — each carried as it was written, in the unit it was written in, and cited
    // to the cell it was read at. A dimension no schedule stated is simply absent, and the rail keeps
    // its row and names the reading it did not get (L-QTY-02).
    dimensions: dimensionsSetupOf(variant.dimensions ?? []),
    // The reinforcement zones the schedule stated, carried across as they were read: a zone that
    // states a spacing and no length is handed on WITH that absence, because what a rail makes of it
    // is the rail's (L-QTY-01, L-FRM-05).
    rebar: variant.zones.map((zone) => ({
      zone: zone.zone,
      bars: zone.bars,
      spacing: zone.spacing,
      spacingUnit: zone.spacingUnit,
      spacingBar: zone.spacingBar,
      sourceKeys: zone.sourceKeys,
    })),
  };
}

/**
 * A variant's stored dimensions as a rail binds them, keyed by the name the method declares
 * (I-322). The figure is TRANSCRIBED — read off a schedule cell — and cites the FIRST entity it was
 * read from, as every other reading of this setup does (`readingSetupOf`); one that cites nothing
 * is carried as silence, never as a figure nothing answers for (L-QTY-03).
 */
export function dimensionsSetupOf(dimensions: readonly MemberDimension[]): Record<string, Measure> {
  const held: Record<string, Measure> = {};
  for (const dimension of dimensions) {
    const source = dimension.sourceKeys[0];
    if (source === undefined || source.length === 0) continue;
    held[dimension.dimension] = { value: String(dimension.value), unit: dimension.unit, basis: "TRANSCRIBED", source };
  }
  return held;
}

/**
 * One stored plan as a rail is handed it — the ONE mapping from the placement stage's outline store to
 * the setup, exported so a proof of what a rail measures reads the same mapping `railSetupOf` does
 * (B-17). Every figure is MEASURED — read off the ring by the vector engine — carried in the unit it
 * was read in, and cited to the ring (L-QTY-01, L-QTY-03). The calibration the view stands on is the
 * rail's to attach, as it is for every other reading measured off a view (L-QTY-03).
 */
export function outlineSetupOf(outline: StoredOutline): OutlineSetup {
  const read = (value: string, unit: string): Measure => ({ value, unit, basis: "MEASURED", source: outline.sourceKey });
  return {
    type: outline.geometry,
    area: read(outline.area, outline.areaUnit),
    length: outline.length === null ? null : read(outline.length, outline.unit),
    breadth: outline.breadth === null ? null : read(outline.breadth, outline.unit),
    perimeter: read(outline.perimeter, outline.unit),
  };
}

/**
 * One record's registered families as the rails are handed them, keyed by family — and a family TWO
 * schedules of the record name handed as NO variant at all (Interpretation I-331).
 *
 * The rails key a member type by its family alone, so two schedules stating one family are two answers
 * to one question: folding them in table order kept whichever the reader happened to meet last, which
 * is a disagreement resolved in silence (L-REG-03). It is refused instead — the family binds nothing,
 * and every rail observes MEMBER_TYPE_UNKNOWN on its members, which is under and says so by name
 * (L-QTY-01: never a guess). A bar-bending schedule no longer names a family at all (`registerMember
 * Types`), so neither fixture names one twice; the refusal is the rule for the drawing that does.
 */
export function memberFamiliesSetupOf(families: readonly { readonly family: string; readonly variants: readonly MemberVariant[] }[]): Record<string, readonly MemberVariantSetup[]> {
  const named = new Map<string, number>();
  for (const family of families) named.set(family.family, (named.get(family.family) ?? 0) + 1);
  const held: Record<string, readonly MemberVariantSetup[]> = {};
  for (const family of families) held[family.family] = (named.get(family.family) ?? 0) > 1 ? [] : family.variants.map(memberVariantSetupOf);
  return held;
}

/** One drawing of the revision, as the cap-pile relation is read off it: its record, its scope, what it places, its view addresses. */
type RelationDrawing = {
  readonly record: { readonly ingestId: string; readonly artifactSha256: string };
  readonly scope: ViewsScope;
  readonly placed: readonly StoredPlacement[];
  readonly addressOf: ReadonlyMap<string, string>;
};

/** The two classes the relation is between. */
const PILE_CAP_CLASS = "pile_cap";
const PILE_CLASS = "pile";

/**
 * The piles each pile cap of the pinned revision stands on (L-MEA-09, I-547), by the cap's
 * placement key — read over EVERY drawing of the revision at once, so a cap layout on one file is laid
 * over a pile layout on another. Nothing where the revision places no cap or no pile: then there is no
 * relation to read, and every cap it does place keeps its row and names `CAP_PILES_UNREAD`.
 *
 * The relation is read off what the partition stored — the placements, the grid each plan was
 * georeferenced by — and off the one fact the store does not keep: the ring each cap was placed by,
 * which the placement stage read out of the drawing's own artifact and names by its source key
 * (`outlineKey`, I-333). The ring is read back out of that artifact here, entity by key, and nothing
 * about it is re-derived: which entity is the cap's ring is the placement stage's answer. Only a
 * drawing that places a cap is opened.
 *
 * The grid is keyed by the partition's view key and the placements by L-REG-04's address, so the
 * axes are carried across by the one translation this setup already makes for calibrations
 * (`viewAddressOf`, B-17).
 */
async function capJunctionsOver(tenantId: string, drawings: readonly RelationDrawing[]): Promise<Record<string, CapJunctionSetup>> {
  const places = (elementType: string) => drawings.some((drawing) => drawing.placed.some((one) => one.elementType === elementType));
  if (!places(PILE_CAP_CLASS) || !places(PILE_CLASS)) return {};

  const readings: DrawingReading[] = [];
  for (const drawing of drawings) {
    const members = drawing.placed.filter((one) => one.elementType === PILE_CAP_CLASS || one.elementType === PILE_CLASS);
    if (members.length === 0) continue;
    // A drawing whose partition georeferenced no plan lays nothing over anything, except what it
    // places on one view with its own piles — a view is always its own frame.
    const grid = await gridOf(drawing.scope);
    const rings = members.some((one) => one.elementType === PILE_CAP_CLASS)
      ? ringsOf(await artifactAt(tenantId, drawing.record.artifactSha256, appStorage(), `ingest ${drawing.record.ingestId}`))
      : new Map<string, readonly Point[]>();
    readings.push({
      drawing: drawing.record.ingestId,
      placements: members.map((one) => ({ placementKey: one.placementKey, elementType: one.elementType, viewKey: one.viewKey, x: one.x, y: one.y, outlineKey: one.outlineKey })),
      axes: (grid?.axes ?? []).map((axis) => ({ viewKey: drawing.addressOf.get(axis.viewKey) ?? axis.viewKey, family: axis.family, axis: axis.axis, label: axis.label, position: axis.position })),
      ringOf: (outlineKey) => rings.get(outlineKey) ?? null,
    });
  }
  const capJunctions: Record<string, CapJunctionSetup> = {};
  for (const [cap, piles] of pilesHeldOverRevision(readings)) capJunctions[cap] = capJunctionSetupOf(cap, piles);
  return capJunctions;
}

/** The drawings the pinned revision names, in the order its manifest addresses them (L-REG-06). */
async function drawingsOfRevision(tx: TenantTx, scope: RailSetupScope): Promise<string[]> {
  const rows = await tx
    .select({ manifest: drawingSetRevisions.manifest })
    .from(drawingSetRevisions)
    .where(and(eq(drawingSetRevisions.tenantId, scope.tenantId), eq(drawingSetRevisions.setRevisionId, scope.setRevisionId)))
    .limit(1);
  return (rows[0]?.manifest ?? []).map((member) => member.drawingId);
}

/** One level of the live stack, as a rail reads it: the standing, and the reading it stands at. */
function levelSetupOf(level: Awaited<ReturnType<typeof levelStackOf>>[number]): LevelSetup {
  // Under AGREED the standing names the reading the height stands AT — where two notations print one
  // height, the exact one, not the rounded print beside it (D-001) — so the figure a rail binds and the
  // entity it cites are that reading's. Under SUSPENDED and NONE there is no height at all (L-MEA-07).
  const stands = level.height.standing === "AGREED" ? (level.height.reading ?? undefined) : undefined;
  return {
    levelId: level.levelId,
    label: level.label,
    ordinal: level.ordinal,
    height:
      stands === undefined
        ? { standing: level.height.standing, value: null, unit: null, basis: null, sourceKey: null }
        : {
            standing: level.height.standing,
            value: stands.valueAsWritten,
            unit: stands.unitAsWritten,
            basis: stands.basis,
            sourceKey: stands.sourceKey,
          },
  };
}

/**
 * The setup of one campaign's pinned revision, whole.
 *
 * A drawing the revision names that nothing has ingested, or whose partition has not been rebuilt,
 * contributes nothing rather than failing the read: what a rail could not find is the rail's to
 * report as an observation, and a measurement that threw over one unpartitioned drawing would cost
 * every other drawing of the set its lines (ARCH-03, L-MEA-08).
 */
export async function railSetupOf(scope: RailSetupScope): Promise<RailSetup> {
  const levels = (await levelStackOf({ tenantId: scope.tenantId, projectId: scope.projectId })).map(levelSetupOf);
  const drawingIds = await forTenant({ tenantId: scope.tenantId }).transaction((tx) => drawingsOfRevision(tx, scope));

  // What the site states, read at the ONE door the ledger is read through (ARCH-02), and what the
  // campaign's own edition states. A project whose ledger holds nothing carries no facts at all, and
  // a rail reads that absence as the named deferral it is rather than a default (AM-06 §1).
  const standing = await siteFactsOf({ tenantId: scope.tenantId, projectId: scope.projectId });
  const siteFacts: Partial<Record<SiteFact, SiteFactSetup>> = {};
  for (const [fact, held] of Object.entries(standing)) {
    // The reading AS WRITTEN, the metres the canon made of it, and the act a reader takes recourse
    // to — a rail binds the written value and cites the act, never the ledger's own columns
    // (L-QTY-03, L-QTY-01).
    if (held !== undefined) {
      siteFacts[fact as SiteFact] = { value: held.valueAsWritten, unit: held.unitAsWritten, canonicalMetres: held.canonicalMetres, sourceNote: held.sourceNote, actId: held.actId };
    }
  }
  // What the campaign's drawings say about DETAILING, asked ONCE at the notes law's one door
  // (AM-03(h)): a general note re-versions what a campaign applies, and no other reader of those
  // rows may stand beside this one. What it did not answer is carried as a null, never a default.
  const applied = await appliedDetailingValuesOf({ tenantId: scope.tenantId, projectId: scope.projectId, setRevisionId: scope.setRevisionId });

  const edition = await forTenant({ tenantId: scope.tenantId }).transaction((tx) => editionOf(tx, scope.tenantId, scope.editionId));
  if (edition === null) {
    throw new Error(
      `the campaign's revision ${scope.setRevisionId} cites the rule-set edition ${scope.editionId}, which this workspace does not hold — a campaign measures under the edition it copied (L-REG-07)`,
    );
  }

  const placements: Record<string, PlacementSetup> = {};
  const memberTypes: Record<string, Record<string, readonly MemberVariantSetup[]>> = {};
  const calibrations: Record<string, Record<string, string>> = {};
  const runs: Record<string, RunSetup> = {};
  const walls: Record<string, WallSetup> = {};
  const relation: RelationDrawing[] = [];

  for (const drawingId of drawingIds) {
    const record = await ingestRecordOf({ tenantId: scope.tenantId, drawingId });
    if (record === null) continue;
    const viewsScope = { tenantId: scope.tenantId, projectId: scope.projectId, drawingId };

    // The plan each ring-placed member of this drawing encloses, read off the ring by the placement
    // stage and stored beside it (I-333): a placement with no entry here was placed off edge lines, or
    // read in a unit nobody stated, and carries no outline — a rail then measures by what its schedule
    // states, or declares the plan it did not get (L-QTY-02).
    const outlines = new Map(((await outlinesOf(viewsScope)) ?? []).map((outline) => [outline.placementKey, outline]));
    const placed = (await placementsOf(viewsScope)) ?? [];
    for (const placement of placed) {
      const outline = outlines.get(placement.placementKey);
      placements[placement.placementKey] = {
        drawingId: placement.drawingId,
        ingestId: placement.ingestId,
        viewKey: placement.viewKey,
        memberFamily: placement.memberFamily,
        engine: VECTOR,
        // A count provenances to the entity it was counted off, which is the placement itself
        // (L-QTY-03: "the (drawing, view) read from", and the source entity beside it).
        sourceEntity: placement.placementKey,
        // The plan the drawing DREW: the ring's own geometry, area, perimeter and sides, never a
        // bounding box (I-333, L-FRM-02). What a foundation rail makes of it beside the schedule's
        // stated size is the rail's (`planOf`, I-334).
        outline: outline === undefined ? null : outlineSetupOf(outline),
        // What the plan NOTE said about this member, carried across in the store's own two columns
        // and in the store's own spelling — the shape it named, and the sentence that named it
        // (I-303, I-304). Not `null` and not a seam: the columns are written by the placement stage
        // and read back whole, and a rail that meets a ROUND here measures the circle the plan
        // stated rather than the square a B × D schedule cell is all there was room to write
        // (L-CAD-08, L-REG-03). A placement no note named carries two nulls, which is every
        // placement of a drawing whose notes say nothing about a member.
        noteShape: placement.noteShape,
        noteKey: placement.noteKey,
      };
    }

    // The clear each beam and tie beam of this drawing measures, and the slab adjoining each of its
    // sides (L-MEA-09). A reading is carried across whole — value, unit, basis — with the FIRST entity
    // it was read from as its source, which is what a binding provenances to (L-QTY-03).
    for (const run of (await runsOf(viewsScope)) ?? []) {
      runs[run.placementKey] = { clear: readingSetupOf(run.clear), sides: [readingSetupOf(run.sides[0]), readingSetupOf(run.sides[1])] };
    }

    const registered = await memberTypesOf(viewsScope);
    if (registered !== null) {
      const families: Record<string, readonly MemberVariantSetup[]> = memberTypes[registered.ingestId] ?? {};
      for (const [family, variants] of Object.entries(memberFamiliesSetupOf(registered.families))) families[family] = variants;
      memberTypes[registered.ingestId] = families;
    }

    // A view is held in two key spaces and this is where they are joined. The partition stores a view
    // under its own key and the scale store files an affirmation against that same key, because the
    // affirmation is evidence about a stored view; a placement, a register row and every offer name
    // the view by L-REG-04's address, derived from the same two facts by `viewAddressOf` (B-17). A
    // rail asks for the calibration of the view its placement cites, so the address is the key this
    // setup answers under — the translation belongs to whoever spans the two stores, and that is here.
    const addresses = await forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
      const scoped = { tenantId: scope.tenantId, ingestId: record.ingestId };
      const records = await viewRecordsOf(tx, scoped);
      const held = new Map(records.map((view) => [view.viewKey, viewAddressOf(view)]));
      return { held, records, affirmed: await affirmationsOfRecord(tx, scoped) };
    });
    const views: Record<string, string> = calibrations[record.ingestId] ?? {};
    // A view the partition no longer holds is filed under the only name the affirmation has: dropping
    // it would lose a standing calibration, and a rail that cannot match it reports the absence.
    for (const [viewKey, standing] of addresses.affirmed) views[addresses.held.get(viewKey) ?? viewKey] = standing.calibrationKey;
    calibrations[record.ingestId] = views;

    // The brick walls this drawing's architect's plans place, each with its length, its thickness and
    // the openings its plan's schedule states in it (`./walls`, s-takeoff I-594) — read only for a
    // drawing whose partition placed a wall at all.
    const walled = (await wallsOf(viewsScope)) ?? [];
    if (walled.length > 0) {
      Object.assign(
        walls,
        wallSetupsOf({
          walls: walled,
          openings: (await wallOpeningsOf(viewsScope)) ?? [],
          families: registered?.families ?? [],
          views: addresses.records.map((view) => ({ viewKey: view.viewKey, address: addresses.held.get(view.viewKey) ?? view.viewKey, caption: view.caption })),
        }),
      );
    }

    // What this drawing places and how its views are addressed, for the relation read over the whole
    // revision once every drawing is in (I-547).
    relation.push({ record, scope: viewsScope, placed, addressOf: addresses.held });
  }

  // The piles each pile cap of the revision stands on (L-MEA-09, I-547): what the cap rails net
  // the piles' heads and sections out of. A cap whose piles could not be read has no entry, and keeps
  // its row naming `CAP_PILES_UNREAD` — never its whole prism over heads nobody placed (L-QTY-04).
  const capJunctions = await capJunctionsOver(scope.tenantId, relation);

  // The revision's hand measurements (s-measure I-384): the manual-origin fact the run filters the
  // machine's rows by, and the standing measurements each kind's manual arm offers — read by the one
  // reader the act's preview reads them through, so the card and the run lay one ring on one set of
  // members (I-389).
  const manual = await forTenant({ tenantId: scope.tenantId }).transaction((tx) => manualSetupIn(tx, scope));

  return {
    placements,
    memberTypes,
    levels,
    calibrations,
    // A seam, empty until a general-notes reader lands: no grade is stated, so nothing is selected
    // by, and the selection basis rolls up to DEFAULTED at the gate (L-QTY-01, riskNotes (5)).
    grades: {},
    // The same seam for the plan readings: until the plan reader writes them, no placement carries a
    // plate, a drop, a flight, a landing or a wall run read off a drawing — and the slab, shear-wall
    // and stair rails report PLAN_READING_ABSENT rather than measuring something nobody read
    // (L-MEA-08, L-QTY-04).
    plans: {},
    // The runs the partition read for this campaign's beam and tie-beam placements (L-MEA-09). A
    // placement with no entry here is one the partition read no run for, and the frame rail reports
    // RUN_UNREAD rather than measuring a member on a figure nobody read (L-QTY-01).
    runs,
    // A seam, empty until the opening-schedule reader lands: no opening states a lintel, so the
    // lintel rails offer none and report LINTEL_SOURCE_ABSENT — a lintel is never inferred from the
    // wall it spans (L-QTY-04).
    lintels: {},
    // The brick walls the partition read off the revision's architect's plans, each with the openings
    // its plan's schedule states in it (s-takeoff I-594). A wall with no entry here is one nobody
    // placed off a plan, and the rail reports OPENING_SCHEDULE_ABSENT for it — "a face with no schedule
    // is not measured", because its gross area would over-measure the work (L-MEA-02).
    walls,
    // A seam of the surfaces reader, empty until it lands: no surface carries an opening schedule, so
    // the finish rails offer nothing and report OPENING_SCHEDULE_ABSENT (L-MEA-02, L-MEA-03).
    surfaces: {},
    // The junctions each pile cap shares with the piles it stands on (L-MEA-09, I-544..d).
    capJunctions,
    // What somebody entered about the site, latest entry per fact (L-MEA-06), and the edition every
    // DERIVED reading cites by digest (L-MEA-01). Neither is judged here: a fact nobody entered is
    // simply absent, and what a rail makes of that absence is the rail's.
    siteFacts,
    edition: { digest: edition.digest, parameters: edition.parameters },
    detailing: detailingSetupOf(applied),
    manual,
  };
}
