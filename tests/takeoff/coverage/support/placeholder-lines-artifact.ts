/**
 * The drawing `tests/takeoff/coverage/placeholder-lines.test.ts` is staged over (I-368), built here
 * and read by nothing but the shipped pipeline.
 *
 * Mechanics only, and PURE: no store, no stage, no product module. The suite that stages it is a
 * database suite, and the drawing is one spelling whichever lane reads it (B-17).
 *
 * Four views of one drawing, each captioned where its own entities stand nearest (L-CAD-06):
 *   · a beam layout under a BARE typical caption — `TYPICAL FLOOR BEAM LAYOUT`, F-RCC6-BNBC's S-14
 *     caption word for word, so its beams wait in the UNRESOLVED slot (L-CAD-07). Each beam is drawn as
 *     a plan draws one: two edge lines a beam's width apart, its mark beside the axis (L-MEA-09);
 *   · a long-section strip sheet stating each beam's section beside its mark, banded by the floors its
 *     own caption names (I-343) — ONE variant per family, as F-RCC6-BNBC's strips are, which is what
 *     lets the frame rail find a section for a beam standing on no level at all;
 *   · a foundation plan whose four footings stand in the FOUNDATION slot, as the placement stage's own
 *     FOUNDATION scenario draws them;
 *   · a footing schedule naming them, so each footing has a member type to be measured by.
 */

/** The grid spacing every plan is drawn on: S, the minimum grid spacing of each plan. */
const S = 4000;

/** Where the foundation plan and its schedule stand, clear of the beam plan and the strip sheet. */
const FOUNDATION_AT = -40000;

/** Where the strip sheet and the footing schedule stand, clear of both plans. */
const SHEET_X = 40000;

/** How tall a caption stands, and how tall every label, mark and cell text stands beside it. */
const CAPTION_HEIGHT = 500;
const LABEL_HEIGHT = 200;

/** The bubble radius, and how many vertices a round ring is drawn from (the grid's own reading). */
const BUBBLE_RADIUS = 300;
const BUBBLE_VERTICES = 16;

/** A beam's drawn width — inside the edition's pairing band, 0.08 × S — and how far its mark stands off its axis. */
const BEAM_WIDTH = 250;
const MARK_OFFSET = 400;

/** The side of a footing's outline. */
const FOOTING_SIDE = 1500;

/** The pitch the strip labels and the schedule's rows are stacked at, and the gap between its columns. */
const PITCH = 500;
const COLUMN_GAP = 800;

/** How far a strip's section is written to the right of its mark, on the same baseline (I-343). */
const SECTION_GAP = 1500;

/** The layers the drawing uses — census data, never a name anything reads a role off. */
const LAYER_CAPTIONS = "CAPTIONS";
const LAYER_BUBBLES = "GRID-BUBBLES";
const LAYER_LABELS = "GRID-LABELS";
const LAYER_LINES = "GRID-LINES";
const LAYER_BEAMS = "BEAMS";
const LAYER_FOOTINGS = "FOOTINGS";
const LAYER_MARKS = "MARKS";
const LAYER_TEXT = "SCHEDULE-TEXT";

/** The spaces the artifact draws in — the model, and the one paper layout a sheet carries. */
const MODEL_SPACE = "Model";
const PAPER_SPACE = "SHEET-1";

/** The captions, verbatim. */
export const BEAM_PLAN_CAPTION = "TYPICAL FLOOR BEAM LAYOUT";
export const STRIP_SHEET_CAPTION = "BEAM LONG SECTION (1ST TO 3RD FLOOR)";
export const FOUNDATION_PLAN_CAPTION = "FOUNDATION PLAN";
export const FOOTING_SCHEDULE_CAPTION = "FOOTING SCHEDULE";

/** The stack the strip sheet's band names, lowest first — what the suite authors and ranges over. */
export const STACK: readonly string[] = Object.freeze(["1ST", "2ND", "3RD"]);

/** The section every strip states, with the millimetre it is written in (I-302). */
const BEAM_SECTION = "250x450MM";

/** The size the footing schedule states for every footing. */
const FOOTING_SIZE = "1500x1500MM";

/** The letters the plans are gridded with, and the numerals — three axes each, S apart. */
const LETTERS: readonly string[] = ["A", "B", "C"];
const NUMERALS: readonly string[] = ["1", "2", "3"];

/**
 * The beams the layout draws: B1 along axis 1 over both bays, B2 along axis 2 over the first. Two
 * families, so a family is a join and never a constant; three members, so a family is not a member.
 */
const BEAMS: readonly { readonly mark: string; readonly numeral: number; readonly fromLetter: number; readonly toLetter: number }[] = [
  { mark: "B1", numeral: 0, fromLetter: 0, toLetter: 1 },
  { mark: "B1", numeral: 0, fromLetter: 1, toLetter: 2 },
  { mark: "B2", numeral: 1, fromLetter: 0, toLetter: 1 },
];

/** The footings the foundation plan draws, one per grid crossing of its first two bays. */
const FOOTINGS: readonly { readonly mark: string; readonly letter: number; readonly numeral: number }[] = [
  { mark: "F1", letter: 0, numeral: 0 },
  { mark: "F2", letter: 1, numeral: 0 },
  { mark: "F3", letter: 0, numeral: 1 },
  { mark: "F4", letter: 1, numeral: 1 },
];

/** One drawn record of the artifact, in the shape the mirror validates (L-CAD-05). */
type Drawn = { key: string; type: string; space: string; layer: string; text?: string; height?: number; closed?: boolean; points?: number[][] };

/** What the built drawing carries, so a case derives its expectations from it (B-19). */
export type PlaceholderLinesArtifact = {
  /** The artifact as the bytes the stand-in CLI hands back. */
  readonly json: string;
  /** How many beams the layout draws, and how many footings the foundation plan does. */
  readonly beams: number;
  readonly footings: number;
};

/** A source key of the DXF-handle scheme, from an ordinal (L-CAD-02). */
function handle(ordinal: number): string {
  return `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;
}

/** The vertices of a round ring — a bubble, as the grid's content signature reads one. */
function ringPoints(centre: readonly [number, number]): number[][] {
  return Array.from({ length: BUBBLE_VERTICES }, (_unused, index) => {
    const angle = (2 * Math.PI * index) / BUBBLE_VERTICES;
    return [centre[0] + BUBBLE_RADIUS * Math.cos(angle), centre[1] + BUBBLE_RADIUS * Math.sin(angle)];
  });
}

/** The four corners of a square outline centred on a point. */
function boxPoints(centre: readonly [number, number], side: number): number[][] {
  const [x, y] = centre;
  const half = side / 2;
  return [
    [x - half, y - half],
    [x + half, y - half],
    [x + half, y + half],
    [x - half, y + half],
  ];
}

/**
 * The drawing, minted from `salt` so two drawings built here are two different drawings. Every plan is
 * drawn on one grid of three letter axes along x and three numeral axes along y, S apart, so each
 * plan's minimum grid spacing is S and every share of it is a distance the drawing itself states.
 */
export function buildPlaceholderLinesArtifact(salt: number): PlaceholderLinesArtifact {
  const base = salt * 0x10000;
  let ordinal = 0;
  const next = (): string => handle(base + (ordinal += 1));
  const originals: Drawn[] = [];

  const text = (value: string, at: readonly [number, number], height: number, layer: string): void => {
    originals.push({ key: next(), type: "TEXT", space: MODEL_SPACE, layer, text: value, height, points: [[at[0], at[1]]] });
  };
  const line = (from: readonly [number, number], to: readonly [number, number], layer: string): void => {
    originals.push({ key: next(), type: "LINE", space: MODEL_SPACE, layer, points: [[from[0], from[1]], [to[0], to[1]]] });
  };
  const ring = (points: number[][], layer: string): void => {
    originals.push({ key: next(), type: "LWPOLYLINE", space: MODEL_SPACE, layer, closed: true, points });
  };

  /** One plan's grid, with its origin at `oy`: a bubble per axis, its bare label inside, its line across. */
  const grid = (oy: number): void => {
    for (const [index, letter] of LETTERS.entries()) {
      const centre: [number, number] = [index * S, oy + S];
      ring(ringPoints(centre), LAYER_BUBBLES);
      text(letter, centre, LABEL_HEIGHT, LAYER_LABELS);
      line([index * S, oy + S - 1000], [index * S, oy - (NUMERALS.length - 1) * S - 1000], LAYER_LINES);
    }
    for (const [index, numeral] of NUMERALS.entries()) {
      const centre: [number, number] = [-S, oy - index * S];
      ring(ringPoints(centre), LAYER_BUBBLES);
      text(numeral, centre, LABEL_HEIGHT, LAYER_LABELS);
      line([-S + 1000, oy - index * S], [(LETTERS.length - 1) * S + 1000, oy - index * S], LAYER_LINES);
    }
  };

  // The beam layout, under the bare caption.
  text(BEAM_PLAN_CAPTION, [S, 3000], CAPTION_HEIGHT, LAYER_CAPTIONS);
  grid(0);
  for (const beam of BEAMS) {
    const y = -beam.numeral * S;
    const [x0, x1] = [beam.fromLetter * S, beam.toLetter * S];
    line([x0, y + BEAM_WIDTH / 2], [x1, y + BEAM_WIDTH / 2], LAYER_BEAMS);
    line([x0, y - BEAM_WIDTH / 2], [x1, y - BEAM_WIDTH / 2], LAYER_BEAMS);
    text(beam.mark, [(x0 + x1) / 2, y + MARK_OFFSET], LABEL_HEIGHT, LAYER_MARKS);
  }

  // The strip sheet: each family labelled once, its section on the mark's baseline to the right.
  text(STRIP_SHEET_CAPTION, [SHEET_X, 3000], CAPTION_HEIGHT, LAYER_CAPTIONS);
  for (const [index, mark] of [...new Set(BEAMS.map((beam) => beam.mark))].entries()) {
    const y = 3000 - (index + 2) * PITCH;
    text(mark, [SHEET_X, y], LABEL_HEIGHT, LAYER_TEXT);
    text(BEAM_SECTION, [SHEET_X + SECTION_GAP, y], LABEL_HEIGHT, LAYER_TEXT);
  }

  // The foundation plan: four footings, each a closed outline with its mark at its centre.
  text(FOUNDATION_PLAN_CAPTION, [S, FOUNDATION_AT + 3000], CAPTION_HEIGHT, LAYER_CAPTIONS);
  grid(FOUNDATION_AT);
  for (const footing of FOOTINGS) {
    const centre: [number, number] = [footing.letter * S, FOUNDATION_AT - footing.numeral * S];
    ring(boxPoints(centre, FOOTING_SIDE), LAYER_FOOTINGS);
    text(footing.mark, centre, LABEL_HEIGHT, LAYER_MARKS);
  }

  // The footing schedule: a header row and one row per footing, as the placement stage draws its own.
  text(FOOTING_SCHEDULE_CAPTION, [SHEET_X, FOUNDATION_AT + 3000], CAPTION_HEIGHT, LAYER_CAPTIONS);
  const rows: readonly (readonly string[])[] = [["MARK", "SIZE"], ...FOOTINGS.map((footing) => [footing.mark, FOOTING_SIZE])];
  for (const [row, cells] of rows.entries()) {
    for (const [column, cell] of cells.entries()) {
      text(cell, [SHEET_X + column * COLUMN_GAP, FOUNDATION_AT + 3000 - (row + 1) * PITCH], LABEL_HEIGHT, LAYER_TEXT);
    }
  }

  // The paper layout: a sheet's own furniture, which L-CAD-06 does not partition at all.
  originals.push({ key: next(), type: "TEXT", space: PAPER_SPACE, layer: "TITLEBLOCK", text: "S-114 TYPICAL FLOOR BEAMS AND FOUNDATIONS", height: 3, points: [[5, 5]] });
  originals.push({ key: next(), type: "LINE", space: PAPER_SPACE, layer: "TITLEBLOCK", points: [[0, 0], [297, 210]] });

  const modelPoints = originals.filter((record) => record.space === MODEL_SPACE).flatMap((record) => record.points ?? []);
  const xs = modelPoints.map((point) => point[0] ?? 0);
  const ys = modelPoints.map((point) => point[1] ?? 0);
  const graph = {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      { name: MODEL_SPACE, kind: "model", bbox: { min: [Math.min(...xs) - 10, Math.min(...ys) - 10], max: [Math.max(...xs) + 10, Math.max(...ys) + 10] }, strays_rejected: 0 },
      { name: PAPER_SPACE, kind: "paper", bbox: { min: [0, 0], max: [297, 210] }, strays_rejected: 0 },
    ],
    dropped_layouts: [],
    entities: originals.map((record) => ({ ...record, colour: { rgb: [0, 0, 0], source: "bylayer" } })),
    derived: [],
    block_attributes: [],
    counters: [],
  };

  return { json: JSON.stringify(graph), beams: BEAMS.length, footings: FOOTINGS.length };
}
