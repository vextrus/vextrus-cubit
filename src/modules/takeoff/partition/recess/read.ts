// A recess cast into a member, as the set's own section of that member states it — the reading the
// pile cap's recess sentences name `Lr`, `Br` and `Dr` (I-546; Interpretation I-598).
//
// A lift pit sunk into a pile cap is a void in the cap's concrete, formed on its four sides. A set
// draws it where a cap detail shows it: in the cap's own section, the void cut into the cap's top —
// an OPEN outline whose two ends stand on the top edge of the cap's section ring and whose floor lies
// inside it — dimensioned across its mouth and down to its floor, and the plan the section cannot
// show written beside it as a size pair (`2493x2188`) under a note naming the recess. That is what is
// read, and every figure is carried as the set WRITES it, cited to the entity that writes it:
//
//   · the recess's length (`Lr`): the dimension whose definition points stand on the outline's two
//     sides — its own measurement text, never the drawn span (a figured dimension governs);
//   · its depth below the cap's top (`Dr`): the dimension whose definition points stand on the top
//     and on the floor;
//   · its breadth (`Br`): the other side of a size pair written in the same view as a note naming the
//     recess, one side of which is the length the dimension states. A pair none of whose sides is the
//     stated length says nothing this reader can tie to the void.
//
// A section is the section of the member its caption names: a caption naming ONE of the members
// asked about, and the word SECTION. The void stands inside that member's section ring, so the
// recess is bound to that member — and to every placement of it, a section being typical for its
// mark.
//
// What is drawn or named but not stated is said so, never dropped: a view that draws the void and
// dimensions it one way only states the other sides as nothing, and a caption or a note that names a
// member beside the word RECESS (`PC5: LIFT PIT RECESS, SEE S-07`) states that a recess is there even
// where no section of it is read. The rails then keep the member's rows naming the side they lack —
// the cap taken whole over a void nobody netted would read over (L-QTY-04).
//
// Pure: the artifact, the views and their assignments in, the statements out. No store, no scale —
// a transcribed figure needs none (L-QTY-03) — and nothing converted: the canon is reached at the
// gate (B-17, L-FRM-06).
import type { SectionUnit } from "@/core/db";
import { normaliseNotation } from "@/core/entitygraph/notation";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { definitionPointsByDimension, measurementTextsOf } from "@/core/scale/proposals";
import { parseFigure, parseSizePair } from "../notation";
import { MM_PER_INCH } from "../notation/grammar";

/** One view, as the reader is handed it: its key and the caption the partition read. */
export type RecessView = { readonly viewKey: string; readonly caption: string };

/** One side of a recess as the set writes it: the figure, its unit, and the entity that writes it. */
export type RecessSide = { readonly value: string; readonly unit: SectionUnit; readonly source: string };

/**
 * What one view states of one member's recess. `outlineKey` is the open outline the void is drawn by,
 * or null where the view only NAMES the member as recessed (a caption or a note) — then every side is
 * null. A side is null where the view states nothing that direction.
 */
export type RecessStatement = {
  readonly mark: string;
  readonly viewKey: string;
  readonly outlineKey: string | null;
  readonly length: RecessSide | null;
  readonly breadth: RecessSide | null;
  readonly depth: RecessSide | null;
};

/** What the reader is handed: one drawing's artifact and views, and the marks a recess may belong to. */
export type RecessInput = {
  readonly graph: EntityGraph;
  readonly views: readonly RecessView[];
  /** The view each entity stands in, by source key (L-CAD-06). */
  readonly assignments: ReadonlyMap<string, string>;
  /** The unit a bare figure is in, as the drawing declares it (I-302); none where it declares none. */
  readonly declaredUnit: SectionUnit | null;
  /** The marks of the members a recess may be cast into — the pile caps the partition placed. */
  readonly marks: readonly string[];
};

/** A point of the plane. */
type Point = readonly [number, number];

/**
 * How near two drawn points must stand to be one point, in drawing units: an outline's end on its
 * ring's edge, a dimension's definition point on the corner it was picked at. A draughtsman snaps
 * both; the tolerance only absorbs the artifact's own rounding.
 */
const ON_THE_POINT = 0.1;

/** How few vertices an open outline needs to be a void cut into a top: down, across, up. */
const FEWEST_OUTLINE_VERTICES = 4;

/** How many vertices a ring needs to enclose anything. */
const FEWEST_RING_VERTICES = 3;

/** The words that name a recess, and the word that makes a caption a section. */
const RECESS_WORD = /\bRECESS(?:ED|ES)?\b/;
const SECTION_WORD = /\bSECTION\b/;

/** A text, upper-cased once its codes are resolved — the one reading of its words here. */
function wordsOf(text: string): string {
  return normaliseNotation(text).toUpperCase();
}

/** Whether `words` names `mark` as a whole word — `PC5`, never the `PC5` inside `PC51`. */
function names(words: string, mark: string): boolean {
  const escaped = mark.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Z0-9])${escaped}(?![A-Z0-9])`).test(words);
}

/** A figure, in millimetres — for comparing two statements of one side, never billed. */
function millimetresOf(side: RecessSide): number {
  const mm = Number(side.value) * (side.unit === "in" ? MM_PER_INCH : 1);
  return Math.round(mm * 1e6) / 1e6;
}

/** Whether a point stands inside a closed ring (even–odd rule). */
function inside(point: Point, ring: readonly Point[]): boolean {
  let held = false;
  for (let at = 0, before = ring.length - 1; at < ring.length; before = at, at += 1) {
    const [xi, yi] = ring[at] as Point;
    const [xj, yj] = ring[before] as Point;
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) held = !held;
  }
  return held;
}

/** The void one open outline draws into the top of one ring, or null where it draws none. */
type Void = { readonly outlineKey: string; readonly x0: number; readonly x1: number; readonly top: number; readonly floor: number };

/**
 * The void an open outline cuts into the top of a ring of the same view: its two ends on the ring's
 * top, apart; every other vertex below the top, between the ends, and inside the ring.
 */
function voidOf(outlineKey: string, outline: readonly Point[], rings: readonly (readonly Point[])[]): Void | null {
  if (outline.length < FEWEST_OUTLINE_VERTICES) return null;
  const first = outline[0] as Point;
  const last = outline[outline.length - 1] as Point;
  if (Math.abs(first[1] - last[1]) > ON_THE_POINT || Math.abs(first[0] - last[0]) <= ON_THE_POINT) return null;
  const x0 = Math.min(first[0], last[0]);
  const x1 = Math.max(first[0], last[0]);
  const between = outline.slice(1, -1);
  for (const ring of rings) {
    const top = Math.max(...ring.map((point) => point[1]));
    if (Math.abs(first[1] - top) > ON_THE_POINT) continue;
    const cut = between.every((point) => point[1] < top - ON_THE_POINT && point[0] >= x0 - ON_THE_POINT && point[0] <= x1 + ON_THE_POINT && inside(point, ring));
    if (!cut) continue;
    return { outlineKey, x0, x1, top, floor: Math.min(...between.map((point) => point[1])) };
  }
  return null;
}

/** One dimension of a view: where its definition points stand, and the one text it measures with. */
type Dimensioned = { readonly key: string; readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number; readonly text: string };

/** A figure the set writes, as a side: in its own unit, or the drawing's where it writes none. */
function sideOf(text: string, declaredUnit: SectionUnit | null, source: string): RecessSide | null {
  const figure = parseFigure(text);
  const unit = figure?.unit ?? declaredUnit;
  if (figure === null || unit === null || !(figure.value > 0)) return null;
  return { value: String(figure.value), unit, source };
}

/** The one side every statement agrees on, or null where none states it or two disagree (L-REG-03). */
function agreed(sides: readonly (RecessSide | null)[]): RecessSide | null {
  const stated = sides.filter((side): side is RecessSide => side !== null);
  const first = stated[0];
  if (first === undefined) return null;
  return stated.every((side) => millimetresOf(side) === millimetresOf(first)) ? first : null;
}

/** Whether a dimension's definition points stand on `from` and `to` along one axis, and it measures along that axis. */
function spans(dimension: Dimensioned, axis: "x" | "y", from: number, to: number): boolean {
  const along = axis === "x" ? [dimension.minX, dimension.maxX] : [dimension.minY, dimension.maxY];
  const across = axis === "x" ? dimension.maxY - dimension.minY : dimension.maxX - dimension.minX;
  const [low, high] = along as [number, number];
  return Math.abs(low - from) <= ON_THE_POINT && Math.abs(high - to) <= ON_THE_POINT && high - low > across;
}

/**
 * Every statement the drawing's views make of a recess in one of `marks`' members, in view order: one
 * per void a member's section draws, and one per caption or text that names a member beside the word
 * RECESS. A drawing that speaks of no recess answers an empty list.
 */
export function recessStatementsOf(input: RecessInput): RecessStatement[] {
  const marks = [...new Set(input.marks)].sort();
  const byView = new Map<string, EntityGraph["entities"][number][]>();
  for (const entity of input.graph.entities) {
    const view = input.assignments.get(entity.key);
    if (view === undefined) continue;
    const held = byView.get(view) ?? [];
    held.push(entity);
    byView.set(view, held);
  }
  const texts = measurementTextsOf(input.graph);
  const definitions = definitionPointsByDimension(input.graph);
  const statements: RecessStatement[] = [];

  for (const view of [...input.views].sort((left, right) => (left.viewKey < right.viewKey ? -1 : left.viewKey > right.viewKey ? 1 : 0))) {
    const entities = byView.get(view.viewKey) ?? [];
    const caption = wordsOf(view.caption);

    // Named: a caption or a note that names a member beside the word RECESS states a recess is there.
    for (const words of [caption, ...entities.flatMap((entity) => (typeof entity.text === "string" ? [wordsOf(entity.text)] : []))]) {
      if (!RECESS_WORD.test(words)) continue;
      for (const mark of marks) if (names(words, mark)) statements.push({ mark, viewKey: view.viewKey, outlineKey: null, length: null, breadth: null, depth: null });
    }

    // Drawn: a section of ONE member, and the voids it cuts into that member's top.
    const named = marks.filter((mark) => names(caption, mark));
    if (named.length !== 1 || !SECTION_WORD.test(caption)) continue;
    const mark = named[0] as string;
    const rings = entities.filter((entity) => entity.closed === true && (entity.points?.length ?? 0) >= FEWEST_RING_VERTICES).map((entity) => (entity.points ?? []).map((point): Point => [point[0] ?? 0, point[1] ?? 0]));
    const voids = entities.flatMap((entity) => {
      if (entity.closed === true || entity.points === undefined) return [];
      const found = voidOf(entity.key, entity.points.map((point): Point => [point[0] ?? 0, point[1] ?? 0]), rings);
      return found === null ? [] : [found];
    });
    if (voids.length === 0) continue;
    // Two voids in one section are two recesses, and the recess sentences net one: the member is
    // recessed, and nothing here states it as one void (I-598).
    if (voids.length > 1) {
      statements.push({ mark, viewKey: view.viewKey, outlineKey: (voids[0] as Void).outlineKey, length: null, breadth: null, depth: null });
      continue;
    }

    const dimensions: Dimensioned[] = entities.flatMap((entity) => {
      const at = definitions.get(entity.key);
      const said = texts.get(entity.key) ?? [];
      if (at === undefined || said.length !== 1) return [];
      const xs = at.map((point) => point[0]);
      const ys = at.map((point) => point[1]);
      return [{ key: entity.key, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), text: said[0] as string }];
    });
    // A size pair is the recess's plan only in a view whose words name the recess.
    const namesTheRecess = entities.some((entity) => typeof entity.text === "string" && RECESS_WORD.test(wordsOf(entity.text)));
    const pairs = namesTheRecess
      ? entities.flatMap((entity) => {
          const pair = typeof entity.text === "string" ? parseSizePair(entity.text) : null;
          const unit = pair?.unit ?? input.declaredUnit;
          return pair === null || unit === null ? [] : [{ key: entity.key, width: pair.width, depth: pair.depth, unit }];
        })
      : [];

    for (const drawn of voids) {
      const length = agreed(dimensions.filter((one) => spans(one, "x", drawn.x0, drawn.x1)).map((one) => sideOf(one.text, input.declaredUnit, one.key)));
      const depth = agreed(dimensions.filter((one) => spans(one, "y", drawn.floor, drawn.top)).map((one) => sideOf(one.text, input.declaredUnit, one.key)));
      // The breadth is the OTHER side of a pair one side of which is the length the dimension states.
      const breadth =
        length === null
          ? null
          : agreed(
              pairs.flatMap((pair) => {
                const width = sideOf(String(pair.width), pair.unit, pair.key);
                const other = sideOf(String(pair.depth), pair.unit, pair.key);
                if (width === null || other === null) return [];
                if (millimetresOf(width) === millimetresOf(length)) return [other];
                if (millimetresOf(other) === millimetresOf(length)) return [width];
                return [];
              }),
            );
      statements.push({ mark, viewKey: view.viewKey, outlineKey: drawn.outlineKey, length, breadth, depth });
    }
  }
  return statements;
}

/** One member's recess, as the drawings state it: each side, or null where no view states it. */
export type RecessOfMark = { readonly length: RecessSide | null; readonly breadth: RecessSide | null; readonly depth: RecessSide | null };

/**
 * The ONE recess the statements make of each member, by mark: each side where every drawn statement
 * that states it agrees, null where none states it or two disagree — a disagreement resolved in
 * silence is a guess (L-REG-03). A member only NAMED as recessed, with no void of it read, has every
 * side null: it is recessed, and nothing states by how much. A member no statement speaks of has no
 * entry — no recess.
 */
export function recessesByMark(statements: readonly RecessStatement[]): Map<string, RecessOfMark> {
  const byMark = new Map<string, RecessStatement[]>();
  for (const statement of statements) {
    const held = byMark.get(statement.mark) ?? [];
    held.push(statement);
    byMark.set(statement.mark, held);
  }
  const recesses = new Map<string, RecessOfMark>();
  for (const [mark, held] of byMark) {
    const drawn = held.filter((one) => one.outlineKey !== null);
    recesses.set(mark, {
      length: agreed(drawn.map((one) => one.length)),
      breadth: agreed(drawn.map((one) => one.breadth)),
      depth: agreed(drawn.map((one) => one.depth)),
    });
  }
  return recesses;
}
