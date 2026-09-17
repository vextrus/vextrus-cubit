// The rule-set authoring module (R-SPINE-012, AM-04): the Author edition screen's section, the copy
// it renders, the state matrix it declares and the pure diff the grid is drawn from. Callers import
// this barrel; the files behind it are the screen, the strings, the states and the diff law.
export { RulesetAuthorSection } from "./ruleset-author-section";
export type { AuthorCommitAnswer, AuthorParentEdition, AuthorPreviewAnswer, AuthorRequest, RulesetAuthorSectionProps } from "./ruleset-author-section";
export { authoredValues, diffParameters, sameFigure } from "./diff";
export type { ParameterDiffRow } from "./diff";
export { RULESET_AUTHOR_STATES } from "./states";
export { rulesetAuthorStrings } from "./strings";
export type { RulesetAuthorStringKey } from "./strings";
