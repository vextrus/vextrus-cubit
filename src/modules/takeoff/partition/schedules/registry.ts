// R-TO-031's member-type registry: the tables a drawing's schedules yielded, folded into one row per
// mark family — "member-type registry from schedules (sections, rebar zones)".
//
// What a member IS, and never how many stand. A schedule states the section a mark carries over a
// band of floors and the rebar it carries there; how many of that member the building holds is read
// off the layout plans by placement, and a registry that answered it would be answering a question
// the schedule never asked (R-TO-031).
//
// One family is one MARK (riskNotes (3)): `C-1`, `c1.` and `C 1` are the family `C1`, the variants
// beneath it are the per-band readings of that mark, and the rebar zones beneath those are read off
// the band's own cell where the schedule wrote them there and off the row's rebar columns where it
// wrote them there — L-CAD-08 puts the zones under the BAND, and a schedule that stacks a band's
// section, bars and ties in one cell states all three of them about that band. A family per
// alphabetic prefix would fold every column of a drawing into one row and make the registry useless
// to placement.
//
// Noise is never a family: a note, a dash and a dimension standing in the mark column name no
// member, and a table none of whose rows names one contributes nothing rather than a guess (L-QTY-04).
//
// Pure over the tables: no store, no clock, no model (L-REG-04).
import type { ElementType } from "@/core/catalogue/classes";
import type { PrintedQuantityBasis, PrintedQuantityRefusal, RebarZone, ScheduleDimension, SectionUnit } from "@/core/db";
import { REFUSALS } from "@/core/errors";
import type { ConventionProfile, DeclaredDimensionUnit } from "@/core/rulesets/methods/conventions/resolve";
import {
  DIMENSION,
  REBAR_ZONE,
  cellParts,
  dimensionOfHeader,
  isBarMarkHeader,
  isMarkFamily,
  isMarkHeader,
  isOpeningMark,
  isPlacedNumberHeader,
  isPrintedQuantityHeader,
  keyKindOfHeader,
  normaliseMark,
  normaliseNotation,
  parseFigure,
  parseFloorZone,
  parsePrintedQuantity,
  parseRebarGroups,
  parseRestatedFigure,
  parseSizePair,
  parseSpacing,
  parseWholeNumber,
  parseZonedSpacing,
  rebarZoneOfHeader,
  sameStorey,
  sectionUnitOfHeader,
  statesPerFloor,
  type FloorBand,
  type KeyKind,
  type RebarGroup,
  type SizePair,
} from "../notation";
import { classOfFamily, classOfPrefix, levelRunsOf, type LevelRun } from "../placement/law";
import { VIEW_TYPE } from "../views/law";
import { isMarkCell, type ScheduleCell, type ScheduleDeferralRow, type ScheduleEvidence, type ScheduleTable } from "./reconstruct";

/**
 * The rebar one zone column states for one row: the cell verbatim, and what it reads as.
 *
 * `spacingUnit` is read the way a section's unit is (Interpretation I-412, after I-302): the cell's
 * own mark, else the head of the column the cell stands under, else the unit the drawing declares —
 * and where the declaration is what answered, `sourceKeys` cites it beside the cell (L-QTY-03). A
 * zone that states no spacing (the main bars) has no spacing to be the unit of, and takes none. The
 * two zones of one `@end/mid` pair are one statement and share one unit: a mark on either side is the
 * pair's, and two sides marked differently leave both zones with none (`pairUnitOf`).
 */
export type MemberZone = {
  readonly zone: RebarZone;
  readonly text: string;
  readonly bars: RebarGroup[] | null;
  readonly spacing: number | null;
  readonly spacingUnit: SectionUnit | null;
  readonly spacingBar: number | null;
  readonly sourceKeys: string[];
};

/**
 * One dimension a row states BESIDE its section (Interpretation I-322): which of the roster it is,
 * the cell verbatim, the figure that cell reads as, the unit it was written in, and the cells — and,
 * where it answered, the declaration — it was read from (L-QTY-03).
 */
export type MemberDimension = {
  readonly dimension: ScheduleDimension;
  readonly text: string;
  readonly value: number;
  readonly unit: SectionUnit;
  readonly sourceKeys: string[];
};

/** One variant of a family: the band of floors a column heads, and the section carried over it. */
export type MemberVariant = {
  readonly variantKey: string;
  readonly bandText: string;
  readonly bandFrom: string | null;
  readonly bandTo: string | null;
  readonly sectionText: string;
  readonly sectionWidth: number | null;
  readonly sectionDepth: number | null;
  readonly sectionUnit: SectionUnit | null;
  readonly sourceKeys: string[];
  readonly zones: MemberZone[];
  /**
   * The dimensions the row states beside the section — a pile's diameter and its length — present
   * only where the row states one its class is read for (I-322). Absent rather than empty, so a
   * registry of a drawing that states none is the registry it always was.
   */
  readonly dimensions?: MemberDimension[];
  /**
   * The quantity an opening schedule PRINTS for this row over these floors (s-schedules I-507):
   * a cited reading of what the schedule says, kept beside the type it was printed for and never a
   * count of members (L-CAD-08). Absent on every row of every other schedule.
   */
  readonly printed?: PrintedQuantity;
};

/**
 * What an opening schedule prints for one of its rows, and how that statement stands against the
 * drawing (L-MEA-02: the schedule is the authority, the plan a DECLARED cross-check).
 *
 * `basis` is what the schedule says the number is counted per — a note stating `PER FLOOR`, or a
 * caption naming one floor, where per floor and per group are one statement — and `basisKeys` what
 * it was read at. `planKey` is the one layout plan of the same floors this drawing carries, and
 * `tagKeys` the tags of this mark it draws: evidence of the check, which bills nothing. `refusal` is
 * the declared outcome — OPENING_QUANTITY_DISAGREES where the tags are not the printed number,
 * OPENING_QUANTITY_BASIS_UNSTATED where no basis was stated to compare them on — or null where the
 * two agree, or where no single plan of these floors stands in the drawing to check against.
 */
export type PrintedQuantity = {
  readonly text: string;
  readonly printed: number;
  readonly basis: PrintedQuantityBasis | null;
  readonly basisKeys: string[];
  readonly planKey: string | null;
  readonly tagKeys: string[];
  readonly refusal: PrintedQuantityRefusal | null;
  readonly sourceKeys: string[];
};

/**
 * What a BARE-PREFIX row's `NOS` cell states: the number of its members the row says the plans hold
 * (I-321). CORROBORATION, and nothing else: placement checks the plans against it before the prefix
 * may name a family for the numbered members it places, and it is never stored and never billed —
 * the count is placement's answer off the layout plans (R-TO-031, T-SCHED-NORULES).
 */
export type PlacedNumber = { readonly placed: number; readonly text: string; readonly sourceKeys: string[] };

/** One mark family of one schedule, with the variants and the rebar beneath it. */
export type MemberFamily = {
  readonly scheduleKey: string;
  readonly family: string;
  /** The mark cell's own spelling, kept verbatim beside the family it normalises to. */
  readonly markText: string;
  readonly rowIndex: number;
  readonly sourceKeys: string[];
  readonly variants: MemberVariant[];
  /** A bare-prefix row's `NOS` cell, where it states one (I-321) — absent on every other family. */
  readonly corroboration?: PlacedNumber;
};

/** What the registry made of the tables: the families, and the views that contributed none. */
export type RegisteredMemberTypes = {
  readonly families: MemberFamily[];
  readonly deferrals: ScheduleDeferralRow[];
};

/** What one header column of a table makes of the column beneath it. */
type ColumnRole =
  | { readonly kind: "mark" }
  | { readonly kind: "zone"; readonly zone: RebarZone }
  | { readonly kind: "band"; readonly band: FloorBand }
  | { readonly kind: "none" };

/** One header column: where it stands, what it says, and what it makes of its column. */
type Column = { readonly index: number; readonly header: string; readonly role: ColumnRole };

/**
 * The member types a drawing's tables name (R-TO-031). Every table either mints the families its
 * mark column names, or defers: a table with no mark column and a table whose every row is noise
 * both contributed nothing, and that is a thing a reader can act on rather than an absence to guess
 * at (R-UI-050, riskNotes (2)).
 *
 * `conventions` is the drawing's own profile where a caller has it — the LAST place a section's unit
 * is read from, after the cell and after the column head (I-302). It is optional because this is a
 * pure fold over the tables and a caller with no profile still gets every family the tables name;
 * what such a caller does not get is a unit for a pair nobody wrote one over, which is exactly the
 * reading it is entitled to.
 */
export function registerMemberTypes(tables: readonly ScheduleTable[], conventions?: ConventionProfile | null, evidence?: ScheduleEvidence): RegisteredMemberTypes {
  const families: MemberFamily[] = [];
  const deferrals: ScheduleDeferralRow[] = [];
  // The drawing's own declaration, where the conventions stage resolved one. It is handed in rather
  // than read here because the profile is one drawing's reading and this function is pure over the
  // tables — the stage that resolved it is the stage that knows (I-302, L-CAD-08).
  const declared = conventions?.dimensionUnit ?? null;
  // The layout plans an opening schedule's printed quantities are checked against, where the caller
  // handed the drawing's views (s-schedules I-507). A caller that handed none checks nothing: its
  // printed quantities stand read and unchecked, never compared with a plan nobody looked at.
  const plans = evidence === undefined ? [] : plansOf(evidence);

  for (const table of tables) {
    // A schedule keyed by ROOM is a schedule of rooms (s-schedules I-509): its table is stored
    // and cited cell by cell, it names no member type, and that is its reading rather than a view
    // that contributed nothing.
    if (keyOf(table) === KEY.room) continue;
    const minted = familiesOf(table, declared, plans);
    if (minted.length === 0) {
      deferrals.push({ viewKey: table.viewKey, reason: REFUSALS.SCHEDULE_VIEW_CONTRIBUTED_NOTHING.code });
      continue;
    }
    families.push(...minted);
  }

  return { families, deferrals };
}

/** The key kinds this registry reads a table by (s-schedules I-503), named off the notation's roster. */
const KEY: Readonly<Record<KeyKind, KeyKind>> = Object.freeze({ opening: "opening", room: "room", symbol: "symbol" });

/** What a table's key column is headed by: an opening type, a room, a symbol — or null for a member schedule. */
function keyOf(table: ScheduleTable): KeyKind | null {
  const mark = columnsOf(table).find((column) => column.role.kind === "mark");
  return mark === undefined ? null : keyKindOfHeader(mark.header);
}

/** The families one table names, in the order its rows name them. */
function familiesOf(table: ScheduleTable, declared: DeclaredDimensionUnit | null, plans: readonly PlanMarks[]): MemberFamily[] {
  const columns = columnsOf(table);
  const mark = columns.find((column) => column.role.kind === "mark");
  // The mark column is what makes a table a schedule OF something: with none, no row of it names a
  // member, and every cell in it is a dimension or a note (AC-1).
  if (mark === undefined) return [];
  // A BAR-BENDING schedule is a schedule of BARS (Interpretation I-331): every row is one bar, and the
  // member its MEMBER column names is the member that bar is cut FOR. Folded here it minted F-RCC6-
  // BNBC's PC3 and S3 as sectionless families from S-26's sample — a second, emptier statement of a
  // member type the member schedules make, which the setup then overwrote the first with in table
  // order. A member type has one statement, its schedule's, so a bar schedule registers none
  // (R-TO-031, B-17), and the table itself is still reconstructed and stored whole for the bar reader.
  if (columns.some((column) => isBarMarkHeader(column.header))) return [];

  const families: MemberFamily[] = [];
  const minted = new Set<string>();
  const rows = rowsOf(table);
  // The class every member row of this table names, or null where its rows name more than one — the
  // one fact the dimension read is scoped by (`dimensionsOf`, I-332).
  const single = soleClassOf(rows, mark.index);
  // The unbanded section column is the TABLE's, chosen once over all its rows: a column is what it is
  // for every row of the schedule, and choosing it per row would key one table's variants two ways.
  const stated = sectionColumnOf(columns, rows);
  // The levels column is the TABLE's for the same reason. A schedule states a band in one of two
  // places and this is the second: over the column (`GF TO 5F` heads the sections carried there) or
  // in a cell of a LEVELS column, one row per mark, written beside that mark's section (R-TO-031).
  const banded = levelsColumnOf(columns, rows, stated);
  // An opening schedule states its floors a third way: in its CAPTION (s-schedules I-506) —
  // `DOOR & WINDOW SCHEDULE (1ST TO 6TH FLOOR)` — and every row claims them (L-MEA-02's floor-group
  // scope). Read by the one home of a caption's level set (`levelRunsOf`, I-409): one run per range
  // or listed floor the caption states, and each run is a variant of every row.
  const opening = keyKindOfHeader(mark.header) === KEY.opening || namesOnlyOpenings(rows, mark.index);
  const runs = opening ? levelRunsOf(table.title) : [];

  for (const [rowIndex, row] of rows) {
    const markCell = row.get(mark.index);
    if (markCell === undefined) continue;
    // A bare class prefix — `P` over a plan that numbers its piles `P1`…`P89` — names the TYPE of
    // those members, so it is a family too (I-321). Whether it may name any of them is placement's
    // question, asked against the plans; here it is only read.
    const bare = isBarePrefix(markCell.text);
    if (!isMarkCell(markCell.text) && !bare) continue;
    const family = normaliseMark(markCell.text);
    // One row per mark family: a mark drawn twice in one schedule is one member type, read from the
    // first row that names it (riskNotes (3)).
    if (minted.has(family)) continue;
    minted.add(family);

    const zones = zonesOf(columns, row, declared);
    const variants =
      runs.length === 0
        ? variantsOf(columns, row, zones, stated, banded, markCell, declared)
        : openingVariantsOf({ runs, title: table.title, scheduleKey: table.scheduleKey, row, zones, stated, markCell, declared });
    // The row's dimensions are the ROW's, as its rebar columns are: every variant carries them.
    const dimensions = dimensionsOf(columns, row, family, declared, single, opening);
    const printed = opening ? printedOf(columns, row, family, table, runs, plans) : undefined;
    const corroboration = bare ? placedNumberOf(columns, row) : undefined;
    families.push({
      scheduleKey: table.scheduleKey,
      family,
      markText: markCell.text,
      rowIndex,
      sourceKeys: [...markCell.sourceKeys],
      variants: variants.map((variant) => ({
        ...variant,
        ...(dimensions.length === 0 ? {} : { dimensions: dimensions.map((one) => ({ ...one, sourceKeys: [...one.sourceKeys] })) }),
        ...(printed === undefined ? {} : { printed: { ...printed, basisKeys: [...printed.basisKeys], tagKeys: [...printed.tagKeys], sourceKeys: [...printed.sourceKeys] } }),
      })),
      ...(corroboration === undefined ? {} : { corroboration }),
    });
  }

  return families;
}

/**
 * Does every row of this table that names a mark name an OPENING (s-schedules I-503, I-505)?
 * A schedule headed `MARK` over `D-1`, `W-1`… is a schedule of openings all the same, and the floors
 * its caption states are its rows' (L-MEA-02): read by its header word alone it registered `D1` over
 * no floors and left its printed quantity unread. One structural mark among the rows and it is not.
 */
function namesOnlyOpenings(rows: readonly (readonly [number, ReadonlyMap<number, ScheduleCell>])[], markIndex: number): boolean {
  const named = rows.flatMap(([, row]) => {
    const cell = row.get(markIndex);
    return cell !== undefined && isMarkCell(cell.text) ? [cell.text] : [];
  });
  return named.length > 0 && named.every((text) => isOpeningMark(text));
}

/**
 * The variants of one row of an opening schedule whose caption states its floors (s-schedules
 * I-506): one per run of floors the caption states, each carrying the row's size — its SIZE
 * (W x H) cell read as a pair, first side the width and second the height as the head names them,
 * wrapped lines run on (I-504) — and citing the caption the floors were read at beside the cell
 * the size was (L-QTY-03). A row with no size cell still stands for its mark over those floors, citing
 * its mark cell and the caption (L-QTY-02: the absence is the reading).
 */
function openingVariantsOf(read: {
  runs: readonly LevelRun[];
  title: string;
  scheduleKey: string;
  row: ReadonlyMap<number, ScheduleCell>;
  zones: readonly MemberZone[];
  stated: Column | null;
  markCell: ScheduleCell;
  declared: DeclaredDimensionUnit | null;
}): MemberVariant[] {
  const cell = read.stated === null ? undefined : read.row.get(read.stated.index);
  const held = new Set<string>();
  const variants: MemberVariant[] = [];
  for (const run of read.runs) {
    const band: FloorBand = { from: run.from, to: run.to };
    const variantKey = variantKeyOf(band);
    if (held.has(variantKey)) continue;
    held.add(variantKey);
    if (cell === undefined || read.stated === null) {
      variants.push({
        variantKey,
        bandText: read.title,
        bandFrom: band.from,
        bandTo: band.to,
        sectionText: "",
        sectionWidth: null,
        sectionDepth: null,
        sectionUnit: null,
        sourceKeys: [...read.markCell.sourceKeys, read.scheduleKey],
        zones: read.zones.map((zone) => ({ ...zone })),
      });
      continue;
    }
    const sized = variantOf({ variantKey, bandText: read.title, band, cell, zones: read.zones, unitHeader: read.stated.header, declared: read.declared });
    variants.push({ ...sized, sourceKeys: [...sized.sourceKeys, read.scheduleKey] });
  }
  return variants;
}

/**
 * One layout plan of the drawing as a printed quantity is checked against it (s-schedules
 * I-507): the floors its caption states, and the texts it draws that are marks, by the mark each
 * names in the comparison form — the plan's circled `D2` and the schedule's `D-2` are one mark
 * (T-MARK-SPELLING).
 */
type PlanMarks = { readonly viewKey: string; readonly runs: readonly LevelRun[]; readonly marks: ReadonlyMap<string, readonly string[]> };

/** Every layout plan of the drawing, with the marks it draws. */
function plansOf(evidence: ScheduleEvidence): PlanMarks[] {
  const plans = new Map<string, { runs: LevelRun[]; marks: Map<string, string[]> }>();
  for (const view of evidence.views) {
    if (view.type !== VIEW_TYPE.LAYOUT_PLAN) continue;
    plans.set(view.viewKey, { runs: levelRunsOf(view.caption), marks: new Map() });
  }
  if (plans.size === 0) return [];
  for (const entity of evidence.graph.entities) {
    const viewKey = evidence.assignments.get(entity.key);
    const plan = viewKey === undefined ? undefined : plans.get(viewKey);
    const said = entity.text ?? "";
    if (plan === undefined || said.trim() === "" || !isMarkCell(said)) continue;
    const mark = normaliseMark(said);
    const held = plan.marks.get(mark);
    if (held === undefined) plan.marks.set(mark, [entity.key]);
    else held.push(entity.key);
  }
  return [...plans.entries()].map(([viewKey, plan]) => ({ viewKey, runs: plan.runs, marks: plan.marks }));
}

/** Do two captions state the same floors — the same runs, in the same order, each end one storey? */
function sameRuns(left: readonly LevelRun[], right: readonly LevelRun[]): boolean {
  return left.length === right.length && left.every((run, at) => sameStorey(run.from, (right[at] as LevelRun).from) && sameStorey(run.to, (right[at] as LevelRun).to));
}

/** The one basis a printed quantity may be read on today (s-schedules I-507). */
const PER_FLOOR: PrintedQuantityBasis = "per-floor";

/** The two refusals a printed quantity is declared under, named through the register (Q-07). */
const QUANTITY_DISAGREES: PrintedQuantityRefusal = REFUSALS.OPENING_QUANTITY_DISAGREES.code;
const QUANTITY_BASIS_UNSTATED: PrintedQuantityRefusal = REFUSALS.OPENING_QUANTITY_BASIS_UNSTATED.code;

/**
 * What an opening schedule's row PRINTS in its quantity column, as a cited reading, and how it stands
 * against the drawing (s-schedules I-507; L-MEA-02, L-CAD-08). Absent where the row prints no
 * quantity the notation reads.
 *
 * The basis first: a caption naming ONE floor states it (per floor is per group there), else a text
 * of the table stating `PER FLOOR` does; a schedule over several floors stating neither has a
 * quantity nobody may compare or multiply, declared OPENING_QUANTITY_BASIS_UNSTATED. Then the check,
 * only where exactly one layout plan of the drawing states the same floors: the plan's tags of this
 * mark against the printed number — equal, and the reading stands; not equal, and the disagreement is
 * DECLARED under OPENING_QUANTITY_DISAGREES, the tags and the cell cited, and neither side taken. No
 * plan, or two, and the reading stands unchecked (a placement across the set checks it, ARCH-4).
 */
function printedOf(columns: readonly Column[], row: ReadonlyMap<number, ScheduleCell>, family: string, table: ScheduleTable, runs: readonly LevelRun[], plans: readonly PlanMarks[]): PrintedQuantity | undefined {
  const column = columns.find((one) => one.role.kind === "none" && isPrintedQuantityHeader(one.header));
  const cell = column === undefined ? undefined : row.get(column.index);
  const printed = cell === undefined ? null : parsePrintedQuantity(cell.text);
  if (cell === undefined || printed === null) return undefined;
  const read = { text: cell.text, printed, sourceKeys: [...cell.sourceKeys] };

  const basis = basisOf(table, runs);
  if (basis === null) return { ...read, basis: null, basisKeys: [], planKey: null, tagKeys: [], refusal: QUANTITY_BASIS_UNSTATED };
  const matching = plans.filter((plan) => runs.length > 0 && sameRuns(plan.runs, runs));
  const plan = matching.length === 1 ? matching[0] : undefined;
  if (plan === undefined) return { ...read, basis: PER_FLOOR, basisKeys: basis, planKey: null, tagKeys: [], refusal: null };
  const tags = [...(plan.marks.get(family) ?? [])];
  return { ...read, basis: PER_FLOOR, basisKeys: basis, planKey: plan.viewKey, tagKeys: tags, refusal: tags.length === printed ? null : QUANTITY_DISAGREES };
}

/**
 * What a schedule states its quantities PER FLOOR at, or null where it states no basis: the caption,
 * where it names one floor (per floor and per group are then one statement), or the text of the table
 * that says `PER FLOOR` — a cell or a text in its rows that reached no column.
 */
function basisOf(table: ScheduleTable, runs: readonly LevelRun[]): string[] | null {
  const [only] = runs;
  if (runs.length === 1 && only !== undefined && sameStorey(only.from, only.to)) return [table.scheduleKey];
  const stating = table.cells.find((cell) => statesPerFloor(cell.text));
  if (stating !== undefined) return [...stating.sourceKeys];
  const unplaced = table.unplaced.find((text) => statesPerFloor(text.text));
  return unplaced === undefined ? null : [unplaced.key];
}

/**
 * The dimensions a family's class is read for (I-322): the names its methods bind a figure of the
 * schedule by. A pile is bored to a diameter and a length (AM-06 §2), so those two are read for it.
 *
 * Read PER CLASS, never off any column that happens to be headed so, because the same head states
 * different things of different tables: F-RCC6-BNBC's BAR BENDING SCHEDULE heads a column `DIA` over
 * the diameter of a BAR, and the member it files that bar under is a pile cap — whose diameter no
 * method asks for.
 *
 * A pile cap's DEPTH is read (Interpretation I-332): its plan is now the OUTLINE's where one was read
 * (the foundations rail's `planOf`, I-334), so the depth no longer multiplies a schedule rectangle
 * the plan does not draw. A footing's is not read yet — F-RCC6's FOOTING SCHEDULE would start billing
 * its 32 footings on a fixture byte-frozen at v1.1 — and neither is the depth of any class stated in
 * a schedule whose rows name MORE than one class (`soleClassOf`): the one such schedule either fixture
 * draws is that same FOOTING SCHEDULE, whose two pile-cap rows would bill 23.328 m³ on the frozen
 * fixture. That lift is a `baseline:` of its own, named with its proof; nothing here guesses it.
 */
const DIMENSIONS_READ: Readonly<Partial<Record<ElementType, readonly ScheduleDimension[]>>> = Object.freeze({
  pile: Object.freeze([DIMENSION.dia, DIMENSION.length]),
  pile_cap: Object.freeze([DIMENSION.depth]),
});

/**
 * The dimensions a schedule's own head states about whatever its rows name, whatever class they are
 * of (s-schedules I-508): a THICKNESS column is the thickness of each row's member — a wall type's
 * in F-ARCH's WALL TYPES — and no other table heads a column so that means anything else. Read and
 * stored, and bound by nothing until a method declares a thickness (I-322: a stored reading is not a
 * billed one).
 */
const STATED_BY_TABLE: readonly ScheduleDimension[] = Object.freeze([DIMENSION.thickness]);

/** And what a schedule of OPENINGS states of each row (I-506): the sill it stands on. */
const STATED_BY_OPENING_TABLE: readonly ScheduleDimension[] = Object.freeze([DIMENSION.sill]);

/**
 * The one class every member row of a table names, or null where its rows name two classes or none —
 * read off the mark column, through the one reading of what a family is a family of
 * (`classOfFamily`, B-17). A dimension is read only from a schedule OF its class (I-332).
 */
function soleClassOf(rows: readonly [number, Map<number, ScheduleCell>][], markColumn: number): ElementType | null {
  const classes = new Set<ElementType>();
  for (const [, row] of rows) {
    const cell = row.get(markColumn);
    if (cell === undefined || (!isMarkFamily(cell.text) && !isBarePrefix(cell.text))) continue;
    const type = classOfFamily(normaliseMark(cell.text));
    if (type !== null) classes.add(type);
  }
  return classes.size === 1 ? ([...classes][0] as ElementType) : null;
}

/** Whether a mark cell is exactly a class prefix and no numbered mark (I-321) — the one test of it here. */
function isBarePrefix(text: string): boolean {
  return !isMarkFamily(text) && classOfPrefix(text) !== null;
}

/**
 * The dimensions one row states for its family, in the order its columns stand: each read from the
 * column whose head names it (`dimensionOfHeader`), as a figure (`parseFigure`), in the unit the cell
 * wrote, else the unit its head states, else the unit the drawing declares (I-302) — the same three
 * statements, nearest first, a section's unit is read from (`unitOf`). A cell with no figure, and a
 * figure nobody gave a unit to, is no dimension: the rail keeps its row and names what is missing
 * (L-QTY-02). Only from a schedule every member row of which is of the family's class (`single`).
 */
function dimensionsOf(
  columns: readonly Column[],
  row: ReadonlyMap<number, ScheduleCell>,
  family: string,
  declared: DeclaredDimensionUnit | null,
  single: ElementType | null,
  opening: boolean,
): MemberDimension[] {
  const type = classOfFamily(family);
  const byClass = type === null || type !== single ? [] : (DIMENSIONS_READ[type] ?? []);
  // What the TABLE's own heads state about whatever its rows name (s-schedules I-506/g): a
  // THICKNESS column states the thickness of each row's member in any schedule, and a SILL column
  // the sill of an opening in a schedule of openings.
  const admitted = [...byClass, ...STATED_BY_TABLE, ...(opening ? STATED_BY_OPENING_TABLE : [])];
  const read: MemberDimension[] = [];
  for (const column of columns) {
    if (column.role.kind !== "none") continue;
    const dimension = dimensionOfHeader(column.header);
    if (dimension === null || !admitted.includes(dimension) || read.some((one) => one.dimension === dimension)) continue;
    const cell = row.get(column.index);
    // A figure restated in brackets in the other unit (`250 (0'-10")`) is read by the figure it
    // restates, in the unit the restatement settles (I-508); any other cell as a figure.
    const figure = cell === undefined ? null : (parseFigure(cell.text) ?? parseRestatedFigure(cell.text));
    if (cell === undefined || figure === null || !(figure.value > 0)) continue;
    const measured = unitOf(figure, column.header, declared);
    if (measured.unit === null) continue;
    read.push({ dimension, text: cell.text, value: figure.value, unit: measured.unit, sourceKeys: [...cell.sourceKeys, ...measured.cited] });
  }
  return read;
}

/** The number a bare-prefix row's `NOS` cell states, where it states one (I-321) — corroboration only. */
function placedNumberOf(columns: readonly Column[], row: ReadonlyMap<number, ScheduleCell>): PlacedNumber | undefined {
  const column = columns.find((one) => one.role.kind === "none" && isPlacedNumberHeader(one.header));
  const cell = column === undefined ? undefined : row.get(column.index);
  const placed = cell === undefined ? null : parseWholeNumber(cell.text);
  return cell === undefined || placed === null ? undefined : { placed, text: cell.text, sourceKeys: [...cell.sourceKeys] };
}

/** What each header column of a table says, and what its column reads as. */
function columnsOf(table: ScheduleTable): Column[] {
  return table.cells
    .filter((cell) => cell.rowIndex === 0)
    .map((cell) => ({ index: cell.columnIndex, header: cell.text, role: roleOf(cell.text) }));
}

/**
 * How one header is read. The specific stands before the general: a mark column is the mark column
 * however its words read, and a ties column is a rebar zone rather than a band of floors — so a
 * header saying both is read as the narrower of the two.
 */
function roleOf(header: string): ColumnRole {
  if (isMarkHeader(header)) return { kind: "mark" };
  const zone = rebarZoneOfHeader(header);
  if (zone !== null) return { kind: "zone", zone };
  const band = parseFloorZone(header);
  return band === null ? { kind: "none" } : { kind: "band", band };
}

/** The data rows of a table, by their row index, each as its cells by column. */
function rowsOf(table: ScheduleTable): [number, Map<number, ScheduleCell>][] {
  const rows = new Map<number, Map<number, ScheduleCell>>();
  for (const cell of table.cells) {
    if (cell.rowIndex === 0) continue;
    const held = rows.get(cell.rowIndex) ?? new Map<number, ScheduleCell>();
    held.set(cell.columnIndex, cell);
    rows.set(cell.rowIndex, held);
  }
  return [...rows.entries()].sort((left, right) => left[0] - right[0]);
}

/**
 * The rebar one row states, one entry per zone column that says anything in that row. A zone named
 * by two columns is read from the first of them: the store holds one row per zone of one variant,
 * and a second reading of the same zone would be a competing opinion rather than more of the answer.
 *
 * A spacing's unit is read in the three statements a section's is, nearest first (`unitOf`,
 * I-412): the cell's own mark, else THIS column's head — a `STIRRUPS (mm)` states the unit of the
 * centres written under it — else the drawing's declaration, cited where it answered.
 */
function zonesOf(columns: readonly Column[], row: ReadonlyMap<number, ScheduleCell>, declared: DeclaredDimensionUnit | null): MemberZone[] {
  const zones: MemberZone[] = [];
  const held = new Set<RebarZone>();

  for (const column of columns) {
    if (column.role.kind !== "zone" || held.has(column.role.zone)) continue;
    const cell = row.get(column.index);
    if (cell === undefined) continue;
    held.add(column.role.zone);
    const spacing = parseSpacing(cell.text);
    const measured = unitOf(spacing, column.header, declared);
    zones.push({
      zone: column.role.zone,
      text: cell.text,
      bars: parseRebarGroups(cell.text),
      spacing: spacing === null ? null : spacing.spacing,
      spacingUnit: measured.unit,
      spacingBar: spacing === null ? null : spacing.bar,
      sourceKeys: [...cell.sourceKeys, ...measured.cited],
    });
  }

  return zones;
}

/**
 * The variants one row carries: one per band of floors the header names, each with the section that
 * band's own cell states and the row's rebar beneath it. The zones are the ROW's — a schedule states
 * one set of bars for the mark and a section per band, so every variant of the row carries the same
 * rebar until a drawing says otherwise (R-TO-031).
 */
function variantsOf(
  columns: readonly Column[],
  row: ReadonlyMap<number, ScheduleCell>,
  zones: readonly MemberZone[],
  stated: Column | null,
  banded: Column | null,
  markCell: ScheduleCell,
  declared: DeclaredDimensionUnit | null,
): MemberVariant[] {
  const variants: MemberVariant[] = [];
  const held = new Set<string>();

  for (const column of columns) {
    if (column.role.kind !== "band") continue;
    const variantKey = variantKeyOf(column.role.band);
    if (held.has(variantKey)) continue;
    const cell = row.get(column.index);
    if (cell === undefined) continue;
    held.add(variantKey);
    variants.push(variantOf({ variantKey, bandText: column.header, band: column.role.band, cell, zones, unitHeader: column.header, declared }));
  }

  // A schedule that heads its section column by what it measures rather than by a band of floors —
  // `SIZE`, the shape a beam schedule is drawn in — states the same facts about the same member. Its
  // row carries ONE variant, under the column that states the section, so the section and the rebar
  // the row states reach the registry rather than being read and dropped (R-TO-031, L-QTY-04).
  if (variants.length > 0) return variants;
  // Whatever stands in that column is the section this row states — `12"x15" (TYP)` and `SEE DETAIL`
  // alike. A cell the parsers cannot read is kept verbatim with a null section rather than dropped,
  // because dropping it would drop the row's rebar with it (R-TO-031).
  const cell = stated === null ? undefined : row.get(stated.index);

  // The band this row's own LEVELS cell states, where it states one. The unit is still the SECTION
  // column's to state, because that is the column the numbers were written under (L-MEA-01).
  const bandCell = banded === null ? undefined : row.get(banded.index);
  const band = bandCell === undefined ? null : parseFloorZone(bandCell.text);

  // A row with NO cell at all in the section column — and a family whose schedule states its sections
  // in no column — still stands for the member its mark names and still states the rebar drawn beside
  // it. One variant carrying a null section keeps that rebar; registering none drops the drawing's own
  // bars along with the section nobody wrote (R-TO-031, L-QTY-02). What such a variant CITES is the
  // row it was read from — the band cell where one states the band, else the mark cell that names the
  // member — because a registry row that cites nothing is unsourced, and the store refuses it whole
  // (`member_type_variants_cited`; L-QTY-03). F-RCC6-BNBC's pile-cap schedule leaves the SECTION cell
  // of PC3 and S3 blank, and a rebuild that wrote them uncited stored no partition at all.
  if (stated === null || cell === undefined) {
    return [
      {
        variantKey: band === null ? columnKeyOf(stated?.header ?? "") : variantKeyOf(band),
        bandText: band === null ? (stated?.header ?? "") : (bandCell as ScheduleCell).text,
        bandFrom: band === null ? null : band.from,
        bandTo: band === null ? null : band.to,
        sectionText: "",
        sectionWidth: null,
        sectionDepth: null,
        sectionUnit: null,
        sourceKeys: bandCell === undefined ? [...markCell.sourceKeys] : [...bandCell.sourceKeys],
        zones: zones.map((zone) => ({ ...zone })),
      },
    ];
  }

  if (band === null || bandCell === undefined) {
    return [variantOf({ variantKey: columnKeyOf(stated.header), bandText: stated.header, band: null, cell, zones, unitHeader: stated.header, declared })];
  }
  // Two cells were read to state one variant, so both are cited: the semantic a rebuild compares
  // carries the evidence a row was read from, and a band read at a cell nobody cited is unsourced
  // (L-QTY-03, L-REG-04). The section's cell stays first — it is the reading the section is read at.
  return [
    {
      ...variantOf({ variantKey: variantKeyOf(band), bandText: bandCell.text, band, cell, zones, unitHeader: stated.header, declared }),
      // The declaration, where the unit was read off one, is cited beside both cells for the reason
      // they are: a unit read off the general notes is evidence from the general notes (I-302).
      sourceKeys: [...cell.sourceKeys, ...bandCell.sourceKeys, ...unitOf(sectionOf(cell.text), stated.header, declared).cited],
    },
  ];
}

/**
 * The unit one section — or one dimension beside it (I-322), or one rebar zone's spacing (I-412) —
 * is measured in, and what that reading CITES (R-TO-031, I-302). One reading for all three, because a
 * drawing that says `ALL DIMENSIONS ARE IN MILLIMETRES` says it of the centres its ties are written
 * at as plainly as of the sides of the column they tie (B-17).
 *
 * Three statements, nearest first. The cell's own mark is the nearest — `12"x24"` is in inches
 * wherever it stands, which is what F-RCC6-BNBC's T-NOT-SIZE-IN turns on and what the drawing's own
 * `FIGURED DIMENSIONS GOVERN` says. The column's head is next: a schedule states its unit once, over
 * the column, and writes bare numbers under it. The drawing's DECLARATION is last and applies only
 * to a pair that states none and stands under a head that states none — the general note is the
 * whole drawing's word, and the nearer statement always outranks it.
 *
 * A declaration is cited only where it ANSWERED. A variant whose column was headed `SIZE (mm)` was
 * not read off S-01, and citing S-01 there would put evidence under a figure it took no part in
 * (L-QTY-03).
 */
export function unitOf(section: Pick<SizePair, "unit"> | null, unitHeader: string, declared: DeclaredDimensionUnit | null): { unit: SectionUnit | null; cited: readonly string[] } {
  if (section === null) return { unit: null, cited: [] };
  const nearer = section.unit ?? sectionUnitOfHeader(unitHeader);
  if (nearer !== null) return { unit: nearer, cited: [] };
  return declared === null ? { unit: null, cited: [] } : { unit: declared.unit, cited: [declared.sourceKey] };
}

/**
 * The column of an unbanded header whose CELLS state each row's band — a `LEVELS` column, the second
 * place a schedule states a band (R-TO-031, L-FRM-02: "a banded vertical prices each band's own
 * section × count"). It is neither the mark, a rebar zone nor the section column, and it is chosen
 * once over the whole table for the reason the section column is: a column is what it is for every
 * row. The first such column wins, so a table with two of them reads one way every time (L-REG-04).
 */
function levelsColumnOf(columns: readonly Column[], rows: readonly [number, Map<number, ScheduleCell>][], stated: Column | null): Column | null {
  return (
    columns.find(
      (column) =>
        column.role.kind === "none" &&
        column.index !== stated?.index &&
        rows.some((row) => {
          const cell = row[1].get(column.index);
          return cell !== undefined && parseFloorZone(cell.text) !== null;
        }),
    ) ?? null
  );
}

/**
 * The section ONE cell states. A cell says as many things as the drawing wrote in it, joined by the
 * notation's own sign, and the section is whichever of them reads as a pair of sides: a schedule that
 * stacks `400x400` over `8-16Ø` over `10Ø@100/150 (TIES)` in one cell states the same section as one
 * that writes it in a column of its own, and the section column's own reading must not depend on how
 * many lines the draughtsman stacked in the cell (L-CAD-08).
 */
export function sectionOf(text: string): SizePair | null {
  for (const part of cellParts(text)) {
    const stated = parseSizePair(part);
    if (stated !== null) return stated;
  }
  return null;
}

/**
 * The rebar ONE cell states, which is the rebar of the BAND that cell stands under — L-CAD-08 puts
 * "rebar zones per band", and a stacked schedule writes each band's bars and ties inside the band's
 * own cell rather than in columns of its own (F-RCC6-BNBC S-11). Each part of the cell answers the
 * question it can: a part naming groups of bars is the main steel, a part stating two centres is the
 * end zones and the middle, a part stating one is the ties.
 *
 * A zone stated twice is read from the first part that states it: the store holds one row per zone of
 * one variant, and a second reading of the same zone is a competing opinion rather than more of the
 * answer. A cell that states none of them — an ordinary `300 x 450` — answers none, and the row's own
 * rebar columns stand where they always did.
 *
 * A spacing's unit is the part's own mark (a two-centre pair's two sides read as one mark, as a
 * section's are — `pairUnitOf`), else the head of the column the CELL stands under — the
 * one its section's unit is read under too, because it is one cell under one head — else the drawing's
 * declaration, cited beside the cell where it answered (I-412, I-302). S-11 writes `10Ø@100/150
 * (TIES)` under `GF TO 2ND`: no unit in the cell, none over the column, and S-01's `ALL DIMENSIONS ARE
 * IN MILLIMETRES` is the statement that says what the 100 and the 150 are.
 */
function zonesInCell(cell: ScheduleCell, unitHeader: string, declared: DeclaredDimensionUnit | null): MemberZone[] {
  const zones: MemberZone[] = [];
  const held = new Set<RebarZone>();
  const cited = [...cell.sourceKeys];
  const spaced = (said: Pick<SizePair, "unit">): { unit: SectionUnit | null; sourceKeys: string[] } => {
    const measured = unitOf(said, unitHeader, declared);
    return { unit: measured.unit, sourceKeys: [...cited, ...measured.cited] };
  };

  for (const part of cellParts(cell.text)) {
    const banded = parseZonedSpacing(part);
    if (banded !== null) {
      // The pair is read as ONE statement before any farther one is asked: `@4/6"` is four inches and
      // six, never four of whatever the notes declare. A pair that contradicts itself has no unit, and
      // no head or declaration may settle it for it (`pairUnitOf`).
      const pair = pairUnitOf(banded);
      const measured = pair.disagrees ? { unit: null, sourceKeys: [...cited] } : spaced(pair);
      for (const one of banded) {
        if (held.has(one.zone)) continue;
        held.add(one.zone);
        zones.push({ zone: one.zone, text: part, bars: parseRebarGroups(part), spacing: one.spacing, spacingUnit: measured.unit, spacingBar: one.bar, sourceKeys: [...measured.sourceKeys] });
      }
      continue;
    }
    const bars = parseRebarGroups(part);
    if (bars !== null) {
      if (held.has(REBAR_ZONE.main)) continue;
      held.add(REBAR_ZONE.main);
      zones.push({ zone: REBAR_ZONE.main, text: part, bars, spacing: null, spacingUnit: null, spacingBar: null, sourceKeys: [...cited] });
      continue;
    }
    const spacing = parseSpacing(part);
    if (spacing === null || held.has(REBAR_ZONE.ties)) continue;
    held.add(REBAR_ZONE.ties);
    const measured = spaced(spacing);
    zones.push({ zone: REBAR_ZONE.ties, text: part, bars: null, spacing: spacing.spacing, spacingUnit: measured.unit, spacingBar: spacing.bar, sourceKeys: measured.sourceKeys });
  }

  return zones;
}

/**
 * The unit a two-centre pair (`10Ø@100/150 (TIES)`) states for BOTH its zones, read the way a
 * section's pair is (`parseSizePair`, I-302's "a pair that states its own unit keeps it"): one side
 * stating a unit states it for the pair, and a pair that states none leaves the head and the
 * declaration to answer (I-412). Read side by side instead, `12"x15"+8-16Ø+10Ø@4/6" (TIES)` under
 * S-01's millimetres stood its end zone at 4 mm beside a 6 in middle — a factor of twenty-five, with
 * the note cited as its evidence.
 *
 * Two sides stating DIFFERENT units (`@4"/150MM`) state no one unit, and `disagrees` says so: the
 * cell's own statement contradicts itself, which is not silence, and filling it from a farther
 * statement would read one side at a unit its own draughtsman overruled. Both zones keep their
 * figures, no unit and no citation, and the rail omits them by name (L-MEA-01, L-QTY-01).
 */
function pairUnitOf(pair: readonly Pick<SizePair, "unit">[]): { unit: SectionUnit | null; disagrees: boolean } {
  const stated = new Set(pair.map((side) => side.unit).filter((unit): unit is SectionUnit => unit !== null));
  if (stated.size > 1) return { unit: null, disagrees: true };
  const [unit] = stated;
  return { unit: unit ?? null, disagrees: false };
}

/**
 * The column of an unbanded header that states the schedule's sections: the first that is neither the
 * mark nor a rebar zone and whose cell reads as a section ANYWHERE in the table. Chosen from the
 * whole table because a column is the section column for every row or for none, and one row's `-`
 * says nothing about the column.
 *
 * A table no unbanded column of which EVER reads as a section states its sections nowhere: taking the
 * leftmost one regardless would read a remarks or a count column as the schedule's sections, and
 * `SEE ARCH DETAIL` would stand where a member's dimensions belong (L-QTY-01: never a guess).
 */
function sectionColumnOf(columns: readonly Column[], rows: readonly [number, Map<number, ScheduleCell>][]): Column | null {
  const unbanded = columns.filter((column) => column.role.kind === "none");
  return (
    unbanded.find((column) =>
      rows.some((row) => {
        const cell = row[1].get(column.index);
        return cell !== undefined && sectionOf(cell.text) !== null;
      }),
    ) ?? null
  );
}

/**
 * The key an unbanded column's variants stand under: the header folded to the shape a band key takes
 * (`SIZE (mm)` → `SIZE-MM`), because the key is a component of the store's primary key and a header's
 * case and punctuation must not be able to key one column two ways.
 */
function columnKeyOf(header: string): string {
  const key = normaliseNotation(header).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return key === "" ? "SECTION" : key;
}

/**
 * One variant row: the band or the column it is keyed by, the section that column's cell states —
 * verbatim beside what it parses to — and the row's own rebar beneath it (R-TO-031).
 */
function variantOf(read: {
  variantKey: string;
  bandText: string;
  band: FloorBand | null;
  cell: ScheduleCell;
  zones: readonly MemberZone[];
  /** The header of the column the SECTION cell was written under — where a stated unit is read. */
  unitHeader: string;
  /** The unit the DRAWING declares, where its own texts declare one — the last word, never the first. */
  declared: DeclaredDimensionUnit | null;
}): MemberVariant {
  const { variantKey, bandText, band, cell, zones } = read;
  const section = sectionOf(cell.text);
  const measured = unitOf(section, read.unitHeader, read.declared);
  // The band's own rebar stands before the row's: a cell that states the ties of ITS band states them
  // for that band, and a rebar column heads the same zone for every band of the row. Where the cell
  // states a zone the columns also state, the nearer statement is the cell's (R-TO-031). Its spacings
  // are read under the same head and the same declaration the section is (I-412).
  const stated = zonesInCell(cell, read.unitHeader, read.declared);
  const held = new Set(stated.map((zone) => zone.zone));
  return {
    variantKey,
    bandText,
    bandFrom: band === null ? null : band.from,
    bandTo: band === null ? null : band.to,
    // The cell verbatim, however many lines the draughtsman stacked inside it (L-CAD-08).
    sectionText: cell.text,
    sectionWidth: section === null ? null : section.width,
    sectionDepth: section === null ? null : section.depth,
    // The cell's own unit where it wrote one, else the one its column is headed with, else the one
    // the DRAWING declares: a schedule states its unit once over the column and writes bare numbers
    // under it, and a drawing that heads no column at all still said it in its notes (R-TO-031,
    // I-302).
    sectionUnit: measured.unit,
    sourceKeys: [...cell.sourceKeys, ...measured.cited],
    zones: [...stated, ...zones.filter((zone) => !held.has(zone.zone)).map((zone) => ({ ...zone }))],
  };
}

/** The key one variant stands under: the two levels its band runs between (AC-5). */
export function variantKeyOf(band: FloorBand): string {
  return `${band.from}-${band.to}`;
}
