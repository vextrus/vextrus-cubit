// R-TO-031's member-type registry: the tables a drawing's schedules yielded, folded into one row per
// mark family — "member-type registry from schedules (sections, rebar zones)".
//
// What a member IS, and never how many stand. A schedule states the section a mark carries over a
// band of floors and the rebar it carries there; how many of that member the building holds is read
// off the layout plans by placement, and a registry that answered it would be answering a question
// the schedule never asked (R-TO-031).
//
// One family is one MARK (riskNotes (3)): `C-1`, `c1.` and `C 1` are the family `C1`, the variants
// beneath it are the per-band readings of that mark, and the rebar zones beneath those are the
// main/ties columns read against each variant. A family per alphabetic prefix would fold every
// column of a drawing into one row and make the registry useless to placement.
//
// Noise is never a family: a note, a dash and a dimension standing in the mark column name no
// member, and a table none of whose rows names one contributes nothing rather than a guess (L-QTY-04).
//
// Pure over the tables: no store, no clock, no model (L-REG-04).
import type { RebarZone, SectionUnit } from "@/core/db";
import { REFUSALS } from "@/core/errors";
import { isMarkFamily, isMarkHeader, normaliseMark, normaliseNotation, parseFloorZone, parseRebarGroups, parseSizePair, parseSpacing, rebarZoneOfHeader, type FloorBand, type RebarGroup } from "../notation";
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
};

/** One mark family of one schedule, with the variants and the rebar beneath it. */
export type MemberFamily = {
  readonly scheduleKey: string;
  readonly family: string;
  /** The mark cell's own spelling, kept verbatim beside the family it normalises to. */
  readonly markText: string;
  readonly rowIndex: number;
  readonly sourceKeys: string[];
  readonly variants: MemberVariant[];
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
 */
export function registerMemberTypes(tables: readonly ScheduleTable[]): RegisteredMemberTypes {
  const families: MemberFamily[] = [];
  const deferrals: ScheduleDeferralRow[] = [];

  for (const table of tables) {
    const minted = familiesOf(table);
    if (minted.length === 0) {
      deferrals.push({ viewKey: table.viewKey, reason: REFUSALS.SCHEDULE_VIEW_CONTRIBUTED_NOTHING.code });
      continue;
    }
    families.push(...minted);
  }

  return { families, deferrals };
}

/** The families one table names, in the order its rows name them. */
function familiesOf(table: ScheduleTable): MemberFamily[] {
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

  for (const [rowIndex, row] of rows) {
    const markCell = row.get(mark.index);
    if (markCell === undefined || !isMarkFamily(markCell.text)) continue;
    const family = normaliseMark(markCell.text);
    // One row per mark family: a mark drawn twice in one schedule is one member type, read from the
    // first row that names it (riskNotes (3)).
    if (minted.has(family)) continue;
    minted.add(family);

    const zones = zonesOf(columns, row);
    families.push({
      scheduleKey: table.scheduleKey,
      family,
      markText: markCell.text,
      rowIndex,
      sourceKeys: [...markCell.sourceKeys],
      variants: variantsOf(columns, row, zones, stated),
    });
  }

  return families;
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
function variantsOf(columns: readonly Column[], row: ReadonlyMap<number, ScheduleCell>, zones: readonly MemberZone[], stated: Column | null): MemberVariant[] {
  const variants: MemberVariant[] = [];
  const held = new Set<string>();

  for (const column of columns) {
    if (column.role.kind !== "band") continue;
    const variantKey = variantKeyOf(column.role.band);
    if (held.has(variantKey)) continue;
    const cell = row.get(column.index);
    if (cell === undefined) continue;
    held.add(variantKey);
    variants.push(variantOf(variantKey, column.header, column.role.band, cell, zones));
  }

  // A schedule that heads its section column by what it measures rather than by a band of floors —
  // `SIZE`, the shape a beam schedule is drawn in — states the same facts about the same member. Its
  // row carries ONE variant, under the column that states the section, so the section and the rebar
  // the row states reach the registry rather than being read and dropped (R-TO-031, L-QTY-04).
  if (variants.length > 0) return variants;
  if (stated === null) return [];
  const cell = row.get(stated.index);
  // Whatever stands in that column is the section this row states — `12"x15" (TYP)` and `SEE DETAIL`
  // alike. A cell the parsers cannot read is kept verbatim with a null section rather than dropped,
  // because dropping it would drop the row's rebar with it (R-TO-031).
  return cell === undefined ? [] : [variantOf(columnKeyOf(stated.header), stated.header, null, cell, zones)];
}

/**
 * The column of an unbanded header that states the schedule's sections: the first that is neither the
 * mark nor a rebar zone and whose cell reads as a section ANYWHERE in the table, falling back to the
 * first unbanded column when none of them ever parses. Chosen from the whole table because a column
 * is the section column for every row or for none, and one row's `-` says nothing about the column.
 */
function sectionColumnOf(columns: readonly Column[], rows: readonly [number, Map<number, ScheduleCell>][]): Column | null {
  const unbanded = columns.filter((column) => column.role.kind === "none");
  const parses = unbanded.find((column) => rows.some((row) => {
    const cell = row[1].get(column.index);
    return cell !== undefined && parseSizePair(cell.text) !== null;
  }));
  return parses ?? unbanded[0] ?? null;
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
function variantOf(variantKey: string, bandText: string, band: FloorBand | null, cell: ScheduleCell, zones: readonly MemberZone[]): MemberVariant {
  const section = parseSizePair(cell.text);
  return {
    variantKey,
    bandText,
    bandFrom: band === null ? null : band.from,
    bandTo: band === null ? null : band.to,
    sectionText: cell.text,
    sectionWidth: section === null ? null : section.width,
    sectionDepth: section === null ? null : section.depth,
    sectionUnit: section === null ? null : section.unit,
    sourceKeys: [...cell.sourceKeys],
    zones: zones.map((zone) => ({ ...zone })),
  };
}

/** The key one variant stands under: the two levels its band runs between (AC-5). */
export function variantKeyOf(band: FloorBand): string {
  return `${band.from}-${band.to}`;
}
