// R-UI-050's matrix for the workspace members screen, in the one enumerable place a suite reflects
// over (B-19). A cell says one of three things and is never silent: the state is rendered here, it
// is handed to a module outside this screen, or it cannot arise on this screen and says why.
// "Impossible" is a claim with a reason attached, which is what makes it reviewable.
import type { ShellStateCell, ShellStateName } from "../../../../../../ui/shell/states";
import { membersStrings } from "./strings";

/** This screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/t/[tenant]/settings/members";

export const MEMBERS_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  // Bones that keep the page's shape, hidden from the accessibility tree by the primitive itself.
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: null },
  empty: {
    declared: "impossible",
    // The screen's own committed sentence, said once (C-13): seeing the roster is itself a
    // permission, so `membersOf` refuses a stranger rather than answering an empty list.
    why: membersStrings.members_empty_reader,
  },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id; a read or a move that faults rather than refuses surfaces there as the unmarked fault it is",
  },
  refusal: {
    declared: "rendered",
    by: `${ROUTE}/members-section.tsx`,
    testId: "members-refusal",
  },
  partial: {
    declared: "impossible",
    // I-59: the read is scoped rather than partial — no row the module answered is withheld.
    why: membersStrings.members_partial_scope,
  },
  offline: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "I-20: the page is server-rendered and holds no data that can age, so unreachability surfaces as the error state — never an invented banner",
  },
  permissionDenied: {
    declared: "delegated",
    to: "src/app/(app)/t/[tenant]/layout.tsx",
    why: "a request for a workspace the session does not hold meets the shell's frameless denial before this route mounts; a member whose role does not carry a move is refused in place instead, through the answer slot above, never by hiding the control (R-SPINE-006)",
  },
};
