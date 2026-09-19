// R-UI-050's matrix for the Author edition screen, in the one enumerable place a suite reflects
// over (B-19, § 2). A cell says one of three things and is never silent: the state is rendered here,
// it is handed to a module outside this screen, or it cannot arise and says why.
import type { ShellStateCell, ShellStateName } from "@/ui/shell/states";

/**
 * What `data-state` on `ruleset-author` may say (§ 7): the states § 2 names, with the two the screen
 * itself never paints — `loading` is the route's own `loading.tsx` and `error` the boundary's —
 * standing in the roster, because a read of the screen meets them at the same element. `partial` is
 * impossible here (§ 2). The roster is the one home of the spelling, so a suite reflects over it
 * rather than transcribing a list of its own (B-19).
 */
export const RULESET_AUTHOR_SCREEN_STATES = ["loading", "empty", "error", "refused", "busy", "ready"] as const;

/** One of the states above — what the section's own `data-state` is typed by. */
export type RulesetAuthorScreenState = (typeof RULESET_AUTHOR_SCREEN_STATES)[number];

/** The screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/t/[tenant]/p/[project]/settings/ruleset-author";
const SECTION = `${ROUTE}/ruleset-author-section.tsx`;

export const RULESET_AUTHOR_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  // Bones that keep the shape the answer will take, hidden from the accessibility tree by the
  // primitive itself — never a spinner over this table (R-UI-004).
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: null },
  // A project that pins nothing has nothing to fork: one EmptyState with the way onward, and no
  // version field, no grid and no disabled door pretending an act is available (§ 2).
  empty: { declared: "rendered", by: SECTION, testId: "ruleset-unpinned" },
  // The refusal slot: one RefusalState with code, message, remedy and evidence, never a toast
  // (R-UI-020). PERMISSION_NOT_HELD stands there for a reader without AUTHOR_RULE_SET (I-266);
  // REQUEST_MALFORMED and EDITION_VERSION_TAKEN answer a preview, and ACT_CHANGES_NOTHING is the
  // seam's own guard, rendered by the same slot because one renderer serves every code (I-267).
  refusal: { declared: "rendered", by: SECTION, testId: "ruleset-author-refusal" },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id; the settings nav survives the fault, so a reader can leave by another area",
  },
  partial: {
    declared: "impossible",
    why: "the pin is one immutable row read as one document, so every parameter of it is answered or none is — there are no refusable rows and no row is ever hidden",
  },
  offline: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "I-20: unreachability is a fault of reachability — a failed navigation or action surfaces the error path or the registered refusal, and no figure ages on screen pretending to be current",
  },
  permissionDenied: {
    declared: "rendered",
    by: SECTION,
    // I-266: the whole screen renders for a reader without the permission — the door carries
    // aria-disabled and is described by the standing PERMISSION_NOT_HELD, which names the act type,
    // the permission and where it is granted. Nothing is hidden from anyone who can see the project.
    testId: "ruleset-author-refusal",
  },
};
