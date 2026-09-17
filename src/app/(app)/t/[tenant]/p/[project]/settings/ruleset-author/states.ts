// R-UI-050's matrix for the Author edition screen, in the one enumerable place a suite reflects
// over (B-19). A cell says one of three things and is never silent: the state is rendered here, it
// is handed to a module outside this screen, or it cannot arise on this screen and says why.
// "Impossible" is a claim with a reason attached, which is what makes it reviewable.
import type { ShellStateCell, ShellStateName } from "@/ui/shell/states";

/** This screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/t/[tenant]/p/[project]/settings/ruleset-author";

export const RULESET_AUTHOR_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  // Bones that keep the page's shape, hidden from the accessibility tree by the primitive itself.
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: null },
  empty: {
    declared: "rendered",
    by: `${ROUTE}/ruleset-author-section.tsx`,
    // A project that pins nothing has nothing to fork, so the empty leg teaches where a pin comes
    // from and leads back to the screen that shows it — never an empty grid (R-UI-050).
    testId: "ruleset-unpinned",
  },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id; the settings nav survives the fault, so a reader can leave by another area",
  },
  refusal: {
    declared: "rendered",
    by: `${ROUTE}/ruleset-author-section.tsx`,
    testId: "ruleset-author-refusal",
  },
  partial: {
    declared: "impossible",
    why: "the pin is one immutable row read as one document, so every parameter of it is answered or none is — there are no refusable rows and no row is ever hidden (I-264)",
  },
  offline: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "I-20: the page is server-rendered and holds no figure that can age, so unreachability surfaces as the error state — never an invented banner",
  },
  permissionDenied: {
    declared: "rendered",
    by: `${ROUTE}/ruleset-author-section.tsx`,
    // I-266: the whole screen stands for a reader without AUTHOR_RULE_SET — the door is disabled
    // and described by the standing PERMISSION_NOT_HELD entry, never hidden (R-SPINE-006).
    testId: "ruleset-author-refusal",
  },
};
