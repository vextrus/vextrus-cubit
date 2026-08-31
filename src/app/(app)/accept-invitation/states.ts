// R-UI-050's matrix for the accept-invitation screen, in the one enumerable place a suite reflects
// over (B-19). A cell says one of three things and is never silent: the state is rendered here, it
// is handed to a module outside this screen, or it cannot arise on this screen and says why.
// "Impossible" is a claim with a reason attached, which is what makes it reviewable.
import type { ShellStateCell, ShellStateName } from "../../../ui/shell/states";
import { strings } from "../../../ui/strings";

/** This screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/accept-invitation";

export const ACCEPT_INVITATION_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  // Bones that keep the screen's shape, hidden from the accessibility tree by the primitive itself.
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: null },
  empty: {
    declared: "rendered",
    // An address with no link behind it: nobody presented anything, so there is nothing to refuse
    // and nothing to submit. The screen teaches what is missing instead (R-UI-020).
    by: `${ROUTE}/accept-invitation-form.tsx`,
    testId: null,
  },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id; a read or a move that faults rather than refuses surfaces there as the unmarked fault it is",
  },
  refusal: {
    declared: "rendered",
    by: `${ROUTE}/accept-invitation-form.tsx`,
    testId: "accept-invitation-refusal",
  },
  partial: {
    declared: "impossible",
    // One action, one answer: the shared matrix sentence for a screen with a single read (C-13 —
    // a "cannot arise" reason is the matrix's own copy, not a sentence this route commits).
    why: strings.state_partial_one_answer,
  },
  offline: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "I-20: the screen is server-rendered and holds no data that can age, so unreachability surfaces as the error state — never an invented banner",
  },
  permissionDenied: {
    declared: "delegated",
    to: "src/app/(app)/layout.tsx",
    why: "the screen is behind the session door of the (app) group: a request carrying no live session is redirected to /sign-in before this route mounts, which is the remedy an ended session needs rather than a permission answer. Holding a claimable token is not a permission this screen withholds — a token it cannot claim is the registered refusal above",
  },
};
