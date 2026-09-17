// R-SPINE-060: the words the STATE MATRIX needs for S-Settings-Ruleset-Author — the empty leg's
// teaching and the two sentences the denial names the permission and its holders with. The screen's
// own copy is the authoring module's table (`rulesetAuthorStrings`); `src/ui` may not reach a module
// (ARCH-01), so the matrix's cells read these, and the two tables are held byte-equal by the
// screen's own suite rather than by either file trusting the other.
export const rulesetAuthor = {
  ruleset_author_state_empty_heading: "No rule set to author",
  ruleset_author_state_empty_body:
    "A project pins its rule set when it is created, and this address names no project with one. There is nothing here to fork.",
  ruleset_author_state_empty_action: "See the pinned rule set",
  // I-266: the door stands for a reader who cannot walk through it, and says why in place.
  ruleset_author_state_denied_permission:
    "Authoring a new rule-set edition needs the AUTHOR_RULE_SET permission, which the act AUTHOR_RULESET_EDITION moves.",
  ruleset_author_state_denied_holder: "The project's LEAD and PRINCIPAL participants hold it.",
} as const;

// R-SPINE-060's convention designates a module table by its file's basename, and this file's
// basename is not an identifier. The table is published under both names: the identifier `index.ts`
// aggregates it by, and the basename the convention designates (the screen-states precedent).
export { rulesetAuthor as "ruleset-author" };
