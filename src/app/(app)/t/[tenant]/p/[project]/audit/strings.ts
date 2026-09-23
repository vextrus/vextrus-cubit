// C-SPINE-PLATFORM: this screen's copy, and all of it — the sections carry no string literal of
// their own beyond test ids and fixed attribute values. The keys read `audit_…`, under the same
// discipline as the tables in `src/ui/strings/*` (Design Decision I-24).
//
// Digests and subject keys are model data: they stay whole as data and are never woven into a
// sentence here (I-25). An act type is read in words through EnumLabel, and a subject by what its
// key names (I-38, I-347) — the words a subject chip may need are this table's.
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

  audit_col_type: "Act type",
  audit_col_actor: "Actor",
  audit_col_occurred: "Occurred",
  audit_consequence_label: "Consequence",
  audit_evidence_label: "Cited evidence",

  audit_subject_proposed_level: "Proposed level {n}",
  audit_subject_model_space: "Model space",
  audit_subject_repeated: "{name} ×{count}",
  audit_subject_more: "+{count}",

  audit_empty_none_heading: "No acts recorded yet",
  audit_empty_none_body: "Acts are recorded here the moment they are committed anywhere in this project — there is nothing to set up.",
  audit_empty_filtered_heading: "No acts match these filters",
  audit_empty_filtered_body: "Every act stays recorded — clear a filter to see the rest.",
  audit_empty_clear: "Clear filters",

  audit_ledger_heading: "Model ledger",
  audit_ledger_disarmed:
    "This installation does not record model calls yet, so there is nothing to list. When it does, every call appears here with its cost and outcome.",
  audit_ledger_count_caption: "recorded model calls",

  audit_ledger_col_call: "Call",
  audit_ledger_col_question: "Question",
  audit_ledger_col_model: "Model",
  audit_ledger_col_transport: "Transport",
  audit_ledger_col_outcome: "Outcome",
  audit_ledger_col_confidence: "Confidence",
  audit_ledger_col_tokens: "Tokens in / out",
  audit_ledger_col_cost: "Cost",
  audit_ledger_col_called: "Called",
  audit_ledger_outcome_awaiting: "Awaiting a person",
  audit_ledger_no_confidence: "—",
  audit_ledger_calibration_heading: "Calibration by question",
  audit_ledger_calibration_counts: "{proposed} proposed · {confirmed} confirmed · {overruled} overruled · {repudiated} repudiated · {affirmed} affirmed · {awaiting} awaiting a person · {refused} refused",
  audit_ledger_calibration_confidence: "Confidence {right} when a person agreed, {wrong} when a person did not.",
  audit_ledger_calibration_confidence_partial: "Confidence {stated} where a person has judged; the other side has no figure yet.",
  audit_ledger_calibration_no_confidence: "No judged call stated a confidence.",

  audit_jobs_heading: "Jobs",
  audit_jobs_disarmed: "Job history is not kept per project yet, so none is listed here.",
  audit_jobs_count_caption: "recorded jobs",
} as const;
