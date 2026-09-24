// The rooms panel's words (viewer.md Part 7, I-687): the viewer's left column, under the
// views/grid panel, where a plan's rooms are confirmed with their names and types. The panel lives in
// `src/modules/takeoff/rooms-ui`, which mirrors these sentences verbatim (`copy.ts`, pinned by
// tests/takeoff/rooms-ui/copy-mirror.test.ts) because a module may not import this layer (ARCH-01).
export const rooms = {
  rooms_heading: "Rooms",
  rooms_loading: "Reading the rooms.",
  rooms_unread: "This drawing has not been read yet, so no room stands on it.",
  rooms_empty: "The plans of this drawing enclose no room the product could read.",
  rooms_failed: "The rooms could not be read.",
  rooms_retry: "Read again",
  rooms_plan_counts: "{rooms} rooms · {confirmed} confirmed · {untyped} to type",
  rooms_group_label: "Rooms on {caption}",
  rooms_group_count_one: "1 room, named and typed from its label",
  rooms_group_count_many: "{count} rooms, named and typed from their labels",
  rooms_basis_label: "From its label",
  rooms_basis_model: "Proposed by Jev, {confidence} % sure",
  rooms_basis_model_unsure: "Proposed by Jev",
  rooms_basis_person: "Typed by a person",
  rooms_confirmed: "Confirmed",
  rooms_untyped_unasked: "No type read from its label; Jev has not answered yet",
  rooms_untyped_none: "Jev read no type in its label",
  rooms_type_field: "Type for {name}",
  rooms_type_placeholder: "Choose a type",
  rooms_type_confirm: "Preview",
  rooms_refused_heading: "Not rooms a finish is measured in",
  rooms_area: "{area} m²",
  rooms_unnamed: "Unnamed region",
  rooms_asking: "Asking Jev about {count} rooms whose labels name no type.",
  rooms_offline: "Nothing was previewed: the connection to the product is gone.",
  rooms_denied_permission: "Confirming rooms needs the MEASURE permission on this project, and your account does not hold it.",
  rooms_denied_holder: "This project's principals and measurers hold it; a principal grants it on the participants screen.",
} as const;
