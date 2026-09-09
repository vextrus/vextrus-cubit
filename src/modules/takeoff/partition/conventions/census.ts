// The entity census L-CAD-08's convention profile is resolved from: what each layer was drawn with,
// and which caption grammars named views. Read off one ingest artifact and the views stage's own
// result, and nothing else — the method beside it (`@/core/rulesets/methods/conventions/resolve`)
// turns this reading into the profile, and this file never decides a role.
//
// What is counted is what L-CAD-03 makes an atom: the ORIGINAL entities standing in model space.
// Derived paint is carried by the entity it came out of, so counting it would tally one drawn thing
// twice; a paper layout's border and title are the sheet's furniture rather than the drawing's
// conventions (L-CAD-05, L-CAD-06 partitions model space).
//
// A grammar id is the class the views stage read a caption under. The two classes that stand for
// "not read at all" — untyped, and the view no caption anchors — named no view, so neither is a
// grammar that names anything (L-CAD-06).
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { EntityCensus, GrammarCensus, LayerCensus } from "@/core/rulesets/methods/conventions/resolve";
import { VIEW_TYPE, type ViewType } from "../views/law";

/** The one DXF type whose records are dimensions, as the extractor normalises it (L-CAD-02). */
const DIMENSION = "DIMENSION";

/** What the census reads off a view: the class the grammar read its caption under. */
export type CensusView = { readonly type: ViewType };

/** An entity as this census reads one — the artifact's own shape, narrowed to what it needs. */
type Drawn = EntityGraph["entities"][number];

/** One layer's tallies while they are still being counted. */
type Tally = { layer: string; paths: number; rings: number; texts: number; dimensions: number };

/** Code-point order, which is the only order a stored derivation sorts by (L-REG-05). */
function byCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * One record's kind, as the profile's statistics tell them apart: a record carrying text is a text,
 * else one typed DIMENSION is a dimension, else a closed one is a ring, else one drawn from points
 * is a path. The order is what makes the kinds exclusive — a dimension is drawn from points too, and
 * a ring that carries a label is text on that layer.
 */
function kindOf(entity: Drawn): keyof Omit<Tally, "layer"> | null {
  if (typeof entity.text === "string") return "texts";
  if (entity.type === DIMENSION) return "dimensions";
  if (entity.closed === true) return "rings";
  if (Array.isArray(entity.points)) return "paths";
  return null;
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

  const tallies = new Map<string, Tally>();
  for (const entity of graph.entities) {
    if (entity.space !== modelSpace) continue;
    let held = tallies.get(entity.layer);
    if (held === undefined) {
      held = { layer: entity.layer, paths: 0, rings: 0, texts: 0, dimensions: 0 };
      tallies.set(entity.layer, held);
    }
    const kind = kindOf(entity);
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
  return { layers, grammars };
}
