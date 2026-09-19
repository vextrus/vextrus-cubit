// R-UI-050's matrix for the Site facts panel (docs/design/s-settings-site-facts.md § 2), in the one
// enumerable place a suite reflects over (B-19). A cell says one of three things and is never silent:
// the state is rendered here, it is handed to a surface outside this panel, or it cannot arise — and
// then it says why.
//
// The cell shape is the shell's; ARCH-01 bars this module from importing `src/ui`, so the shape is
// declared here in the same words rather than imported, and the app tier's own matrices are typed by
// the shell's copy of it (`ShellStateCell`). The two are the same five fields and are checked against
// each other where the screen is mounted.

/** R-UI-050's roster, in the clause's own order and in the key form a matrix files a cell under. */
export const SITE_FACTS_STATE_NAMES = ["loading", "empty", "error", "refusal", "partial", "offline", "permissionDenied"] as const;

/** One state of the clause's roster. */
export type SiteFactsStateName = (typeof SITE_FACTS_STATE_NAMES)[number];

/** What the panel declares about one state — the shell's own three arms (`@/ui/shell/states`). */
export type SiteFactsStateCell =
  | { readonly declared: "rendered"; readonly by: string; readonly testId: string | null }
  | { readonly declared: "delegated"; readonly to: string; readonly why: string }
  | { readonly declared: "impossible"; readonly why: string };

/** What `data-state` on `site-facts` may say (§ 7): the cells the panel itself paints. */
export const SITE_FACTS_SCREEN_STATES = ["loading", "error", "refused", "busy", "ready"] as const;

/** One of the states above — what the panel's own `data-state` is typed by. */
export type SiteFactsScreenState = (typeof SITE_FACTS_SCREEN_STATES)[number];

/** The panel's own home, spelled once: every cell that names a file of it starts here. */
const PANEL = "src/modules/takeoff/site-facts-ui/index.tsx";
const ROUTE = "src/app/(app)/t/[tenant]/p/[project]/settings/site-facts";

export const SITE_FACTS_STATES: Readonly<Record<SiteFactsStateName, SiteFactsStateCell>> = {
  // Bones that keep the shape the answer will take, hidden from the accessibility tree by the
  // primitive itself — no spinner ever stands on this table (R-UI-004, § 2).
  loading: { declared: "rendered", by: `${ROUTE}/loading.tsx`, testId: null },
  empty: {
    declared: "impossible",
    why: "SITE_FACTS is a compile-time roster of six, and a project that has entered none of them is not empty — it is six named deferrals, which is exactly what the reader needs to read (I-277, I-278)",
  },
  partial: {
    declared: "impossible",
    why: "the store answers the whole ledger or none of it, so no row can be refused BY THE READ; R-UI-050's 'some rows refused: shown, not hidden' is satisfied by construction — an entered fact and a deferred one stand side by side in roster order (I-277)",
  },
  // The row's own deferral for an absent fact, and the panel's slot for a refusal of its own — one
  // RefusalState in both homes, never a toast and never a block of this screen's making (R-UI-020).
  refusal: { declared: "rendered", by: PANEL, testId: "site-facts-row-deferral" },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id; the settings nav survives the fault, so a reader can leave by another area",
  },
  offline: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "I-20: a fault of reachability surfaces the error path or the registered refusal; this panel invents no banner, and no figure ages on screen pretending to be current",
  },
  permissionDenied: {
    declared: "rendered",
    by: PANEL,
    // R-SPINE-006: a reader without AUTHOR_PROJECT_FACT sees the whole panel, every row and every
    // deferral; each door stands shut beside a standing PERMISSION_NOT_HELD naming the act type, the
    // permission and where it is granted. Nothing is hidden from anyone who can see the project.
    testId: "site-facts-refusal",
  },
};
