// S-Settings-Ruleset-Author's copy, and all of it (§3, verbatim): the section carries no string
// literal of its own beyond test ids and fixed attribute values. The keys read `ruleset_author_…`,
// under the same discipline as the tables in `src/ui/strings/*` (s-settings-ruleset I-24).
//
// "Mint", "seam" and "store" appear in no text a reader can see; "act", "consequence", "digest" and
// "edition" are the product's own user-facing law and are used as such (§3).
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
  /** The slot is data — the row's own parameter label (§3). */
  ruleset_author_value_label: "Authored value for {parameter}",

  ruleset_author_submit: "Author this edition",
  ruleset_author_status_pending: "Carrying the act out…",
  /** The slot is data — the version the act carried (§3). */
  ruleset_author_status_done: "Done. The project now reads version {version}.",
  ruleset_author_see_ruleset: "See the pinned rule set",

  ruleset_author_unpinned_heading: "No rule set to author",
  ruleset_author_unpinned_body:
    "A project pins its rule set when it is created, and this address names no project with one. There is nothing here to fork.",
};

/** One key of the table above — a screen names copy by key, never by sentence (R-SPINE-060). */
export type RulesetAuthorStringKey = keyof typeof rulesetAuthorStrings;
