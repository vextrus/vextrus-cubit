// The rule-set edition module (L-MEA-01, L-REG-07): what an edition IS — content, identity and the
// digest that keys the content — and what a project's pin looks like to a surface. Callers import
// this barrel; the two files behind it are the content law and the read.
export { editionDigest } from "./content";
export type { EditionContent, EditionIdentity, EditionLineageStep, EditionParameter, EditionScope, MethodPair } from "./content";
export { currentProjectEdition, projectRulesetView } from "./view";
export type { CurrentProjectEdition, PinnedRulesetView, ProjectRulesetView, UnpinnedRulesetView } from "./view";
// L-MEA-01's mint — one function, never a second store: the project's next edition is a row beside
// its parent, and `authoredContent` is what an author's values make of the parent's content.
export { authoredContent, mintProjectEdition, projectHoldsVersion } from "./mint";
export type { MintProjectEdition, MintedEdition } from "./mint";
