// S-Settings-Ruleset-Author's copy, verbatim from its Design Decision § 3. Every string a reader
// meets on this screen is here; the JSX carries no literal beyond test ids and fixed attribute
// values. Registered refusal copy is the register's and is never re-worded here (R-UI-020).
//
// Voice: calm, concrete, present tense about what will be true. Scope, name, version, parameter
// keys and digests are DATA and are never woven into a sentence (s-settings-ruleset I-25) — the two
// strings with a slot take theirs as data and say so.
export const rulesetAuthorStrings = {
  ruleset_author_heading: "Author edition",
  ruleset_author_caption:
    "Authoring mints a new edition and never changes the one pinned before it. The project reads the newest edition from the moment it is minted.",
  ruleset_author_version_hint: "A version names this edition beside its scope and name, and must be one this project has not used.",
  ruleset_author_parent_label: "Forked from",
  ruleset_author_digest_label: "Content digest",
  ruleset_author_version_label: "Version",
  ruleset_author_col_parameter: "Parameter",
  ruleset_author_col_pinned: "Pinned value",
  ruleset_author_col_authored: "Authored value",
  ruleset_author_col_unit: "Unit",
  ruleset_author_submit: "Author this edition",
  ruleset_author_status_pending: "Carrying the act out…",
  ruleset_author_see_ruleset: "See the pinned rule set",
  ruleset_author_evidence_ruleset: "See the pinned rule set",
  ruleset_author_unpinned_heading: "No rule set to author",
  ruleset_author_unpinned_body:
    "A project pins its rule set when it is created, and this address names no project with one. There is nothing here to fork.",
} as const;

/** One key of this screen's copy. */
export type RulesetAuthorStringKey = keyof typeof rulesetAuthorStrings;

/**
 * The accessible name of one row's authored field: the parameter it is for, in the words the row
 * itself is read under. The slot is DATA — the row's own label — so the sentence is built here
 * rather than seventeen times in the grid (Design Decision § 3).
 */
export function rulesetAuthorValueLabel(parameter: string): string {
  return `Authored value for ${parameter}`;
}

/**
 * What the screen says once the act has been carried out. The slot is data — the version the act
 * carried — and the sentence states what is now true rather than congratulating anyone.
 */
export function rulesetAuthorStatusDone(version: string): string {
  return `Done. The project now reads version ${version}.`;
}
