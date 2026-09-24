// L-CAD-07's placement: the members a layout-plan view places, read off the drawing itself — the
// fifth stage of R-TO-030's stored partition.
//
// A placement is a closed outline anchored by a member mark. Every constant that decides one is a
// CONTENT-SCALED SHARE of the view's own minimum grid spacing (L-MEA-01), read off the project's
// pinned edition and handed in: nothing here spells a distance in drawing units, so a plan drawn at
// another size places the same way.
//
// Three shares decide, in this order:
//   · near-anchor — an outline is placed only where a mark stands within `nearAnchor × spacing` of
//     it; the nearest such mark is the one that names it.
//   · footprint — a candidate whose longest side is outside the band `footprintMin … footprintMax`
//     times the MEDIAN longest side of the view's mark-anchored candidates is not a member of this
//     plan at all (riskNotes (1)): the columns of one plan are alike, and a room outline or a hatch
//     fragment is not.
//   · stated section — a candidate whose longest side is outside the same band times the section its
//     mark's SCHEDULE states (at the scale the drawing's own plans and schedules agree on) is not the
//     member that mark names: the registry says what a member is (R-TO-031), and a stair opening a
//     column mark stands nearest to is not a column. Judged of the anchored candidates as the
//     footprint band is, because the two are separate statements and neither filters the other.
//   · containment/merge — outlines of one mark whose centres stand within `containmentMerge ×
//     spacing` of each other are one member drawn twice, and yield one placement.
//
// Before any of the three, one plan may draw TWO populations — F-RCC6-BNBC's S-06 draws each pile
// cap's outline and, inside it, the circles of the piles it stands on — and the nearest mark names
// every ring about it, so the cap's mark names its piles too and the plan's median is theirs. So a
// mark standing INSIDE closed rings names the innermost of them whose size agrees with the section
// its own schedule states, at the drawing's scale — and that ring alone; a ring holding no mark and
// lying inside a ring a mark so names belongs to no mark (Interpretation I-333). Nowhere else does
// anything move: a mark standing in no ring its schedule agrees with — every column mark of F-RCC6
// stands inside a slab's ring — anchors by nearness exactly as before. The scale the containment is
// gated at is read over ONE candidate per mark (the ring each stands nearest), so a population of
// pile circles cannot answer for the caps they stand under; the median and the scale every section
// is then judged at are read over what survived, where a mark that named its ring stands for that
// ring alone.
//
// Then the plan's NOTES are read over the same texts its marks were read from (I-303: a plan note
// that names a mark is evidence about THAT member). Two phases, in this order: a note whose mark has
// a placed row BINDS to it, and a note whose mark placed nothing MINTS one off the nearest outline no
// mark anchors. The minting runs last and over a population already closed, so the plan's footprint
// median and the drawing's scale are read off the mark-anchored candidates alone: a minted member is
// judged by them and contributes to neither, which is why placing one moves no figure of any member
// that stood before it (L-MEA-01, L-QTY-06).
//
// NO LAYER is consulted by either reading, here or in `./law`: L-CAD-07 reads a drawing by content
// signature and never by layer names, and a note is what a text SAYS rather than where a draughtsman
// filed it. The one thing read off a layer's name is what no draughtsman wrote there — the binding
// infix a CAD program gives a layer another drawing was bound in on (`ARCH-PLAN$0$WALL`), which says
// the entity is that drawing's background and no member of this one (I-342, T-XREF-BOUND).
//
// Only layout-plan-class views are read (L-CAD-06: "only layout-plan-class views may yield
// instances"), and only a view the grid stage georeferenced: a plan with no spacing has nothing to
// scale a share by, so it stands in `ungridded` rather than being placed by numbers nobody read.
//
// Pure over the artifact and the stages before it: no store, no clock, no model. The same evidence
// places the same members forever, which is what makes the stored partition rebuildable (L-REG-04).
import type { ElementType } from "@/core/catalogue/classes";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { placementKey, viewKey as viewKeyOf, type ViewRef } from "@/core/identity";
import type { DetectedGrid, GridAxisRow } from "../grid/detect";
import { DIMENSION, normaliseMark } from "../notation";
import type { PartitionedView } from "../views/assign";
import { yieldsInstances } from "../views/law";
import { classOfFamily, classOfMark, classOfPrefix, isBoundXrefContext, isRingPlacedClass, memberNoteOf, soleNotesAmong, type MemberNote } from "./law";
import { enclosedAreaOf, outlineReadingOf, ringHolds } from "./outline";
import type { DetectedPlacements, DrawnUnit, FamilyNamed, OutlineRow, PlacementEvidence, PlacementNote, PlacementRow, UngriddedView } from "./rows";
import { detectRuns, drawnUnitOf } from "./runs";
import { detectWalls } from "../walls/pairs";
import { shareValue } from "./shares";

/** A point in the drawing's own plane. */
type Point = readonly [number, number];

/** An entity as this detection reads one — the artifact's own shape, narrowed to what it needs. */
type Drawn = EntityGraph["entities"][number];

/** One mark standing on a plan: what it says, where it stands, and the class it names. */
type Mark = { readonly key: string; readonly text: string; readonly mark: string; readonly type: ElementType; readonly at: Point };

/**
 * One closed outline of a plan: where its bounding box centres and how long its longest side is —
 * what the bands judge — and the ring itself with the area it encloses, which is what a mark standing
 * inside it and the plan the member occupies are read off (I-333).
 */
type Outline = { readonly key: string; readonly centre: Point; readonly longest: number; readonly points: readonly Point[]; readonly area: number };

/** An outline the plan's own marks name: the two together, which is what a placement is read from. */
type Anchored = { readonly outline: Outline; readonly mark: Mark };

/** One NOTE standing on a plan: the text it was read from, where it stands, and what it states. */
type Noted = { readonly key: string; readonly text: string; readonly at: Point; readonly note: MemberNote };

/**
 * One plan read whole, before anything is decided about it: the texts and rings standing in it, the
 * marks and outlines they are, and the outlines a mark anchors.
 *
 * ONE traversal, because the two readings partition ONE population: a text this plan carries is a
 * mark or a note or neither, and a reader that walked the assignment map twice could see a different
 * set the second time (`./law`'s `memberNoteOf` names the partition; B-17).
 */
type PlanRead = {
  readonly standing: readonly Drawn[];
  readonly marks: readonly Mark[];
  readonly outlines: readonly Outline[];
  readonly anchored: readonly Anchored[];
};

/** The two families of the backbone, named as the members of the seam's roster they are. */
const LETTER_FAMILY = "letter";
const NUMERAL_FAMILY = "numeral";

/** How few vertices a closed ring may be drawn from and still enclose an area. */
const FEWEST_OUTLINE_VERTICES = 3;

/**
 * The placements of one artifact (L-CAD-07). Every layout-plan view is examined; a georeferenced one
 * yields the members its marks anchor, and one the grid stage deferred yields nothing and says so.
 */
export function detectPlacements(evidence: PlacementEvidence): DetectedPlacements {
  const shares = {
    containmentMerge: shareValue(evidence.shares, "containmentMerge"),
    nearAnchor: shareValue(evidence.shares, "nearAnchor"),
    footprintMin: shareValue(evidence.shares, "footprintMin"),
    footprintMax: shareValue(evidence.shares, "footprintMax"),
  };
  const families = new Set(evidence.families.map((named) => named.family));
  const stated = statedLongestOf(evidence.families);
  const axesByView = axesOf(evidence.grid);

  const placements: PlacementRow[] = [];
  const ungridded: UngriddedView[] = [];
  const plans: { readonly pass: PlanPass; readonly read: PlanRead }[] = [];
  let examined = 0;

  for (const view of evidence.views) {
    if (!yieldsInstances(view.type) || view.anchorKey === null) continue;
    examined += 1;
    const axes = axesByView.get(view.viewKey) ?? [];
    // A plan the grid stage could not georeference states no spacing, and a share of no spacing is
    // no distance: the plan is reported rather than placed by numbers nobody read (L-CAD-07).
    const spacing = axes[0]?.minSpacing ?? 0;
    if (!(spacing > 0)) {
      ungridded.push({ viewKey: view.viewKey });
      continue;
    }
    const ref: ViewRef = { viewClass: view.type, captionAnchorSourceKey: view.anchorKey };
    const pass: PlanPass = { evidence, view, axes, spacing, shares, families, ref };
    plans.push({ pass, read: readPlan(pass) });
  }

  // The scale is the ARTIFACT's, read once over every plan of it: a sheet's plans are drawn to one
  // scale and the drawing states it by drawing its members to the sizes its schedules give them, so
  // a plan whose own candidates are mostly not members still has a scale to be judged at (L-MEA-01).
  //
  // Read TWICE (I-333). First over ONE candidate per mark — the ring each mark stands nearest, which is
  // all a mark says before anything is judged — and that is the scale the containment below is gated
  // at: read over every ring a mark is nearest to instead, S-06's 89 pile circles answer for the cap
  // marks about them and the drawing reads at a quarter of its scale. Then over what the containment
  // left, where a mark that named its ring stands for that ring alone: the scale every stated section
  // is judged at. Where no mark named a ring by containment the survivors ARE the anchored candidates,
  // and both the scale and every plan's median are what they always were.
  const nearest = drawnScaleOf(
    plans.flatMap((plan) => onePerMark(plan.read.anchored)),
    stated,
  );
  const judged = plans.map((plan) => ({ ...plan, judged: containedOf(plan.read, stated, nearest, plan.pass.shares) }));
  const scale = drawnScaleOf(
    judged.flatMap((plan) => plan.judged.survivors),
    stated,
  );
  let noted = 0;
  let minted = 0;
  for (const plan of judged) {
    // The plan's own members first, then what its notes say about them: the note pass is handed the
    // rows this plan placed, because "the mark placed nothing here" is the fact that tells a binding
    // note from a minting one, and it is a fact about THIS plan (I-303).
    const median = medianFootprintOf(plan.judged.survivors);
    const placed = rowsFrom(plan.pass, plan.judged.survivors, median, stated, scale);
    const read = notedRows(plan.pass, plan.read, placed, { median, claimed: plan.judged.claimed }, stated, scale);
    noted += read.noted;
    minted += read.minted;
    for (const row of read.rows) placements.push(row);
  }

  // What a bare-prefix schedule row names, asked once every plan has placed what it places: the
  // corroboration is a fact about the whole ARTIFACT's members of that class, never one plan's (I-321).
  const rings = new Map(plans.flatMap((plan) => plan.read.outlines).map((outline) => [outline.key, outline]));
  const typed = typedByPrefix(placements, evidence.families, rings, scale);

  // The unit the drawing's geometry is read in, read ONCE for the rings and the runs alike (I-340): a
  // plan and a clear drawn on one sheet are drawn in one unit, and two readings of it could disagree.
  const unit = drawnUnitIn(evidence, scale);

  // The plan each ring-placed member encloses, read off the ring it was placed by (I-333): what the
  // measure of a foundation stands on, so a chamfered cap is its shoelace and a turned one its own
  // sides — never a bounding box, and never the schedule's rectangle (L-FRM-02).
  const outlines = outlinesOf(typed, rings, unit);

  // The members no closed outline stands for: a beam is drawn as the pair of lines either side of its
  // axis, and it is placed off that pair with the run it measures beside it (`./runs`, L-MEA-09). It
  // runs here, after the outline pass, because the outlines that pass placed are the members that
  // CARRY a beam's ends and the rings a slab must not be read from.
  const framed = detectRuns(evidence, typed, unit, scale);

  // And the members an ARCHITECT'S plan draws: the brick walls, read off their two faces at the
  // thicknesses the drawing's WALL TYPES tables state, and the openings standing in their gaps
  // (`../walls/pairs`, I-593). A drawing that states no wall type places none, and a drawing that
  // places none carries neither field, so a structural drawing's reading is the reading it was.
  const walled = detectWalls(evidence, unit);
  const walls = walled.walls.length === 0 && walled.openings.length === 0 ? {} : { walls: walled.walls, wallOpenings: walled.openings };
  return { views: examined, placements: [...typed, ...framed.placements, ...walled.placements], ungridded, runs: framed.runs, outlines, scale, noted, minted, ...walls };
}

/** The plan each ring-placed row's ring encloses, in the rows' own order — none where no unit reads. */
function outlinesOf(rows: readonly PlacementRow[], rings: ReadonlyMap<string, Outline>, unit: DrawnUnit | null): OutlineRow[] {
  if (unit === null) return [];
  return rows.flatMap((row) => {
    const ring = rings.get(row.outlineKey);
    const reading = ring === undefined ? null : outlineReadingOf(ring.points, unit.unit);
    return reading === null ? [] : [{ placementKey: row.placementKey, sourceKey: row.outlineKey, unitSourceKey: unit.sourceKey, ...reading }];
  });
}

/**
 * How near one the drawn scale must stand for a unitless drawing's geometry to be read in the unit
 * its notes declare: a thousandth — a millimetre in a metre, a pure number (L-MEA-01).
 */
const DECLARED_SCALE_AGREEMENT = 1e-3;

/**
 * The unit the geometry of this drawing is read in — the rings' plans (I-333) and the runs' clears
 * (I-340) alike — or null where none is stated.
 *
 * The header's, where it names one the canon carries (`drawnUnitOf`, B-17). Where the header is
 * UNITLESS — F-RCC6-BNBC's is — the unit the drawing's own notes declare (I-302: the declaration is
 * the last word on a figure nobody gave a unit to), and only where the drawing's own members
 * corroborate it: drawn at scale one, a member IS the size its schedule states in that unit, so a unit
 * of the drawing is a unit of the declaration. A declaration the members do not bear out reads no
 * plan and no run at all (L-QTY-01: never a guess).
 */
function drawnUnitIn(evidence: PlacementEvidence, scale: number | null): DrawnUnit | null {
  const header = drawnUnitOf(evidence.graph);
  if (header !== null) return { unit: header, sourceKey: null };
  const declared = evidence.declaredUnit ?? null;
  if (declared === null || scale === null || Math.abs(scale - 1) > DECLARED_SCALE_AGREEMENT) return null;
  return { unit: declared.unit, sourceKey: declared.sourceKey };
}

/**
 * What one plan's candidates are once the marks standing INSIDE rings have spoken (I-333): the
 * candidates the bands then judge, and every ring a mark has a claim on — which no note may mint a
 * member from.
 */
type Contained = { readonly survivors: readonly Anchored[]; readonly claimed: ReadonlySet<string> };

/**
 * One plan's candidates, with its marks' containment read (Interpretation I-333).
 *
 * A mark standing inside closed rings NAMES the innermost of them whose longest side agrees with the
 * section its own family's schedule states, at the drawing's scale and inside the edition's footprint
 * band — the same test the stated-section check makes of every candidate (`matchesStatedSection`),
 * asked of the rings the mark stands in. Three things follow, and nothing else moves:
 *
 *   · the ring a mark so names is that mark's, whichever mark stands nearest its centre;
 *   · a ring holding no mark that lies inside a ring a mark so names belongs to NO mark — it is what
 *     the member is drawn standing on (a cap's piles, placed by their own plan), and counting it here
 *     would be the member counted twice (L-REG-03);
 *   · a mark that names a ring so names that ring ALONE: the centre pile circle a PC4 mark is written
 *     over is not a second, pile-sized PC4.
 *
 * The gate is the SCHEDULE's size, never containment alone: the PC4 and PC5 marks stand on their centre
 * piles, so the innermost ring is a 500 circle and an ungated rule places three caps a quarter of their
 * size; and on F-RCC6 25 of the 36 column marks of the TYPICAL FLOOR PLAN stand inside the slab's ring,
 * which no column's schedule agrees with. A mark whose schedule states no section is not judged at all
 * and anchors by nearness as it always did — so S-04's pile numbers, standing inside their circles and
 * inside the unmarked caps around them, place the circles exactly as before (L-QTY-01: never a guess).
 *
 * Two marks naming one ring name nothing by it: one ring is one member, and this stage is in no
 * position to choose between two statements about it.
 */
function containedOf(read: PlanRead, stated: ReadonlyMap<string, number>, scale: number | null, shares: PlanPass["shares"]): Contained {
  const naming = new Map<string, Mark[]>();
  if (scale !== null) {
    for (const mark of read.marks) {
      const said = stated.get(mark.mark);
      if (said === undefined) continue;
      const ring = read.outlines
        .filter((outline) => ringHolds(outline.points, mark.at))
        .sort(innermostFirst)
        .find((outline) => withinBand(outline.longest / (said * scale), shares.footprintMin, shares.footprintMax));
      if (ring !== undefined) naming.set(ring.key, [...(naming.get(ring.key) ?? []), mark]);
    }
  }
  const named = new Map([...naming.entries()].flatMap(([key, marks]) => (marks.length === 1 ? [[key, marks[0] as Mark] as const] : [])));
  const claimed = new Set(read.anchored.map((held) => held.outline.key));
  if (named.size === 0) return { survivors: read.anchored, claimed };

  const speaking = new Set([...named.values()].map((mark) => mark.key));
  const rings = read.outlines.filter((outline) => named.has(outline.key));
  const nearest = new Map(read.anchored.map((held) => [held.outline.key, held]));
  const survivors: Anchored[] = [];
  // In the artifact's own order, as the nearest-anchor reading was: the merge keeps the first of a
  // group in that order, and a reading that walked the rings another way would keep another (L-REG-04).
  for (const outline of read.outlines) {
    const mark = named.get(outline.key);
    if (mark !== undefined) {
      claimed.add(outline.key);
      survivors.push({ outline, mark });
      continue;
    }
    if (!read.marks.some((one) => ringHolds(outline.points, one.at)) && rings.some((ring) => liesInside(outline, ring))) {
      // Nobody's member, and nobody's to mint one from either: it is what a named member stands on.
      claimed.add(outline.key);
      continue;
    }
    const held = nearest.get(outline.key);
    if (held === undefined || speaking.has(held.mark.key)) continue;
    survivors.push(held);
  }
  return { survivors, claimed };
}

/** Rings by the area they enclose, the smallest first — ties to the lower source key (L-REG-04). */
function innermostFirst(left: Outline, right: Outline): number {
  if (left.area !== right.area) return left.area - right.area;
  return left.key < right.key ? -1 : left.key > right.key ? 1 : 0;
}

/** Whether one ring lies wholly inside another: every vertex of it inside, and it is not the other. */
function liesInside(inner: Outline, outer: Outline): boolean {
  return inner.key !== outer.key && inner.area < outer.area && inner.points.every((point) => ringHolds(outer.points, point));
}

/**
 * One candidate per mark: the ring each mark stands NEAREST among the rings it anchors, ties to the
 * lower source key (L-REG-04). What the scale the containment is gated at is read over (I-333): a mark
 * counts once there, whatever else it happens to stand nearest to.
 *
 * Not what a plan's median or the final scale is read over: those keep the candidates the containment
 * left, which is every anchored candidate wherever no mark named a ring — F-RCC6's ROOF PLAN, read one
 * per mark, would judge its four C4 rings by their own size instead of by the plan's roof rings and
 * place four columns the fixture's byte-frozen reading never placed (measured: 233 placements → 237).
 */
function onePerMark(anchored: readonly Anchored[]): Anchored[] {
  const best = new Map<string, { readonly held: Anchored; readonly distance: number }>();
  for (const held of anchored) {
    const distance = distanceBetween(held.mark.at, held.outline.centre);
    const prior = best.get(held.mark.key);
    if (prior === undefined || distance < prior.distance || (distance === prior.distance && held.outline.key < prior.held.outline.key)) best.set(held.mark.key, { held, distance });
  }
  return [...best.values()].map((one) => one.held);
}

/**
 * The rows as a BARE-PREFIX family leaves them (Interpretation I-321).
 *
 * F-RCC6-BNBC's PILE SCHEDULE types its piles in one row whose mark is the bare prefix `P`, and the
 * PILE LAYOUT PLAN writes each pile's NUMBER — `P1` to `P89` — at the centre of its ring. The mark
 * placement reads is the number, and the join `families.has(mark)` finds no family `P1`, so every
 * pile stood untyped. The number stays the placement's identity (L-REG-04: the key is the mark the
 * plan wrote); what the prefix row names is the member's FAMILY.
 *
 * It names it only where three things the drawing states agree, and otherwise names nothing and
 * MEMBER_TYPE_UNKNOWN stands (L-QTY-01: never a guess):
 *
 *   · the row is the SOLE family of its class the schedules registered — a second row of piles,
 *     bare or numbered, and the prefix no longer says which type a numbered pile is;
 *   · its `NOS` cell states exactly the number of members of that class the plans place — the
 *     schedule's own count of what the plans draw, read as CORROBORATION and never as a count
 *     (T-SCHED-NORULES): the lines are still one per placed member;
 *   · its diameter equals every placed ring, at the scale the drawing's plans and schedules agree on
 *     (`drawnScaleOf`), to the half-unit the schedule printed the figure to — the schedule says what
 *     the member IS, and a ring of another size is another member. A row stating no diameter
 *     corroborates no ring, so a bare prefix types only a ROUND member today.
 *
 * Only an outline-placed class: a beam's family is the run reader's (`./runs`).
 */
function typedByPrefix(rows: readonly PlacementRow[], families: readonly FamilyNamed[], rings: ReadonlyMap<string, Outline>, scale: number | null): PlacementRow[] {
  let typed = [...rows];
  for (const named of families) {
    const type = classOfPrefix(named.family);
    if (!isRingPlacedClass(type)) continue;
    if (families.filter((other) => classOfFamily(other.family) === type).length !== 1) continue;
    const members = rows.filter((row) => row.elementType === type);
    if (members.length === 0 || named.corroboration?.placed !== members.length) continue;
    const diameter = statedDiameterOf(named);
    if (diameter === null || scale === null) continue;
    const agrees = members.every((row) => {
      const ring = rings.get(row.outlineKey);
      return ring !== undefined && Math.abs(ring.longest / scale - diameter.value) <= diameter.halfUnit;
    });
    if (!agrees) continue;
    typed = typed.map((row) => (row.elementType === type && row.memberFamily === null ? { ...row, memberFamily: named.family } : row));
  }
  return typed;
}

/**
 * The diameter a family's schedule states, and the half-unit of the place it was printed to — `500`
 * is a figure in [499.5, 500.5], and a ring the drawing drew inside that is the ring the schedule
 * describes. Null where no variant states one.
 */
function statedDiameterOf(named: FamilyNamed): { readonly value: number; readonly halfUnit: number } | null {
  for (const variant of named.variants ?? []) {
    const dia = (variant.dimensions ?? []).find((one) => one.dimension === DIMENSION.dia);
    if (dia !== undefined) return { value: dia.value, halfUnit: 0.5 * 10 ** -placesOf(dia.text) };
  }
  return null;
}

/** How many places a figure is printed to: the most decimals any number in its text carries. */
function placesOf(text: string): number {
  return Math.max(0, ...[...text.matchAll(/\d+(?:\.(\d+))?/g)].map((match) => (match[1] ?? "").length));
}

/** What one plan places, keyed and grid-referenced. */
type PlanPass = {
  readonly evidence: PlacementEvidence;
  readonly view: PartitionedView;
  readonly axes: readonly GridAxisRow[];
  readonly spacing: number;
  readonly shares: { readonly containmentMerge: number; readonly nearAnchor: number; readonly footprintMin: number; readonly footprintMax: number };
  readonly families: ReadonlySet<string>;
  readonly ref: ViewRef;
};

/**
 * One layout plan read whole. The bubbles the grid was read from are excluded by the grid's own
 * citation rather than by a second reading of what a bubble is: a ring the backbone stands on is a
 * georeference, and reading it as a member would place a column at every grid intersection (B-17).
 *
 * The standing population is kept beside what was read from it, because the note pass reads the SAME
 * texts the marks were read from and must see exactly the set this reading saw (I-303, B-17). What
 * another drawing bound in as background stands in no population of this one (I-342).
 */
function readPlan(pass: PlanPass): PlanRead {
  const cited = new Set(pass.axes.flatMap((axis) => [axis.bubbleKey, axis.labelKey]));
  const standing = pass.evidence.graph.entities.filter(
    (entity) => pass.evidence.assignments.get(entity.key) === pass.view.viewKey && !cited.has(entity.key) && !isBoundXrefContext(entity.layer),
  );

  const marks = standing.flatMap((entity) => markOf(entity) ?? []);
  const outlines = standing.flatMap((entity) => outlineOf(entity) ?? []);

  const reach = pass.shares.nearAnchor * pass.spacing;
  const anchored = outlines.flatMap((outline) => {
    const mark = nearestMark(outline, marks, reach);
    return mark === null ? [] : [{ outline, mark }];
  });
  return { standing, marks, outlines, anchored };
}

/** What one plan's notes left behind: the rows as they now stand, and the census of what they did. */
type NotedPlan = { readonly rows: readonly PlacementRow[]; readonly noted: number; readonly minted: number };

/**
 * One plan's rows as its NOTES leave them (I-303: a plan note that names a mark is evidence about
 * that MEMBER). Two phases over one set of notes, and a note falls to exactly one of them:
 *
 *   · BINDING — the note's mark has a placed row on this plan, so the note is carried on that row
 *     and the member it names is excepted from the view's typical range (`C7 Ø450 PORCH COLUMN`).
 *   · MINTING — the note's mark placed NOTHING here, so the note is the whole of the evidence that a
 *     member of it stands on this plan, and it places one off the nearest outline no mark anchors
 *     (`C5 FLOATING COLUMN OVER TG1 (STARTS AT 1F)`, over the dashed rectangle the sheet tags with
 *     no mark of its own). "Dashed" is invisible to this product — the artifact carries no linetype
 *     and the ring's colour is bylayer like every other column's — so the NOTE is the evidence and
 *     the outline is merely what it reaches (L-CAD-03, L-QTY-01).
 *
 * BOTH PHASES ANSWER TO THE PLAN'S OWN NEAR-ANCHOR REACH (I-303's fifth statement: a note is
 * evidence about a member only where it stands within `nearAnchor × spacing` of it — "the reach
 * every other placement question on this plan is already answered at"). What it is measured TO is
 * the entity the note is evidence about, which is the one thing that differs between the phases: the
 * MARK where a mark placed the member, and the RING itself where the note is what places it. A note
 * written at the other end of the sheet is a note about something else (L-MEA-01, L-CAD-07).
 *
 * THE SINGULARITY GUARD, BOTH HALVES. A note excepts its member only where exactly ONE note names
 * the mark (`soleNotesAmong`, the fact about the notes) AND that mark names exactly ONE member (the
 * fact about this plan's rows, applied here). F-RCC6-BNBC's S-23 writes three notes over an `SW1`
 * naming 27 members; a blunt rule would let any one of them collapse the whole lift core onto the
 * level S-23 draws. Two statements about one mark are two statements, and this stage is in no
 * position to choose between them, so it takes neither and the mark expands as it always did
 * (L-QTY-01: never a guess).
 */
function notedRows(
  pass: PlanPass,
  read: PlanRead,
  placed: readonly PlacementRow[],
  population: { readonly median: number; readonly claimed: ReadonlySet<string> },
  stated: ReadonlyMap<string, number>,
  scale: number | null,
): NotedPlan {
  const notes = read.standing.flatMap((entity) => noteOf(entity) ?? []);
  if (notes.length === 0) return { rows: placed, noted: 0, minted: 0 };
  const sole = soleNotesAmong(notes.map((seen) => seen.note));

  const byMark = new Map<string, PlacementRow[]>();
  for (const row of placed) byMark.set(row.mark, [...(byMark.get(row.mark) ?? []), row]);

  // An outline a mark anchors is that mark's, whether or not the bands kept it — and so is a ring a
  // named member stands on (I-333): minting it from a note would place a member over geometry another
  // reading already claimed, and a member drawn once and counted twice is the over-measurement
  // L-REG-03 exists to make unrepresentable. The median is the plan's own, read by the one reading
  // the placed members were judged by (B-17).
  const claimed = new Set(population.claimed);
  const median = population.median;

  const bound = new Map<string, PlacementNote>();
  const minted: PlacementRow[] = [];
  for (const seen of notes) {
    // The note half of the guard: this note is the only note of this plan naming its mark.
    if (sole.get(seen.note.mark) !== seen.note) continue;
    const named = byMark.get(seen.note.mark) ?? [];
    // The mark half: the mark names one member, or none at all and the note places it.
    if (named.length > 1) continue;
    const only = named[0];
    if (only !== undefined) {
      // I-303's fifth statement, measured to the mark that placed the member: a sentence naming
      // this mark from the far side of the sheet is a sentence about something else.
      const mark = read.marks.find((one) => one.key === only.markKey);
      if (mark === undefined || distanceBetween(seen.at, mark.at) > pass.shares.nearAnchor * pass.spacing) continue;
      bound.set(only.placementKey, statedIn(seen));
      continue;
    }
    const row = mintedRow(pass, read, seen, claimed, median, stated, scale);
    if (row === null) continue;
    // One outline is one member: a second note reaching the same ring does not mint a second.
    claimed.add(row.outlineKey);
    minted.push(row);
  }

  const rows = placed.map((row) => {
    const note = bound.get(row.placementKey);
    return note === undefined ? row : { ...row, note };
  });
  return { rows: [...rows, ...minted], noted: bound.size + minted.length, minted: minted.length };
}

/**
 * The member a note PLACES, or null where its words reach nothing this plan can stand one on
 * (I-303's minting half). Every fence the mark reader answers to, asked of the note:
 *
 *   · the nearest outline within `nearAnchor × spacing` of the note, ties to the lower source key —
 *     the plan's own reach, and `nearestMark`'s own tie rule, so one drawing anchors one way every
 *     time (L-REG-04);
 *   · never one a mark anchors, so the geometry a placed member already stands on is never counted
 *     a second time;
 *   · inside the plan's own footprint band, and inside the band its mark's SCHEDULE states — the two
 *     statements every other candidate of this plan is judged by, asked in the same order.
 *
 * THE MEDIAN AND THE SCALE ARE THE MARK-ANCHORED POPULATION'S — as the containment left it (I-333) —
 * and the minted candidate joins neither: both were closed before this ran, which is exactly what
 * makes minting a member unable to move any figure of any member that stood without it (L-MEA-01,
 * L-QTY-06).
 *
 * A plan whose own candidates state NO median states nothing to judge a stranger's footprint by, and
 * minting there would be placing a member on the strength of one sentence and no corroboration at
 * all: it mints nothing, and its noted mark expands as it always did (L-QTY-01, L-QTY-04).
 */
function mintedRow(
  pass: PlanPass,
  read: PlanRead,
  seen: Noted,
  claimed: ReadonlySet<string>,
  median: number,
  stated: ReadonlyMap<string, number>,
  scale: number | null,
): PlacementRow | null {
  if (!(median > 0)) return null;
  const free = read.outlines.filter((outline) => !claimed.has(outline.key));
  const reached = nearestOutline(seen.at, free, pass.shares.nearAnchor * pass.spacing);
  if (reached === null) return null;
  if (!withinBand(reached.longest / median, pass.shares.footprintMin, pass.shares.footprintMax)) return null;
  if (!matchesStatedSection(reached.longest, seen.note.mark, stated, scale, pass.shares.footprintMin, pass.shares.footprintMax)) return null;

  // The identity is the grammar's, unchanged: the view, the mark and the point quantised onto the
  // lattice (L-REG-04). The NOTE is the naming entity — a placement anybody can trace back to the
  // two entities it was read from is what L-CAD-03 asks for, and here they are the ring and the
  // sentence that named it (`mark_key` is the note's own key, `mark_text` its own words).
  const placement = { view: pass.ref, mark: seen.note.mark, x: reached.centre[0], y: reached.centre[1] };
  return {
    viewKey: viewKeyOf(pass.ref),
    view: pass.ref,
    placementKey: placementKey(placement),
    mark: seen.note.mark,
    markText: seen.text,
    elementType: seen.note.type,
    x: reached.centre[0],
    y: reached.centre[1],
    gridLetter: nearestLabel(pass.axes, LETTER_FAMILY, reached.centre),
    gridNumeral: nearestLabel(pass.axes, NUMERAL_FAMILY, reached.centre),
    outlineKey: reached.key,
    markKey: seen.key,
    memberFamily: pass.families.has(seen.note.mark) ? seen.note.mark : null,
    note: statedIn(seen),
  };
}

/** The note as a placed member carries one: its own key and words, and what it stated (`./rows`). */
function statedIn(seen: Noted): PlacementNote {
  return { sourceKey: seen.key, text: seen.text, band: seen.note.band, shape: seen.note.shape };
}

/**
 * This entity read as a plan note about one member, or nothing where it is not one (`./law`).
 *
 * The reading is the law's whole; what is added here is WHERE the text stands, because a note is
 * evidence about a member only within the plan's own near-anchor reach of it (I-303's fifth
 * statement) and a text with no point is a text nothing can be measured from.
 */
function noteOf(entity: Drawn): [Noted] | null {
  const text = entity.text ?? "";
  const at = (entity.points ?? [])[0];
  if (text === "" || at === undefined) return null;
  const note = memberNoteOf(text);
  return note === null ? null : [{ key: entity.key, text, at: [at[0] ?? 0, at[1] ?? 0], note }];
}

/**
 * The outline nearest this point within the reach, or null where none stands inside it. Ties go to
 * the lower source key, exactly as `nearestMark`'s do, so one drawing anchors one way every time
 * (L-REG-04).
 */
function nearestOutline(at: Point, outlines: readonly Outline[], reach: number): Outline | null {
  let held: { outline: Outline; distance: number } | null = null;
  for (const outline of outlines) {
    const distance = distanceBetween(at, outline.centre);
    if (distance > reach) continue;
    if (held === null || distance < held.distance || (distance === held.distance && outline.key < held.outline.key)) held = { outline, distance };
  }
  return held?.outline ?? null;
}

/**
 * The rows one plan's anchored candidates yield. Two statements have to hold of a candidate and they
 * are read from two different places, so both are tested against the candidates as they were anchored
 * and neither is a filter over the other's answer: the plan says its own members are alike (the
 * footprint band), and the schedules say what each mark IS (the stated section). A candidate that
 * fails either is not the member that mark names.
 */
function rowsFrom(pass: PlanPass, anchored: readonly Anchored[], median: number, stated: ReadonlyMap<string, number>, scale: number | null): PlacementRow[] {
  const inBand = withinFootprintBand(anchored, median, pass.shares.footprintMin, pass.shares.footprintMax);
  const said = new Set(
    anchored
      .filter((held) => matchesStatedSection(held.outline.longest, held.mark.mark, stated, scale, pass.shares.footprintMin, pass.shares.footprintMax))
      .map((held) => held.outline.key),
  );
  const merged = mergedByMark(
    inBand.filter((held) => said.has(held.outline.key)),
    pass.shares.containmentMerge * pass.spacing,
  );

  const rows: PlacementRow[] = [];
  const keyed = new Set<string>();
  for (const held of merged) {
    const placement = { view: pass.ref, mark: held.mark.mark, x: held.outline.centre[0], y: held.outline.centre[1] };
    const key = placementKey(placement);
    // Two members of one mark quantising onto one lattice point are one member (L-REG-04): the key
    // is the identity, so the second is the same placement rather than a row that collides at insert.
    if (keyed.has(key)) continue;
    keyed.add(key);
    rows.push({
      viewKey: viewKeyOf(pass.ref),
      view: pass.ref,
      placementKey: key,
      mark: held.mark.mark,
      markText: held.mark.text,
      elementType: held.mark.type,
      x: held.outline.centre[0],
      y: held.outline.centre[1],
      gridLetter: nearestLabel(pass.axes, LETTER_FAMILY, held.outline.centre),
      gridNumeral: nearestLabel(pass.axes, NUMERAL_FAMILY, held.outline.centre),
      outlineKey: held.outline.key,
      markKey: held.mark.key,
      memberFamily: pass.families.has(held.mark.mark) ? held.mark.mark : null,
      // A mark names a member; whether a NOTE names it too is the note pass's answer, made over the
      // rows this one leaves (I-303). Null here is "no note has been read yet", and the note pass
      // rewrites exactly the rows it binds one to.
      note: null,
    });
  }
  return rows;
}

/** One view's axes, by the view they georeference. */
function axesOf(grid: DetectedGrid | null): Map<string, GridAxisRow[]> {
  const byView = new Map<string, GridAxisRow[]>();
  for (const axis of grid?.axes ?? []) {
    const held = byView.get(axis.viewKey);
    if (held === undefined) byView.set(axis.viewKey, [axis]);
    else held.push(axis);
  }
  return byView;
}

/**
 * This entity read as a member mark this stage places by, or nothing where it names none (L-CAD-07).
 *
 * A mark of a FRAMED class names no outline: its member is drawn as a pair of edge lines and `./runs`
 * places it off that pair. Read here, it would anchor whatever closed ring happened to stand nearest —
 * a stair well, a hatch boundary — and place a beam nobody drew, with no run to measure it by
 * (L-MEA-09, L-QTY-04). The two readers divide the plan by how the plan draws a member, and neither
 * reads the other's. Nor does a mark of the wall lane's classes: a door tag is drawn in a circle, and
 * that ring is the tag's, never a door (`./law`'s `isRingPlacedClass`, I-590).
 */
function markOf(entity: Drawn): [Mark] | null {
  const text = entity.text ?? "";
  const at = (entity.points ?? [])[0];
  if (text === "" || at === undefined) return null;
  const type = classOfMark(text);
  if (!isRingPlacedClass(type)) return null;
  return [{ key: entity.key, text, mark: normaliseMark(text), type, at: [at[0] ?? 0, at[1] ?? 0] }];
}

/** This entity read as a closed outline, or nothing where it encloses no area. */
function outlineOf(entity: Drawn): [Outline] | null {
  if (entity.closed !== true) return null;
  const points = (entity.points ?? []).map((point): Point => [point[0] ?? 0, point[1] ?? 0]);
  if (points.length < FEWEST_OUTLINE_VERTICES) return null;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return [
    {
      key: entity.key,
      centre: [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2],
      longest: Math.max(width, height),
      points,
      area: enclosedAreaOf(points),
    },
  ];
}

/**
 * The mark that names this outline: the nearest one standing within the near-anchor reach, or null
 * where none does. Ties go to the lower source key, so one drawing anchors one way every time
 * (L-REG-04).
 */
function nearestMark(outline: Outline, marks: readonly Mark[], reach: number): Mark | null {
  let held: { mark: Mark; distance: number } | null = null;
  for (const mark of marks) {
    const distance = distanceBetween(mark.at, outline.centre);
    if (distance > reach) continue;
    if (held === null || distance < held.distance || (distance === held.distance && mark.key < held.mark.key)) held = { mark, distance };
  }
  return held?.mark ?? null;
}

/**
 * The anchored candidates whose longest side stands inside the footprint band (riskNotes (1)): the
 * band is a share of the MEDIAN longest side of this plan's own mark-anchored candidates, because
 * the columns of one plan are alike and a room outline or a hatch fragment is not. A plan whose
 * candidates have no size at all is left alone: a band around zero would drop every one of them.
 */
function withinFootprintBand(anchored: readonly Anchored[], median: number, min: number, max: number): Anchored[] {
  if (!(median > 0)) return [...anchored];
  return anchored.filter((held) => withinBand(held.outline.longest / median, min, max));
}

/**
 * The middle footprint of one plan's MARK-ANCHORED candidates — the size this plan says its own
 * members are. Its one home, because the footprint band and the note's minting are the same question
 * asked of two candidates, and a second reading of "what this plan's members look like" would let a
 * minted member be judged by a population the placed ones were not (B-17, I-303). Asked of the
 * candidates the containment left (I-333), so a plan drawing two populations is judged by the members
 * its marks name and not by whichever population is the more numerous.
 */
function medianFootprintOf(anchored: readonly Anchored[]): number {
  return medianOf(anchored.map((held) => held.outline.longest));
}

/** Whether one share of a stated size stands inside the edition's band (L-MEA-01). */
function withinBand(share: number, min: number, max: number): boolean {
  return share >= min && share <= max;
}

/**
 * The longest side the record's schedules state for each mark family, in the schedules' own units. A
 * banded family states a section per band and the member is drawn to one of them, so the largest is
 * the size its outline is judged against — judging by the smallest would call the member drawn at its
 * lowest band a stranger (L-FRM-02). A family whose every section went unread states no size at all.
 */
function statedLongestOf(families: readonly FamilyNamed[]): Map<string, number> {
  const stated = new Map<string, number>();
  for (const named of families) {
    for (const variant of named.variants ?? []) {
      const sides = [variant.sectionWidth, variant.sectionDepth].filter((side): side is number => side !== null && side > 0);
      if (sides.length === 0) continue;
      stated.set(named.family, Math.max(stated.get(named.family) ?? 0, ...sides));
    }
  }
  return stated;
}

/**
 * How many drawing units one unit of the schedules' measures, read off the drawing itself: the median
 * of every mark-anchored candidate's longest side against the section its own mark's schedule states.
 * A plan draws its members to the sizes the schedules give them, so the agreement between the two IS
 * the drawing's statement of what it was drawn at — no distance is spelled here either (L-MEA-01).
 *
 * Null where nothing can be compared: a record whose schedules stated no section says nothing about
 * its own scale, and a scale guessed from no evidence would place members by numbers nobody read.
 */
function drawnScaleOf(anchored: readonly Anchored[], stated: ReadonlyMap<string, number>): number | null {
  const ratios = anchored.flatMap((held) => {
    const said = stated.get(held.mark.mark);
    return said === undefined || !(held.outline.longest > 0) ? [] : [held.outline.longest / said];
  });
  const median = medianOf(ratios);
  return median > 0 ? median : null;
}

/**
 * Whether a candidate's footprint agrees with the section its mark's schedule states, at the scale
 * the drawing was drawn to. "Member-type registry from schedules" says what a member IS (R-TO-031),
 * so an outline a `C4` mark happens to stand nearest to but that is three times the size the schedule
 * gives C4 is not a C4 — it is whatever else the plan drew there, and placing it would count a stair
 * opening as a column. Judged by the same shares the footprint band uses, because it is the same
 * question asked of the schedule instead of of the plan.
 *
 * A mark the schedules state no section for is not judged: the drawing said nothing to judge it by,
 * and a reading that refused what it could not check would place nothing on a scheduleless plan.
 */
function matchesStatedSection(longest: number, mark: string, stated: ReadonlyMap<string, number>, scale: number | null, min: number, max: number): boolean {
  const said = stated.get(mark);
  if (said === undefined || scale === null) return true;
  return withinBand(longest / (said * scale), min, max);
}

/** The middle of a set of measurements — the mean of the two middles where there is no single one. */
function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;
  return (((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2);
}

/**
 * One member per group of outlines of ONE mark standing within the containment/merge share of each
 * other — a column drawn as an outline and its own hatch boundary is one column, and two rows of
 * quantity for it is over-measurement (L-CAD-07, L-REG-03).
 *
 * The group is single-linkage over the merge distance, and the member it yields is the FIRST of the
 * group in the artifact's own order — a representative chosen by the drawing rather than by the
 * order a reader happened to walk it in (L-REG-04).
 */
function mergedByMark(anchored: readonly Anchored[], distance: number): Anchored[] {
  const kept: Anchored[] = [];
  const merged = new Set<string>();
  for (const held of anchored) {
    if (merged.has(held.outline.key)) continue;
    kept.push(held);
    merged.add(held.outline.key);
    // Single linkage: everything reachable from the representative through a chain of merges is the
    // same member, so a member drawn as three touching rings is one and not two.
    const reachable = [held];
    while (reachable.length > 0) {
      const from = reachable.pop() as Anchored;
      for (const other of anchored) {
        if (merged.has(other.outline.key) || other.mark.mark !== held.mark.mark) continue;
        if (distanceBetween(from.outline.centre, other.outline.centre) > distance) continue;
        merged.add(other.outline.key);
        reachable.push(other);
      }
    }
  }
  return kept;
}

/**
 * The label of the nearest axis of one family, or null where this view's backbone carries none. Ties
 * go to the lower label, so a member standing midway between two axes is referenced the same way
 * every time (L-REG-04).
 */
function nearestLabel(axes: readonly GridAxisRow[], family: string, at: Point): string | null {
  let held: { label: string; distance: number } | null = null;
  for (const axis of axes) {
    if (axis.family !== family) continue;
    const distance = Math.abs((axis.axis === "x" ? at[0] : at[1]) - axis.position);
    if (held === null || distance < held.distance || (distance === held.distance && axis.label < held.label)) held = { label: axis.label, distance };
  }
  return held?.label ?? null;
}

function distanceBetween(left: Point, right: Point): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}
