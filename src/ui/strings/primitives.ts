// R-SPINE-060: the core primitive set's own copy — the words a primitive says on its own behalf,
// never the words a screen says through it. A primitive that invents a sentence at its call site is
// a second string table nobody can enumerate (B-17), and a screen's own copy stays in the screen's
// own table: everything here is chrome — the name of a control, the word on a retry, the sentence a
// filter says when it matches nothing.
export const primitives = {
  primitive_select_placeholder: "Choose",
  primitive_combobox_filter_placeholder: "Filter…",
  primitive_combobox_no_matches: "No matches",
  primitive_combobox_chip_separator: "·",
  primitive_id_chip_copy: "Copy the full value",
  primitive_id_chip_copied: "Copied",
  primitive_breadcrumb_label: "Breadcrumb",
  primitive_breadcrumb_menu: "Show the other places at this level",
  primitive_error_retry: "Try again",
  primitive_error_report: "Report",
  primitive_relative_just_now: "Just now",
  primitive_relative_minutes: "{count} min ago",
  primitive_relative_hours: "{count} h ago",
  primitive_relative_yesterday: "Yesterday",
} as const;
