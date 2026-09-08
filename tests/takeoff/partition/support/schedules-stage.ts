/**
 * The mechanics the fourth partition stage is graded on (R-TO-030, R-TO-031, L-CAD-08).
 *
 * Mechanics only — nothing here judges the product. The database, the storage root, the accounts, the
 * recorded drawing and the stand-in for the `cad/` CLI all come from the stage the stored partition
 * already runs on (`./partition-stage`), so this file adds exactly what a schedule needs beyond a
 * partitioned ingest: artifacts whose MODEL SPACE really carries a gridless schedule table — a
 * caption, a leading note, a header band and data bands stacked at a fixed pitch — the doors the
 * criteria drive, and the store reads they are graded by.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one the increment's interfaces, its test
 * contract or the Bible publishes. What this file DECLARES — the module homes, the call shapes and
 * the reading of `source_keys` — is the public test contract the hidden set is measured against too
 * (B-12): a Builder who reads only this file and the spec can pass every case.
 */
import { expect } from "vitest";
import { ROLE_APP, TENANT_COLUMN } from "../../../../db/__tests__/support/fixtures";
import { ident, lit } from "../../../../db/__tests__/support/live-sql";
import {
  INGEST_JOB_MODULE,
  INGEST_MODULE,
  MODEL_SPACE,
  PAPER_SPACE,
  PARTITION_MODULE,
  productModule,
  rebuildDoor,
  sql,
  sqlValue,
  stepSink,
  storageOf,
  tempDir,
  unique,
  viewsLaw,
  type JsonValue,
  type Person,
  type ProgressLike,
  type StagedDrawing,
  type StepRecord,
} from "./partition-stage";
import { stageDrawing, stubCli, withCadCommand } from "../../support/ingest-stage";

export { MODEL_SPACE, PAPER_SPACE };

/* ------------------------------------------------------------------ the homes the spec names */

/** The door the overlay, placement and the rails read stored schedules through (test contract). */
export const SCHEDULES_DOOR_MODULE = PARTITION_MODULE;

/** The pure reconstructor (increment interfaces). */
export const RECONSTRUCT_MODULE = "src/modules/takeoff/partition/schedules/reconstruct.ts";

/** The pure registry — the reconstructor's own neighbour, the way the grid's detector and store are. */
export const REGISTRY_MODULE = "src/modules/takeoff/partition/schedules/registry.ts";

/** The stage's own store, which the partition's one rewrite transaction calls (test contract). */
export const SCHEDULES_STORE_MODULE = "src/modules/takeoff/partition/schedules/store.ts";

/** The notation parsers, exported for placement, the levels proposal and the rails to reuse (AC-6). */
export const NOTATION_MODULE = "src/modules/takeoff/partition/notation/index.ts";

/** The views stage, which the pure half of AC-1 is handed the evidence of. */
export const VIEWS_ASSIGN_MODULE = "src/modules/takeoff/partition/views/assign.ts";

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The stage this increment adds, the stage it runs after, and the step that says it was written. */
export const SCHEDULES_STAGE = "schedules";
export const GRID_STAGE = "grid";
export const STORED_STEP = "stored";

/** The six tables a reconstructed schedule and its registry land in (AC-4). */
export const SCHEDULES = "schedules";
export const SCHEDULE_CELLS = "schedule_cells";
export const MEMBER_TYPES = "member_types";
export const MEMBER_TYPE_VARIANTS = "member_type_variants";
export const REBAR_ZONES_TABLE = "rebar_zones";
export const SCHEDULE_DEFERRALS = "schedule_deferrals";

/** All six, in the order a rewrite has to leave them consistent in. */
export const SCHEDULE_TABLES: readonly string[] = [SCHEDULES, SCHEDULE_CELLS, MEMBER_TYPES, MEMBER_TYPE_VARIANTS, REBAR_ZONES_TABLE, SCHEDULE_DEFERRALS];

/** The two closed reasons a schedule view defers under (AC-7, riskNotes (2)). */
export const SCHEDULE_NONE_RECONSTRUCTED = "SCHEDULE_NONE_RECONSTRUCTED";
export const SCHEDULE_VIEW_CONTRIBUTED_NOTHING = "SCHEDULE_VIEW_CONTRIBUTED_NOTHING";

/**
 * Where the closed list of those two is published (test contract: `SCHEDULE_DEFERRAL_REASONS`). The
 * module's own door: a deferral reason is what `schedulesOf` answers and what an overlay renders, so
 * it stands where the callers of that door already look, beside the reasons of the stage before it.
 */
export const SCHEDULE_DEFERRAL_REASONS_HOME = PARTITION_MODULE;

/** The four zones a rebar column reads as (AC-4's CHECK, AC-6's `rebarZoneOfHeader`). */
export const ZONE_MAIN = "main";
export const ZONE_TIES = "ties";
export const ZONE_TIES_END = "ties-end";
export const ZONE_TIES_MID = "ties-mid";

/**
 * The words a member count would be spelled with. No column, no answered key and no step detail may
 * carry one: a schedule says what a member IS, and how many there are is placement's answer, read off
 * the layout plans (R-TO-031, AC-3, AC-8).
 */
export const COUNT_WORDS: readonly string[] = ["count", "members", "nos", "quantity"];

/** The two captions every artifact is drawn around, and the classes the grammar reads them as. */
export const CAPTION_SCHEDULE = "COLUMN SCHEDULE";
export const CAPTION_PLAN = "TYPICAL FLOOR PLAN";
export const SCHEDULE = "SCHEDULE";
export const LAYOUT_PLAN = "LAYOUT_PLAN";

/**
 * The heights the artifacts are drawn at. A caption is the big text on the sheet (L-CAD-06), so it
 * stands more than twice as tall as a cell text — a schedule whose cells were captions would be a
 * schedule cut into one view per cell, which is a defect of the ARTIFACT rather than a finding about
 * the product.
 */
export const TEXT_HEIGHT = 2.5;
export const CAPTION_HEIGHT = 8;

/** The pitch every artifact stacks its bands at: the row spacing the 3.5× stop is measured in. */
export const PITCH = 10;

/** The layers the artifacts draw on — census data, never a name anything reads a role off. */
const LAYER_CAPTIONS = "CAPTIONS";
const LAYER_TEXT = "SCHEDULE-TEXT";
const LAYER_LINES = "GRID-LINES";

/** The DXF types the artifacts are built from. */
const TYPE_TEXT = "TEXT";
const TYPE_LINE = "LINE";

/** The five scenarios the criteria are staged over (test contract: fixture scenarios). */
export const SCENARIO = Object.freeze({
  PLAIN: "schedule-plain",
  GAP_INSIDE: "schedule-gap-inside",
  NO_HEADER: "schedule-no-header",
  NOISE_ONLY: "schedule-noise-only",
  LOOKALIKES: "schedule-lookalikes",
} as const);

/** One of the five. */
export type ScheduleScenario = (typeof SCENARIO)[keyof typeof SCENARIO];

/* ------------------------------------------------------------------ the shapes the doors answer in */

/** One `schedule_cells` row, as the store holds one and as `schedulesOf` answers one (AC-3). */
export type CellRow = { rowIndex: number; columnIndex: number; text: string; sourceKeys: string[] };

/** One `schedules` row, without its cells. */
export type ScheduleRow = { viewKey: string; scheduleKey: string; title: string; pitch: number };

/** One `schedule_deferrals` row: the view that deferred, and why (riskNotes (2)). */
export type ScheduleDeferralRow = { viewKey: string; reason: string };

/** One `rebar_zones` row (AC-4, AC-5). */
export type ZoneRow = {
  zone: string;
  text: string;
  bars: unknown;
  spacing: number | null;
  spacingUnit: string | null;
  spacingBar: number | null;
  sourceKeys: string[];
};

/** One `member_type_variants` row and the zones beneath it (AC-5). */
export type VariantRow = {
  variantKey: string;
  bandText: string;
  bandFrom: string | null;
  bandTo: string | null;
  sectionText: string;
  sectionWidth: number | null;
  sectionDepth: number | null;
  sectionUnit: string | null;
  sourceKeys: string[];
  zones: ZoneRow[];
};

/** One `member_types` row and the variants beneath it (AC-5). */
export type FamilyRow = {
  scheduleKey: string;
  family: string;
  markText: string;
  rowIndex: number;
  sourceKeys: string[];
  variants: VariantRow[];
};

/** What `schedulesOf` answers for a drawing whose partition has been rebuilt (AC-3). */
export type StoredSchedules = { ingestId: string; schedules: unknown[]; deferrals: unknown[] } & Record<string, unknown>;

/** What `memberTypesOf` answers for the same drawing (AC-3). */
export type StoredMemberTypes = { ingestId: string; families: unknown[] } & Record<string, unknown>;

/** The scope every door read is made in. */
export type ScheduleScope = { tenantId: string; projectId: string; drawingId: string };

/** The module door the overlay, placement and the rails read stored schedules through. */
export type ScheduleDoor = {
  schedulesOf: (scope: ScheduleScope) => Promise<StoredSchedules | null>;
  memberTypesOf: (scope: ScheduleScope) => Promise<StoredMemberTypes | null>;
  /** The closed list the `schedule_deferrals.reason` CHECK is the store's half of (test contract). */
  SCHEDULE_DEFERRAL_REASONS?: readonly string[];
};

/** One table the reconstructor answers (increment interfaces: `ScheduleTable`). */
export type ReconstructedTable = {
  viewKey: string;
  scheduleKey: string;
  title: string;
  pitch: number;
  columns: number[];
  cells: CellRow[];
};

/** What `reconstructSchedules` answers (increment interfaces). */
export type Reconstruction = { views: number; tables: ReconstructedTable[]; deferrals: ScheduleDeferralRow[] };

/** The pure reconstructor, as this acceptance calls it (increment interfaces). */
export type ReconstructSeam = {
  reconstructSchedules: (evidence: { graph: unknown; views: readonly unknown[]; assignments: ReadonlyMap<string, string> }) => Reconstruction;
};

/**
 * The pure registry, as this acceptance calls it: the tables the reconstructor answered, folded into
 * one row per mark family, with the views that contributed nothing standing beside them.
 */
export type RegistrySeam = {
  registerMemberTypes: (tables: readonly ReconstructedTable[]) => { families: FamilyRow[]; deferrals: ScheduleDeferralRow[] };
};

/** The stage's own store — called from the partition's ONE rewrite transaction (AC-3). */
export type ScheduleStoreSeam = { rewriteScheduleRows: (...args: never[]) => unknown };

/** A section, as `parseSizePair` reads one (AC-6). */
export type SizePair = { width: number; depth: number; unit: string | null } | null;

/** A spacing, as `parseSpacing` reads one (AC-6). */
export type Spacing = { bar: number | null; spacing: number; unit: string | null } | null;

/** A floor band, as `parseFloorZone` reads one (AC-6). */
export type FloorZone = { from: string; to: string } | null;

/** The notation parsers, every one of them pure and total (AC-6, test contract). */
export type NotationSeam = {
  normaliseNotation: (text: string) => string;
  parseFeetInches: (text: string) => number | null;
  parseSizePair: (text: string) => SizePair;
  parseRebarGroups: (text: string) => { n: number; diameterMm: number }[] | null;
  parseSpacing: (text: string) => Spacing;
  parseFloorZone: (text: string) => FloorZone;
  parseNOf: (text: string) => { n: number; rest: string } | null;
  normaliseMark: (text: string) => string;
  isMarkFamily: (text: string) => boolean;
  isMarkHeader: (text: string) => boolean;
  rebarZoneOfHeader: (text: string) => string | null;
  REBAR_ZONES?: readonly string[];
};

/** The names the notation barrel publishes as functions (test contract: procedures). */
export const NOTATION_CALLS: readonly string[] = [
  "normaliseNotation",
  "parseFeetInches",
  "parseSizePair",
  "parseRebarGroups",
  "parseSpacing",
  "parseFloorZone",
  "parseNOf",
  "normaliseMark",
  "isMarkFamily",
  "isMarkHeader",
  "rebarZoneOfHeader",
];

/* ------------------------------------------------------------------ loading the doors */

/** One door, with the calls this stage makes through it asserted by name before it is used. */
async function doorOf<T>(home: string, calls: readonly string[]): Promise<T> {
  const door = await productModule<Record<string, unknown>>(home);
  for (const call of calls) expect(typeof door[call], `${home} publishes \`${call}\``).toBe("function");
  return door as T;
}

/** The takeoff module's door onto stored schedules and the member-type registry. */
export async function schedulesDoor(): Promise<ScheduleDoor> {
  return doorOf<ScheduleDoor>(SCHEDULES_DOOR_MODULE, ["schedulesOf", "memberTypesOf"]);
}

/** The pure reconstructor. */
export async function reconstructDoor(): Promise<ReconstructSeam> {
  return doorOf<ReconstructSeam>(RECONSTRUCT_MODULE, ["reconstructSchedules"]);
}

/** The pure registry. */
export async function registryDoor(): Promise<RegistrySeam> {
  return doorOf<RegistrySeam>(REGISTRY_MODULE, ["registerMemberTypes"]);
}

/** The stage's own store. */
export async function scheduleStoreDoor(): Promise<ScheduleStoreSeam> {
  return doorOf<ScheduleStoreSeam>(SCHEDULES_STORE_MODULE, ["rewriteScheduleRows"]);
}

/** The notation parsers. */
export async function notationDoor(): Promise<NotationSeam> {
  return doorOf<NotationSeam>(NOTATION_MODULE, NOTATION_CALLS);
}

/* ------------------------------------------------------------------ a hand-authored artifact */

/** A colour every built entity carries: channels, never a spelled colour (the artifact's own shape). */
const CHANNELS = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" };

/** One drawn record of the built artifact, in the shape the mirror validates (L-CAD-05). */
export type Drawn = { key: string; type: string; space: string; layer: string; text?: string; height?: number; points?: number[][] };

/** What a band of the drawing is: the leading note, the header, a data row, or the trailing note. */
export type BandRole = "leading" | "header" | "data" | "trailing";

/** One text of one cell: what it says, and how far off the band's own y it is drawn (AC-2). */
type TextDraw = { text: string; dy?: number };

/** One cell of one band: where its column stands, and the text or texts drawn in it. */
type CellDraw = { x: number; texts: readonly TextDraw[] };

/** One band of the drawing: its y, what it is, and the cells drawn across it. */
type BandDraw = { y: number; role: BandRole; cells: readonly CellDraw[] };

/** One cell as it was really drawn: the two stacked texts of AC-2 are one cell, joined top text first. */
export type BuiltCell = { x: number; text: string; keys: string[] };

/** One band as it was really drawn. */
export type BuiltBand = { y: number; role: BandRole; cells: BuiltCell[] };

/** A source key of the DXF-handle scheme, from an ordinal (L-CAD-02). */
function handle(ordinal: number): string {
  return `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;
}

/** One cell drawn from one text. */
function cell(x: number, text: string): CellDraw {
  return { x, texts: [{ text }] };
}

/** A whole band, one cell per column, in column order. */
function band(y: number, role: BandRole, columns: readonly number[], texts: readonly string[]): BandDraw {
  return { y, role, cells: texts.map((text, index) => cell(columns[index] ?? 0, text)) };
}

/** The six columns the plain schedule is drawn at, and the headers standing over them (AC-1). */
const PLAIN_COLUMNS: readonly number[] = [600, 630, 660, 690, 720, 750];
const PLAIN_HEADERS: readonly string[] = ["MARK", "GF TO 3RD", "4TH TO ROOF", "MAIN BAR", "TIES END ZONE", "TIES MID ZONE"];

/** The seventh column the lookalikes artifact adds — a count, which is nobody's member count (AC-8). */
const NOS_COLUMN = 780;

/** The two ties cells every data band of the plain schedule carries (AC-5). */
const TIES_END = '10Ø @ 4" c/c';
const TIES_MID = '10Ø @ 6" c/c';

/** The leading note and the trailing note the plain schedule stands between (AC-1). */
const LEADING_NOTE = "ALL DIMENSIONS ARE IN INCH";
const TRAILING_NOTE = "NOTE: TIES AS PER DETAIL";

/** The four data bands of the plain schedule, in the order they are drawn down the page (AC-1, AC-5). */
const PLAIN_ROWS: readonly (readonly string[])[] = [
  ["C-1", '12"x15"', '10"x12"', "8-16Ø", TIES_END, TIES_MID],
  ["C2", '15"x15"', '12"x12"', "6-16Ø", TIES_END, TIES_MID],
  ["C3", `1'-0"x1'-3"`, "12X12", "4-20Ø", TIES_END, TIES_MID],
  ["SEE NOTE 3", "-", "-", "-", "-", "-"],
];

/** The same four bands, drawn with the Ø lookalikes AC-8 keeps verbatim. */
const LOOKALIKE_MAIN_BARS: readonly string[] = ["8-16%%C", "8-16φ", "8-16ø", "-"];

/** The NOS cell each of those bands carries (AC-8). */
const LOOKALIKE_NOS: readonly string[] = ["12", "8", "4", "-"];

/** The bands each scenario is drawn from. Every y is a multiple of the pitch below the caption. */
function bandsOf(scenario: ScheduleScenario): readonly BandDraw[] {
  if (scenario === SCENARIO.NO_HEADER) {
    // A caption that says SCHEDULE over two bands, and no band holding a name or mark cell: there is
    // no header to take columns from, so there is no table to reconstruct at all (AC-7).
    return [
      band(-20, "data", [600, 630], ['12"x15"', "8-16Ø"]),
      band(-30, "data", [600, 630], ['10"x12"', "6-16Ø"]),
    ];
  }
  if (scenario === SCENARIO.NOISE_ONLY) {
    // A real header, real cells — and not one mark cell that names a member: the table stands, and
    // the registry it feeds mints nothing (AC-7).
    const columns = [600, 630, 660];
    return [
      band(-20, "header", columns, ["MARK", "GF TO 3RD", "MAIN BAR"]),
      band(-30, "data", columns, ["SEE NOTE 3", '12"x15"', "8-16Ø"]),
      band(-40, "data", columns, ["-", '10"x12"', "6-16Ø"]),
    ];
  }
  if (scenario === SCENARIO.GAP_INSIDE) {
    // The plain layout with C3 moved three pitches below C2 — a gap INSIDE the 3.5× stop — and the
    // trailing note four pitches below that, outside it. C-1's MAIN BAR cell is drawn as two texts,
    // one either side of the band's own y (AC-2).
    const rows = PLAIN_ROWS.slice(0, 3);
    const stacked: CellDraw = {
      x: 690,
      texts: [
        { text: "4-20Ø", dy: 1 },
        { text: "4-16Ø", dy: -1 },
      ],
    };
    const first = band(-30, "data", PLAIN_COLUMNS, rows[0] ?? []);
    return [
      band(-10, "leading", [600], [LEADING_NOTE]),
      band(-20, "header", PLAIN_COLUMNS, PLAIN_HEADERS),
      { y: -30, role: "data", cells: first.cells.map((drawn) => (drawn.x === 690 ? stacked : drawn)) },
      band(-40, "data", PLAIN_COLUMNS, rows[1] ?? []),
      band(-70, "data", PLAIN_COLUMNS, rows[2] ?? []),
      band(-110, "trailing", [600], [TRAILING_NOTE]),
    ];
  }

  const lookalikes = scenario === SCENARIO.LOOKALIKES;
  const columns = lookalikes ? [...PLAIN_COLUMNS, NOS_COLUMN] : PLAIN_COLUMNS;
  const headers = lookalikes ? [...PLAIN_HEADERS, "NOS"] : PLAIN_HEADERS;
  const rows = PLAIN_ROWS.map((row, index) => {
    if (!lookalikes) return row;
    const swapped = row.map((text, column) => (column === 3 ? (LOOKALIKE_MAIN_BARS[index] ?? text) : text));
    return [...swapped, LOOKALIKE_NOS[index] ?? "-"];
  });
  return [
    band(-10, "leading", [600], [LEADING_NOTE]),
    band(-20, "header", columns, headers),
    ...rows.map((row, index) => band(-30 - index * PITCH, "data", columns, row)),
    band(-100, "trailing", [600], [TRAILING_NOTE]),
  ];
}

/** What a built artifact carries, so a criterion derives its expectations from it (B-19). */
export type BuiltScheduleArtifact = {
  /** Which of the five this is. */
  scenario: ScheduleScenario;
  /** The artifact as bytes, for the stand-in CLI to write. */
  json: string;
  /** The graph, as an object. */
  graph: Record<string, JsonValue>;
  /** Every ORIGINAL record, model space and paper alike. */
  originals: readonly Drawn[];
  /** The key of the SCHEDULE caption — the anchor a table's `scheduleKey` is (increment interfaces). */
  captionKey: string;
  /** The key of the LAYOUT_PLAN caption drawn on the same sheet. */
  planCaptionKey: string;
  /** Every band really drawn, in the order they stand down the page. */
  bands: BuiltBand[];
  /** The pitch the bands were stacked at. */
  pitch: number;
};

/**
 * An EntityGraph v2 whose model space carries a gridless `COLUMN SCHEDULE` beside a
 * `TYPICAL FLOOR PLAN`, drawn to whichever of the five scenarios is asked for. Every ordinal is
 * minted from `salt`, so two artifacts built here are two different drawings.
 */
export function buildScheduleArtifact(scenario: ScheduleScenario, salt: number): BuiltScheduleArtifact {
  const base = salt * 0x10000;
  let ordinal = 0;
  const next = (): string => handle(base + (ordinal += 1));
  const originals: Drawn[] = [];

  const caption = (text: string, at: readonly [number, number]): string => {
    const key = next();
    originals.push({ key, type: TYPE_TEXT, space: MODEL_SPACE, layer: LAYER_CAPTIONS, text, height: CAPTION_HEIGHT, points: [[at[0], at[1]]] });
    return key;
  };

  const planCaptionKey = caption(CAPTION_PLAN, [0, 0]);
  originals.push({ key: next(), type: TYPE_LINE, space: MODEL_SPACE, layer: LAYER_LINES, points: [[-5, -30], [55, -30]] });
  originals.push({ key: next(), type: TYPE_LINE, space: MODEL_SPACE, layer: LAYER_LINES, points: [[0, -35], [0, -5]] });

  const captionKey = caption(CAPTION_SCHEDULE, [600, 0]);

  const bands: BuiltBand[] = bandsOf(scenario).map((drawn) => ({
    y: drawn.y,
    role: drawn.role,
    cells: drawn.cells.map((one) => {
      // A cell is what one column of one band says. Two texts stacked in it are ONE cell, read top
      // text first — the reading order of the page (AC-2).
      const stacked = [...one.texts].sort((left, right) => (right.dy ?? 0) - (left.dy ?? 0));
      const keys = stacked.map((text) => {
        const key = next();
        originals.push({ key, type: TYPE_TEXT, space: MODEL_SPACE, layer: LAYER_TEXT, text: text.text, height: TEXT_HEIGHT, points: [[one.x, drawn.y + (text.dy ?? 0)]] });
        return key;
      });
      return { x: one.x, text: stacked.map((text) => text.text).join("+"), keys };
    }),
  }));

  // The paper layout: a sheet's own furniture, which L-CAD-06 does not partition at all.
  originals.push({ key: next(), type: TYPE_TEXT, space: PAPER_SPACE, layer: "TITLEBLOCK", text: "S-101 GENERAL ARRANGEMENT", height: 3, points: [[5, 5]] });
  originals.push({ key: next(), type: TYPE_LINE, space: PAPER_SPACE, layer: "TITLEBLOCK", points: [[0, 0], [297, 210]] });

  const graph: Record<string, JsonValue> = {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      { name: MODEL_SPACE, kind: "model", bbox: { min: [-60, -140], max: [820, 20] }, strays_rejected: 0 },
      { name: PAPER_SPACE, kind: "paper", bbox: { min: [0, 0], max: [297, 210] }, strays_rejected: 0 },
    ] as unknown as JsonValue,
    dropped_layouts: [],
    entities: originals.map((record) => ({ ...record, colour: CHANNELS })) as unknown as JsonValue,
    derived: [],
    block_attributes: [],
    counters: [],
  };

  return { scenario, json: JSON.stringify(graph), graph, originals, captionKey, planCaptionKey, bands, pitch: PITCH };
}

/* ------------------------------------------------------------------ the acceptance's own reading */

/** The band the artifact drew as its header, or null where it drew none. */
export function headerBandOf(built: BuiltScheduleArtifact): BuiltBand | null {
  return built.bands.find((one) => one.role === "header") ?? null;
}

/** The bands the artifact drew as data rows, in the order they stand down the page. */
export function dataBandsOf(built: BuiltScheduleArtifact): BuiltBand[] {
  return built.bands.filter((one) => one.role === "data");
}

/** The bands the artifact drew OUTSIDE the table: the leading note and the trailing note (AC-1). */
export function asideBandsOf(built: BuiltScheduleArtifact): BuiltBand[] {
  return built.bands.filter((one) => one.role === "leading" || one.role === "trailing");
}

/** Every text key of a band, whatever cell it stands in. */
export function keysOf(band: BuiltBand): string[] {
  return band.cells.flatMap((one) => one.keys);
}

/** The columns a table takes from its header: the header texts' insertion x, ascending (riskNotes (1)). */
export function columnsOf(built: BuiltScheduleArtifact): number[] {
  return [...(headerBandOf(built)?.cells ?? [])].map((one) => one.x).sort((left, right) => left - right);
}

/** One cell of the table this acceptance reads the artifact as. */
export type ExpectedCell = CellRow;

/** The table an artifact owes, as this acceptance reads the artifact it built (B-19). */
export type ExpectedTable = { scheduleKey: string; title: string; pitch: number; columns: number[]; cells: ExpectedCell[] };

/**
 * The table the artifact owes: row 0 is the band the drawing drew as its header, rows 1..n are the
 * data bands in the order they stand down the page, a column is a header text's own insertion x, and
 * every cell cites the keys of the texts it was drawn from. The notes standing outside the table are
 * no part of it — neither as a row nor as a key any cell cites (AC-1, AC-2).
 *
 * Derived, never transcribed: an artifact drawn differently owes a different table.
 */
export function expectedTableOf(built: BuiltScheduleArtifact): ExpectedTable | null {
  const header = headerBandOf(built);
  if (header === null) return null;
  const columns = columnsOf(built);
  const rows = [header, ...dataBandsOf(built)];
  return {
    scheduleKey: built.captionKey,
    title: CAPTION_SCHEDULE,
    pitch: built.pitch,
    columns,
    cells: rows.flatMap((row, rowIndex) =>
      row.cells.map((one) => ({ rowIndex, columnIndex: columns.indexOf(one.x), text: one.text, sourceKeys: [...one.keys] })),
    ),
  };
}

/** Any list of cells, in one order — the store's order is nobody's contract (C-05). */
export function byCell<T extends { rowIndex: number; columnIndex: number }>(cells: readonly T[]): T[] {
  return [...cells].sort((left, right) => left.rowIndex - right.rowIndex || left.columnIndex - right.columnIndex);
}

/** Any list of rows carrying a key, in code-point order of it. */
export function byKey<T>(rows: readonly T[], keyOf: (row: T) => string): T[] {
  return [...rows].sort((left, right) => (keyOf(left) < keyOf(right) ? -1 : keyOf(left) > keyOf(right) ? 1 : 0));
}

/** How a header column is read: the mark column, a rebar zone, a floor band, or none of the three. */
export type ColumnRole = { kind: "mark" } | { kind: "zone"; zone: string } | { kind: "band"; from: string; to: string } | { kind: "none" };

/**
 * What one header text makes of its column, asked of the notation the golden corpus pins (AC-6). The
 * order is the specific before the general: a mark column is a mark column however its words read,
 * and a ties column is a rebar zone rather than a floor band.
 */
export function columnRoleOf(notation: NotationSeam, header: string): ColumnRole {
  if (notation.isMarkHeader(header)) return { kind: "mark" };
  const zone = notation.rebarZoneOfHeader(header);
  if (zone !== null) return { kind: "zone", zone };
  const floor = notation.parseFloorZone(header);
  if (floor !== null) return { kind: "band", from: floor.from, to: floor.to };
  return { kind: "none" };
}

/** The key a variant of one floor band stands under (AC-5: `GF-3RD`, `4TH-ROOF`). */
export function variantKeyOf(from: string, to: string): string {
  return `${from}-${to}`;
}

/**
 * The registry the artifact owes, read off the artifact by this acceptance's own reading of the rule:
 * one family per data band whose mark cell names a member, one variant per floor-band column, and one
 * rebar zone per zone column beneath each variant — every parsed field being the notation's own
 * reading of the verbatim cell text, which the golden corpus pins independently (AC-5, AC-6).
 */
export function expectedFamiliesOf(built: BuiltScheduleArtifact, notation: NotationSeam): FamilyRow[] {
  const header = headerBandOf(built);
  if (header === null) return [];
  const roles = header.cells.map((one) => ({ x: one.x, role: columnRoleOf(notation, one.text), header: one.text }));
  const markColumn = roles.find((one) => one.role.kind === "mark");
  if (markColumn === undefined) return [];
  const rows = [header, ...dataBandsOf(built)];

  const families: FamilyRow[] = [];
  for (const [rowIndex, row] of rows.entries()) {
    if (row.role !== "data") continue;
    const markCell = row.cells.find((one) => one.x === markColumn.x);
    if (markCell === undefined || !notation.isMarkFamily(markCell.text)) continue;
    const cellAt = (x: number): BuiltCell | undefined => row.cells.find((one) => one.x === x);

    const zones = roles.flatMap<{ column: number; row: ZoneRow }>((column) => {
      if (column.role.kind !== "zone") return [];
      const zoneCell = cellAt(column.x);
      if (zoneCell === undefined) return [];
      const spacing = notation.parseSpacing(zoneCell.text);
      return [
        {
          column: column.x,
          row: {
            zone: column.role.zone,
            text: zoneCell.text,
            bars: notation.parseRebarGroups(zoneCell.text),
            spacing: spacing === null ? null : spacing.spacing,
            spacingUnit: spacing === null ? null : spacing.unit,
            spacingBar: spacing === null ? null : spacing.bar,
            sourceKeys: [...zoneCell.keys],
          },
        },
      ];
    });

    const variants = roles.flatMap<VariantRow>((column) => {
      if (column.role.kind !== "band") return [];
      const sectionCell = cellAt(column.x);
      if (sectionCell === undefined) return [];
      const section = notation.parseSizePair(sectionCell.text);
      return [
        {
          variantKey: variantKeyOf(column.role.from, column.role.to),
          bandText: column.header,
          bandFrom: column.role.from,
          bandTo: column.role.to,
          sectionText: sectionCell.text,
          sectionWidth: section === null ? null : section.width,
          sectionDepth: section === null ? null : section.depth,
          sectionUnit: section === null ? null : section.unit,
          sourceKeys: [...sectionCell.keys],
          zones: zones.map((zone) => zone.row),
        },
      ];
    });

    families.push({
      scheduleKey: built.captionKey,
      family: notation.normaliseMark(markCell.text),
      markText: markCell.text,
      rowIndex,
      sourceKeys: [...markCell.keys],
      variants,
    });
  }
  return families;
}

/* ------------------------------------------------------------------ staging a drawing to partition */

/** A drawing of a built artifact, recorded by the shipped ingest pipeline. */
export type StagedScheduleIngest = { drawing: StagedDrawing; ingestId: string; artifact: BuiltScheduleArtifact };

/**
 * A recorded drawing whose ingest artifact is the built one: the bytes are seeded into the store, and
 * the shipped ingest job is run over a stand-in CLI that hands back the artifact. What lands is a
 * real `ingests` row, written by the product's own pipeline (B-17).
 *
 * The reconstructor is asked for FIRST, before a database is touched: a stage this increment has not
 * been built for should red as the missing module it is, in a second, rather than after a staging.
 */
export async function stageScheduleIngest(person: Person, projectId: string, scenario: ScheduleScenario, salt: number): Promise<StagedScheduleIngest> {
  await reconstructDoor();
  const job = await productModule<{ runIngestJob: (payload: unknown, progress: ProgressLike, deps: { storage: unknown }) => Promise<void> }>(INGEST_JOB_MODULE);
  const records = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> }>(INGEST_MODULE);

  const artifact = buildScheduleArtifact(scenario, salt);
  const bytes = new TextEncoder().encode(`0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n; ${scenario}\n`);
  const drawing = await stageDrawing(person, projectId, bytes, { name: unique(`${scenario}.dxf`), format: "dxf" });
  const stub = stubCli({ artifact: artifact.json, stderr: "", exitCode: 0 });

  await withCadCommand(stub.command, async () => {
    await job.runIngestJob(
      { tenantId: person.tenantId, drawingId: drawing.drawingId, requestedBy: person.userId, declared: null },
      { jobId: unique(`ingest-${scenario}`), tempDir: tempDir("ingest"), step: async () => undefined },
      { storage: await storageOf() },
    );
  });

  const record = await records.ingestRecordOf({ tenantId: person.tenantId, drawingId: drawing.drawingId });
  expect(record, `staging ${scenario} left no ingest record — a partition is a reading of a record`).not.toBeNull();
  return { drawing, ingestId: (record as { ingestId: string }).ingestId, artifact };
}

/** One run of the shipped partition job over a staged ingest, with the steps it recorded. */
export async function runSchedulePartition(person: Person, staged: StagedScheduleIngest, label = "schedules"): Promise<StepRecord[]> {
  const rebuild = await rebuildDoor();
  const sink = stepSink(label);
  await rebuild.runPartitionJob(
    { tenantId: person.tenantId, drawingId: staged.drawing.drawingId, ingestId: staged.ingestId, requestedBy: person.userId },
    sink.progress,
    { storage: await storageOf() },
  );
  return sink.steps;
}

/** The evidence the pure reconstructor is handed, derived from the artifact by the views stage itself. */
export async function evidenceOf(built: BuiltScheduleArtifact): Promise<{ graph: unknown; views: readonly unknown[]; assignments: ReadonlyMap<string, string> }> {
  const assign = await productModule<{ partitionArtifact: (graph: unknown) => { views: readonly unknown[]; assignments: ReadonlyMap<string, string> } }>(VIEWS_ASSIGN_MODULE);
  const partitioned = assign.partitionArtifact(built.graph);
  return { graph: built.graph, views: partitioned.views, assignments: partitioned.assignments };
}

/**
 * Run `body` with the app role unable to write a schedule cell — the way a rebuild's schedule write
 * is made to fail without reaching inside the rebuild (AC-3). The privilege is given back whatever
 * the body did, so no later case runs against a store this one narrowed.
 */
export async function withScheduleWriteBroken<T>(body: () => Promise<T>): Promise<T> {
  sql(`revoke insert on ${ident(SCHEDULE_CELLS)} from ${ident(ROLE_APP)};`);
  try {
    return await body();
  } finally {
    sql(`grant insert on ${ident(SCHEDULE_CELLS)} to ${ident(ROLE_APP)};`);
  }
}

/* ------------------------------------------------------------------ reading the store */

/** The rows of one select, as JSON — nullable columns and text[] survive the trip unambiguously. */
function jsonRows<T>(select: string): T[] {
  return JSON.parse(sqlValue(`select coalesce(jsonb_agg(to_jsonb(x))::text, '[]') from (${select}) x;`)) as T[];
}

/** The `where` every read of one ingest's rows is scoped by. */
function ofIngest(tenantId: string, ingestId: string): string {
  return `where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and ingest_id = ${lit(ingestId)}::uuid`;
}

/** Every `schedules` row of one ingest, as the acceptance's own audit read. */
export function scheduleRows(tenantId: string, ingestId: string): ScheduleRow[] {
  return byKey(
    jsonRows<ScheduleRow>(`select view_key as "viewKey", schedule_key as "scheduleKey", title, pitch::float8 as pitch from ${ident(SCHEDULES)} ${ofIngest(tenantId, ingestId)}`),
    (row) => row.scheduleKey,
  );
}

/** Every `schedule_cells` row of one schedule, as the acceptance's own audit read. */
export function scheduleCellRows(tenantId: string, ingestId: string, scheduleKey: string): CellRow[] {
  return byCell(
    jsonRows<CellRow>(
      `select row_index as "rowIndex", column_index as "columnIndex", text, source_keys as "sourceKeys"
         from ${ident(SCHEDULE_CELLS)} ${ofIngest(tenantId, ingestId)} and schedule_key = ${lit(scheduleKey)}`,
    ),
  );
}

/** Every `schedule_deferrals` row of one ingest. */
export function scheduleDeferralRows(tenantId: string, ingestId: string): ScheduleDeferralRow[] {
  return byKey(jsonRows<ScheduleDeferralRow>(`select view_key as "viewKey", reason from ${ident(SCHEDULE_DEFERRALS)} ${ofIngest(tenantId, ingestId)}`), (row) => `${row.viewKey}|${row.reason}`);
}

/**
 * The whole registry of one ingest, as the store holds it: families, the variants beneath them and
 * the zones beneath those, nested the way `memberTypesOf` answers them (AC-3).
 */
export function memberTypeRows(tenantId: string, ingestId: string): FamilyRow[] {
  const families = jsonRows<FamilyRow>(
    `select schedule_key as "scheduleKey", family, mark_text as "markText", row_index as "rowIndex", source_keys as "sourceKeys"
       from ${ident(MEMBER_TYPES)} ${ofIngest(tenantId, ingestId)}`,
  );
  const variants = jsonRows<VariantRow & { scheduleKey: string; family: string }>(
    `select schedule_key as "scheduleKey", family, variant_key as "variantKey", band_text as "bandText", band_from as "bandFrom", band_to as "bandTo",
            section_text as "sectionText", section_width::float8 as "sectionWidth", section_depth::float8 as "sectionDepth", section_unit as "sectionUnit",
            source_keys as "sourceKeys"
       from ${ident(MEMBER_TYPE_VARIANTS)} ${ofIngest(tenantId, ingestId)}`,
  );
  const zones = jsonRows<ZoneRow & { scheduleKey: string; family: string; variantKey: string }>(
    `select schedule_key as "scheduleKey", family, variant_key as "variantKey", zone, text, bars, spacing::float8 as spacing,
            spacing_unit as "spacingUnit", spacing_bar::float8 as "spacingBar", source_keys as "sourceKeys"
       from ${ident(REBAR_ZONES_TABLE)} ${ofIngest(tenantId, ingestId)}`,
  );

  return byKey(
    families.map((family) => ({
      ...family,
      variants: byKey(
        variants
          .filter((variant) => variant.scheduleKey === family.scheduleKey && variant.family === family.family)
          .map((variant) => ({
            variantKey: variant.variantKey,
            bandText: variant.bandText,
            bandFrom: variant.bandFrom,
            bandTo: variant.bandTo,
            sectionText: variant.sectionText,
            sectionWidth: variant.sectionWidth,
            sectionDepth: variant.sectionDepth,
            sectionUnit: variant.sectionUnit,
            sourceKeys: variant.sourceKeys,
            zones: byKey(
              zones
                .filter((zone) => zone.scheduleKey === family.scheduleKey && zone.family === family.family && zone.variantKey === variant.variantKey)
                .map((zone) => ({
                  zone: zone.zone,
                  text: zone.text,
                  bars: zone.bars,
                  spacing: zone.spacing,
                  spacingUnit: zone.spacingUnit,
                  spacingBar: zone.spacingBar,
                  sourceKeys: zone.sourceKeys,
                })),
              (zone) => zone.zone,
            ),
          })),
        (variant) => variant.variantKey,
      ),
    })),
    (family) => `${family.scheduleKey}|${family.family}`,
  );
}

/** Every row of one of the six tables, as one comparable string — the byte-identity AC-2 asks for. */
export function tableSnapshot(tenantId: string, ingestId: string, table: string): string {
  return sqlValue(
    `select coalesce(string_agg(line, e'\\n' order by line), '') from (
       select to_jsonb(x)::text as line from (select * from ${ident(table)} ${ofIngest(tenantId, ingestId)}) x
     ) y;`,
  );
}

/** All six tables of one ingest, snapshotted together. */
export function storeSnapshot(tenantId: string, ingestId: string): Record<string, string> {
  return Object.fromEntries(SCHEDULE_TABLES.map((table) => [table, tableSnapshot(tenantId, ingestId, table)]));
}

/** The columns one of the six tables carries, in code-point order (AC-8's information_schema read). */
export function columnNamesOf(table: string): string[] {
  return sql(`select column_name from information_schema.columns where table_schema = 'public' and table_name = ${lit(table)} order by 1;`).map((row) => row[0] ?? "");
}

/** The view keys of one ingest that carry a given class, read off the partition the run really left. */
export async function viewKeysOfType(tenantId: string, ingestId: string, type: string): Promise<string[]> {
  const law = await viewsLaw();
  const spelled = String(law.VIEW_TYPE[type]);
  return sql(
    `select view_key from ${ident("partition_views")} ${ofIngest(tenantId, ingestId)} and type = ${lit(spelled)} order by view_key;`,
  ).map((row) => row[0] ?? "");
}

/** The one SCHEDULE view of an ingest — a singular, asserted rather than assumed. */
export async function scheduleViewKey(tenantId: string, ingestId: string): Promise<string> {
  const keys = await viewKeysOfType(tenantId, ingestId, SCHEDULE);
  expect(keys.length, "the artifact's schedule caption anchors exactly one SCHEDULE view — with none there is no schedule to reconstruct (L-CAD-06)").toBe(1);
  return keys[0] ?? "";
}

/* ------------------------------------------------------------------ reading a door's answer */

/** A field of an answered row, under either the door's spelling or the column's (C-05: shapes are free). */
function field(row: Record<string, unknown>, camel: string, snake: string): unknown {
  return row[camel] ?? row[snake];
}

/** One answered cell, read under the names the test contract fixes for it. */
export function cellOf(answered: unknown): CellRow {
  const row = (answered ?? {}) as Record<string, unknown>;
  return {
    rowIndex: Number(field(row, "rowIndex", "row_index")),
    columnIndex: Number(field(row, "columnIndex", "column_index")),
    text: String(row["text"] ?? ""),
    sourceKeys: ((field(row, "sourceKeys", "source_keys") ?? []) as unknown[]).map(String),
  };
}

/** One answered schedule, without its cells. */
export function scheduleOf(answered: unknown): ScheduleRow {
  const row = (answered ?? {}) as Record<string, unknown>;
  return {
    viewKey: String(field(row, "viewKey", "view_key") ?? ""),
    scheduleKey: String(field(row, "scheduleKey", "schedule_key") ?? ""),
    title: String(row["title"] ?? ""),
    pitch: Number(row["pitch"]),
  };
}

/** One answered deferral. */
export function deferralOf(answered: unknown): ScheduleDeferralRow {
  const row = (answered ?? {}) as Record<string, unknown>;
  return { viewKey: String(field(row, "viewKey", "view_key") ?? ""), reason: String(row["reason"] ?? "") };
}

/** Every key at every depth of an answered value — what AC-3 and AC-8 forbid a member count in. */
export function keysAtEveryDepth(value: unknown, held: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) keysAtEveryDepth(entry, held);
    return held;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      held.add(key);
      keysAtEveryDepth(entry, held);
    }
  }
  return held;
}

/** Whichever of the forbidden count words a set of names carries, compared without case (AC-3, AC-8). */
export function countWordsAmong(names: Iterable<string>): string[] {
  const said = [...names].map((name) => name.toLowerCase());
  return COUNT_WORDS.filter((word) => said.includes(word));
}
