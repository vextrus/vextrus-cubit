// R-SPINE-060: the authoring screen's copy, and all of it — the section carries no string literal of
// its own beyond test ids and fixed attribute values. Keys read `ruleset_author_…`, as
// docs/design/s-settings-ruleset-author.md § 3 fixes them, verbatim.
//
// "Mint", "seam" and "store" appear in nothing a reader sees; scope, name, version, parameter keys
// and digests are data and are never woven into a sentence (s-settings-ruleset I-25).
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
  // The slot is data — the row's own parameter label (§ 3).
  ruleset_author_value_label: "Authored value for {parameter}",
  // The mark a changed row wears, rendered through EnumLabel like every other closed word.
  ruleset_author_changed: "Changed",
  ruleset_author_unchanged: "Unchanged",
  ruleset_author_col_change: "Change",

  ruleset_author_submit: "Author this edition",
  ruleset_author_status_pending: "Carrying the act out…",
  // The slot is data — the version the act carried (§ 3).
  ruleset_author_status_done: "Done. The project now reads version {version}.",
  ruleset_author_see_ruleset: "See the pinned rule set",
  ruleset_author_evidence_ruleset: "See the pinned rule set",

  ruleset_author_unpinned_heading: "No rule set to author",
  ruleset_author_unpinned_body:
    "A project pins its rule set when it is created, and this address names no project with one. There is nothing here to fork.",

  // L-MEA-01's own spelling of an edition: `IS1200_IN @ 2026.08`. The joiner is copy, so it is here
  // rather than inside the markup that puts a name beside a version.
  ruleset_author_identity_joiner: " @ ",
} as const;

/** One key of the table above — what a screen may name, and nothing wider. */
export type RulesetAuthorStringKey = keyof typeof rulesetAuthorStrings;
