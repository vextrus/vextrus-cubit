// R-UI-050's matrix for the grown Projects home, in the one enumerable place a suite reflects over
// (B-19). A cell says one of three things and is never silent: the state is rendered here, it is
// handed to a module outside this screen, or it cannot arise on this screen and says why.
// "Impossible" is a claim with a reason attached, which is what makes it reviewable.
//
// The shell's own matrix declared this area around `ShellEmptyState`, which is still the empty
// branch, so that declaration stays true and is left alone; this is the grown screen's own.
import type { ShellStateCell, ShellStateName } from "../../../../../ui/shell/states";

/** This screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/t/[tenant]";

export const HOME_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  loading: {
    declared: "delegated",
    to: `${ROUTE}/loading.tsx`,
    why: "the shipped route-level skeletons keep the frame and the page's shape while the workspace's projects are read; this screen adds no second loading surface",
  },
  // R-UI-033's teaching branch: a workspace with no projects is shown what to do next, and the one
  // offer is the SAMPLE set. No grid and no documents region paint beside it.
  empty: { declared: "rendered", by: `${ROUTE}/projects-onboarding.tsx`, testId: "shell-empty" },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id",
  },
  // The form's answer slot and the card's in-place refusal, both through the one renderer: a
  // lifecycle door taken by somebody holding no participation answers PERMISSION_NOT_HELD, and a
  // submission made after a session ended answers SIGNED_OUT (L-ACT-03, ARCH-03).
  refusal: { declared: "rendered", by: `${ROUTE}/home/project-form.tsx`, testId: "project-form-refusal" },
  partial: {
    declared: "impossible",
    why: "projectsForHome answers one query whole — the grid holds no row that can be refused while its neighbours stand",
  },
  offline: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "I-20: the page is server-rendered and holds no data that can age, so unreachability surfaces as the error state — never an invented banner",
  },
  permissionDenied: {
    declared: "delegated",
    to: `${ROUTE}/layout.tsx`,
    why: "the workspace guard renders the frameless denial surface before this page mounts, and redirects an ended session to /sign-in (R-UI-030)",
  },
};
