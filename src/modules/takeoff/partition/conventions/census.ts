// The entity census L-CAD-08's convention profile is resolved from: what each layer was drawn with,
// which caption grammars named views, and which unit the drawing's own texts DECLARE its dimensions
// in. Read off one ingest artifact and the views stage's own result, and nothing else — the method
// beside it (`@/core/rulesets/methods/conventions/resolve`) turns this reading into the profile, and
// this file never decides a role, nor which of two disagreeing declarations wins (I-302).
//
// What is counted is what L-CAD-03 makes an atom: the ORIGINAL entities standing in model space.
// Derived paint is carried by the entity it came out of, so counting it would tally one drawn thing
// twice — but it is also what that entity DREW, so where the original's own record says nothing
// about what kind of thing it is, its paint is where that answer is (see `kindOf`). A paper layout's
// border and title are the sheet's furniture rather than the drawing's conventions (L-CAD-05,
// L-CAD-06 partitions model space).
//
// A grammar id is the class the views stage read a caption under. The two classes that stand for
// "not read at all" — untyped, and the view no caption anchors — named no view, so neither is a
// grammar that names anything (L-CAD-06).
import type { SectionUnit } from "@/core/db";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { clausesOf } from "@/core/notes/clauses";
import type { EntityCensus, GrammarCensus, LayerCensus, UnitDeclarationCensus } from "@/core/rulesets/methods/conventions/resolve";
import { VIEW_TYPE, type ViewType } from "../views/law";

/** The one DXF type whose records are dimensions, as the extractor normalises it (L-CAD-02). */
const DIMENSION = "DIMENSION";

/** What the census reads off a view: the class the grammar read its caption under. */
export type CensusView = { readonly type: ViewType };

/** An entity as this census reads one — the artifact's own shape, narrowed to what it needs. */
type Drawn = EntityGraph["entities"][number];

/** One piece of derived paint: what an original drew, carried by the original it came out of. */
type Painted = EntityGraph["derived"][number];

/** One layer's tallies while they are still being counted. */
type Tally = { layer: string; paths: number; rings: number; texts: number; dimensions: number };

/** Code-point order, which is the only order a stored derivation sorts by (L-REG-05). */
function byCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * How a drawing DECLARES the unit its dimensions are figured in (I-302, L-CAD-08): the general-notes
 * sentence every structural set opens with — `ALL DIMENSIONS ARE IN MILLIMETRES`, `ALL DIMENSIONS IN
 * mm`, `ALL DIMENSIONS SHALL BE IN INCHES`. The copula is the draughtsman's style and not a second
 * statement, so it is optional; the unit is the FIRST word after the `IN`, and nothing past it is
 * read.
 *
 * Only the clause that speaks of the DIMENSIONS matches. `LEVELS ARE IN METRES ABOVE P.L.` standing
 * in the same sentence declares the unit of a level and not of a size, and a pattern loose enough to
 * take it would measure a 400 mm column in metres (L-MEA-05: a unit is read, never guessed).
 */
const DECLARATION = /\bALL\s+DIMENSIONS?\s+(?:ARE\s+|SHALL\s+BE\s+|TO\s+BE\s+)?IN\s+([A-Za-z]+)/i;

/**
 * The unit words a declaration may name, and the member of the store's own roster each is. The
 * roster is closed at `SECTION_UNITS` (`@/core/db`), so a note declaring METRES or FEET declares a
 * unit this product does not measure a section in, and the census counts NO reading for it: the
 * section stays unitless and the rail refuses by name, which is what a figure nobody can state
 * honestly deserves (L-QTY-04).
 */
const DECLARED_UNITS: readonly (readonly [string, SectionUnit])[] = Object.freeze([
  ["MM", "mm"],
  ["MILLIMETRE", "mm"],
  ["MILLIMETRES", "mm"],
  ["MILLIMETER", "mm"],
  ["MILLIMETERS", "mm"],
  ["IN", "in"],
  ["INCH", "in"],
  ["INCHES", "in"],
] as const);

/**
 * The unit ONE text declares, or null where it declares none. The text is cut into the clauses a
 * reader reads it in by the one reading of a drawing's notes (`clausesOf`, B-17): a general-notes
 * block is a numbered MTEXT of many clauses drawn with the font and alignment codes an MTEXT
 * carries, and a declaration is one clause of it.
 *
 * The FIRST clause that declares a unit answers for the text. `4. ALL DIMENSIONS ARE IN MILLIMETRES
 * UNLESS FIGURED IN FEET AND INCHES.` declares millimetres and states its own exception; the
 * exception is not a second declaration, and the pair that is figured in inches keeps its own mark
 * where it is written (I-302, clause 5's `FIGURED DIMENSIONS GOVERN`).
 */
function declaredUnitIn(text: string): SectionUnit | null {
  for (const clause of clausesOf(text)) {
    const said = DECLARATION.exec(clause);
    if (said === null) continue;
    const word = (said[1] ?? "").toUpperCase();
    const held = DECLARED_UNITS.find((candidate) => candidate[0] === word);
    if (held !== undefined) return held[1];
  }
  return null;
}

/**
 * Every unit declaration standing in the drawing, counted per unit, with the first entity that
 * declares each (I-302).
 *
 * Read over the WHOLE artifact rather than model space alone, unlike the layer tallies above. A
 * layer's role is a fact about what model space was drawn with; a general note is the drawing
 * SPEAKING ABOUT ITSELF, and every office prints it on a notes sheet — F-RCC6-BNBC's stands on the
 * paper layout `S-01 GENERAL NOTES (1 OF 2)`. Reading model space alone would make a drawing that
 * declares its unit in the one place a drawing declares it a drawing that declares none, and a
 * reading refused where the drawing plainly speaks is not a conservative reading but a lost one
 * (L-CAD-08, L-MEA-05).
 *
 * ORIGINALS first, like every other tally: derived paint is carried by the entity it came out of, and
 * counting it beside the original would tally one note twice (L-CAD-03).
 *
 * And the PAINT where no original declares anything (I-669). A title block is a block, so the
 * `ALL DIMENSIONS IN mm U.N.O.` every sheet of F-RCC6-BNBC prints in its title panel is paint of the
 * sheet's INSERT, never an original of its own, and it was never read. The DXF declared its unit in
 * S-01's general notes too, so nothing was lost there; the DWG minted from it carries that note
 * truncated to its last clause (LibreDWG's `dxf2dwg` keeps an MTEXT's tail and drops its leading
 * chunks), and a fresh upload read no unit at all — every column section stood unitless and S-10
 * published nothing (walk-2 BD-3). The title panel is the drawing speaking about itself on every
 * sheet, exactly as a general note is, and it is cited by the INSERT that draws it (L-QTY-03). It is
 * asked only where the originals are silent, so a drawing whose notes declare a unit reads exactly
 * as it did, and two units declared across the paint are still no convention at all.
 */
function unitDeclarationsOf(graph: EntityGraph): UnitDeclarationCensus[] {
  const originals = declarationsIn(graph.entities.map((entity) => ({ key: entity.key, text: entity.text })));
  if (originals.length > 0) return originals;
  return declarationsIn(graph.derived.map((record) => ({ key: record.src, text: record.text })));
}

/** Every unit the texts declare, counted per unit, each with the first key in code-point order that declares it. */
function declarationsIn(texts: readonly { readonly key: string; readonly text?: unknown }[]): UnitDeclarationCensus[] {
  const declared = new Map<SectionUnit, { sourceKey: string; declarations: number }>();
  for (const entity of texts) {
    if (typeof entity.text !== "string") continue;
    const unit = declaredUnitIn(entity.text);
    if (unit === null) continue;
    const held = declared.get(unit);
    // The FIRST declaring entity in code-point order of key, so the same drawing cites the same note
    // however the artifact's entities were ordered (L-REG-04).
    if (held === undefined) declared.set(unit, { sourceKey: entity.key, declarations: 1 });
    else declared.set(unit, { sourceKey: byCodePoint(entity.key, held.sourceKey) < 0 ? entity.key : held.sourceKey, declarations: held.declarations + 1 });
  }

  return [...declared.entries()]
    .map(([unit, held]) => ({ unit, sourceKey: held.sourceKey, declarations: held.declarations }))
    .sort((left, right) => byCodePoint(left.unit, right.unit));
}

/**
 * One entity's kind, as the profile's statistics tell them apart: what its own record says, and
 * where its own record says nothing, what it DREW (L-CAD-03: "derived paint is carried by the entity
 * it came out of").
 *
 * The order between the two halves is the whole of it. An entity whose record answers for itself is
 * read from that record and never from its paint: a dimension is one record that explodes into lines
 * and a text, and reading the paint first would tally one dimension as linework and lose the
 * dimensions role the drawing plainly carries. An entity whose record answers nothing — no text, no
 * dimension type, no closing flag, no points, which is what a block instance is — has drawn
 * something all the same, and a layer of them is not a layer nothing was drawn on. Declining to read
 * that paint is what leaves a block-drawn grid layer at four zeroes and out of every role, and a
 * role the drawing really states is not a role to defer (L-QTY-04).
 */
function kindOf(entity: Drawn, paint: readonly Painted[]): keyof Omit<Tally, "layer"> | null {
  return ownKindOf(entity) ?? paintedKindOf(paint);
}

/**
 * What a record says about itself: a record carrying text is a text, else one typed DIMENSION is a
 * dimension, else a closed one is a ring, else one drawn from points is a path. The order is what
 * makes the kinds exclusive — a dimension is drawn from points too, and a ring that carries a label
 * is text on that layer.
 */
function ownKindOf(entity: Drawn): keyof Omit<Tally, "layer"> | null {
  if (typeof entity.text === "string") return "texts";
  if (entity.type === DIMENSION) return "dimensions";
  if (entity.closed === true) return "rings";
  if (Array.isArray(entity.points)) return "paths";
  return null;
}

/**
 * What an entity's paint says it drew: a closed figure makes it a ring, else a text makes it a text,
 * else anything drawn from points makes it a path.
 *
 * The closed figure comes FIRST here where a text comes first above, because these are many records
 * rather than one. A single record carrying text is a label however it is closed; a thing that paints
 * a closed figure AND some text has drawn an outline and annotated it, and the outline is what it
 * put on the layer. No DIMENSION branch: a dimension answers from its own record and never reaches
 * here, and paint that merely looks like one is the parent's drawing, not a second dimension.
 */
function paintedKindOf(paint: readonly Painted[]): keyof Omit<Tally, "layer"> | null {
  if (paint.some((record) => record.closed === true)) return "rings";
  if (paint.some((record) => typeof record.text === "string")) return "texts";
  if (paint.some((record) => Array.isArray(record.points))) return "paths";
  return null;
}

/** Every piece of paint, by the key of the original it came out of (L-CAD-03's `src`). */
function paintBySource(graph: EntityGraph): Map<string, Painted[]> {
  const painted = new Map<string, Painted[]>();
  for (const record of graph.derived) {
    const held = painted.get(record.src);
    if (held === undefined) painted.set(record.src, [record]);
    else held.push(record);
  }
  return painted;
}

/**
 * The census of one artifact and the views its captions were read into (L-CAD-08). Total over model
 * space: every layer something original stands on is tallied, including one whose records fall into
 * no kind at all — a layer of zero tallies is the drawing saying it carries no role, which is a
 * reading the resolver is entitled to make.
 *
 * An artifact with NO model layout has no census: null, not an empty one. A drawing with nowhere to
 * take a census is not a drawing that was read and found to carry nothing, and an empty census
 * resolves to a profile whose every role is deferred — a record indistinguishable, to any later
 * reader, from a real reading of a real drawing (L-QTY-04).
 */
export function censusOf(graph: EntityGraph, views: readonly CensusView[]): EntityCensus | null {
  const modelSpace = graph.layouts.find((layout) => layout.kind === "model")?.name;
  if (modelSpace === undefined) return null;

  // A tally is against the layer the ORIGINAL stands on, even where the answer came from its paint:
  // the original is the atom a source key names and the thing the drawing put on that layer, and its
  // paint may be drawn ByBlock onto layers of the block's own (L-CAD-03).
  const painted = paintBySource(graph);
  const tallies = new Map<string, Tally>();
  for (const entity of graph.entities) {
    if (entity.space !== modelSpace) continue;
    let held = tallies.get(entity.layer);
    if (held === undefined) {
      held = { layer: entity.layer, paths: 0, rings: 0, texts: 0, dimensions: 0 };
      tallies.set(entity.layer, held);
    }
    const kind = kindOf(entity, painted.get(entity.key) ?? []);
    if (kind !== null) held[kind] += 1;
  }

  const named = new Map<string, number>();
  for (const view of views) {
    if (view.type === VIEW_TYPE.UNTYPED || view.type === VIEW_TYPE.UNASSIGNED) continue;
    named.set(view.type, (named.get(view.type) ?? 0) + 1);
  }

  const layers: LayerCensus[] = [...tallies.values()].sort((left, right) => byCodePoint(left.layer, right.layer));
  const grammars: GrammarCensus[] = [...named.entries()]
    .map(([grammar, captions]) => ({ grammar, captions }))
    .sort((left, right) => byCodePoint(left.grammar, right.grammar));
  return { layers, grammars, unitDeclarations: unitDeclarationsOf(graph) };
}
