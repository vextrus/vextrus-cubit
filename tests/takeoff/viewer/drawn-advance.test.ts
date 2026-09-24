/**
 * A drawing's text runs as long as the drawing letters it (Decision I-648,
 * `src/modules/takeoff/viewer/lettering.ts`): each line at DejaVu Sans's advance — the face the
 * product's DWG lane (`drawing_render`) letters a drawing's text in — with the capital A the text's
 * height, and the painter's face set evenly along that run. Walk 1 (B05) saw S-01's clear-cover row
 * run together in the mono face's 0.825-cap advance — `(pile caps)` into `25mm` — where the lane's
 * picture keeps them apart; the records below are S-01's own, by the drawing's figures.
 */
import { describe, expect, test } from "vitest";
import { DRAWN_ADVANCE, MONO_UNITS, NOMINAL_FACE, letter, letteredBox, type Face, type GlyphShape } from "../../../src/modules/takeoff/viewer/lettering";
import { DRAWN_UNITS } from "../../../src/modules/takeoff/viewer/drawn-advance";
import type { RenderRecord } from "../../../src/modules/takeoff/viewer/types";

const text = (fields: Partial<RenderRecord>): RenderRecord => ({ key: "DXF_HANDLE:1", type: "TEXT", rgb: [0, 0, 0], text: "C1", height: 10, anchor: [0, 0], ...fields });
const runOf = (line: string): number => [...line].reduce((run, character) => run + DRAWN_ADVANCE(character), 0);

describe("the drawn advance is the DWG lane's arithmetic", () => {
  test("DejaVu Sans's advances over the capital A's height, as ezdxf's own renderer measures them", () => {
    // Read through ezdxf 1.4.4's TTFontRenderer over DejaVuSans.ttf (`get_text_length`, cap height 1).
    expect(runOf("H")).toBeCloseTo(1.031480241125251, 12);
    expect(runOf('2" clear cover (pile caps)')).toBeCloseTo(17.172136637642332, 12);
    expect(runOf("MMMM")).toBeCloseTo(4.734092431346283, 12);
    expect(runOf("iiii")).toBeCloseTo(1.524447421299397, 12);
  });

  test("a character the face holds no glyph for advances as its missing glyph, never as nothing", () => {
    expect(DRAWN_ADVANCE("ঢ")).toBe(DRAWN_UNITS.missing / DRAWN_UNITS.cap);
    expect(DRAWN_ADVANCE("ঢ")).toBeGreaterThan(0);
  });

  test("a proportional run: a space and an i are narrow, an M wide — the mono face's one 0.825 is neither", () => {
    const mono = MONO_UNITS.advance / MONO_UNITS.cap;
    expect(DRAWN_ADVANCE(" ")).toBeLessThan(mono / 1.5);
    expect(DRAWN_ADVANCE("i")).toBeLessThan(mono / 2);
    expect(DRAWN_ADVANCE("M")).toBeGreaterThan(mono * 1.3);
  });
});

describe("a line runs as long as the drawing letters it, whatever face the painter letters in", () => {
  const INK: GlyphShape = { advance: 2, left: 0.2, right: 1.8, ascent: 1, descent: 0 };
  const WIDE: Face = { shapeOf: () => INK, descent: 0.2 };

  test("the outline is the drawn run: the same for the nominal face and a face twice as wide", () => {
    const record = text({ text: "2\" clear cover (pile caps)", height: 3.2, anchor: [16, 182] });
    const nominal = letteredBox(record) ?? [0, 0, 0, 0];
    const wide = letteredBox(record, WIDE) ?? [0, 0, 0, 0];
    expect(nominal[2] - nominal[0]).toBeCloseTo(runOf('2" clear cover (pile caps)') * 3.2, 9);
    expect(wide[2]).toBeCloseTo(nominal[2], 9);
  });

  test("the face's glyphs are set evenly along it: the first ink starts at the run's start, the last ends inside its end, one step apart", () => {
    const quads: number[][] = [];
    letter(text({ text: "ABCD", height: 10 }), WIDE, (_character, corners) => quads.push([...corners]));
    const run = runOf("ABCD") * 10;
    const along = run / 8; // the face's own run is 4 × 2 caps; one factor condenses it to the drawn run
    expect(quads).toHaveLength(4);
    expect(quads[0]?.[0]).toBeCloseTo(0.2 * along, 9);
    expect(quads[3]?.[2]).toBeCloseTo(run - 0.2 * along, 9);
    expect((quads[1]?.[0] ?? 0) - (quads[0]?.[0] ?? 0)).toBeCloseTo(2 * along, 9);
    // The height is the record's: the drawn run condenses a line across, never down.
    expect((quads[0]?.[5] ?? 0) - (quads[0]?.[1] ?? 0)).toBeCloseTo(10, 9);
  });

  test("each line of an MTEXT runs its own drawn length, centred lines each about the anchor", () => {
    const box = letteredBox(text({ type: "MTEXT", text: "MMMM\\Pii", justify: { x: "centre", y: "top" } })) ?? [0, 0, 0, 0];
    expect(box[2] - box[0], "the block is as wide as its longest drawn line").toBeCloseTo(runOf("MMMM") * 10, 9);
    const quads: number[][] = [];
    letter(text({ type: "MTEXT", text: "MMMM\\Pii", justify: { x: "centre", y: "top" } }), NOMINAL_FACE, (_c, corners) => quads.push([...corners]));
    const second = quads.slice(4);
    const mid = ((second[0]?.[0] ?? 0) + (second[1]?.[2] ?? 0)) / 2;
    expect(mid, "the short line is centred on the anchor too").toBeCloseTo(0, 6);
  });

  test("a fitted text still runs exactly from its anchor to its second point, its natural length the drawn run", () => {
    const quads: number[][] = [];
    const made = letter(text({ text: "AB", anchor: [0, 0], fit: { to: [40, 0], height: "kept" } }), NOMINAL_FACE, (_c, corners) => quads.push([...corners]));
    expect(made?.outline[1][0]).toBeCloseTo(40, 9);
    expect(made?.height).toBe(10);
    const scaled = letter(text({ text: "AB", anchor: [0, 0], fit: { to: [40, 0], height: "scaled" } }), NOMINAL_FACE);
    expect(scaled?.height, "an aligned text's height scales by the distance over the drawn run").toBeCloseTo((10 * 40) / (runOf("AB") * 10), 9);
  });
});

describe("S-01's materials block stands where the drawing puts it (walk 1, B05)", () => {
  /** S-01's clear-cover rows, by the drawing's own figures: each text's insert x, left on its baseline, 3.2 high. */
  const ROWS: readonly (readonly (readonly [number, string])[])[] = [
    [
      [16, '2" clear cover (pile caps)'],
      [80, "25mm clear cover (beams)"],
      [150, "40mm clear cover (columns)"],
      [222, "20mm clear cover (slabs)"],
    ],
    [
      [16, "75mm clear cover (piles & footings)"],
      [100, "30mm clear cover (tanks)"],
      [170, "25mm clear cover (lintels)"],
      [234, "20mm clear cover (walls, stairs & parapet)"],
    ],
  ];

  test("every text in a row ends before the next one starts — `(pile caps)` never runs into `25mm`", () => {
    for (const row of ROWS) {
      row.slice(0, -1).forEach(([x, words], at) => {
        const end = letteredBox(text({ text: words, height: 3.2, anchor: [x, 182] }))?.[2] ?? Number.POSITIVE_INFINITY;
        const next = row[at + 1]?.[0] ?? 0;
        expect(end, `"${words}" ends before x ${next}`).toBeLessThan(next);
      });
    }
  });

  test("the longest JUNCTION OWNERSHIP note, unwrapped, stays inside the sheet's frame and short of the title block", () => {
    const note =
      "JUNCTION OWNERSHIP: formwork: column 2(b+d) × (floor-to-floor \\U+2212 slab t) \\U+2212 beam-end contacts > 500 cm²; beam sides (D \\U+2212 t each side) + soffit b, × clear; slab soffit net of beam soffits and columns, free edges × t as EDGE; caps/GB/footing sides only; piles none; stair soffit + risers + strings";
    const end = letteredBox(text({ type: "MTEXT", text: note, height: 2.4, anchor: [16, 112], justify: { x: "left", y: "top" } }))?.[2] ?? Number.POSITIVE_INFINITY;
    // S-01's frame runs to x 584 and its title block stands from about x 524.
    expect(end).toBeLessThan(524);
  });
});
