// These two screens' copy, fixed verbatim by docs/design/s-drawings-sets.md § 3 (the ruleset I-24
// precedent: copy lives beside the page it is written for, keyed, never inline in JSX). One table
// serves the sets index and the set browser.
//
// Digests, sha256 values, ordinals, drawing names and the act type are data and render verbatim as
// data (I-25's class), so no sentence here weaves one in; the registered refusals' own words belong
// to the register.
export const sets = {
  sets_heading: "Drawing sets",
  sets_caption: "A set names the drawings a campaign measures. Pinning a set records exactly which revision of each drawing it holds.",
  sets_drawings_link: "Open this project's drawings",
  sets_sets_link: "See this project's sets",
  sets_create_heading: "Create a set",
  sets_create_hint: "Give the set a name no other set of this project carries. Which drawings it names is chosen on the set itself.",
  sets_name_label: "Set name",
  sets_create_submit: "Create set",
  sets_create_pending: "Creating the set…",
  sets_list_heading: "Sets",
  sets_list_hint: "Newest set first. The digest fingerprints the revision each set stands pinned at.",
  sets_row_members: "{count} drawings",
  sets_row_revisions: "{count} pinned revisions",
  sets_row_digest_label: "Current digest",
  sets_row_digest_none: "Not pinned yet",
  sets_open: "Open set",
  sets_empty_heading: "No sets yet",
  sets_empty_body: "A set names the drawings a campaign measures. Name the first one above, then choose its drawings on the set itself.",
  sets_empty_action: "Name the first set",
  sets_set_caption: "Choose the drawings this set names, then pin it to record the revision each one stands at.",
  sets_members_heading: "Drawings in this set",
  sets_members_hint: "Every drawing this project holds is listed, whether or not the set names it. A drawing brings its sheets with it.",
  sets_members_none: "This project holds no drawings yet, so there is nothing here for this set to name.",
  sets_revision_count: "{count} revisions",
  sets_revision_current: "Current",
  sets_revision_superseded: "Superseded",
  sets_member_add: "Add to set",
  sets_member_remove: "Remove from set",
  sets_member_add_label: "Add {drawing} to this set",
  sets_member_remove_label: "Remove {drawing} from this set",
  sets_pin_heading: "Pin this set",
  sets_pin_hint:
    "Pinning records a set revision: every member with the revision it stands at now, and a digest of that list. What is already pinned never changes.",
  sets_pin_submit: "Preview this pin",
  sets_pin_pending: "Working out what this pin would record…",
  sets_revisions_heading: "Pinned revisions",
  sets_revisions_hint:
    "Newest first. A pinned revision cites every member it held — including a drawing the set no longer names, and the revision a member stood at then — and never changes afterwards.",
  sets_revisions_none: "This set has never been pinned, so it cites nothing yet.",
  sets_revision_digest_label: "Manifest digest",
  sets_empty_no_drawings_heading: "No drawings to name yet",
  sets_empty_no_drawings_body:
    "This project holds no drawings, so this set can name none. Add one on the drawings screen; it is listed here as soon as it is stored.",
  sets_empty_no_revisions_heading: "Nothing pinned yet",
  sets_empty_no_revisions_body:
    "Add drawings to this set, then pin it. Pinning records the revision each member stands at, and that record never changes.",
  sets_empty_no_members_heading: "This set names no drawings now",
  sets_empty_no_members_body: "Its pinned revisions stand exactly as they were pinned. Add at least one drawing before pinning this set again.",
  sets_denied_permission:
    "Creating a set, changing what it names and pinning it need the PIN_SET permission on this project, and your account does not hold it.",
  sets_denied_holder: "This project's principals and leads hold it; a principal grants it on the participants screen.",
  sets_evidence_participants: "Open the project's participants",
  sets_evidence_reload: "Reload this project's sets",
  sets_evidence_set: "Reload this set",
} as const;
