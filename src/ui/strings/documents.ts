// S-Documents' copy (docs/design/s-documents.md §3, R-SPINE-060). Every sentence a reader meets on
// the project's issued-documents list lives here and nowhere else — the screen, its states and the
// matrix cell that declares them all read these keys, so the words cannot drift into two spellings.
//
// Voice: calm, concrete, professional. No build vocabulary — a document is issued and published,
// never "stored", "rendered under a pin" or "digested" — and no identifier is woven into a sentence
// (R-UI-082 keeps uuids, digests and act ids inside IdChip).
export const documents = {
  documents_title: "Documents",

  // The count readout, in its two forms: a list of one says so in words rather than in arithmetic.
  documents_count_one: "1 document",
  documents_count_other: "{count} documents",

  documents_grid_label: "Issued documents",
  documents_col_kind: "Kind",
  documents_col_version: "Version",
  documents_col_issued_by: "Issued by",
  documents_col_digest: "Digest",
  documents_col_acts: "Acts cited",
  documents_col_superseded: "Superseded by",
  documents_col_document: "Document",

  /** The kinds SEAM-DOC issues today, read as words (I-260). A kind with no line here humanises. */
  documents_kind_proof: "Proof",

  // I-261: a live issue says it is live. An empty cell would leave a reader to infer it from a hole.
  documents_current: "Current",
  // I-262: two act chips and then the count of the rest — a cell never wraps, and a tooltip full of
  // identifiers teaches nothing.
  documents_acts_more: "+{count} more",
  // An issue citing no act says so in words: a bare dash in this cell would read as a figure nobody
  // filled in, where what is true is that the document stands on no committed act (R-UI-020).
  documents_no_acts: "No acts cited",

  documents_open: "Open PDF",
  documents_open_label: "Open {kind} version {version} as a PDF",

  documents_empty_heading: "No document issued yet",
  documents_empty_body:
    "An issued document seals a published figure, the basis behind it and the acts that committed it into a PDF that never changes. Publish from the takeoff register, and every issue appears here, newest first.",
  documents_empty_action: "Go to the takeoff register",

  documents_error_heading: "The documents could not be listed",
  documents_error_body: "Nothing was changed. Try again, and quote the report id if it keeps happening.",
  documents_report_label: "Report id",
  documents_retry: "Try again",

  /** Where a refusal met on the way to a document sends a reader back to (R-UI-020's evidence link). */
  documents_evidence_list: "Open the documents list",

  // The three cells R-UI-050 asks of this screen that no reader can reach on it: the matrix declares
  // them, and their words are this screen's own rather than sentences the matrix wrote for it (C-13).
  documents_state_partial:
    "The list is one read answered whole: every issue this project holds is shown, and a row that could not be read would be the read failing, not a row refusing.",
  documents_denied_permission: "Reading this project's documents needs membership of the project.",
  documents_denied_holder: "A project principal can add you on the participants screen.",
} as const;
