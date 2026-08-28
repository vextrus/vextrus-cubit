// The rule-set edition module (L-MEA-01, L-REG-07): what an edition IS — content, identity and the
// digest that keys the content — and what a project's pin looks like to a surface. Callers import
// this barrel; the two files behind it are the content law and the read.
export { editionDigest } from "./content";
export type { EditionContent, EditionIdentity, EditionLineageStep, EditionParameter, EditionScope, MethodPair } from "./content";
export { projectRulesetView } from "./view";
export type { PinnedRulesetView, ProjectRulesetView, UnpinnedRulesetView } from "./view";
