// R-UI-050's matrix for the Author edition screen, in the one enumerable place a suite reflects over
// (B-19). A cell says one of three things and is never silent: the state is rendered here, it is
// handed to a module outside this screen, or it cannot arise on this screen and says why.
import type { ShellStateCell, ShellStateName } from "@/ui/shell/states";

/** This screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/t/[tenant]/p/[project]/settings/ruleset-author";

export const RULESET_AUTHOR_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  // Bones that keep the shape the answer will take, hidden from the accessibility tree by the
  // primitive itself. The frame and the settings nav survive the wait (§2).
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: null },
  // A project that pins nothing has nothing to fork: the rule-set screen's own teaching, with the
  // way onward to it, and no version field, no grid and no disabled door (§2).
  empty: { declared: "rendered", by: `${ROUTE}/ruleset-author-section.tsx`, testId: "ruleset-unpinned" },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id; the settings nav survives the fault, so a reader can leave by another area",
  },
  // The four codes the act's two doors answer with, all in one slot, one renderer (R-UI-020).
  refusal: { declared: "rendered", by: `${ROUTE}/ruleset-author-section.tsx`, testId: "ruleset-author-refusal" },
  partial: {
    declared: "impossible",
    why: "the pin is one immutable row read as one document, so every parameter of it is answered or none is — there are no refusable rows and no row is ever hidden (I-264)",
  },
  offline: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "I-20: the grid is server-rendered from the pin and holds no figure that can age, so unreachability surfaces as the error state or as the action's own registered refusal — never an invented banner",
  },
  // I-266: the whole screen renders for a reader without AUTHOR_RULE_SET, the door is disarmed, and
  // the standing PERMISSION_NOT_HELD entry names the act type, the permission and who holds it.
  permissionDenied: { declared: "rendered", by: `${ROUTE}/ruleset-author-section.tsx`, testId: "ruleset-author-refusal" },
};
