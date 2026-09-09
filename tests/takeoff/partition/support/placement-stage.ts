/**
 * The mechanics the fifth, sixth and seventh partition stages are graded on (R-TO-030/031, L-CAD-07,
 * L-REG-04, L-MEA-01, L-ACT-02/03).
 *
 * Mechanics only — nothing here judges the product. The database, the storage root, the accounts, the
 * recorded drawing and the stand-in for the `cad/` CLI come from the stages the stored partition, the
 * register, the level stack and the drawing sets already run on (`./partition-stage`,
 * `../../register/support/register-stage`, `../../levels/support/levels-stage`,
 * `../../sets/support/sets-stage`): one invariant, one home (B-17, ARCH-02). What this file adds is
 * what PLACEMENT needs beyond a partitioned ingest — artifacts whose model space really carries a
 * georeferenced layout plan (bubbles, closed column outlines and the marks that anchor them), a
 * long section carrying level marks, a project pinned to the seed rule-set edition, a live level
 * stack, a pinned set revision naming the drawing, and the store reads the criteria are graded by.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one the increment's interfaces, its test
 * contract or the Bible publishes. What this file DECLARES — the module homes, the call shapes and
 * the reading of the artifacts — is the public test contract the held-out set is measured against
 * too (B-12): a Builder who reads only this file and the spec can pass every case.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. Keep it free of judgement so neither lane can hide one here.
 */
import { expect } from "vitest";
import {
  MODEL_SPACE,
  PAPER_SPACE,
  PARTITION_MODULE,
  PARTITION_REBUILD_MODULE,
  INGEST_JOB_MODULE,
  INGEST_MODULE,
  actorOf,
  closeStage,
  codeOf,
  grantRole,
  openSheetsStage,
  productModule,
  rebuildDoor,
  rejection,
  sql,
  stepSink,
  storageOf,
  tempDir,
  unique,
  viewsLaw,
  PRINCIPAL,
  type JsonValue,
  type Person,
  type ProgressLike,
  type StagedDrawing,
  type StepRecord,
} from "./partition-stage";
import { stageDrawing, stubCli, withCadCommand } from "../../support/ingest-stage";
import { joinWorkspace, stagePerson } from "../../support/sheets-stage";
import { identitySeam, field, type IdentitySeam, type StoreRow } from "../../register/support/register-stage";
import { insertion, performAct, previewOf, storeRows, tableStands, type ActorCtx, type ConsequenceLike, type ProposedLevel } from "../../levels/support/levels-stage";
import { pinning, setsSeam, actsSeam } from "../../sets/support/sets-stage";

export {
  MODEL_SPACE,
  PAPER_SPACE,
  PRINCIPAL,
  actorOf,
  closeStage,
  codeOf,
  field,
  grantRole,
  identitySeam,
  insertion,
  joinWorkspace,
  openSheetsStage,
  performAct,
  previewOf,
  productModule,
  stagePerson,
  rejection,
  sql,
  storeRows,
  tableStands,
  unique,
  viewsLaw,
};
export type { ActorCtx, ConsequenceLike, IdentitySeam, JsonValue, Person, ProposedLevel, StagedDrawing, StepRecord, StoreRow };

/* ------------------------------------------------------------------ the homes the spec names */

/** The door placements, deferrals, authored ranges and the proposed stack are read through. */
export const PLACEMENT_DOOR_MODULE = PARTITION_MODULE;

/** The job whose stage list this increment extends (increment interfaces). */
export const REBUILD_MODULE = PARTITION_REBUILD_MODULE;

/** The pure detector the placement stage runs (increment interfaces, test contract). */
export const PLACEMENT_DETECT_MODULE = "src/modules/takeoff/partition/placement/detect.ts";

/** The closed class map and the two rosters of classes (increment interfaces). */
export const PLACEMENT_LAW_MODULE = "src/modules/takeoff/partition/placement/law.ts";

/** The content-scaled shares, read off the project's pinned edition (increment interfaces). */
export const PLACEMENT_SHARES_MODULE = "src/modules/takeoff/partition/placement/shares.ts";

/** The pure, order-independent expansion resolver (goal, test contract). */
export const EXPANSION_MODULE = "src/modules/takeoff/partition/expansion/resolve.ts";

/** The pure levels proposal (goal, test contract). */
export const LEVELS_PROPOSAL_MODULE = "src/modules/takeoff/partition/levels-proposal/propose.ts";

/** SEAM-ACT, and the closed act law the new act joins (L-ACT-02, L-ACT-03). */
export const ACTS_MODULE = "src/core/acts/index.ts";
export const ACTS_LAW_MODULE = "src/core/acts/law.ts";

/** The one home of the transport vocabularies a wire code is spelled in (Q-07). */
export const TRANSPORT_VOCABULARY_MODULE = "src/core/errors/transport-vocabulary.ts";

/** The pinned rule-set edition, as a surface reads one (R-SPINE-012, L-MEA-01). */
export const EDITIONS_MODULE = "src/core/rulesets/editions/index.ts";

/** The project door a project is made through, so L-REG-07's pin really forks (gate's own path). */
export const PROJECTS_MODULE = "src/modules/spine/projects/index.ts";

/** The stages before this increment's, whose evidence the pure halves are handed. */
export const VIEWS_ASSIGN_MODULE = "src/modules/takeoff/partition/views/assign.ts";
export const CONVENTIONS_CENSUS_MODULE = "src/modules/takeoff/partition/conventions/census.ts";
export const CONVENTIONS_RESOLVE_MODULE = "src/core/rulesets/methods/conventions/resolve.ts";
export const GRID_DETECT_MODULE = "src/modules/takeoff/partition/grid/detect.ts";

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The three stages this increment adds, the stage they run after, and the step that stores. */
export const PLACEMENT_STAGE = "placement";
export const EXPANSION_STAGE = "expansion";
export const LEVELS_PROPOSAL_STAGE = "levels-proposal";
export const SCHEDULES_STAGE = "schedules";
export const VIEWS_STAGE = "views";
export const CONVENTIONS_STAGE = "conventions";
export const GRID_STAGE = "grid";
export const STORED_STEP = "stored";

/** The stage list this increment leaves behind, in the order the stages run (increment interfaces). */
export const EXPECTED_STAGES: readonly string[] = [VIEWS_STAGE, CONVENTIONS_STAGE, GRID_STAGE, SCHEDULES_STAGE, PLACEMENT_STAGE, EXPANSION_STAGE, LEVELS_PROPOSAL_STAGE];

/** The tables the three stages write, and the tables they must leave alone (test contract). */
export const PLACEMENTS = "placements";
export const EXPANSION_DEFERRALS = "expansion_deferrals";
export const TYPICAL_RANGES = "typical_ranges";
export const PROPOSED_LEVELS = "proposed_levels";
export const REGISTER_OBJECTS = "register_objects";
export const REFUSED_SIGHTINGS = "refused_sightings";
export const QUANTITY_LINES = "quantity_lines";
export const LEVELS_TABLE = "levels";
export const STOREY_HEIGHT_READINGS = "storey_height_readings";
export const GRIDS = "grids";
export const MEMBER_TYPES = "member_types";
export const ACTS_TABLE = "acts";

/** The act this increment mints, the permission it moves, and the roles that hold or lack it. */
export const AUTHOR_TYPICAL_RANGE = "AUTHOR_TYPICAL_RANGE";
export const INSERT_LEVEL = "INSERT_LEVEL";
export const MEASURE = "MEASURE";
export const MEASURER = "MEASURER";
export const REVIEWER = "REVIEWER";
export const LEAD = "LEAD";

/** The two standings a register row stands at, and the basis a transcribed reading carries. */
export const MEASURED = "MEASURED";
export const DERIVED = "DERIVED";
export const TRANSCRIBED = "TRANSCRIBED";

/** The discipline every sighting of this slice is registered under, and the two classes it mints. */
export const STRUCTURAL = "STRUCTURAL";
export const COLUMN = "column";
export const FOOTING = "footing";

/** The lawful-null level slots and the placeholder a level authored later carries (L-REG-04). */
export const FOUNDATION = "FOUNDATION";
export const UNRESOLVED = "UNRESOLVED";
export const UNREGISTERED_PREFIX = "@unregistered:";

/** The two reasons an expansion defers under (goal, AC-4). */
export const TYPICAL_RANGE_UNSTATED = "TYPICAL_RANGE_UNSTATED";
export const LEVEL_RANGE_ENDPOINT_UNMAPPED = "LEVEL_RANGE_ENDPOINT_UNMAPPED";

/** The refusals the act pair answers with (L-ACT-02, L-ACT-03). */
export const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";
export const ACT_CHANGES_NOTHING = "ACT_CHANGES_NOTHING";

/** The group kind the proposed stack is offered as (AC-7). */
export const PROPOSED_LEVEL_STACK = "PROPOSED_LEVEL_STACK";

/**
 * The four placement parameters of the pinned edition, by the name the share carries in the step's
 * detail. The VALUES are never spelled here: they are read off the project's own pinned edition, so
 * an edition authored with other numbers moves the expectation with it (L-MEA-01, B-19).
 */
export const SHARE_PARAMETERS: Readonly<Record<string, string>> = Object.freeze({
  containmentMerge: "placementContainmentMerge",
  nearAnchor: "placementNearAnchor",
  footprintMin: "placementFootprintMin",
  footprintMax: "placementFootprintMax",
});

/** The four share names, in the order the detail names them. */
export const SHARE_NAMES: readonly string[] = Object.freeze(["containmentMerge", "nearAnchor", "footprintMin", "footprintMax"]) as readonly string[];

/** The labels the six-level stack of AC-3 is authored with, ordinals 1..6 in this order. */
export const STACK_LABELS: readonly string[] = Object.freeze(["1ST", "2ND", "3RD", "4TH", "5TH", "6TH"]) as readonly string[];

/** The scenarios the criteria are staged over (test contract: fixture scenarios). */
export const SCENARIO = Object.freeze({
  TYPICAL_RANGE: "placement-typical-range",
  TYPICAL_BARE: "placement-typical-bare",
  SINGLE_LEVEL: "placement-single-level",
  FOUNDATION: "placement-foundation",
  SECTIONS: "placement-sections",
  SHARES: "placement-shares",
} as const);

/** One of the six. */
export type PlacementScenario = (typeof SCENARIO)[keyof typeof SCENARIO];

/** The caption each scenario's own view is drawn under (test contract). */
export const CAPTION_OF: Readonly<Record<string, string>> = Object.freeze({
  [SCENARIO.TYPICAL_RANGE]: "TYPICAL FLOOR PLAN (1ST TO 6TH FLOOR)",
  [SCENARIO.TYPICAL_BARE]: "TYPICAL FLOOR PLAN",
  [SCENARIO.SINGLE_LEVEL]: "2ND FLOOR PLAN",
  [SCENARIO.FOUNDATION]: "FOUNDATION PLAN",
  [SCENARIO.SECTIONS]: "LONGITUDINAL SECTION",
  [SCENARIO.SHARES]: "TYPICAL FLOOR PLAN",
});

/** The caption the member-type schedule is drawn under, where a scenario draws one. */
export const CAPTION_SCHEDULE = "COLUMN SCHEDULE";

/** The four level marks the section artifact is drawn with, verbatim (test contract, AC-7). */
export const LEVEL_MARKS: readonly { text: string; label: string; elevation: number }[] = Object.freeze([
  Object.freeze({ text: "GF LVL +0.00 M", label: "GF", elevation: 0 }),
  Object.freeze({ text: "1ST FLOOR LVL +3.05 M", label: "1ST", elevation: 3.05 }),
  Object.freeze({ text: "2ND FLOOR LVL +6.10 M", label: "2ND", elevation: 6.1 }),
  Object.freeze({ text: "ROOF LVL +9.15 M", label: "ROOF", elevation: 9.15 }),
]) as readonly { text: string; label: string; elevation: number }[];

/** The unit those marks are written in, and the storey height three of them state (AC-7). */
export const HEIGHT_UNIT = "M";
export const STOREY_HEIGHT = "3.05";

/* ------------------------------------------------------------------ the artifacts' own geometry */

/** The grid spacing every artifact is drawn on: S, the minimum grid spacing of its plan (AC-2). */
export const S = 4000;

/** The side of the column outlines, and of the footing outlines (AC-6). */
const COLUMN_SIDE = 400;
const FOOTING_SIDE = 1500;

/** The shares of S the SHARES artifact draws its four cases at (AC-2). Facts OF THE DRAWING. */
export const DRAWN_MERGE_GAP = 0.05;
export const DRAWN_FAR_ANCHOR = 0.95;
export const DRAWN_NEAR_ANCHOR = 0.85;
export const DRAWN_LONG_OUTLINE = 3;

/** The near-anchor share the pure detector is re-run under, which no longer reaches C4 (AC-2). */
export const NARROWED_NEAR_ANCHOR = "0.5";

/** How tall a caption stands, and how tall every label, mark and cell text stands beside it. */
const CAPTION_HEIGHT = 500;
const LABEL_HEIGHT = 200;

/** The caption of the SHARES plan stands taller because its own view is wider (reach is heights). */
const WIDE_CAPTION_HEIGHT = 1500;

/** The bubble radius, and how many vertices a round ring is drawn from (the grid's own reading). */
const BUBBLE_RADIUS = 300;
const BUBBLE_VERTICES = 16;

/** The layers the artifacts draw on — census data, never a name anything reads a role off. */
const LAYER_CAPTIONS = "CAPTIONS";
const LAYER_BUBBLES = "GRID-BUBBLES";
const LAYER_LABELS = "GRID-LABELS";
const LAYER_LINES = "GRID-LINES";
const LAYER_OUTLINES = "COLUMNS";
const LAYER_MARKS = "MARKS";
const LAYER_TEXT = "SCHEDULE-TEXT";
const LAYER_SECTION = "SECTION-LINES";

/** The DXF types the artifacts are built from. */
const TYPE_TEXT = "TEXT";
const TYPE_LINE = "LINE";
const TYPE_RING = "LWPOLYLINE";

/** A colour every built entity carries: channels, never a spelled colour (the artifact's own shape). */
const CHANNELS = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" };

/** One drawn record of the built artifact, in the shape the mirror validates (L-CAD-05). */
export type Drawn = { key: string; type: string; space: string; layer: string; text?: string; height?: number; closed?: boolean; points?: number[][] };

/** One column (or footing) the artifact really drew, as this acceptance reads it back (B-19). */
export type DrawnMember = {
  /** The mark as the page spells it, and as the dotless-uppercase normalisation reads it. */
  markText: string;
  mark: string;
  /** The entity keys the placement cites: the outline it was read off, and the mark that anchored it. */
  outlineKey: string;
  markKey: string;
  /** The outline's bounding-box centre — where a placement stands. */
  x: number;
  y: number;
  /** The nearest axis of each family, as the drawing itself places them. */
  gridLetter: string;
  gridNumeral: string;
  /** Whether this member is one the drawing means to be placed at all (AC-2's four cases). */
  placed: boolean;
};

/** One level mark the section artifact drew, as this acceptance reads it back (AC-7). */
export type DrawnLevelMark = { text: string; label: string; elevation: number; markKey: string };

/** What a built artifact carries, so a criterion derives its expectations from it (B-19). */
export type BuiltPlacementArtifact = {
  scenario: PlacementScenario;
  /** The artifact as bytes, for the stand-in CLI to write. */
  json: string;
  /** The graph, as an object. */
  graph: Record<string, JsonValue>;
  /** Every ORIGINAL record, model space and paper alike. */
  originals: readonly Drawn[];
  /** The caption this scenario's own view is anchored at, and its text. */
  captionKey: string;
  caption: string;
  /** The caption of the member-type schedule, where this scenario drew one. */
  scheduleCaptionKey: string | null;
  /** Every member the drawing carries, in the order it drew them. */
  members: readonly DrawnMember[];
  /** Every level mark the drawing carries (the section artifact only). */
  levelMarks: readonly DrawnLevelMark[];
  /** The minimum grid spacing the bubbles of this artifact really stand at. */
  minSpacing: number;
};

/** A source key of the DXF-handle scheme, from an ordinal (L-CAD-02). */
function handle(ordinal: number): string {
  return `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;
}

/** The vertices of a round ring — a bubble, as the grid's content signature reads one. */
function ringPoints(centre: readonly [number, number], radius: number, vertices: number): number[][] {
  return Array.from({ length: vertices }, (_unused, index) => {
    const angle = (2 * Math.PI * index) / vertices;
    return [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)];
  });
}

/** The four corners of a square outline of a given side, centred on a point. */
function boxPoints(centre: readonly [number, number], width: number, height: number): number[][] {
  const [x, y] = centre;
  return [
    [x - width / 2, y - height / 2],
    [x + width / 2, y - height / 2],
    [x + width / 2, y + height / 2],
    [x - width / 2, y + height / 2],
  ];
}

/** The letters the plans are gridded with, and the numerals — three axes each, S apart. */
const LETTERS: readonly string[] = ["A", "B", "C"];
const NUMERALS: readonly string[] = ["1", "2", "3"];

/** Where the letter axis at this index stands along x, and the numeral axis along y. */
function letterAt(index: number): number {
  return index * S;
}
function numeralAt(index: number): number {
  return -index * S;
}

/** The nine marks a nine-column plan is drawn with: three spellings of C1, then C2s, then C3s. */
const NINE_MARKS: readonly string[] = ["C-1", "c1.", "C 1", "C2", "C2", "C2", "C3", "C3", "C3"];

/** The four marks the foundation plan is drawn with (AC-6). */
const FOUNDATION_MARKS: readonly string[] = ["F1", "F2", "F3", "F4"];

/** The schedule the TYPICAL_RANGE artifact draws, so the registry names some of its marks (AC-1). */
const SCHEDULE_HEADERS: readonly string[] = ["MARK", "GF TO 3RD", "MAIN BAR"];
const SCHEDULE_ROWS: readonly (readonly string[])[] = [
  ["C1", '12"x15"', "8-16Ø"],
  ["C2", '15"x15"', "6-16Ø"],
];

/** Where the schedule stands, and the pitch its bands are stacked at. */
const SCHEDULE_AT: readonly [number, number] = [40000, 3000];
const SCHEDULE_COLUMNS: readonly number[] = [40000, 40800, 41600];
const SCHEDULE_PITCH = 500;

/**
 * An EntityGraph v2 drawn to whichever of the six scenarios is asked for. Every ordinal is minted
 * from `salt`, so two artifacts built here are two different drawings.
 *
 * Every plan is drawn on ONE grid — three letter axes along x and three numeral axes along y, S
 * apart — so the view's minimum grid spacing is S and the placement shares scale by something the
 * drawing itself states.
 */
export function buildPlacementArtifact(scenario: PlacementScenario, salt: number): BuiltPlacementArtifact {
  const base = salt * 0x10000;
  let ordinal = 0;
  const next = (): string => handle(base + (ordinal += 1));
  const originals: Drawn[] = [];
  const members: DrawnMember[] = [];
  const levelMarks: DrawnLevelMark[] = [];

  const text = (value: string, at: readonly [number, number], height: number, layer: string): string => {
    const key = next();
    originals.push({ key, type: TYPE_TEXT, space: MODEL_SPACE, layer, text: value, height, points: [[at[0], at[1]]] });
    return key;
  };
  const ring = (centre: readonly [number, number]): string => {
    const key = next();
    originals.push({ key, type: TYPE_RING, space: MODEL_SPACE, layer: LAYER_BUBBLES, closed: true, points: ringPoints(centre, BUBBLE_RADIUS, BUBBLE_VERTICES) });
    return key;
  };
  const outline = (centre: readonly [number, number], width: number, height: number): string => {
    const key = next();
    originals.push({ key, type: TYPE_RING, space: MODEL_SPACE, layer: LAYER_OUTLINES, closed: true, points: boxPoints(centre, width, height) });
    return key;
  };
  const line = (from: readonly [number, number], to: readonly [number, number], layer: string): void => {
    originals.push({ key: next(), type: TYPE_LINE, space: MODEL_SPACE, layer, points: [[from[0], from[1]], [to[0], to[1]]] });
  };

  /** The plan's grid: a bubble per axis, each ring paired with the bare label standing inside it. */
  const gridBubbles = (): void => {
    for (const [index, letter] of LETTERS.entries()) {
      const centre: [number, number] = [letterAt(index), S];
      ring(centre);
      text(letter, centre, LABEL_HEIGHT, LAYER_LABELS);
      line([letterAt(index), S - 1000], [letterAt(index), numeralAt(LETTERS.length - 1) - 1000], LAYER_LINES);
    }
    for (const [index, numeral] of NUMERALS.entries()) {
      const centre: [number, number] = [-S, numeralAt(index)];
      ring(centre);
      text(numeral, centre, LABEL_HEIGHT, LAYER_LABELS);
      line([-S + 1000, numeralAt(index)], [letterAt(LETTERS.length - 1) + 1000, numeralAt(index)], LAYER_LINES);
    }
  };

  /** One member: a closed outline and the mark that anchors it, both cited by the placement. */
  const member = (o: { markText: string; centre: [number, number]; side: number; gridLetter: string; gridNumeral: string; markAt?: [number, number]; placed?: boolean; longSide?: number }): void => {
    const outlineKey = outline(o.centre, o.longSide ?? o.side, o.side);
    const markKey = text(o.markText, o.markAt ?? o.centre, LABEL_HEIGHT, LAYER_MARKS);
    members.push({
      markText: o.markText,
      mark: normalisedMarkOf(o.markText),
      outlineKey,
      markKey,
      x: o.centre[0],
      y: o.centre[1],
      gridLetter: o.gridLetter,
      gridNumeral: o.gridNumeral,
      placed: o.placed ?? true,
    });
  };

  const caption = CAPTION_OF[scenario] ?? "";
  const wide = scenario === SCENARIO.SHARES;
  const captionAt: [number, number] = scenario === SCENARIO.SECTIONS ? [0, 12000] : wide ? [18000, 6000] : [S, 3000];
  const captionKey = text(caption, captionAt, wide ? WIDE_CAPTION_HEIGHT : CAPTION_HEIGHT, LAYER_CAPTIONS);
  let scheduleCaptionKey: string | null = null;

  if (scenario === SCENARIO.TYPICAL_RANGE || scenario === SCENARIO.TYPICAL_BARE || scenario === SCENARIO.SINGLE_LEVEL) {
    gridBubbles();
    let index = 0;
    for (const [row, numeral] of NUMERALS.entries()) {
      for (const [column, letter] of LETTERS.entries()) {
        const markText = NINE_MARKS[index] ?? "C9";
        index += 1;
        member({ markText, centre: [letterAt(column), numeralAt(row)], side: COLUMN_SIDE, gridLetter: letter, gridNumeral: numeral });
      }
    }
  }

  if (scenario === SCENARIO.FOUNDATION) {
    gridBubbles();
    let index = 0;
    for (const row of [0, 1]) {
      for (const column of [0, 1]) {
        const markText = FOUNDATION_MARKS[index] ?? "F9";
        index += 1;
        member({
          markText,
          centre: [letterAt(column), numeralAt(row)],
          side: FOOTING_SIDE,
          gridLetter: LETTERS[column] ?? "",
          gridNumeral: NUMERALS[row] ?? "",
        });
      }
    }
  }

  if (scenario === SCENARIO.SHARES) {
    // The grid this view's shares scale by: three letters along x, two numerals along y, S apart.
    for (const [index, letter] of LETTERS.entries()) {
      const centre: [number, number] = [letterAt(index), 2000];
      ring(centre);
      text(letter, centre, LABEL_HEIGHT, LAYER_LABELS);
    }
    for (const index of [0, 1]) {
      const centre: [number, number] = [-2000, numeralAt(index)];
      ring(centre);
      text(NUMERALS[index] ?? "1", centre, LABEL_HEIGHT, LAYER_LABELS);
    }
    line([-3000, 0], [12000, 0], LAYER_LINES);
    line([0, 3000], [0, -6000], LAYER_LINES);

    // C2: two outlines whose centres stand 0.05·S apart, under one mark drawn between them.
    const gap = DRAWN_MERGE_GAP * S;
    const first = outline([0, 0], COLUMN_SIDE, COLUMN_SIDE);
    const second = outline([0, -gap], COLUMN_SIDE, COLUMN_SIDE);
    const c2Mark = text("C2", [0, -gap / 2], LABEL_HEIGHT, LAYER_MARKS);
    members.push({ markText: "C2", mark: "C2", outlineKey: first, markKey: c2Mark, x: 0, y: 0, gridLetter: "A", gridNumeral: "1", placed: true });
    members.push({ markText: "C2", mark: "C2", outlineKey: second, markKey: c2Mark, x: 0, y: -gap, gridLetter: "A", gridNumeral: "1", placed: false });

    // c-4.: one outline, its mark drawn 0.85·S away — inside the near-anchor share the seed states.
    member({
      markText: "c-4.",
      centre: [letterAt(2), 0],
      side: COLUMN_SIDE,
      gridLetter: "C",
      gridNumeral: "1",
      markAt: [letterAt(2), -DRAWN_NEAR_ANCHOR * S],
    });

    // C3: one outline, its mark drawn 0.95·S away — outside it.
    member({
      markText: "C3",
      centre: [16000, 0],
      side: COLUMN_SIDE,
      gridLetter: "C",
      gridNumeral: "1",
      markAt: [16000, -DRAWN_FAR_ANCHOR * S],
      placed: false,
    });

    // C5: an outline 3·S long, anchored by its own mark — a thing of the drawing, not a column.
    member({
      markText: "C5",
      centre: [30000, -5800],
      side: COLUMN_SIDE,
      longSide: DRAWN_LONG_OUTLINE * S,
      gridLetter: "C",
      gridNumeral: "2",
      placed: false,
    });
  }

  if (scenario === SCENARIO.SECTIONS) {
    for (const mark of LEVEL_MARKS) {
      const markKey = text(mark.text, [0, mark.elevation * 1000], LABEL_HEIGHT, LAYER_MARKS);
      levelMarks.push({ text: mark.text, label: mark.label, elevation: mark.elevation, markKey });
      line([0, mark.elevation * 1000], [6000, mark.elevation * 1000], LAYER_SECTION);
    }
    line([0, 0], [0, 9150], LAYER_SECTION);
    line([6000, 0], [6000, 9150], LAYER_SECTION);
  }

  if (scenario === SCENARIO.TYPICAL_RANGE) {
    // A member-type schedule on the same sheet: the registry it feeds names C1 and C2 and not C3, so
    // a placement's `member_family` is a join and never a constant (AC-1).
    scheduleCaptionKey = text(CAPTION_SCHEDULE, SCHEDULE_AT, CAPTION_HEIGHT, LAYER_CAPTIONS);
    const bands = [SCHEDULE_HEADERS, ...SCHEDULE_ROWS];
    for (const [row, band] of bands.entries()) {
      for (const [column, cell] of band.entries()) {
        text(cell, [SCHEDULE_COLUMNS[column] ?? SCHEDULE_AT[0], SCHEDULE_AT[1] - (row + 1) * SCHEDULE_PITCH], LABEL_HEIGHT, LAYER_TEXT);
      }
    }
  }

  // The paper layout: a sheet's own furniture, which L-CAD-06 does not partition at all.
  originals.push({ key: next(), type: TYPE_TEXT, space: PAPER_SPACE, layer: "TITLEBLOCK", text: "S-101 GENERAL ARRANGEMENT", height: 3, points: [[5, 5]] });
  originals.push({ key: next(), type: TYPE_LINE, space: PAPER_SPACE, layer: "TITLEBLOCK", points: [[0, 0], [297, 210]] });

  const modelPoints = originals.filter((record) => record.space === MODEL_SPACE).flatMap((record) => record.points ?? []);
  const xs = modelPoints.map((point) => point[0] ?? 0);
  const ys = modelPoints.map((point) => point[1] ?? 0);
  const graph: Record<string, JsonValue> = {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      { name: MODEL_SPACE, kind: "model", bbox: { min: [Math.min(...xs) - 10, Math.min(...ys) - 10], max: [Math.max(...xs) + 10, Math.max(...ys) + 10] }, strays_rejected: 0 },
      { name: PAPER_SPACE, kind: "paper", bbox: { min: [0, 0], max: [297, 210] }, strays_rejected: 0 },
    ] as unknown as JsonValue,
    dropped_layouts: [],
    entities: originals.map((record) => ({ ...record, colour: CHANNELS })) as unknown as JsonValue,
    derived: [],
    block_attributes: [],
    counters: [],
  };

  return {
    scenario,
    json: JSON.stringify(graph),
    graph,
    originals,
    captionKey,
    caption,
    scheduleCaptionKey,
    members,
    levelMarks,
    minSpacing: S,
  };
}

/**
 * L-CAD-07's label normalisation, as the ARTIFACT is read by this acceptance: dotless, uppercase,
 * with whitespace and hyphens dropped. The product's own `normaliseMark` is what the criteria grade;
 * this is how the built drawing states what it drew, so the two are independent readings of one rule.
 */
export function normalisedMarkOf(text: string): string {
  return text
    .toUpperCase()
    .replace(/[.\s-]/g, "")
    .trim();
}

/**
 * One measurement, at the precision two readings of it are compared to. Both sides read the same
 * drawn coordinates, so they agree in substance; comparing to a millionth of a drawing unit whose
 * bays are thousands of them leaves the last bit of a double to be the last bit of a double.
 */
export function atPrecision(value: number): number {
  const rounded = Math.round(value * 1e6) / 1e6;
  return rounded === 0 ? 0 : rounded;
}

/** The members of a built artifact the drawing means to be placed (AC-2's four cases). */
export function placedMembersOf(built: BuiltPlacementArtifact): DrawnMember[] {
  return built.members.filter((member) => member.placed);
}

/* ------------------------------------------------------------------ staging a project and a drawing */

/** A staged workspace: a person who holds every permission, and a project with a real pin. */
export type PlacementStage = { person: Person; projectId: string; actor: ActorCtx };

/**
 * A person, and a project of theirs made THROUGH THE SHIPPED DOOR so L-REG-07's pin really forks: the
 * placement shares are read off that pin, and a project inserted behind the door's back would have
 * no edition to read them from (L-MEA-01).
 */
export async function stagePlacementProject(label: string): Promise<PlacementStage> {
  await openSheetsStage();
  const { person } = await stagePerson(`placement-${label}`);
  const projects = await productModule<{ createProject: (ctx: ActorCtx, draft: { name: string }) => Promise<{ projectId: string }> }>(PROJECTS_MODULE);
  const created = await projects.createProject(actorOf(person), { name: unique(`Placement ${label}`) });
  expect(typeof created.projectId, `${PROJECTS_MODULE} answered the project it created: ${JSON.stringify(created)}`).toBe("string");
  const projectId = created.projectId;
  ensureRole(person.tenantId, projectId, person.userId, PRINCIPAL);
  return { person, projectId, actor: actorOf(person) };
}

/**
 * Put a person on a project holding a role, unless the door that made the project already did. The
 * roster is `participant_roles` and it holds a role once, so a second grant of the same role is a
 * unique violation rather than a no-op — and whether the shipped door grants the founder anything is
 * the door's own business, not something this stage may assume either way (L-ACT-03).
 */
export function ensureRole(tenantId: string, projectId: string, userId: string, role: string): void {
  const held = storeRows("participant_roles", tenantId).some(
    (row) => said(row, "projectId", "project_id") === projectId && said(row, "userId", "user_id") === userId && said(row, "role", "role") === role,
  );
  if (!held) grantRole(tenantId, projectId, userId, role);
}

/** A second person on the same project, holding one role and nothing else (AC-5's REVIEWER). */
export async function stageColleague(stage: PlacementStage, label: string, role: string): Promise<{ person: Person; actor: ActorCtx }> {
  const { person } = await stagePerson(`placement-${label}`);
  joinWorkspace(stage.person.tenantId, person.userId);
  ensureRole(stage.person.tenantId, stage.projectId, person.userId, role);
  return { person: { ...person, tenantId: stage.person.tenantId }, actor: { ...actorOf(person), tenantId: stage.person.tenantId } };
}

/** One staged ingest of a built artifact: the drawing, its record, and the artifact it was made of. */
export type StagedPlacementIngest = { drawing: StagedDrawing; drawingId: string; ingestId: string; artifact: BuiltPlacementArtifact };

/**
 * A recorded drawing whose ingest artifact is the built one: the bytes are seeded into the store and
 * the shipped ingest job is run over a stand-in CLI that hands back the artifact. What lands is a
 * real `ingests` row, written by the product's own pipeline (B-17).
 */
export async function stagePlacementIngest(stage: PlacementStage, scenario: PlacementScenario, salt: number): Promise<StagedPlacementIngest> {
  const job = await productModule<{ runIngestJob: (payload: unknown, progress: ProgressLike, deps: { storage: unknown }) => Promise<void> }>(INGEST_JOB_MODULE);
  const records = await productModule<{ ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> }>(INGEST_MODULE);

  const artifact = buildPlacementArtifact(scenario, salt);
  const bytes = new TextEncoder().encode(`0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n; ${scenario} ${salt}\n`);
  const drawing = await stageDrawing(stage.person, stage.projectId, bytes, { name: unique(`${scenario}.dxf`), format: "dxf" });
  const stub = stubCli({ artifact: artifact.json, stderr: "", exitCode: 0 });

  await withCadCommand(stub.command, async () => {
    await job.runIngestJob(
      { tenantId: stage.person.tenantId, drawingId: drawing.drawingId, requestedBy: stage.person.userId, declared: null },
      { jobId: unique(`ingest-${scenario}`), tempDir: tempDir("ingest"), step: async () => undefined },
      { storage: await storageOf() },
    );
  });

  const record = await records.ingestRecordOf({ tenantId: stage.person.tenantId, drawingId: drawing.drawingId });
  expect(record, `staging ${scenario} left no ingest record — a partition is a reading of a record`).not.toBeNull();
  return { drawing, drawingId: drawing.drawingId, ingestId: (record as { ingestId: string }).ingestId, artifact };
}

/** One run of the shipped partition job over a staged ingest, with the steps it recorded. */
export async function runPlacementPartition(stage: PlacementStage, staged: StagedPlacementIngest, label = "placement"): Promise<StepRecord[]> {
  const rebuild = await rebuildDoor();
  const sink = stepSink(label);
  await rebuild.runPartitionJob(
    { tenantId: stage.person.tenantId, drawingId: staged.drawingId, ingestId: staged.ingestId, requestedBy: stage.person.userId },
    sink.progress,
    { storage: await storageOf() },
  );
  return sink.steps;
}

/** The detail one step of a run recorded, asserted present. */
export function stepDetail(steps: readonly StepRecord[], step: string): Record<string, unknown> {
  const found = steps.find((one) => one.step === step);
  expect(found, `the run recorded a \`${step}\` step (it recorded ${steps.map((one) => one.step).join(", ")})`).toBeTruthy();
  return (found as StepRecord).detail;
}

/** The steps a run recorded, by name, in the order they were recorded. */
export function stepNames(steps: readonly StepRecord[]): string[] {
  return steps.map((one) => one.step);
}

/* ------------------------------------------------------------------ the level stack and the pin */

/** One authored level of the live stack: its label and the surrogate the ledger minted for it. */
export type StackedLevel = { label: string; ordinal: number; levelId: string };

/**
 * A live level stack, authored as ONE `INSERT_LEVEL` — the act the levels increment publishes. The
 * surrogate ids are read back off the store, because a level is referenced by surrogate and never by
 * label (L-REG-02).
 */
export async function stageStack(stage: PlacementStage, labels: readonly string[], firstOrdinal = 1): Promise<StackedLevel[]> {
  const proposed: ProposedLevel[] = labels.map((label, index) => ({ label, ordinal: firstOrdinal + index }));
  await performAct(stage.actor, insertion(stage.projectId, proposed));
  return levelsOfProject(stage).filter((level) => labels.includes(level.label));
}

/** Every live level of a project, as the store holds it: label, ordinal and surrogate. */
export function levelsOfProject(stage: PlacementStage): StackedLevel[] {
  return storeRows(LEVELS_TABLE, stage.person.tenantId)
    .filter((row) => String(field(row, "projectId", "project_id")) === stage.projectId && (field(row, "repudiatedActId", "repudiated_act_id") ?? null) === null)
    .map((row) => ({ label: String(row["label"]), ordinal: Number(row["ordinal"]), levelId: String(field(row, "levelId", "level_id")) }))
    .sort((left, right) => left.ordinal - right.ordinal);
}

/** The level of a live stack carrying this label, asserted present. */
export function levelNamed(levels: readonly StackedLevel[], label: string): StackedLevel {
  const found = levels.find((level) => level.label === label);
  expect(found, `the live stack carries ${label} (it carries ${levels.map((level) => level.label).join(", ")})`).toBeTruthy();
  return found as StackedLevel;
}

/**
 * A pinned drawing-set revision whose manifest names this drawing — driven through the shipped path:
 * a set is made, the drawing is toggled into it, and the set is pinned through the one act seam, so
 * the revision the expansion resolves over is a real row the product itself wrote (B-17, L-REG-06).
 */
export async function pinRevisionNaming(stage: PlacementStage, drawingId: string): Promise<string> {
  const sets = await setsSeam();
  const acts = await actsSeam();
  const scope = { tenantId: stage.person.tenantId, projectId: stage.projectId };
  const created = await sets.createSet(scope, { userId: stage.person.userId }, unique("placement set"));
  expect(created.created, `the set for the pinned revision was created: ${JSON.stringify(created)}`).toBe(true);
  const setId = (created as { created: true; setId: string }).setId;
  const toggled = await sets.toggleMember(scope, setId, drawingId);
  expect(toggled.toggled, `the drawing was toggled into the set: ${JSON.stringify(toggled)}`).toBe(true);

  const before = new Set(setRevisionIds(stage));
  const input = pinning(stage.projectId, setId);
  const pinner = stage.actor as unknown as Parameters<typeof acts.preview>[0];
  const consequence = await acts.preview(pinner, input);
  await acts.commit(pinner, input, acts.consequenceDigest(consequence));
  const added = setRevisionIds(stage).filter((id) => !before.has(id));
  expect(added.length, "pinning the set added exactly one revision to the ledger (L-REG-06)").toBe(1);
  return added[0] as string;
}

/** Every set revision id this project holds. */
export function setRevisionIds(stage: PlacementStage): string[] {
  return storeRows("drawing_set_revisions", stage.person.tenantId)
    .filter((row) => String(field(row, "projectId", "project_id")) === stage.projectId)
    .map((row) => String(field(row, "setRevisionId", "set_revision_id")));
}

/* ------------------------------------------------------------------ the pinned edition's shares */

/**
 * The four placement shares this project is pinned to, read off its own rule-set edition through the
 * surface's own door. Never spelled here: an edition authored with other values moves what the step
 * owes with it (L-MEA-01, B-19).
 */
export async function pinnedSharesOf(stage: PlacementStage): Promise<Record<string, string>> {
  const editions = await productModule<{
    projectRulesetView: (scope: { tenantId: string; projectId: string }) => Promise<{ pinned: boolean; parameters?: Readonly<Record<string, { value: string; unit: string }>> }>;
  }>(EDITIONS_MODULE);
  const view = await editions.projectRulesetView({ tenantId: stage.person.tenantId, projectId: stage.projectId });
  expect(view.pinned, "the project is pinned to a rule-set edition — L-REG-07 makes an unpinned project unrepresentable").toBe(true);
  const parameters = view.parameters ?? {};
  return Object.fromEntries(
    SHARE_NAMES.map((share) => {
      const parameter = SHARE_PARAMETERS[share] ?? share;
      const held = parameters[parameter];
      expect(held, `the pinned edition states \`${parameter}\` — the share \`${share}\` is scaled by it (L-MEA-01)`).toBeTruthy();
      return [share, String((held as { value: string }).value)];
    }),
  );
}

/* ------------------------------------------------------------------ the pure halves */

/** What the stages before placement derived, as the pure detector is handed it (increment interfaces). */
export type PlacementEvidence = {
  graph: unknown;
  views: readonly unknown[];
  assignments: ReadonlyMap<string, string>;
  grid: unknown;
  shares: Record<string, string>;
  families: readonly unknown[];
};

/** What `detectPlacements` answers (increment interfaces: the `placement` step's own detail). */
export type DetectedPlacements = { views?: number; placements?: readonly Record<string, unknown>[]; ungridded?: readonly unknown[] } & Record<string, unknown>;

/** The pure detector, with the call this stage makes through it asserted by name before it is used. */
export async function detectDoor(): Promise<{ detectPlacements: (evidence: PlacementEvidence) => DetectedPlacements }> {
  const door = await productModule<Record<string, unknown>>(PLACEMENT_DETECT_MODULE);
  expect(typeof door["detectPlacements"], `${PLACEMENT_DETECT_MODULE} publishes \`detectPlacements\``).toBe("function");
  return door as { detectPlacements: (evidence: PlacementEvidence) => DetectedPlacements };
}

/** The pure expansion resolver (goal: "a pure, order-independent resolver"). */
export async function expansionDoor(): Promise<{ resolveExpansion: (evidence: Record<string, unknown>) => Record<string, unknown> }> {
  const door = await productModule<Record<string, unknown>>(EXPANSION_MODULE);
  expect(typeof door["resolveExpansion"], `${EXPANSION_MODULE} publishes \`resolveExpansion\``).toBe("function");
  return door as { resolveExpansion: (evidence: Record<string, unknown>) => Record<string, unknown> };
}

/**
 * The evidence the stages before placement leave, derived from a built artifact by the product's own
 * earlier stages: the views the first stage cuts, the profile the second resolves and the grid the
 * third detects. Nothing here re-implements a stage — the pure detector is handed exactly what the
 * job hands it.
 */
export async function evidenceOf(built: BuiltPlacementArtifact, shares: Record<string, string>): Promise<PlacementEvidence> {
  const assign = await productModule<{ partitionArtifact: (graph: unknown) => { views: readonly unknown[]; assignments: ReadonlyMap<string, string> } }>(VIEWS_ASSIGN_MODULE);
  const census = await productModule<{ censusOf: (graph: unknown, views: readonly unknown[]) => unknown }>(CONVENTIONS_CENSUS_MODULE);
  const conventions = await productModule<{ resolve: (census: unknown) => unknown }>(CONVENTIONS_RESOLVE_MODULE);
  const grid = await productModule<{ detectGrid: (evidence: { graph: unknown; views: readonly unknown[]; assignments: ReadonlyMap<string, string>; profile: unknown }) => unknown }>(GRID_DETECT_MODULE);

  const partitioned = assign.partitionArtifact(built.graph);
  const profile = conventions.resolve(census.censusOf(built.graph, partitioned.views));
  return {
    graph: built.graph,
    views: partitioned.views,
    assignments: partitioned.assignments,
    grid: grid.detectGrid({ graph: built.graph, views: partitioned.views, assignments: partitioned.assignments, profile }),
    shares,
    families: [],
  };
}

/** The placements a pure answer carries, whichever of the two published shapes it answers in. */
export function placementsAnswered(answer: DetectedPlacements | readonly Record<string, unknown>[]): Record<string, unknown>[] {
  if (Array.isArray(answer)) return [...answer];
  const held = (answer as DetectedPlacements).placements;
  expect(Array.isArray(held), `detectPlacements answers the placements it read: ${JSON.stringify(answer)}`).toBe(true);
  return [...((held ?? []) as readonly Record<string, unknown>[])];
}

/** The marks a list of answered or stored placements carries, in code-point order. */
export function marksOf(rows: readonly Record<string, unknown>[]): string[] {
  return rows.map((row) => String(field(row, "mark", "mark") ?? "")).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/* ------------------------------------------------------------------ reading the store */

/** Every row of one table of one ingest, whole — the acceptance's own audit read. */
export function rowsOfIngest(table: string, tenantId: string, ingestId: string): StoreRow[] {
  return storeRows(table, tenantId).filter((row) => String(field(row, "ingestId", "ingest_id") ?? "") === ingestId);
}

/** Every `placements` row of one ingest (AC-1). */
export function placementRows(tenantId: string, ingestId: string): StoreRow[] {
  return rowsOfIngest(PLACEMENTS, tenantId, ingestId);
}

/** Every `expansion_deferrals` row of one ingest (AC-4). */
export function expansionDeferralRows(tenantId: string, ingestId: string): StoreRow[] {
  return rowsOfIngest(EXPANSION_DEFERRALS, tenantId, ingestId);
}

/** Every `proposed_levels` row of one ingest (AC-7). */
export function proposedLevelRows(tenantId: string, ingestId: string): StoreRow[] {
  return rowsOfIngest(PROPOSED_LEVELS, tenantId, ingestId);
}

/** Every `typical_ranges` row of one workspace (AC-5). */
export function typicalRangeRows(tenantId: string): StoreRow[] {
  return storeRows(TYPICAL_RANGES, tenantId);
}

/** Every `register_objects` row standing for one set revision (AC-3). */
export function registerObjectRows(tenantId: string, setRevisionId: string): StoreRow[] {
  return storeRows(REGISTER_OBJECTS, tenantId).filter((row) => String(field(row, "setRevisionId", "set_revision_id") ?? "") === setRevisionId);
}

/** Every `refused_sightings` row of one workspace (AC-5, AC-8). */
export function refusedSightingRows(tenantId: string): StoreRow[] {
  return storeRows(REFUSED_SIGHTINGS, tenantId);
}

/** Every `quantity_lines` row of one workspace (AC-4: none cites a placeholder). */
export function quantityLineRows(tenantId: string): StoreRow[] {
  return storeRows(QUANTITY_LINES, tenantId);
}

/** Every `member_types` row of one ingest — what a placement's `member_family` joins to (AC-1). */
export function memberTypeRows(tenantId: string, ingestId: string): StoreRow[] {
  return rowsOfIngest(MEMBER_TYPES, tenantId, ingestId);
}

/** Every `grids` row of one ingest, as the placement's grid reference is read against (AC-1). */
export function gridRows(tenantId: string, ingestId: string): StoreRow[] {
  return rowsOfIngest(GRIDS, tenantId, ingestId);
}

/** Every `acts` row of one workspace, oldest first. */
export function actRowsOf(tenantId: string): StoreRow[] {
  return storeRows(ACTS_TABLE, tenantId);
}

/** Every `storey_height_readings` row of one workspace (AC-7). */
export function readingRowsOf(tenantId: string): StoreRow[] {
  return storeRows(STOREY_HEIGHT_READINGS, tenantId);
}

/** Every `levels` row of one workspace, whatever project it stands in (AC-7's "no row"). */
export function levelRowsOf(tenantId: string): StoreRow[] {
  return storeRows(LEVELS_TABLE, tenantId);
}

/** One field of a stored row, under either the door's spelling or the column's (C-05). */
export function said(row: StoreRow, camel: string, snake: string): string {
  const value = field(row, camel, snake);
  return value === null || value === undefined ? "" : String(value);
}

/** A list of strings, in code-point order — the store's order is nobody's contract (C-05). */
export function ordered(values: readonly string[]): string[] {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/** The view key of one ingest's view of a class, read off the partition the run really left. */
export async function viewKeysOfType(tenantId: string, ingestId: string, type: string): Promise<string[]> {
  const law = await viewsLaw();
  const spelled = String(law.VIEW_TYPE[type]);
  return rowsOfIngest("partition_views", tenantId, ingestId)
    .filter((row) => said(row, "type", "type") === spelled)
    .map((row) => said(row, "viewKey", "view_key"))
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/** The one view of a class an ingest carries — a singular, asserted rather than assumed. */
export async function oneViewKeyOfType(tenantId: string, ingestId: string, type: string): Promise<string> {
  const keys = await viewKeysOfType(tenantId, ingestId, type);
  expect(keys.length, `the artifact's caption anchors exactly one ${type} view`).toBe(1);
  return keys[0] ?? "";
}

/**
 * The two lawful spellings of one view's key: the partition's own (`<class>:<anchor>`) and L-REG-04's
 * (`viewKey({ viewClass, captionAnchorSourceKey })`). A placement cites its view under one of them —
 * which one is the Builder's to choose, and the composition of the placement key is graded against
 * whichever the row itself carries (AC-1).
 */
export async function lawfulViewKeys(identity: IdentitySeam, type: string, anchorKey: string): Promise<string[]> {
  const law = await viewsLaw();
  const spelled = String(law.VIEW_TYPE[type]);
  return [`${spelled}:${anchorKey}`, identity.viewKey({ viewClass: spelled, captionAnchorSourceKey: anchorKey })];
}
