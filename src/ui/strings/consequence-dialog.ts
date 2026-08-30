// R-SPINE-060: the ConsequenceDialog pattern's own table. Pattern chrome only, and act-agnostic —
// every act-specific word arrives in the Consequence's own data or as the act-type identifier, so
// one dialog serves every act without a second table per act (B-17). Copy fixed verbatim by
// docs/design/consequence-dialog.md § 3.
export const consequenceDialog = {
  consequence_dialog_title: "What this act changes",
  consequence_dialog_hint: "Computed from the project as it stands. Confirming commits exactly what is shown and nothing else.",
  consequence_dialog_before_label: "Before",
  consequence_dialog_after_label: "After",
  consequence_dialog_none: "none",
  consequence_dialog_digest_label: "Consequence digest",
  consequence_dialog_stale: "The project changed while you were deciding, so nothing was committed. What is shown below was recomputed just now, and confirming carries the new digest.",
  consequence_dialog_confirm: "Confirm",
  consequence_dialog_cancel: "Cancel",
  consequence_dialog_close: "Close",
} as const;

// R-SPINE-060's per-module convention is that a table file's DESIGNATED export is the one named for
// its basename, and this file's basename is not an identifier. The table is therefore published
// under both names: the identifier `index.ts` aggregates it by, and the basename the convention
// designates. One table, two names for it — never two tables.
export { consequenceDialog as "consequence-dialog" };
