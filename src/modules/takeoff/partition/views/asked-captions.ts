// R-TO-030, L-AI-03: which captions of a partition the product puts to a model — ONE spelling.
//
// The partition's rebuild asks a model about these and nothing else, and the corpus recorder
// (`scripts/model-corpus/view-caption.ts`) records answers to these and nothing else, both by calling
// this function: the recorder and the product choosing their subjects by two filters is how the
// corpus came to answer nine captions nobody asked while the ten the product did ask refused
// FIXTURE_MISSING (B-17 — two spellings of one fact).
//
// Pure over the views a partition cut: no store, no model, no clock.
import type { PartitionedView } from "./assign";
import { VIEW_TYPE, type ViewType } from "./law";

/** One caption a model is asked about: the view it anchors, its text, and the entity that carries it. */
export type AskedCaption = { readonly viewKey: string; readonly caption: string; readonly anchorKey: string };

/**
 * The captions a model is asked about, in partition order: every view the deterministic grammar was
 * silent on (UNTYPED) that a caption anchors. A view the grammar classified asks no model — L-AI-03
 * puts the grammar first — and the one view no caption anchors has nothing to be asked about.
 */
export function captionsAskedOf(views: readonly PartitionedView[]): AskedCaption[] {
  const asked: AskedCaption[] = [];
  for (const view of views) {
    if ((view.type as ViewType) !== VIEW_TYPE.UNTYPED || view.anchorKey === null) continue;
    asked.push({ viewKey: view.viewKey, caption: view.caption, anchorKey: view.anchorKey });
  }
  return asked;
}
