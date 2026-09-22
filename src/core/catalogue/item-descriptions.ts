// L-BD-01's item description as a CLOSED roster: "the item description is the method of
// measurement", so the sentence a quantity is billed under is chosen from a list and never written.
//
// WHAT MAY STAND HERE IS ONLY WHAT THE LAW ALREADY STATES. A row exists because a clause names an
// axis as quantity-bearing — L-BD-04's "brickwork at nominal declared thickness (250/375 mm) in
// cum" and "excavation in cum banded by depth (per 0.5 m over 1.5 m)", AM-16 §4's "brick walls 250
// and 125" — and it cites that clause beside its own text. No rate, no norm, no book code and no
// value the law does not spell is invented here (AM-12, L-BD-07): a description that added a
// convention nobody legislated would be a method of measurement with no author.
//
// AN AXIS IS AUTHORED; A ROW IS DERIVED. Each axis names the kind it qualifies and the values the
// law states, and the classes it stands over are read off `BEARS` — so a class that gains a kind
// gains its rows on the same edit, and no second roster can go stale beside the relation (B-19).
//
// WHERE THE LAW STATES ONE DESCRIPTION, THERE IS ONE CANDIDATE. `candidateItemsFor` is total over
// class × kind and answers the catalogue's own sentence (L-MEA-04's work item) where no axis
// divides the kind. One candidate is nothing to select: the caller does not ask a model to choose
// from a list of one, and the draft keeps the plain description it has always written.
import { BEARS } from "./bears";
import { WORK_ITEM_CATALOGUE } from "./catalogue";
import { type ElementType } from "./classes";
import { type Kind } from "./kinds";

/**
 * The answer a chooser gives when no description in the list describes the line. It is the no-match
 * outcome every closed question carries, and it is a first-class answer rather than a failure: what
 * stands then is the plain description the emission already writes (L-AI-02's abstention).
 */
export const NO_MATCH = "NONE_OF_THESE";

/** One work-item description a (class, kind) may be billed under, and the clause that states its axis. */
export type ItemDescriptionRow = {
  /** `<kind>/<class>/<slug>` — stable, derived, and never a minted id (L-REG-04). */
  readonly id: string;
  readonly class: ElementType;
  readonly kind: Kind;
  /** The description itself: the method of measurement this line is billed under (L-BD-01). */
  readonly text: string;
  /** What this row's axis says, in the words the clause says it — what tells it from its siblings. */
  readonly qualifier: string;
  /** The clause that states this axis is quantity-bearing. A row that cites none may not stand. */
  readonly clause: string;
};

/** One value of one axis: the slug it is filed under, what it says, the sentence it bills under. */
type AxisValue = {
  readonly slug: string;
  readonly qualifier: string;
  readonly clause: string;
  readonly text: string;
};

/** One axis of one kind: the law-stated values that divide that kind's item into several. */
type Axis = { readonly kind: Kind; readonly values: readonly AxisValue[] };

/**
 * Brickwork's nominal declared thickness. L-BD-04 states the axis and two of its values ("brickwork
 * at nominal declared thickness (250/375 mm) in cum"); AM-16 §4 states the third for this product's
 * own scope ("brick walls 250 and 125"). The thickness both SELECTS the item and MEASURES it, which
 * is why the catalogue's own sentence already names it (L-MEA-02, R-TO-032).
 */
const NOMINAL_THICKNESS: Axis = Object.freeze({
  kind: "masonry.brickwork",
  values: Object.freeze([
    Object.freeze({
      slug: "nominal-250",
      qualifier: "250 mm nominal declared thickness",
      clause: "L-BD-04",
      text: "Brickwork in walls of 250 mm nominal declared thickness, measured as the wall face net of scheduled openings by its nominal thickness",
    }),
    Object.freeze({
      slug: "nominal-375",
      qualifier: "375 mm nominal declared thickness",
      clause: "L-BD-04",
      text: "Brickwork in walls of 375 mm nominal declared thickness, measured as the wall face net of scheduled openings by its nominal thickness",
    }),
    Object.freeze({
      slug: "nominal-125",
      qualifier: "125 mm nominal declared thickness",
      clause: "AM-16",
      text: "Brickwork in walls of 125 mm nominal declared thickness, measured as the wall face net of scheduled openings by its nominal thickness",
    }),
  ]),
});

/**
 * Excavation's depth band. L-BD-04 states it: "excavation in cum banded by depth (per 0.5 m over
 * 1.5 m)". The band is the BASE item; the depth beyond 1.5 m is an added-rate item, which the same
 * clause rules "modif[ies] a base item and bill[s] as separate lines" — so it is named in the deeper
 * row's own sentence and is never a third candidate here.
 */
const DEPTH_BAND: Axis = Object.freeze({
  kind: "earthwork.excavation",
  values: Object.freeze([
    Object.freeze({
      slug: "depth-to-1500",
      qualifier: "not exceeding 1.5 m deep",
      clause: "L-BD-04",
      text: "Excavation in earth for foundations not exceeding 1.5 m deep, measured as the pit's volume including working space",
    }),
    Object.freeze({
      slug: "depth-over-1500",
      qualifier: "exceeding 1.5 m deep",
      clause: "L-BD-04",
      text: "Excavation in earth for foundations exceeding 1.5 m deep, measured as the pit's volume including working space, the depth beyond 1.5 m billed per 0.5 m as its own added-rate line",
    }),
  ]),
});

/**
 * Every axis the law states, and no other.
 *
 * DELIBERATELY ABSENT, each because the law states the AXIS and not its values, and a value nobody
 * legislated would be invented convention (AM-12):
 *   · concrete BY GRADE (AM-16 §4) — no clause and no table in this tree closes the grade set, and
 *     the register states none today (`grades: {}`), so `rcc.concrete` carries one description.
 *   · formwork BY MEMBER SUB-ITEM (L-BD-04's 12 sub-items) — the member is the line's own class,
 *     which code already knows, so there is nothing for a reader to choose between; the height band
 *     above 4 m is an added-rate item under the same clause, not a second base description.
 *   · plaster BY THICKNESS, MIX, FACE AND FLOOR (L-BD-04) — the axes are named, the values are the
 *     drawing's (the rails carry them as written, `12 mm`, never banded), and no closed list of them
 *     is law. The rows land here on the increment that makes one law.
 */
const AXES: readonly Axis[] = Object.freeze([NOMINAL_THICKNESS, DEPTH_BAND]);

/** The classes that bear one kind, in the relation's own order (L-MEA-04's `bears`). */
function classesBearing(kind: Kind): readonly ElementType[] {
  return BEARS.filter((row) => row.kind === kind).map((row) => row.class);
}

/** One row, spelled from its axis value and the pair it stands over. */
function rowOf(klass: ElementType, kind: Kind, value: AxisValue): ItemDescriptionRow {
  return Object.freeze({ id: `${kind}/${klass}/${value.slug}`, class: klass, kind, text: value.text, qualifier: value.qualifier, clause: value.clause });
}

/**
 * The closed roster: every description an axis divides a kind into, over every class that bears
 * that kind. A pair no axis divides is NOT listed here — its one description is the catalogue's own
 * and is derived on demand, so this roster holds authored content and nothing else.
 */
export const ITEM_DESCRIPTIONS: readonly ItemDescriptionRow[] = Object.freeze(
  AXES.flatMap((axis) => classesBearing(axis.kind).flatMap((klass) => axis.values.map((value) => rowOf(klass, axis.kind, value)))),
);

/**
 * The one description a kind carries where no axis divides it: the work-item catalogue's own
 * sentence, which is L-MEA-04's description of what is measured of that kind. Derived rather than
 * copied — a catalogue entry reworded rewords this with it (B-17).
 */
function catalogueItemFor(klass: ElementType, kind: Kind): ItemDescriptionRow {
  return Object.freeze({
    id: `${kind}/${klass}/base`,
    class: klass,
    kind,
    text: WORK_ITEM_CATALOGUE[kind].description,
    qualifier: "the work-item catalogue's one description for this kind",
    clause: "L-MEA-04",
  });
}

/**
 * The descriptions this (class, kind) may be billed under, in the roster's order (test contract:
 * `candidateItemsFor`).
 *
 * TOTAL, and never empty: a pair the rails publish that the `bears` relation does not name still
 * answers its catalogue description, because a line with no description at all could not be billed.
 * A pair that answers ONE row is a pair with nothing to select — the caller takes what stands and
 * asks nobody.
 */
export function candidateItemsFor(klass: ElementType, kind: Kind): readonly ItemDescriptionRow[] {
  const divided = ITEM_DESCRIPTIONS.filter((row) => row.class === klass && row.kind === kind);
  return divided.length === 0 ? Object.freeze([catalogueItemFor(klass, kind)]) : Object.freeze(divided);
}

/** One candidate by its id, out of that pair's own set — never out of the whole roster. */
export function itemDescriptionOf(klass: ElementType, kind: Kind, id: string): ItemDescriptionRow | null {
  return candidateItemsFor(klass, kind).find((row) => row.id === id) ?? null;
}
