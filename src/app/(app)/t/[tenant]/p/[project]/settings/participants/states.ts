// R-UI-050's matrix for the project participants screen, in the one enumerable place a suite
// reflects over (B-19). A cell says one of three things and is never silent: the state is rendered
// here, it is handed to a module outside this screen, or it cannot arise on this screen and says
// why. "Impossible" is a claim with a reason attached, which is what makes it reviewable.
import type { ShellStateCell, ShellStateName } from "../../../../../../../../ui/shell/states";

/** This screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/t/[tenant]/p/[project]/settings/participants";

export const PARTICIPANTS_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  // Bones that keep the page's shape, hidden from the accessibility tree by the primitive itself.
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: null },
  empty: {
    declared: "impossible",
    why: "a project holds at least one effective PRINCIPAL at every moment (R-SPINE-011, L-ACT-03), so the roster always has a row, the record always holds the creating grant, and the member picker always holds the session's own account",
  },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id; a re-granted role's uniqueness violation (I-54) surfaces there as the unmarked fault it is",
  },
  refusal: {
    declared: "rendered",
    by: `${ROUTE}/participants-section.tsx`,
    testId: "participants-refusal",
  },
  partial: {
    declared: "impossible",
    why: "one guard answers the whole read (L-ACT-03), so the roster and the record are answered together or refused together — there are no rows that can be refused one by one",
  },
  offline: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "I-20: the page is server-rendered and holds no data that can age, so unreachability surfaces as the error state — never an invented banner",
  },
  permissionDenied: {
    declared: "rendered",
    by: `${ROUTE}/page.tsx`,
    // I-50: the workspace membership holds, so the frame stays and the denial is in-frame — unlike
    // the shell's frameless denial for a workspace the session does not hold at all.
    testId: "participants-refusal",
  },
};
