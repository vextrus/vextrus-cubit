// R-UI-050's matrix for S-Project, in the one enumerable place a suite reflects over (B-19). A cell
// says one of three things and is never silent: the state is rendered here, it is handed to a module
// outside this screen, or it cannot arise on this screen and says why. "Impossible" is a claim with
// a reason attached, which is what makes it reviewable.
import type { ShellStateCell, ShellStateName } from "@/ui/shell/states";

/** This screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/t/[tenant]/p/[project]";

export const PROJECT_HOME_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  // Bones that keep the page's shape, hidden from the accessibility tree by the primitive itself.
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: null },
  // The screen as a whole cannot be empty — a project always has a name and always holds a principal
  // (R-SPINE-011) — so emptiness is a region's, and each region says why it is empty: the activity
  // list is the one a reader meets on a project nothing has happened on yet.
  empty: { declared: "rendered", by: `${ROUTE}/home/project-home.tsx`, testId: "project-home-activity-empty" },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id",
  },
  // I-129: the participants door is the one door here that refuses, and it refuses in the roster's
  // own place through the one renderer, with the evidence link to the setting that resolves it.
  refusal: { declared: "rendered", by: `${ROUTE}/home/project-home.tsx`, testId: "refusal-state" },
  // The same cell read the other way: this screen composes four independent doors, and a refused
  // roster leaves the header, the areas, the quick actions, the AI cost and the activity answering.
  partial: { declared: "rendered", by: `${ROUTE}/home/project-home.tsx`, testId: "project-home-participants" },
  offline: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "I-20: the page is server-rendered and holds no data that can age, so unreachability surfaces as the error state — never an invented banner",
  },
  // The project-scoped denial is the roster's, in place (I-129). A workspace this session does not
  // hold is refused by the frame before this route mounts, and a project this workspace does not
  // hold is an absent address rather than a refused one (I-130).
  permissionDenied: { declared: "rendered", by: `${ROUTE}/home/project-home.tsx`, testId: "refusal-state" },
};
