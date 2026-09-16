// V-E2E's per-screen moderate budget (AM-09 §4; R-UI-012 read as the checkpoint enforces it).
//
// Serious and critical violations BLOCK — an accessibility failure at a checkpoint is a failure of
// the screen, not a note for later, and that has not changed. What is new is the tier below it.
// `moderate` findings used to be attached and forgotten: nothing read them, so the count on a screen
// could climb for a year and no run went red. A budget per screen is the smallest instrument that
// stops that without turning today's tree red at once — the screen may carry the moderates it
// carries, and it may never carry MORE than it did the day the budget was recorded.
//
// WHAT `null` MEANT, AND WHY IT IS GONE (2026-09-12). Every one of the seventy entries was `null`,
// `moderateBudgetFor` returned `null` for a checkpoint this file had never heard of too, and
// `checkpoint.ts` gated the assertion on `budget !== null`. Naming a checkpoint here and omitting it
// were therefore byte-identical outcomes, no test asserted that a checkpoint appeared at all, and
// the registry was a no-op with a docblock — the same disease it was written to cure, one level up.
//
// THE READING THIS FILE NOW TAKES, stated once: every named checkpoint carries a NUMBER, and a
// checkpoint this file does not name is a FAILURE rather than a silent pass. The seventy numbers are
// seeded at 0 — the strictest reading — because no run's moderate counts were readable when the
// nulls were removed, and a budget invented without a reading is worse than a zero that a real run
// corrects. The first run that finds a moderate finding fails on it, and the fix is one of two
// commits: the finding is repaired, or the number is raised with the reading and the reason in the
// commit that raises it.
//
// HOW TO SEED. Run the lane with `CUBIT_AXE_BUDGET_SEED=1`; each checkpoint writes its observed
// moderate count to `test-results/axe-budget.seed.json`, and those numbers are pasted here in one
// commit whose subject names the run they came from. A screen added by another node is added here in
// the same commit that adds the checkpoint — that is the point of failing on an unnamed one.
//
// A budget is a CEILING TO LOWER, never a target: a fix that takes a screen to zero takes its budget
// with it in the same commit.

/** checkpoint name -> the moderate violations that screen is allowed. Every entry is a number. */
export const AXE_MODERATE_BUDGET: Readonly<Record<string, number>> = Object.freeze({
  "accept": 0,
  "certificate": 0,
  "contested": 0,
  "grid": 0,
  "held-out": 0,
  "invite-pending": 0,
  "j-000/disciplines-confirmed": 0,
  "j-000/entity-selected": 0,
  "j-000/first-project-on-s-home": 0,
  "j-000/partition-read": 0,
  "j-000/scale-affirmed": 0,
  "j-000/sheet-open": 0,
  "j-000/workspace-named": 0,
  "j-003-consequence-dialog-open": 0,
  "j-003-last-principal-protected": 0,
  "j-003-role-granted": 0,
  "j-003/project-edited": 0,
  "j-003/ruleset-pin-visible": 0,
  "j-010-discipline-confirmed": 0,
  "j-010-jobs-tray-open": 0,
  "j-010-sheets-fanned-out": 0,
  "j-010-sheets-uploaded": 0,
  "j-010-timeline-done": 0,
  "j-010-upload-created": 0,
  "j-010-upload-resumed": 0,
  "j-010-upload-stored": 0,
  "j-011-dark": 0,
  "j-011-deep-link": 0,
  "j-011-deep-link-selection": 0,
  "j-011-inspector-dark": 0,
  "j-011-inspector-hover": 0,
  "j-011-inspector-selected": 0,
  "j-011-layers": 0,
  "j-011-multi-select": 0,
  "j-011-sheet-open": 0,
  "j-011-zoom-pan-fit": 0,
  "j-012-repinned": 0,
  "j-012-revision-added": 0,
  "j-012-set-created": 0,
  "j-012-set-pinned": 0,
  "j-020-scale/affirm-open": 0,
  "j-020-scale/affirmed": 0,
  "j-020-scale/observation": 0,
  "j-020-scale/panel-open": 0,
  "j-020-scale/sheet-card": 0,
  "j-020-snap-glyph": 0,
  "j-020-snap-readout": 0,
  "j-021-column-slice/cited": 0,
  "j-021-column-slice/traced": 0,
  "j-021-palette-open": 0,
  "j-021-shortcut-sheet": 0,
  "j-021/partition-confirm-open": 0,
  "j-021/partition-confirmed": 0,
  "j-021/partition-open": 0,
  "j-021/partition-toggled": 0,
  "j004-shell-dark": 0,
  "j004-shell-deeplink": 0,
  "j004-shell-light": 0,
  "j004-shell-onboarding": 0,
  "j004-shell-tenant-switcher-open": 0,
  "j004-shell-user-menu-open": 0,
  "panel": 0,
  "reaffirmed": 0,
  "remove-refused": 0,
  "s-audit-explorer": 0,
  "s-auth-reset-done": 0,
  "s-auth-sign-up": 0,
  "s-auth-signed-in-sessions": 0,
  "s-project-drawings-via-tab": 0,
  "s-project-home": 0,
  // S-Schedules' two checkpoints (J-032), named here by the acceptance that added them: a checkpoint
  // this file does not name FAILS, so the screen could not be walked at all without these two lines.
  // Zero is the strictest reading and the only honest one before a run — the screen does not exist
  // yet, so no moderate count has been measured. It is raised only by the commit that reads one.
  "s-schedules/tables": 0,
  "s-schedules/transcribed": 0,
  // S-Settings-Ruleset-Author's checkpoints (J-304), named here by the acceptance that added them
  // for the same reason the two above are: a checkpoint this file does not name FAILS, so the screen
  // could not be walked at all without these four lines. Zero is the strictest reading and the only
  // honest one before a run — the screen does not exist yet, so no moderate count has been measured.
  // The light twin is its own checkpoint because it is its own axe run on its own ground (I-RSA-4).
  "s-settings-ruleset-author/authoring-open": 0,
  "s-settings-ruleset-author/authoring-open-light": 0,
  "s-settings-ruleset-author/edition-minted": 0,
  "s-settings-ruleset-author/value-changed": 0,
  "s-takeoff/measure-queued": 0,
  "s-takeoff/register": 0,
  "stack": 0,
  "switched": 0,
});

/**
 * The budget a checkpoint is judged against, or `undefined` where this file has never heard of it.
 * `undefined` is not "no budget": the caller fails on it by name, which is what makes adding a
 * checkpoint without recording its budget impossible to do by accident.
 */
export function moderateBudgetFor(checkpoint: string): number | undefined {
  return Object.prototype.hasOwnProperty.call(AXE_MODERATE_BUDGET, checkpoint) ? AXE_MODERATE_BUDGET[checkpoint] : undefined;
}
