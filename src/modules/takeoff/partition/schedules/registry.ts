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
import type { RebarZone, ScheduleDimension, SectionUnit } from "@/core/db";
import { REFUSALS } from "@/core/errors";
import type { ConventionProfile, DeclaredDimensionUnit } from "@/core/rulesets/methods/conventions/resolve";
import {
  DIMENSION,
  REBAR_ZONE,
  cellParts,
  dimensionOfHeader,
  isMarkFamily,
  isMarkHeader,
  isPlacedNumberHeader,
  normaliseMark,
  normaliseNotation,
  parseFigure,
  parseFloorZone,
  parseRebarGroups,
  parseSizePair,
  parseSpacing,
  parseWholeNumber,
  parseZonedSpacing,
  rebarZoneOfHeader,
  sectionUnitOfHeader,
  type FloorBand,
  type RebarGroup,
  type SizePair,
} from "../notation";
import { classOfFamily, classOfPrefix } from "../placement/law";
import type { ScheduleCell, ScheduleDeferralRow, ScheduleTable } from "./reconstruct";

/** The rebar one zone column states for one row: the cell verbatim, and what it reads as. */
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
 * One dimension a row states BESIDE its section (Interpretation I-315): which of the roster it is,
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
   * only where the row states one its class is read for (I-315). Absent rather than empty, so a
   * registry of a drawing that states none is the registry it always was.
   */
  readonly dimensions?: MemberDimension[];
};

/**
 * What a BARE-PREFIX row's `NOS` cell states: the number of its members the row says the plans hold
 * (I-314). CORROBORATION, and nothing else: placement checks the plans against it before the prefix
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
  /** A bare-prefix row's `NOS` cell, where it states one (I-314) — absent on every other family. */
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
export function registerMemberTypes(tables: readonly ScheduleTable[], conventions?: ConventionProfile | null): RegisteredMemberTypes {
  const families: MemberFamily[] = [];
  const deferrals: ScheduleDeferralRow[] = [];
  // The drawing's own declaration, where the conventions stage resolved one. It is handed in rather
  // than read here because the profile is one drawing's reading and this function is pure over the
  // tables — the stage that resolved it is the stage that knows (I-302, L-CAD-08).
  const declared = conventions?.dimensionUnit ?? null;

  for (const table of tables) {
    const minted = familiesOf(table, declared);
    if (minted.length === 0) {
      deferrals.push({ viewKey: table.viewKey, reason: REFUSALS.SCHEDULE_VIEW_CONTRIBUTED_NOTHING.code });
      continue;
    }
    families.push(...minted);
  }

  return { families, deferrals };
}

/** The families one table names, in the order its rows name them. */
function familiesOf(table: ScheduleTable, declared: DeclaredDimensionUnit | null): MemberFamily[] {
  const columns = columnsOf(table);
  const mark = columns.find((column) => column.role.kind === "mark");
  // The mark column is what makes a table a schedule OF something: with none, no row of it names a
  // member, and every cell in it is a dimension or a note (AC-1).
  if (mark === undefined) return [];

  const families: MemberFamily[] = [];
  const minted = new Set<string>();
  const rows = rowsOf(table);
  // The unbanded section column is the TABLE's, chosen once over all its rows: a column is what it is
  // for every row of the schedule, and choosing it per row would key one table's variants two ways.
  const stated = sectionColumnOf(columns, rows);
  // The levels column is the TABLE's for the same reason. A schedule states a band in one of two
  // places and this is the second: over the column (`GF TO 5F` heads the sections carried there) or
  // in a cell of a LEVELS column, one row per mark, written beside that mark's section (R-TO-031).
  const banded = levelsColumnOf(columns, rows, stated);

  for (const [rowIndex, row] of rows) {
    const markCell = row.get(mark.index);
    if (markCell === undefined) continue;
    // A bare class prefix — `P` over a plan that numbers its piles `P1`…`P89` — names the TYPE of
    // those members, so it is a family too (I-314). Whether it may name any of them is placement's
    // question, asked against the plans; here it is only read.
    const bare = !isMarkFamily(markCell.text) && classOfPrefix(markCell.text) !== null;
    if (!isMarkFamily(markCell.text) && !bare) continue;
    const family = normaliseMark(markCell.text);
    // One row per mark family: a mark drawn twice in one schedule is one member type, read from the
    // first row that names it (riskNotes (3)).
    if (minted.has(family)) continue;
    minted.add(family);

    const zones = zonesOf(columns, row);
    const variants = variantsOf(columns, row, zones, stated, banded, markCell, declared);
    // The row's dimensions are the ROW's, as its rebar columns are: every variant carries them.
    const dimensions = dimensionsOf(columns, row, family, declared);
    const corroboration = bare ? placedNumberOf(columns, row) : undefined;
    families.push({
      scheduleKey: table.scheduleKey,
      family,
      markText: markCell.text,
      rowIndex,
      sourceKeys: [...markCell.sourceKeys],
      variants: dimensions.length === 0 ? variants : variants.map((variant) => ({ ...variant, dimensions: dimensions.map((one) => ({ ...one, sourceKeys: [...one.sourceKeys] })) })),
      ...(corroboration === undefined ? {} : { corroboration }),
    });
  }

  return families;
}

/**
 * The dimensions a family's class is read for (I-315): the names its methods bind a figure of the
 * schedule by. A pile is bored to a diameter and a length (AM-06 §2), so those two are read for it.
 *
 * Read PER CLASS, never off any column that happens to be headed so, because the same head states
 * different things of different tables: F-RCC6-BNBC's BAR BENDING SCHEDULE heads a column `DIA` over
 * the diameter of a BAR, and the member it files that bar under is a pile cap — whose diameter no
 * method asks for. A foundation's DEPTH is not read yet: its plan must be the outline's before its
 * depth is the schedule's, or F-RCC6-BNBC's pile caps would bill a schedule rectangle as their
 * volume (FND-2), and F-RCC6's FOOTING SCHEDULE would start billing on a fixture byte-frozen at v1.1.
 */
const DIMENSIONS_READ: Readonly<Partial<Record<ElementType, readonly ScheduleDimension[]>>> = Object.freeze({
  pile: Object.freeze([DIMENSION.dia, DIMENSION.length]),
});

/**
 * The dimensions one row states for its family, in the order its columns stand: each read from the
 * column whose head names it (`dimensionOfHeader`), as a figure (`parseFigure`), in the unit the cell
 * wrote, else the unit its head states, else the unit the drawing declares (I-302) — the same three
 * statements, nearest first, a section's unit is read from (`unitOf`). A cell with no figure, and a
 * figure nobody gave a unit to, is no dimension: the rail keeps its row and names what is missing
 * (L-QTY-02).
 */
function dimensionsOf(columns: readonly Column[], row: ReadonlyMap<number, ScheduleCell>, family: string, declared: DeclaredDimensionUnit | null): MemberDimension[] {
  const type = classOfFamily(family);
  const admitted = type === null ? [] : (DIMENSIONS_READ[type] ?? []);
  const read: MemberDimension[] = [];
  if (admitted.length === 0) return read;
  for (const column of columns) {
    if (column.role.kind !== "none") continue;
    const dimension = dimensionOfHeader(column.header);
    if (dimension === null || !admitted.includes(dimension) || read.some((one) => one.dimension === dimension)) continue;
    const cell = row.get(column.index);
    const figure = cell === undefined ? null : parseFigure(cell.text);
    if (cell === undefined || figure === null || !(figure.value > 0)) continue;
    const measured = unitOf(figure, column.header, declared);
    if (measured.unit === null) continue;
    read.push({ dimension, text: cell.text, value: figure.value, unit: measured.unit, sourceKeys: [...cell.sourceKeys, ...measured.cited] });
  }
  return read;
}

/** The number a bare-prefix row's `NOS` cell states, where it states one (I-314) — corroboration only. */
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
 */
function zonesOf(columns: readonly Column[], row: ReadonlyMap<number, ScheduleCell>): MemberZone[] {
  const zones: MemberZone[] = [];
  const held = new Set<RebarZone>();

  for (const column of columns) {
    if (column.role.kind !== "zone" || held.has(column.role.zone)) continue;
    const cell = row.get(column.index);
    if (cell === undefined) continue;
    held.add(column.role.zone);
    const spacing = parseSpacing(cell.text);
    zones.push({
      zone: column.role.zone,
      text: cell.text,
      bars: parseRebarGroups(cell.text),
      spacing: spacing === null ? null : spacing.spacing,
      spacingUnit: spacing === null ? null : spacing.unit,
      spacingBar: spacing === null ? null : spacing.bar,
      sourceKeys: [...cell.sourceKeys],
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
 * The unit one section — or one dimension beside it (I-315) — is measured in, and what that reading
 * CITES (R-TO-031, I-302).
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
function unitOf(section: Pick<SizePair, "unit"> | null, unitHeader: string, declared: DeclaredDimensionUnit | null): { unit: SectionUnit | null; cited: readonly string[] } {
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
function sectionOf(text: string): SizePair | null {
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
 */
function zonesInCell(cell: ScheduleCell): MemberZone[] {
  const zones: MemberZone[] = [];
  const held = new Set<RebarZone>();
  const cited = [...cell.sourceKeys];

  for (const part of cellParts(cell.text)) {
    const banded = parseZonedSpacing(part);
    if (banded !== null) {
      for (const one of banded) {
        if (held.has(one.zone)) continue;
        held.add(one.zone);
        zones.push({ zone: one.zone, text: part, bars: parseRebarGroups(part), spacing: one.spacing, spacingUnit: one.unit, spacingBar: one.bar, sourceKeys: [...cited] });
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
    zones.push({ zone: REBAR_ZONE.ties, text: part, bars: null, spacing: spacing.spacing, spacingUnit: spacing.unit, spacingBar: spacing.bar, sourceKeys: [...cited] });
  }

  return zones;
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
  // states a zone the columns also state, the nearer statement is the cell's (R-TO-031).
  const stated = zonesInCell(cell);
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
