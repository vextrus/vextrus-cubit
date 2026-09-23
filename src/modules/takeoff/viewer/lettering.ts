// How a text record is lettered on the sheet (R-UI-040, L-CAD-05 v3, Decision I-462): the
// lines its words are drawn as, each glyph at the record's own cap height and the face's own
// advance, the run turned by the text's world rotation and set so that its anchor stands where the
// drawing says it does — the start, middle or end of the run; the baseline, the descenders, the
// middle or the cap top of the block.
//
// Pure and camera-free: the painter lays glyph quads from it once per layer, and the viewer's world
// box of a text — what a hit-test, a marquee, a selection mark and a fly-to frame — is the outline it
// answers (B-17). The face is handed in: the painter measures the one it letters in, and a box read
// where no face can be measured (the index's worker, a server) takes `NOMINAL_FACE`.
import { MTEXT_LINE_PITCH, displayLines } from "@/core/entitygraph/text";
import type { RenderRecord, TextJustify } from "./types";

/** A point in drawing units. */
export type Point = readonly [number, number];

/**
 * What a face says about one character, in cap heights: how far the pen moves after it, and the box
 * its ink stands in, measured from the pen on the baseline — `left`/`right` along the run, `ascent`
 * up from the baseline, `descent` down from it (positive down). A character with no ink — a space —
 * has a box of no extent and is laid as an advance alone.
 */
export type GlyphShape = {
  readonly advance: number;
  readonly left: number;
  readonly right: number;
  readonly ascent: number;
  readonly descent: number;
};

/** A face as lettering reads it: each character's shape, and how far its descenders reach, in cap heights. */
export type Face = {
  readonly shapeOf: (character: string) => GlyphShape;
  readonly descent: number;
};

/**
 * The face a box is read with where none can be measured: the product's own mono face, Spline Sans
 * Mono (`src/ui/fonts/`, 2000 units to the em), by the file's own figures — a capital stands 1454
 * units, every character advances 1200 (0.825 of a cap), an H's ink runs from 134 to 1066, and the
 * deepest descender (j) reaches 462 below the baseline. So the box the index, a hit, a marquee and a
 * fly-to read is the box the painter letters in once it has measured that face (I-462 (5)),
 * never a nominal few per cent wider. Every character is a capital's ink box, which is what a
 * drawing's lettering almost wholly is.
 */
export const MONO_UNITS = Object.freeze({ cap: 1454, advance: 1200, inkLeft: 134, inkRight: 1066, descender: 462 });
const NOMINAL_SHAPE: GlyphShape = Object.freeze({
  advance: MONO_UNITS.advance / MONO_UNITS.cap,
  left: MONO_UNITS.inkLeft / MONO_UNITS.cap,
  right: MONO_UNITS.inkRight / MONO_UNITS.cap,
  ascent: 1,
  descent: 0,
});
export const NOMINAL_FACE: Face = Object.freeze({ shapeOf: () => NOMINAL_SHAPE, descent: MONO_UNITS.descender / MONO_UNITS.cap });

/** One glyph as it is laid: the character, and its ink quad's four world corners — bottom left, bottom right, top right, top left. */
export type GlyphSink = (character: string, corners: readonly [number, number, number, number, number, number, number, number]) => void;

/** A text as lettered: the box it stands in, as four world corners in the same order, and the cap height it is drawn at. */
export type Lettering = {
  readonly outline: readonly [Point, Point, Point, Point];
  readonly height: number;
};

const DEGREES = Math.PI / 180;

/** Where the first baseline stands under the anchor, for a block of `lines` lines at cap height `height`. */
function firstBaseline(y: TextJustify["y"], lines: number, height: number, descent: number): number {
  const drop = (lines - 1) * MTEXT_LINE_PITCH * height;
  if (y === "top") return -height;
  if (y === "middle") return (drop + height) / 2 - height;
  if (y === "bottom") return descent * height + drop;
  return 0;
}

/** Where a line of this width starts, for an anchor at its start, middle or end. */
function lineStart(x: TextJustify["x"], width: number): number {
  if (x === "centre") return -width / 2;
  if (x === "right") return -width;
  return 0;
}

/** One line's run, in cap heights: the sum of its characters' advances. */
function runOf(line: string, face: Face): number {
  let run = 0;
  for (const character of line) run += face.shapeOf(character).advance;
  return run;
}

/**
 * Letter one text: every glyph handed to `sink` as its world quad (where a sink is given), and the
 * outline and cap height answered. Null for a record that is no text, stands nowhere, or has no
 * height to letter at — nothing of it can be drawn or framed.
 *
 * A fitted text (DXF "aligned" or "fit") runs from its anchor to its second point, turned along them:
 * its advances are stretched to the distance, and its height with them where the drawing scales it.
 */
export function letter(record: RenderRecord, face: Face, sink?: GlyphSink): Lettering | null {
  const height = record.height ?? 0;
  const anchor = record.anchor;
  if (record.text === undefined || anchor === undefined || !(height > 0) || !Number.isFinite(height)) return null;
  const lines = displayLines(record.text, record.type);
  const runs = lines.map((line) => runOf(line, face));

  let turn = (record.rotation ?? 0) * DEGREES;
  let across = height;
  let up = height;
  const justify: TextJustify = record.justify ?? { x: "left", y: "baseline" };
  if (record.fit !== undefined) {
    const dx = record.fit.to[0] - anchor[0];
    const dy = record.fit.to[1] - anchor[1];
    const distance = Math.hypot(dx, dy);
    const natural = (runs[0] ?? 0) * height;
    if (distance > 0 && natural > 0) {
      turn = Math.atan2(dy, dx);
      across = (height * distance) / natural;
      up = record.fit.height === "scaled" ? across : height;
    }
  }

  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const worldX = (x: number, y: number): number => anchor[0] + x * cos - y * sin;
  const worldY = (x: number, y: number): number => anchor[1] + x * sin + y * cos;

  const pitch = MTEXT_LINE_PITCH * up;
  const baseline = firstBaseline(justify.y, lines.length, up, face.descent);
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  lines.forEach((line, at) => {
    const width = (runs[at] ?? 0) * across;
    const start = lineStart(justify.x, width);
    if (start < minX) minX = start;
    if (start + width > maxX) maxX = start + width;
    if (sink === undefined) return;
    const y = baseline - at * pitch;
    let pen = start;
    for (const character of line) {
      const shape = face.shapeOf(character);
      if (shape.right > shape.left && shape.ascent + shape.descent > 0) {
        const left = pen + shape.left * across;
        const right = pen + shape.right * across;
        const bottom = y - shape.descent * up;
        const top = y + shape.ascent * up;
        sink(character, [
          worldX(left, bottom),
          worldY(left, bottom),
          worldX(right, bottom),
          worldY(right, bottom),
          worldX(right, top),
          worldY(right, top),
          worldX(left, top),
          worldY(left, top),
        ]);
      }
      pen += shape.advance * across;
    }
  });
  if (!(maxX >= minX)) {
    minX = 0;
    maxX = 0;
  }
  // The block: every line's run across, from the first line's cap top to the last line's descenders.
  const top = baseline + up;
  const bottom = baseline - (lines.length - 1) * pitch - face.descent * up;
  const corner = (x: number, y: number): Point => [worldX(x, y), worldY(x, y)];
  return {
    outline: [corner(minX, bottom), corner(maxX, bottom), corner(maxX, top), corner(minX, top)],
    height: up,
  };
}

/** The world box `[minX, minY, maxX, maxY]` of a text's outline, or null where it letters nothing. */
export function letteredBox(record: RenderRecord, face: Face = NOMINAL_FACE): [number, number, number, number] | null {
  const lettered = letter(record, face);
  if (lettered === null) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of lettered.outline) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}
