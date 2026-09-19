// The words R-UI-050's exhibited matrix says about the project's Site facts panel (AM-06 §1).
//
// The panel's own table lives in its module (`src/modules/takeoff/site-facts-ui/strings.ts`), which
// this layer may never import (ARCH-01) — so what the matrix needs of it is mirrored here, in the
// same idiom the drawings and sets rows already use. Nothing on the panel itself reads these keys:
// they are the gallery's sentences about the screen, never a second spelling of the screen's copy
// (B-17, R-SPINE-060).
export const siteFacts = {
  state_empty_site_facts:
    "The site facts a project records are a fixed roster, so this screen is never empty — a fact nobody has entered stands in its own row, named, with what its absence costs.",
  state_partial_site_facts:
    "The ledger answers every fact of the roster or none of them, so no row can be refused by the read: an entered fact and a deferred one stand side by side, and nothing is hidden for being refused.",
  state_denied_site_facts_permission: "Entering a site fact needs the AUTHOR_PROJECT_FACT permission on this project, and your account does not hold it.",
  state_denied_site_facts_holder: "This project's measurers and principals hold it; a principal grants it on the participants screen.",
} as const;

// R-SPINE-060's per-module convention is that a table file's DESIGNATED export is the one named for
// its basename, and this file's basename is not an identifier. The table is therefore published
// under both names: the identifier `index.ts` aggregates it by, and the basename the convention
// designates. One table, two names for it — never two tables.
export { siteFacts as "site-facts" };
