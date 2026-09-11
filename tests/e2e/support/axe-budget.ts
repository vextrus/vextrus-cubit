// V-E2E's per-screen moderate budget (AM-09 §4; R-UI-012 read as the checkpoint enforces it).
//
// Serious and critical violations BLOCK — an accessibility failure at a checkpoint is a failure of
// the screen, not a note for later, and that has not changed. What is new is the tier below it.
// `moderate` findings used to be attached and forgotten: nothing read them, so the count on a screen
// could climb for a year and no run went red. A budget per screen is the smallest instrument that
// stops that without turning today's tree red at once — the screen may carry the moderates it
// carries, and it may never carry MORE than it did the day the budget was recorded.
//
// A number is a SEEDED budget: the moderate count observed on that screen, recorded, and enforced.
// `null` is UNSEEDED: the checkpoint is known to exist, its count is attached and printed, and it
// is enforced against nothing — a budget invented without a reading would be a number with no
// evidence behind it, which is the defect this file exists to prevent, not an instance of it.
//
// HOW TO SEED. Run the lane with `CUBIT_AXE_BUDGET_SEED=1`; each checkpoint writes its observed
// moderate count to `test-results/axe-budget.seed.json`, and those numbers are pasted here in one
// commit whose subject names the run they came from. A checkpoint this file does not name at all is
// treated as unseeded, so a screen added by another node is recorded rather than refused.
//
// A budget is a CEILING TO LOWER, never a target: a fix that takes a screen to zero takes its budget
// with it in the same commit.

/** checkpoint name -> the moderate violations that screen is allowed, or null when unseeded. */
export const AXE_MODERATE_BUDGET: Readonly<Record<string, number | null>> = Object.freeze({
  "accept": null,
  "certificate": null,
  "grid": null,
  "held-out": null,
  "invite-pending": null,
  "j-000/entity-selected": null,
  "j-000/first-project-on-s-home": null,
  "j-000/sheet-open": null,
  "j-000/workspace-named": null,
  "j-003-consequence-dialog-open": null,
  "j-003-last-principal-protected": null,
  "j-003-role-granted": null,
  "j-003/project-edited": null,
  "j-003/ruleset-pin-visible": null,
  "j-010-discipline-confirmed": null,
  "j-010-jobs-tray-open": null,
  "j-010-sheets-fanned-out": null,
  "j-010-sheets-uploaded": null,
  "j-010-timeline-done": null,
  "j-010-upload-created": null,
  "j-010-upload-resumed": null,
  "j-010-upload-stored": null,
  "j-011-dark": null,
  "j-011-deep-link": null,
  "j-011-deep-link-selection": null,
  "j-011-inspector-dark": null,
  "j-011-inspector-hover": null,
  "j-011-inspector-selected": null,
  "j-011-layers": null,
  "j-011-multi-select": null,
  "j-011-sheet-open": null,
  "j-011-zoom-pan-fit": null,
  "j-012-repinned": null,
  "j-012-revision-added": null,
  "j-012-set-created": null,
  "j-012-set-pinned": null,
  "j-020-scale/affirm-open": null,
  "j-020-scale/affirmed": null,
  "j-020-scale/observation": null,
  "j-020-scale/panel-open": null,
  "j-020-scale/sheet-card": null,
  "j-020-snap-glyph": null,
  "j-020-snap-readout": null,
  "j-021-column-slice/cited": null,
  "j-021-column-slice/traced": null,
  "j-021-palette-open": null,
  "j-021-shortcut-sheet": null,
  "j-021/partition-confirm-open": null,
  "j-021/partition-confirmed": null,
  "j-021/partition-open": null,
  "j-021/partition-toggled": null,
  "j004-shell-dark": null,
  "j004-shell-deeplink": null,
  "j004-shell-light": null,
  "j004-shell-onboarding": null,
  "j004-shell-tenant-switcher-open": null,
  "j004-shell-user-menu-open": null,
  "panel": null,
  "remove-refused": null,
  "s-audit-explorer": null,
  "s-auth-reset-done": null,
  "s-auth-sign-up": null,
  "s-auth-signed-in-sessions": null,
  "s-project-drawings-via-tab": null,
  "s-project-home": null,
  "s-takeoff/measure-queued": null,
  "s-takeoff/register": null,
  "switched": null,
});

/** What a screen this file does not name is judged against: nothing, and it says so. */
export function moderateBudgetFor(checkpoint: string): number | null {
  return Object.prototype.hasOwnProperty.call(AXE_MODERATE_BUDGET, checkpoint) ? (AXE_MODERATE_BUDGET[checkpoint] ?? null) : null;
}
