// C-SPINE-PLATFORM: this screen's copy, and all of it — the sections carry no string literal of
// their own beyond test ids and fixed attribute values. The keys read `audit_…`, under the same
// discipline as the tables in `src/ui/strings/*` (Design Decision I-24).
//
// Act types, actor ids, subjects and digests are model data: they render verbatim as data and are
// never woven into a sentence here (I-25).
export const auditStrings = {
  audit_heading: "Audit",
  audit_caption: "Every act committed on this project, with its consequence and the evidence it cited.",

  audit_acts_heading: "Act log",
  audit_filter_type_label: "Act type",
  audit_filter_actor_label: "Actor",
  audit_filter_subject_label: "Subject",
  audit_filter_any_type: "All act types",
  audit_filter_any_actor: "All actors",
  audit_count: "{shown} of {total} acts",

  audit_consequence_label: "Consequence",
  audit_evidence_label: "Cited evidence",

  audit_empty_none_heading: "No acts recorded yet",
  audit_empty_none_body: "Acts are recorded here the moment they are committed anywhere in this project — there is nothing to set up.",
  audit_empty_filtered_heading: "No acts match these filters",
  audit_empty_filtered_body: "Every act stays recorded — clear a filter to see the rest.",
  audit_empty_clear: "Clear filters",

  audit_ledger_heading: "Model ledger",
  audit_ledger_disarmed:
    "This installation does not record model calls yet, so there is nothing to list. When it does, every call appears here with its cost and outcome.",
  audit_ledger_count_caption: "recorded model calls",

  audit_jobs_heading: "Jobs",
  audit_jobs_disarmed: "This installation does not run recorded background jobs yet, so there is no history to list. When it does, every job appears here.",
  audit_jobs_count_caption: "recorded jobs",
} as const;
