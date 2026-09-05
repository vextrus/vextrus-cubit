// R-UI-050's matrix for the job pattern's two surfaces, in the one enumerable place a suite reflects
// over (B-19): the clause is checkable rather than aspirational, so a state a surface never declares
// is a failing test and never a review note — and prose in a Design Decision cannot be where it
// lives. docs/design/job-timeline.md § 3 and docs/design/shell-top-bar.md § 2 rule each cell; this is
// those rulings in a form a test can walk.
//
// A cell says one of three things and is never silent: the state is rendered here, it is handed to a
// module outside this surface, or it cannot arise and says why. "Impossible" is a claim with a reason
// attached, which is what makes it reviewable. The cell shape is the shell matrix's, in the register
// the clause itself uses — its own kebab names, from their one home.
import type { ScreenStateName } from "../../screen-states/contract";

/** What a surface declares about one state. */
export type JobStateCell =
  | {
      readonly declared: "rendered";
      /** The module that paints it, repo-relative. */
      readonly by: string;
      /** The hook a journey reads it at, or null for a state with no id of its own. */
      readonly testId: string | null;
    }
  | {
      readonly declared: "delegated";
      /** The module that owns the state instead, repo-relative. */
      readonly to: string;
      readonly why: string;
    }
  | { readonly declared: "impossible"; readonly why: string };

/** One surface's seven, total over the clause's roster by type — a missing cell cannot compile. */
export type JobStateRow = Readonly<Record<ScreenStateName, JobStateCell>>;

const TIMELINE_MODULE = "src/ui/patterns/job-timeline/job-timeline.tsx";
const TRAY_MODULE = "src/ui/shell/jobs-tray/jobs-tray.tsx";
const REFUSAL_RENDERER = "src/ui/patterns/refusal-state/refusal-state.tsx";

/** R-UI-020's one renderer answers every refusal on both surfaces; neither keeps a block of its own. */
const REFUSAL_DELEGATED = {
  declared: "delegated",
  to: REFUSAL_RENDERER,
  why: "a refusal is answered by the one RefusalState, carrying the registered code, message, remedy and the step's evidence (R-UI-020, B-17)",
} as const;

/** The tray lists a job, the screen that started it answers for it (docs/design/shell-top-bar.md § 2). */
const ANSWERED_INLINE = (why: string) => ({ declared: "delegated", to: TIMELINE_MODULE, why }) as const;

/** No request this pattern makes can be refused for want of a permission (I-114). */
const PERMISSION_DENIED = {
  declared: "impossible",
  why: "the register holds the jobs this tab started under this session: there is no other reader's job to be denied, and a workspace the session does not hold never reaches the frame (shell I-17)",
} as const;

export const JOB_TIMELINE_STATES: Readonly<Record<string, JobStateRow>> = {
  "job-timeline": {
    // The steps are the operation's own progress; only the timing a frame has not carried yet is a
    // bone, and it is the Skeleton's own id, which belongs to that primitive rather than here.
    loading: { declared: "rendered", by: TIMELINE_MODULE, testId: null },
    empty: { declared: "rendered", by: TIMELINE_MODULE, testId: "job-timeline-idle" },
    error: { declared: "rendered", by: TIMELINE_MODULE, testId: "job-timeline-step-fault" },
    refusal: REFUSAL_DELEGATED,
    partial: { declared: "rendered", by: TIMELINE_MODULE, testId: "job-timeline-step" },
    offline: { declared: "rendered", by: TIMELINE_MODULE, testId: "job-timeline-transport-lost" },
    "permission-denied": PERMISSION_DENIED,
  },
  "jobs-tray": {
    loading: { declared: "rendered", by: TRAY_MODULE, testId: null },
    empty: { declared: "rendered", by: TRAY_MODULE, testId: "shell-jobs-tray-empty" },
    error: ANSWERED_INLINE("a failed job stands in the list as Failed; its fault id, evidence and the way to try again are the inline timeline's error cell (job-timeline I-110)"),
    refusal: REFUSAL_DELEGATED,
    partial: { declared: "rendered", by: TRAY_MODULE, testId: "shell-jobs-tray-item" },
    offline: ANSWERED_INLINE("the tray holds no data of its own that ages; a job whose transport is gone keeps its last status while the screen that started it says so in words (I-111)"),
    "permission-denied": PERMISSION_DENIED,
  },
};
