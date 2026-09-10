// R-UI-050's matrix for the register workspace, in the one enumerable place a suite reflects over
// (B-19). A cell says one of three things and is never silent: the state is rendered here, it is
// handed to a module outside this screen, or it cannot arise on this screen and says why.
import type { ShellStateCell, ShellStateName } from "@/ui/shell/states";

/** This screen's own home, spelled once: every cell that names a file of it starts here. */
const ROUTE = "src/app/(app)/t/[tenant]/p/[project]/takeoff/register";

export const REGISTER_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  // Bones that keep all three regions' shape, hidden from the accessibility tree by the primitive.
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: null },
  // A project with no campaign pinned teaches the one next action; a campaign that has registered
  // nothing says so and leaves the Measure door standing where it already is (Decision § 2).
  empty: { declared: "rendered", by: "src/modules/takeoff/register-ui/index.tsx", testId: "register-empty" },
  error: {
    declared: "rendered",
    by: `${ROUTE}/register-screen.tsx`,
    // This screen holds a read it can re-run, so its own retry stands here with the report id rather
    // than sending a reader to the root boundary for a fault they can clear themselves (R-UI-050).
    testId: "register-retry",
  },
  refusal: {
    declared: "rendered",
    by: "src/modules/takeoff/register-ui/index.tsx",
    // Two surfaces, one renderer: the answer slot for a door's rejection, and each refusal row for a
    // sighting that produced no line (R-UI-020, B-17).
    testId: "refusal-state",
  },
  partial: {
    declared: "rendered",
    by: "src/modules/takeoff/register-ui/index.tsx",
    // Published lines, deferred sightings and refused ones stand together, and a repudiated object's
    // lines stay in the table carrying the word (I-173) — shown, never hidden.
    testId: "register-refusals",
  },
  offline: {
    declared: "rendered",
    by: "src/modules/takeoff/register-ui/index.tsx",
    // s-drawings I-89's condition holds here: the screen carries act doors and a live job timeline,
    // so losing the connection is a state a person is in rather than a fault of reachability.
    testId: "register-workspace",
  },
  permissionDenied: {
    declared: "rendered",
    by: "src/modules/takeoff/register-ui/index.tsx",
    // I-50: reading the register needs only membership, so the whole register still renders and the
    // denial names MEASURE in place — a door that could only refuse is not rendered at all.
    testId: "refusal-state",
  },
};
